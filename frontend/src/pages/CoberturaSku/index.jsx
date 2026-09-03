// Cobertura & Distribuição por SKU — visão gestor (GV / diretoria / admin).
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx-js-style";
import api from "../../services/api";

const VERDE = "#7DBA3D";
const BG = "#0c1410";
const fmt = (v, d = 0) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const ROT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const fmtMes = (m) => { const [y, mo] = String(m).split("-"); return `${ROT[(Number(mo) || 1) - 1]}/${String(y).slice(2)}`; };
const mesAtual = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };

const DIAS = [
  { key: "SEG", label: "Seg" }, { key: "TER", label: "Ter" }, { key: "QUA", label: "Qua" },
  { key: "QUI", label: "Qui" }, { key: "SEX", label: "Sex" }, { key: "SAB", label: "Sáb" },
];
const DIA_MAP = {
  SEG: "SEG", SEGUNDA: "SEG", "SEGUNDA-FEIRA": "SEG", "2": "SEG",
  TER: "TER", TERCA: "TER", "TERÇA": "TER", "TERCA-FEIRA": "TER", "TERÇA-FEIRA": "TER", "3": "TER",
  QUA: "QUA", QUARTA: "QUA", "QUARTA-FEIRA": "QUA", "4": "QUA",
  QUI: "QUI", QUINTA: "QUI", "QUINTA-FEIRA": "QUI", "5": "QUI",
  SEX: "SEX", SEXTA: "SEX", "SEXTA-FEIRA": "SEX", "6": "SEX",
  SAB: "SAB", SABADO: "SAB", "SÁBADO": "SAB", "7": "SAB",
};
const normalizeDia = (raw) => { const s = String(raw || "").trim().toUpperCase().split(/[\/,; \-]/)[0].trim(); return DIA_MAP[s] || s; };

export default function CoberturaSku({ embutido = false }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [sug, setSug] = useState([]);
  const [mostraSug, setMostraSug] = useState(false);
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [mesesDisp, setMesesDisp] = useState([]);      // meses disponíveis
  const [meses, setMeses] = useState([mesAtual()]);    // meses selecionados
  const [termoAtual, setTermoAtual] = useState("");    // último SKU buscado
  const [fltRn, setFltRn] = useState("");
  const [fltDia, setFltDia] = useState("");

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

  // meses disponíveis (para o seletor de período)
  useEffect(() => {
    api.get("/api/cobertura-sku/meses").then((r) => {
      const ms = r.data || [];
      setMesesDisp(ms);
      if (ms.length && !ms.includes(mesAtual())) setMeses([ms[0]]); // sem dado do mês atual → usa o mais recente
    }).catch(() => {});
  }, []);

  async function buscarTermo(termo, mesesArg) {
    if (!termo) return;
    const ms = mesesArg || meses;
    setTermoAtual(termo);
    setMostraSug(false);
    setLoading(true); setErro(""); setD(null);
    try {
      const r = await api.get("/api/cobertura-sku", { params: { q: termo, meses: ms.join(",") }, timeout: 60000 });
      setD(r.data);
    } catch (err) {
      setErro(err.response?.data?.error || "Erro ao buscar.");
    } finally {
      setLoading(false);
    }
  }

  // Alterna um mês na seleção e re-busca o SKU atual (mantém ao menos 1 mês).
  function toggleMes(m) {
    const novo = meses.includes(m) ? meses.filter((x) => x !== m) : [...meses, m].sort();
    if (!novo.length) return;
    setMeses(novo);
    if (termoAtual) buscarTermo(termoAtual, novo);
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

      {/* Seletor de período — 1+ meses (marque mais meses para acumular) */}
      {mesesDisp.length > 0 && (
        <div className="no-print" style={S.periodo}>
          <span style={S.periodoLbl}>Período:</span>
          {mesesDisp.map((m) => (
            <button key={m} type="button" onClick={() => toggleMes(m)}
              style={meses.includes(m) ? S.mesOn : S.mes}>{fmtMes(m)}</button>
          ))}
          <span style={S.periodoHint}>{meses.length} {meses.length > 1 ? "meses" : "mês"} · marque mais para acumular</span>
        </div>
      )}

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
              {d.meses?.length ? ` · período ${d.meses.map(fmtMes).join(", ")}` : (d.mes_referencia ? ` · mês ${d.mes_referencia}` : "")}
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

          {/* Base que ainda não comprou — com filtro de RN e dia de visita */}
          <NaoCompradores lista={d.nao_compradores || []} fltRn={fltRn} setFltRn={setFltRn} fltDia={fltDia} setFltDia={setFltDia} />
        </div>
      )}

      <style>{CSS}</style>
    </div>
  );
}

