// Produtos — sub-abas: Grade de Estoque (ativa) e Shelf (em breve).
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";

const VERDE = "#7DBA3D";
const BG = "#0c1410";
const fmtN = (v, d = 0) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

export default function Produtos() {
  const navigate = useNavigate();
  const [aba, setAba] = useState("grade");
  return (
    <div style={S.root}>
      <div style={S.header}>
        <button style={S.voltar} onClick={() => navigate("/")}>← Início</button>
        <div>
          <h1 style={S.titulo}>📦 Produtos</h1>
          <p style={S.sub}>Estoque e acompanhamento</p>
        </div>
      </div>

      <div style={S.abas}>
        <button style={{ ...S.tab, ...(aba === "grade" ? S.tabAtiva : {}) }} onClick={() => setAba("grade")}>📊 Grade de Estoque</button>
        <button style={{ ...S.tab, ...S.tabOff }} title="Em breve — importe o relatório de shelf" disabled>🏷️ Shelf <span style={S.soon}>em breve</span></button>
      </div>

      {aba === "grade" && <Grade />}
      <style>{CSS}</style>
    </div>
  );
}

function Grade() {
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [sort, setSort] = useState({ k: "saldo", dir: "desc" });

  useEffect(() => {
    let vivo = true;
    setLoading(true); setErro("");
    api.get("/api/grade")
      .then((r) => vivo && setD(r.data))
      .catch(() => vivo && setErro("Não consegui carregar a grade de estoque."))
      .finally(() => vivo && setLoading(false));
    return () => { vivo = false; };
  }, []);

  const colunas = [
    { k: "cod", t: "Cód" },
    { k: "nome", t: "Produto" },
    { k: "un", t: "Un" },
    { k: "saldo", t: "Saldo", num: true, fmt: (v) => fmtN(v) },
    { k: "hl_estoque", t: "HL", num: true, fmt: (v) => fmtN(v, 1) },
    { k: "saidas", t: "Saídas", num: true, fmt: (v) => fmtN(v) },
  ];

  const linhas = useMemo(() => {
    if (!d) return [];
    const q = busca.trim().toLowerCase();
    let arr = d.itens.filter((r) =>
      !q || String(r.nome || "").toLowerCase().includes(q) || String(r.cod || "").includes(q) || String(r.descricao || "").toLowerCase().includes(q)
    );
    const col = colunas.find((c) => c.k === sort.k) || {};
    arr = [...arr].sort((a, b) => {
      let r;
      if (col.num) r = (Number(a[sort.k]) || 0) - (Number(b[sort.k]) || 0);
      else r = String(a[sort.k] ?? "").localeCompare(String(b[sort.k] ?? ""), "pt-BR", { sensitivity: "base", numeric: true });
      return sort.dir === "asc" ? r : -r;
    });
    return arr;
  }, [d, busca, sort]);

  if (loading && !d) return <div style={S.info}><span className="pr-spin" /> Carregando…</div>;
  if (erro) return <div style={S.erro}>{erro}</div>;
  if (!d) return null;
  if (d.total_itens === 0)
    return <div style={S.vazio}>Nenhum item em estoque. Importe a <b>Grade de Estoque</b> (e a <b>Base Produtos</b> p/ os nomes) em Admin › Arquivos.</div>;

  const clicar = (c) => setSort((s) => (s.k === c.k ? { k: c.k, dir: s.dir === "asc" ? "desc" : "asc" } : { k: c.k, dir: c.num ? "desc" : "asc" }));

  return (
    <>
      {d.atualizado_em && <div style={S.atualizado}>🔄 atualizado em {d.atualizado_em}</div>}

      <div style={S.kpis}>
        <Kpi label="Itens em estoque" valor={fmtN(d.total_itens)} cor={VERDE} />
        <Kpi label="Caixas/Un (saldo)" valor={fmtN(d.total_caixas)} cor="#fff" />
        <Kpi label="HL em estoque" valor={fmtN(d.total_hl, 1)} cor="#f5c451" />
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
              <tr key={l.cod} style={i % 2 ? S.trAlt : undefined}>
                {colunas.map((c) => (
                  <td key={c.k} style={{ ...S.td, textAlign: c.num ? "right" : "left", ...(c.k === "nome" ? S.tdNome : {}) }}>
                    {c.fmt ? c.fmt(l[c.k]) : l[c.k]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {linhas.length === 0 && <div style={S.vazio}>Nenhum produto encontrado para "{busca}".</div>}
    </>
  );
}

function Kpi({ label, valor, sub, cor }) {
  return (
    <div style={S.kpi}>
      <div style={{ ...S.kpiValor, color: cor || "#fff" }}>{valor}</div>
      <div style={S.kpiLabel}>{label}</div>
      {sub != null && <div style={S.kpiSub}>{sub}</div>}
    </div>
  );
}

const S = {
  root: { minHeight: "100vh", background: BG, fontFamily: "'Poppins','Segoe UI',system-ui,sans-serif", padding: "clamp(16px,4vw,28px)", maxWidth: "1600px", margin: "0 auto", color: "#fff" },
  header: { display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap", marginBottom: "18px" },
  voltar: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", padding: "8px 14px", borderRadius: "8px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.85rem" },
  titulo: { margin: 0, fontSize: "clamp(1.2rem,4vw,1.5rem)", fontWeight: "800" },
  sub: { margin: "2px 0 0", color: "rgba(255,255,255,0.45)", fontSize: "0.8rem" },
  abas: { display: "flex", gap: "8px", marginBottom: "18px", flexWrap: "wrap" },
  tab: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", padding: "10px 18px", borderRadius: "10px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.9rem", fontWeight: "600" },
  tabAtiva: { background: "rgba(125,186,61,0.15)", borderColor: "rgba(125,186,61,0.5)", color: VERDE },
  tabOff: { opacity: 0.5, cursor: "not-allowed" },
  soon: { fontSize: "0.62rem", background: "rgba(255,255,255,0.1)", padding: "2px 6px", borderRadius: "10px", marginLeft: "4px", verticalAlign: "middle" },
  atualizado: { color: "rgba(255,255,255,0.35)", fontSize: "0.7rem", margin: "0 0 14px 2px", fontStyle: "italic" },
  info: { color: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", gap: "10px", padding: "20px 0" },
  erro: { color: "#ef6f6f", padding: "16px", background: "rgba(239,68,68,0.1)", borderRadius: "10px" },
  vazio: { color: "rgba(255,255,255,0.55)", padding: "20px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", lineHeight: 1.6 },
  kpis: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "12px", marginBottom: "14px" },
  kpi: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "16px" },
  kpiValor: { fontSize: "1.5rem", fontWeight: "800", lineHeight: 1.1 },
  kpiLabel: { color: "rgba(255,255,255,0.6)", fontSize: "0.78rem", marginTop: "6px" },
  kpiSub: { color: "rgba(255,255,255,0.4)", fontSize: "0.72rem", marginTop: "2px" },
  busca: { width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(125,186,61,0.3)", borderRadius: "10px", color: "#fff", padding: "11px 14px", fontSize: "0.9rem", fontFamily: "inherit", outline: "none", marginBottom: "12px", boxSizing: "border-box" },
  tabelaWrap: { overflowX: "auto", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px" },
  tabela: { width: "100%", borderCollapse: "collapse", fontSize: "0.84rem" },
  th: { padding: "10px 12px", color: "rgba(255,255,255,0.5)", fontWeight: "600", borderBottom: "1px solid rgba(255,255,255,0.1)", whiteSpace: "nowrap", background: "rgba(255,255,255,0.03)", userSelect: "none", position: "sticky", top: 0 },
  td: { padding: "9px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.85)", whiteSpace: "nowrap" },
  tdNome: { whiteSpace: "normal", minWidth: "180px", color: "#fff" },
  trAlt: { background: "rgba(255,255,255,0.02)" },
};

const CSS = `
.pr-spin { width:16px;height:16px;border:2px solid rgba(125,186,61,0.2);border-top-color:${VERDE};border-radius:50%;display:inline-block;animation:pr-rot .8s linear infinite; }
@keyframes pr-rot { to { transform: rotate(360deg); } }
`;
