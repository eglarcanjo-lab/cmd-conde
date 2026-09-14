// Home — Top 20 PDVs por volume (média dos 3 meses no mesmo período 01..D-1) com a
// variação vs o mês atual. Abas Todos / AS (101–103) / Rota (demais). Sobe e desce.
// Dado: GET /api/farol-queda/top-pdvs.
import { useState, useEffect } from "react";
import api from "../services/api";

const fmt = (n) => (Number(n) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default function ResumoTopPDVs() {
  const [data, setData] = useState(null);
  const [erro, setErro] = useState("");
  const [esperando, setEsperando] = useState(false);
  const [aba, setAba] = useState("todos"); // todos | as | rota

  useEffect(() => {
    let cancel = false, tent = 0;
    const buscar = () => {
      api.get("/api/farol-queda/top-pdvs", { timeout: 18000 })
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
  const lista = data ? (data[aba] || []) : [];

  return (
    <div style={S.card}>
      <div style={S.head}>
        <span style={S.title}><span style={{ color: "#7DBA3D" }}>🗺️</span> Top 20 PDVs — <span style={{ color: "#7DBA3D" }}>média 3M</span></span>
        {data && <span style={S.sub}>média {data.ref_label} · GAP dia {data.periodo}</span>}
      </div>

      <div style={S.tabs}>
        {[["todos", "Todos"], ["as", "AS"], ["rota", "Rota"]].map(([id, lbl]) => (
          <button key={id} style={aba === id ? S.tabOn : S.tab} onClick={() => setAba(id)}>{lbl}</button>
        ))}
      </div>

      {!data ? (
        <div style={S.skel}>{esperando ? "Acordando o servidor…" : "Carregando…"}</div>
      ) : !lista.length ? (
        <div style={S.skel}>Sem histórico suficiente — importe o volume dos 3 meses anteriores.</div>
      ) : (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                {["#", "Cod", "PDV", "Setor", "Média 3M (HL)", "Mês atual (HL)", "GAP (HL)", "Δ"].map((h, i) => (
                  <th key={h} style={{ ...S.th, textAlign: i <= 2 ? "left" : "right" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map((p, i) => {
                const sobe = p.gap_hl > 0.001, desce = p.gap_hl < -0.001;
                const cor = sobe ? "#4ade80" : desce ? "#ef6f6f" : "rgba(255,255,255,0.55)";
                const seta = sobe ? "▲" : desce ? "▼" : "—";
                return (
                  <tr key={p.cod_pdv} style={i % 2 ? S.trAlt : undefined}>
                    <td style={{ ...S.td, color: "rgba(255,255,255,0.35)" }}>{i + 1}</td>
                    <td style={{ ...S.td, color: "rgba(255,255,255,0.5)" }}>{p.cod_pdv}</td>
                    <td style={{ ...S.td, color: "#fff", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={p.nome_pdv}>{p.nome_pdv}</td>
                    <td style={{ ...S.td, color: "rgba(255,255,255,0.6)" }}>{p.setor}</td>
                    <td style={{ ...S.td, textAlign: "right" }}>{fmt(p.media)}</td>
                    <td style={{ ...S.td, textAlign: "right", fontWeight: 600 }}>{fmt(p.atual)}</td>
                    <td style={{ ...S.td, textAlign: "right", color: cor, fontWeight: 600 }}>{p.gap_hl > 0 ? "+" : ""}{fmt(p.gap_hl)}</td>
                    <td style={{ ...S.td, textAlign: "right", color: cor, fontWeight: 700, whiteSpace: "nowrap" }}>{seta} {Math.abs(p.gap_pct)}%</td>
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
  tabs: { display: "flex", gap: "6px", marginBottom: "10px" },
  tab: { fontSize: "0.8rem", fontFamily: "inherit", color: "rgba(255,255,255,0.55)", background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "18px", padding: "4px 14px", cursor: "pointer" },
  tabOn: { fontSize: "0.8rem", fontFamily: "inherit", color: "#0c1410", background: "#7DBA3D", border: "1px solid #7DBA3D", borderRadius: "18px", padding: "4px 14px", cursor: "pointer", fontWeight: "700" },
  skel: { color: "rgba(255,255,255,0.35)", fontSize: "0.9rem", padding: "10px 2px" },
  tableWrap: { overflowX: "auto", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.06)" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" },
  th: { padding: "8px 10px", color: "rgba(255,255,255,0.45)", fontWeight: "600", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.03em", borderBottom: "1px solid rgba(255,255,255,0.1)", whiteSpace: "nowrap", background: "rgba(255,255,255,0.03)" },
  td: { padding: "7px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.8)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" },
  trAlt: { background: "rgba(255,255,255,0.02)" },
};