function NaoCompradores({ lista, fltRn, setFltRn, fltDia, setFltDia }) {
  // setor -> nome do RN (para rotular o filtro)
  const rnPorSetor = {};
  lista.forEach((p) => { if (p.setor && !rnPorSetor[p.setor]) rnPorSetor[p.setor] = p.rn || ""; });
  const setores = Object.keys(rnPorSetor).sort();
  const filtrada = lista.filter((p) =>
    (!fltRn || String(p.setor) === String(fltRn)) &&
    (!fltDia || normalizeDia(p.dia_visita) === fltDia)
  );
  function exportar() {
    const rows = filtrada.map((p) => ({ "Cod PDV": p.cod_pdv, "Cliente": p.nome_pdv, "Setor": p.setor, "RN": p.rn, "Dia visita": normalizeDia(p.dia_visita) }));
    if (!rows.length) return;
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Nao compradores");
    XLSX.writeFile(wb, "nao_compradores.xlsx");
  }
  return (
    <>
      <div style={S.naoHead}>
        <h3 style={{ ...S.h3, margin: 0, color: "#f0997b" }}>Base que ainda não comprou ({filtrada.length}{filtrada.length !== lista.length ? ` de ${lista.length}` : ""})</h3>
        <button className="no-print" style={S.excel} onClick={exportar}>⤓ Excel</button>
      </div>
      <div className="no-print" style={S.fltRow}>
        <select style={S.select} value={fltRn} onChange={(e) => setFltRn(e.target.value)}>
          <option value="">Todos os RNs / setores</option>
          {setores.map((s) => <option key={s} value={s}>{s}{rnPorSetor[s] ? ` · ${rnPorSetor[s]}` : ""}</option>)}
        </select>
        <div style={S.diaBtns}>
          {DIAS.map((dd) => (
            <button key={dd.key} type="button" onClick={() => setFltDia(fltDia === dd.key ? "" : dd.key)}
              style={fltDia === dd.key ? S.diaOn : S.dia}>{dd.label}</button>
          ))}
        </div>
      </div>
      <Tabela linhas={filtrada} colunas={[
        { k: "cod_pdv", t: "Cód" },
        { k: "nome_pdv", t: "Cliente" },
        { k: "setor", t: "Setor" },
        { k: "rn", t: "RN" },
        { k: "dia_visita", t: "Dia visita", fmt: (v) => normalizeDia(v) || "—" },
      ]} />
    </>
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
  periodo: { display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginBottom: "16px" },
  periodoLbl: { color: "rgba(255,255,255,0.5)", fontSize: "0.8rem", fontWeight: 600, marginRight: "2px" },
  periodoHint: { color: "rgba(255,255,255,0.3)", fontSize: "0.72rem", marginLeft: "4px" },
  mes: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)", borderRadius: "16px", padding: "5px 12px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.78rem" },
  mesOn: { background: "rgba(125,186,61,0.16)", border: "1px solid #7DBA3D", color: "#7DBA3D", borderRadius: "16px", padding: "5px 12px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.78rem", fontWeight: 700 },
  naoHead: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap", marginTop: "22px" },
  excel: { background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.4)", color: "#4ade80", borderRadius: "8px", padding: "6px 12px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.8rem", fontWeight: 600 },
  fltRow: { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", margin: "10px 0" },
  select: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "#fff", padding: "8px 12px", fontSize: "0.84rem", fontFamily: "inherit", outline: "none" },
  diaBtns: { display: "flex", gap: "5px", flexWrap: "wrap" },
  dia: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.55)", borderRadius: "16px", padding: "6px 12px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.78rem" },
  diaOn: { background: "rgba(125,186,61,0.15)", border: "1px solid rgba(125,186,61,0.45)", color: "#7DBA3D", borderRadius: "16px", padding: "6px 12px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.78rem", fontWeight: 700 },
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
