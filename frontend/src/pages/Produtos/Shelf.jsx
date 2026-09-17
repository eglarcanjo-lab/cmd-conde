// Shelf — produtos perto do vencimento (guia FAROL PZC da Coleta).
import { useState, useEffect, useMemo } from "react";
import api from "../../services/api";

const VERDE = "#7DBA3D";
const fmtN = (v, d = 0) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtR$ = (v) => "R$ " + fmtN(v, 2);

export default function Shelf() {
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [sort, setSort] = useState({ k: "dias_vencer", dir: "asc" });

  useEffect(() => {
    let vivo = true;
    setLoading(true); setErro("");
    api.get("/api/shelf")
      .then((r) => vivo && setD(r.data))
      .catch(() => vivo && setErro("Não consegui carregar o Shelf."))
      .finally(() => vivo && setLoading(false));
    return () => { vivo = false; };
  }, []);

  const colunas = [
    { k: "cod", t: "Cód" },
    { k: "descricao", t: "Produto" },
    { k: "qtd_cx", t: "Qtd Cx", num: true, fmt: (v) => fmtN(v) },
    { k: "validade", t: "Validade" },
    { k: "dias_vencer", t: "Dias p/ vencer", num: true, fmt: (v) => fmtN(v) },
    { k: "valor_shelf", t: "Valor Shelf", num: true, fmt: (v) => fmtR$(v) },
  ];

  const linhas = useMemo(() => {
    if (!d) return [];
    const q = busca.trim().toLowerCase();
    let arr = d.itens.filter((r) => !q || String(r.descricao || "").toLowerCase().includes(q) || String(r.cod || "").includes(q));
    const col = colunas.find((c) => c.k === sort.k) || {};
    arr = [...arr].sort((a, b) => {
      let r;
      if (col.num) r = (Number(a[sort.k]) || 0) - (Number(b[sort.k]) || 0);
      else r = String(a[sort.k] ?? "").localeCompare(String(b[sort.k] ?? ""), "pt-BR", { numeric: true });
      return sort.dir === "asc" ? r : -r;
    });
    return arr;
  }, [d, busca, sort]);

  if (loading && !d) return <div style={S.info}><span className="pr-spin" /> Carregando…</div>;
  if (erro) return <div style={S.erro}>{erro}</div>;
  if (!d) return null;
  if (d.total_itens === 0)
    return <div style={S.vazio}>Sem itens de shelf. Importe a <b>Coleta</b> (guia FAROL PZC) em Admin › Arquivos.</div>;

  const clicar = (c) => setSort((s) => (s.k === c.k ? { k: c.k, dir: s.dir === "asc" ? "desc" : "asc" } : { k: c.k, dir: c.num ? "desc" : "asc" }));
  const corDias = (n) => (n < 7 ? "#ff9d9d" : n < 15 ? "#f5c451" : "rgba(255,255,255,0.85)");

  return (
    <>
      {d.atualizado_em && <div style={S.atualizado}>🔄 atualizado em {d.atualizado_em}</div>}
      <div style={S.kpis}>
        <Kpi label="Itens em shelf" valor={fmtN(d.total_itens)} cor={VERDE} />
        <Kpi label="Caixas" valor={fmtN(d.total_cx)} cor="#fff" />
        <Kpi label="Valor total" valor={fmtR$(d.total_valor)} cor="#f5c451" />
      </div>
      <input style={S.busca} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="🔎 Buscar produto (nome ou código)…" />
      <div style={S.tabelaWrap}>
        <table style={S.tabela}>
          <thead>
            <tr>
              {colunas.map((c) => (
                <th key={c.k} style={{ ...S.th, textAlign: c.num ? "right" : "left", cursor: "pointer" }} onClick={() => clicar(c)}>
                  {c.t}{sort.k === c.k ? (sort.dir === "asc" ? " ▲" : " ▼") : " ⇅"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={l.cod + i} style={i % 2 ? S.trAlt : undefined}>
                {colunas.map((c) => (
                  <td key={c.k} style={{ ...S.td, textAlign: c.num ? "right" : "left", ...(c.k === "descricao" ? S.tdNome : {}), ...(c.k === "dias_vencer" ? { color: corDias(l.dias_vencer), fontWeight: 700 } : {}) }}>
                    {c.fmt ? c.fmt(l[c.k]) : l[c.k]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {linhas.length === 0 && <div style={S.vazio}>Nenhum produto encontrado para "{busca}".</div>}
      <style>{`.pr-spin{width:16px;height:16px;border:2px solid rgba(125,186,61,0.2);border-top-color:${VERDE};border-radius:50%;display:inline-block;animation:pr-rot .8s linear infinite;}@keyframes pr-rot{to{transform:rotate(360deg);}}`}</style>
    </>
  );
}

function Kpi({ label, valor, cor }) {
  return (
    <div style={S.kpi}>
      <div style={{ ...S.kpiValor, color: cor || "#fff" }}>{valor}</div>
      <div style={S.kpiLabel}>{label}</div>
    </div>
  );
}

const S = {
  info: { color: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", gap: "10px", padding: "20px 0" },
  erro: { color: "#ef6f6f", padding: "16px", background: "rgba(239,68,68,0.1)", borderRadius: "10px" },
  vazio: { color: "rgba(255,255,255,0.55)", padding: "20px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", lineHeight: 1.6 },
  atualizado: { color: "rgba(255,255,255,0.35)", fontSize: "0.7rem", margin: "0 0 14px 2px", fontStyle: "italic" },
  kpis: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "12px", marginBottom: "14px" },
  kpi: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "16px" },
  kpiValor: { fontSize: "1.5rem", fontWeight: "800", lineHeight: 1.1 },
  kpiLabel: { color: "rgba(255,255,255,0.6)", fontSize: "0.78rem", marginTop: "6px" },
  busca: { width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(125,186,61,0.3)", borderRadius: "10px", color: "#fff", padding: "11px 14px", fontSize: "0.9rem", fontFamily: "inherit", outline: "none", marginBottom: "12px", boxSizing: "border-box" },
  tabelaWrap: { overflowX: "auto", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px" },
  tabela: { width: "100%", borderCollapse: "collapse", fontSize: "0.84rem" },
  th: { padding: "10px 12px", color: "rgba(255,255,255,0.5)", fontWeight: "600", borderBottom: "1px solid rgba(255,255,255,0.1)", whiteSpace: "nowrap", background: "rgba(255,255,255,0.03)", userSelect: "none", position: "sticky", top: 0 },
  td: { padding: "9px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.85)", whiteSpace: "nowrap" },
  tdNome: { whiteSpace: "normal", minWidth: "180px", color: "#fff" },
  trAlt: { background: "rgba(255,255,255,0.02)" },
};
