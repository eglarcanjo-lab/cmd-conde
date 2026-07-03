// Cobertura & Distribuição por SKU — visão gestor (GV / diretoria / admin).
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";

const VERDE = "#7DBA3D";
const BG = "#0c1410";
const fmt = (v, d = 0) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

export default function CoberturaSku({ embutido = false }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [sug, setSug] = useState([]);
  const [mostraSug, setMostraSug] = useState(false);
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  // Autocomplete: sugere produtos enquanto digita (debounce)
  useEffect(() => {
    const termo = q.trim();
    if (termo.length < 2) { setSug([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await api.get("/api/cobertura-sku/buscar", { params: { q: termo } });
        setSug(r.data || []);
        setMostraSug(true);
      } catch { /* silencioso */ }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  async function buscarTermo(termo) {
    if (!termo) return;
    setMostraSug(false);
    setLoading(true); setErro(""); setD(null);
    try {
      const r = await api.get("/api/cobertura-sku", { params: { q: termo } });
      setD(r.data);
    } catch (err) {
      setErro(err.response?.data?.error || "Erro ao buscar.");
    } finally {
      setLoading(false);
    }
  }

  function buscar(e) {
    e?.preventDefault?.();
    buscarTermo(q.trim());
  }

  function escolher(p) {
    setQ(p.nome);
    setSug([]);
    setMostraSug(false);
    buscarTermo(p.cod);
  }

  return (
    <div style={embutido ? S.emb : S.root}>
      {!embutido && (
        <div className="no-print" style={S.header}>
          <button style={S.voltar} onClick={() => navigate("/")}>← Início</button>
          <div>
            <h1 style={S.titulo}>📈 Cobertura & Distribuição</h1>
            <p style={S.sub}>Por SKU · visão consolidada</p>
          </div>
        </div>
      )}

      <div className="no-print" style={S.buscaWrap}>
        <form style={S.busca} onSubmit={buscar} autoComplete="off">
          <div style={S.inputWrap}>
            <input
              style={S.input}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onFocus={() => sug.length > 0 && setMostraSug(true)}
              onBlur={() => setTimeout(() => setMostraSug(false), 150)}
              placeholder="🔎 Digite o nome ou código do produto"
            />
            {mostraSug && sug.length > 0 && (
              <div style={S.dropdown}>
                {sug.map((p) => (
                  <button key={p.cod} type="button" style={S.sugItem} onMouseDown={() => escolher(p)}>
                    <span style={S.sugNome}>{p.nome}</span>
                    <span style={S.sugCod}>cód {p.cod}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button type="submit" style={S.btn} disabled={loading}>{loading ? "…" : "Buscar"}</button>
        </form>
      </div>

      {erro && <div style={S.erro}>{erro}</div>}
      {loading && <div style={S.info}><span className="cs-spin" /> Buscando…</div>}

      {d && !d.encontrado && !loading && (
        <div style={S.vazio}>Nenhuma venda encontrada para "<b>{q}</b>" no escopo. Confira o código do SKU ou reimporte os pedidos.</div>
      )}

      {d && d.encontrado && (
        <div>
          {/* Cabeçalho em evidência */}
          <div style={S.evid}>
            <div style={S.evidTit}>Cobertura e Distribuição</div>
            <div style={S.evidProd}>{d.produto.nome} <span style={S.evidCod}>· cód {d.produto.cod}</span></div>
            <div style={S.evidSub}>
              {d.atualizado_em ? `🔄 atualizado em ${d.atualizado_em}` : ""}
              {d.mes_referencia ? ` · mês ${d.mes_referencia}` : ""}
            </div>
            <button className="no-print" style={S.pdfBtn} onClick={() => window.print()}>📄 Exportar PDF</button>
          </div>

          {d.sem_hl && (
            <div style={S.aviso}>⚠️ Esse produto está sem <b>HL por caixa</b> na base — a distribuição (caixas) ficou em 0. Importe o 0111 (Base de Produtos) com esse item.</div>
          )}

          {/* KPIs consolidados */}
          <div style={S.kpis}>
            <Kpi label="Cobertura (PDVs)" valor={fmt(d.consolidado.cobertura)} cor={VERDE} sub="PDVs que compraram" />
            <Kpi label="Distribuição (caixas)" valor={fmt(d.consolidado.distribuicao, 1)} cor="#f5c451" sub="total de caixas" />
          </div>

          <h3 style={S.h3}>Por RN (setor)</h3>
          <Tabela linhas={d.por_rn} colunas={[
            { k: "setor", t: "Setor" },
            { k: "cobertura", t: "Cobertura (PDVs)", num: true, fmt: (v) => fmt(v) },
            { k: "distribuicao", t: "Distribuição (cx)", num: true, fmt: (v) => fmt(v, 1) },
          ]} />

          <h3 style={S.h3}>Por PDV ({d.por_pdv.length})</h3>
          <Tabela linhas={d.por_pdv} colunas={[
            { k: "cod_pdv", t: "Cód" },
            { k: "nome_pdv", t: "Cliente" },
            { k: "setor", t: "Setor" },
            { k: "caixas", t: "Caixas", num: true, fmt: (v) => fmt(v, 1) },
          ]} />
        </div>
      )}

      <style>{CSS}</style>
    </div>
  );
}

function Kpi({ label, valor, sub, cor }) {
  return (
    <div style={S.kpi}>
      <div style={{ ...S.kpiValor, color: cor || "#fff" }}>{valor}</div>
      <div style={S.kpiLabel}>{label}</div>
      {sub && <div style={S.kpiSub}>{sub}</div>}
    </div>
  );
}

function Tabela({ colunas, linhas }) {
  if (!linhas || linhas.length === 0) return <div style={S.vazio}>Sem dados.</div>;
  return (
    <div style={S.tabelaWrap}>
      <table style={S.tabela}>
        <thead>
          <tr>{colunas.map((c) => <th key={c.k} style={{ ...S.th, textAlign: c.num ? "right" : "left" }}>{c.t}</th>)}</tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i} style={i % 2 ? S.trAlt : undefined}>
              {colunas.map((c) => <td key={c.k} style={{ ...S.td, textAlign: c.num ? "right" : "left" }}>{c.fmt ? c.fmt(l[c.k]) : l[c.k]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const S = {
  root: { minHeight: "100vh", background: BG, fontFamily: "'Poppins','Segoe UI',system-ui,sans-serif", padding: "clamp(16px,4vw,28px)", maxWidth: "1600px", margin: "0 auto", color: "#fff" },
  emb: { color: "#fff", fontFamily: "'Poppins','Segoe UI',system-ui,sans-serif" },
  header: { display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap", marginBottom: "18px" },
  voltar: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", padding: "8px 14px", borderRadius: "8px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.85rem" },
  titulo: { margin: 0, fontSize: "clamp(1.2rem,4vw,1.5rem)", fontWeight: "800" },
  sub: { margin: "2px 0 0", color: "rgba(255,255,255,0.45)", fontSize: "0.8rem" },
  buscaWrap: { marginBottom: "18px" },
  busca: { display: "flex", gap: "8px" },
  inputWrap: { position: "relative", flex: 1, minWidth: 0 },
  input: { width: "100%", minWidth: 0, boxSizing: "border-box", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(125,186,61,0.3)", borderRadius: "10px", color: "#fff", padding: "11px 14px", fontSize: "0.9rem", fontFamily: "inherit", outline: "none" },
  btn: { flexShrink: 0, whiteSpace: "nowrap", background: "linear-gradient(135deg,#7DBA3D,#2E7D32)", color: "#0c1410", border: "none", borderRadius: "10px", padding: "0 18px", fontWeight: "700", cursor: "pointer", fontFamily: "inherit", fontSize: "0.9rem" },
  dropdown: { position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#14241a", border: "1px solid rgba(125,186,61,0.35)", borderRadius: "10px", zIndex: 50, maxHeight: "300px", overflowY: "auto", boxShadow: "0 16px 50px rgba(0,0,0,0.5)" },
  sugItem: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", width: "100%", textAlign: "left", background: "transparent", border: "none", borderBottom: "1px solid rgba(255,255,255,0.06)", color: "#fff", padding: "10px 12px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.84rem" },
  sugNome: { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  sugCod: { color: "rgba(125,186,61,0.8)", fontSize: "0.72rem", flexShrink: 0 },
  info: { color: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", gap: "10px", padding: "20px 0" },
  erro: { color: "#ef6f6f", padding: "16px", background: "rgba(239,68,68,0.1)", borderRadius: "10px" },
  aviso: { color: "#f5c451", padding: "12px 14px", background: "rgba(245,196,81,0.08)", border: "1px solid rgba(245,196,81,0.25)", borderRadius: "10px", fontSize: "0.84rem", marginBottom: "12px" },
  vazio: { color: "rgba(255,255,255,0.55)", padding: "20px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", lineHeight: 1.6 },
  evid: { background: "rgba(125,186,61,0.08)", border: "1px solid rgba(125,186,61,0.3)", borderRadius: "14px", padding: "16px 18px", marginBottom: "14px" },
  evidTit: { color: VERDE, fontWeight: "700", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.05em" },
  evidProd: { color: "#fff", fontWeight: "800", fontSize: "1.15rem", marginTop: "4px", lineHeight: 1.25 },
  evidCod: { color: "rgba(255,255,255,0.45)", fontWeight: "400", fontSize: "0.85rem" },
  evidSub: { color: "rgba(255,255,255,0.45)", fontSize: "0.76rem", marginTop: "4px" },
  pdfBtn: { marginTop: "12px", display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", borderRadius: "8px", padding: "8px 14px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.8rem" },
  kpis: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "12px", marginBottom: "8px" },
  kpi: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "16px" },
  kpiValor: { fontSize: "1.7rem", fontWeight: "800", lineHeight: 1.1 },
  kpiLabel: { color: "rgba(255,255,255,0.6)", fontSize: "0.8rem", marginTop: "6px" },
  kpiSub: { color: "rgba(255,255,255,0.4)", fontSize: "0.72rem", marginTop: "2px" },
  h3: { margin: "22px 0 10px", fontSize: "1rem", fontWeight: "700" },
  tabelaWrap: { overflowX: "auto", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px" },
  tabela: { width: "100%", borderCollapse: "collapse", fontSize: "0.84rem" },
  th: { padding: "10px 12px", color: "rgba(255,255,255,0.5)", fontWeight: "600", borderBottom: "1px solid rgba(255,255,255,0.1)", whiteSpace: "nowrap", background: "rgba(255,255,255,0.03)" },
  td: { padding: "9px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.85)", whiteSpace: "nowrap" },
  trAlt: { background: "rgba(255,255,255,0.02)" },
};

const CSS = `
.cs-spin { width:16px;height:16px;border:2px solid rgba(125,186,61,0.2);border-top-color:${VERDE};border-radius:50%;display:inline-block;animation:cs-rot .8s linear infinite; }
@keyframes cs-rot { to { transform: rotate(360deg); } }
@media print {
  .no-print { display: none !important; }
  html, body { background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;
