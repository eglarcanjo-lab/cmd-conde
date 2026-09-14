// Home — Top 20 produtos por volume (média dos 3 meses no mesmo período 01..D-1)
// com a variação vs o mês atual. Mostra quem CAIU e quem SUBIU.
// Dado: GET /api/farol-queda/top-produtos.
import { useState, useEffect } from "react";
import api from "../services/api";

const fmt = (n) => (Number(n) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default function ResumoTopProdutos() {
  const [data, setData] = useState(null);
  const [erro, setErro] = useState("");
  const [esperando, setEsperando] = useState(false);

  useEffect(() => {
    let cancel = false, tent = 0;
    const buscar = () => {
      api.get("/api/farol-queda/top-produtos", { timeout: 18000 })
        .then((r) => { if (!cancel) { setData(r.data); setEsperando(false); } })
        .catch((e) => {
          if (cancel) return;
          const st = e?.response?.status;
          const cold = st === 503 || st === 502 || e?.code === "ECONNABORTED" || !st;
          if (cold && tent < 6) { tent += 1; setEsperando(true); setTimeout(buscar, 8000); }
          else setErro(st ? `HTTP ${st}` : (e?.message || "falha"));
        });
    };
    buscar();
    return () => { cancel = true; };
  }, []);

  if (erro) return null;
  const prods = data?.produtos || [];

  return (
    <div style={S.card}>
      <div style={S.head}>
        <span style={S.title}><span style={{ color: "#7DBA3D" }}>📦</span> Top 20 Produtos · Volume</span>
        {data && <span style={S.sub}>{data.periodo} · vs média 3M ({data.ref_label})</span>}
      </div>

      {!data ? (
        <div style={S.skel}>{esperando ? "Acordando o servidor…" : "Carregando…"}</div>
      ) : !prods.length ? (
        <div style={S.skel}>Sem histórico suficiente — importe o volume dos 3 meses anteriores.</div>
      ) : (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                {["#", "Produto", "Méd 3M", "Atual", "Var (HL)", "Var (%)"].map((h, i) => (
                  <th key={h} style={{ ...S.th, textAlign: i <= 1 ? "left" : "right" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {prods.map((p, i) => {
                const sobe = p.var_hl > 0.001;
                const desce = p.var_hl < -0.001;
                const cor = sobe ? "#4ade80" : desce ? "#ef6f6f" : "rgba(255,255,255,0.55)";
                const seta = sobe ? "▲" : desce ? "▼" : "—";
                return (
                  <tr key={p.cod_produto} style={i % 2 ? S.trAlt : undefined}>
                    <td style={{ ...S.td, color: "rgba(255,255,255,0.35)" }}>{i + 1}</td>
                    <td style={{ ...S.td, color: "#fff", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={`${p.nome_produto} (${p.cod_produto})`}>{p.nome_produto}</td>
                    <td style={{ ...S.td, textAlign: "right" }}>{fmt(p.media)}</td>
                    <td style={{ ...S.td, textAlign: "right", fontWeight: 600 }}>{fmt(p.atual)}</td>
                    <td style={{ ...S.td, textAlign: "right", color: cor }}>{seta} {fmt(Math.abs(p.var_hl))}</td>
                    <td style={{ ...S.td, textAlign: "right", color: cor, fontWeight: 700 }}>{p.var_pct > 0 ? "+" : ""}{p.var_pct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const S = {
  card: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "12px 14px", marginBottom: "16px" },
  head: { display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap", marginBottom: "8px" },
  title: { color: "#fff", fontWeight: "600", fontSize: "1.05rem", display: "flex", alignItems: "center", gap: "7px" },
  sub: { color: "rgba(255,255,255,0.4)", fontSize: "0.76rem" },
  skel: { color: "rgba(255,255,255,0.35)", fontSize: "0.9rem", padding: "10px 2px" },
  tableWrap: { overflowX: "auto", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.06)" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" },
  th: { padding: "8px 10px", color: "rgba(255,255,255,0.45)", fontWeight: "600", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.03em", borderBottom: "1px solid rgba(255,255,255,0.1)", whiteSpace: "nowrap", background: "rgba(255,255,255,0.03)" },
  td: { padding: "7px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.8)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" },
  trAlt: { background: "rgba(255,255,255,0.02)" },
};
