import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";

const CATEGORIAS = [
  { key: "GIRO RGB",                   label: "GIRO RGB" },
  { key: "LITRINHO",                   label: "LITRINHO" },
  { key: "CERVEJA",                    label: "CERVEJA" },
  { key: "CERVEJA ZERO",               label: "CERVEJA ZERO" },
  { key: "CERVEJA MULTIPACK",          label: "CERVEJA MULTIPACK" },
  { key: "HE",                         label: "HE" },
  { key: "NAB",                        label: "NAB" },
  { key: "NAB ZERO",                   label: "NAB ZERO" },
  { key: "MATCH",                      label: "MATCH" },
  { key: "MKTP",                       label: "MKTP" },
  { key: "BALANCED CHOICE",            label: "BALANCED CHOICE" },
  { key: "TRIMARCA RGB HE (Original)", label: "TRIMARCA RGB HE (Original)" },
  { key: "TRIMARCA RGB HE (Stella)",   label: "TRIMARCA RGB HE (Stella)" },
  { key: "TRIMARCA RGB HE (Spaten)",   label: "TRIMARCA RGB HE (Spaten)" },
];

// SKUs HE monitorados para Distribuição
const HE_SKUS = [
  "TRIMARCA RGB HE (Original)",
  "TRIMARCA RGB HE (Stella)",
  "TRIMARCA RGB HE (Spaten)",
];

// Distribuição HE de um PDV = qtd de SKUs HE com status OK
function calcDistHE(cob) {
  return HE_SKUS.filter((sku) => cob[sku] === "OK").length;
}

// Cor da distribuição HE
function corDistHE(dist) {
  if (dist === 3) return "#4ade80";
  if (dist === 2) return "#fbb900";
  if (dist === 1) return "#fb923c";
  return "#f87171";
}

const DIAS = [
  { key: "SEG", label: "Segunda" },
  { key: "TER", label: "Terça" },
  { key: "QUA", label: "Quarta" },
  { key: "QUI", label: "Quinta" },
  { key: "SEX", label: "Sexta" },
  { key: "SAB", label: "Sábado" },
];

const STATUS_COLORS = {
  OK:       { bg: "rgba(34,197,94,0.15)",  color: "#4ade80", dot: "#4ade80" },
  PENDENTE: { bg: "rgba(251,185,0,0.15)",  color: "#fbb900", dot: "#fbb900" },
  NOK:      { bg: "rgba(239,68,68,0.15)",  color: "#f87171", dot: "#f87171" },
  "—":      { bg: "transparent",           color: "rgba(255,255,255,0.15)", dot: "transparent" },
};

function getDiaHoje() {
  const dias = ["DOM","SEG","TER","QUA","QUI","SEX","SAB"];
  return dias[new Date().getDay()];
}

export default function Cobertura() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const [cobertura, setCobertura] = useState([]);
  const [pdvBase, setPdvBase] = useState([]);
  const [loading, setLoading] = useState(true);
  const [diaFiltro, setDiaFiltro] = useState(getDiaHoje());
  const [busca, setBusca] = useState("");
  const [filtroCat, setFiltroCat] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setLoading(true);
    try {
      const [resC, resP] = await Promise.all([
        api.get("/api/cobertura"),
        api.get("/api/cobertura/pdv-base"),
      ]);
      setCobertura(resC.data || []);
      setPdvBase(resP.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Filtra pelo setor do usuário (RN vê só o seu, gestor vê todos)
  const isGestor = ["admin","director","gv1","gv3"].includes(usuario?.perfil);
  const coberturaSetor = isGestor
    ? cobertura
    : cobertura.filter((r) => r.setor === usuario?.cod);

  const pdvSetor = isGestor
    ? pdvBase
    : pdvBase.filter((r) => r.setor === usuario?.cod);

  // PDVs com visita no dia selecionado
  const pdvsDia = pdvSetor.filter((p) => {
    const dia = String(p.dia_visita || "").trim().toUpperCase().split("/")[0].trim();
    return dia === diaFiltro;
  });

  // Monta mapa de cobertura: { cod_pdv: { categoria: status } }
  const mapaCob = {};
  coberturaSetor.forEach((r) => {
    if (!mapaCob[r.cod_pdv]) mapaCob[r.cod_pdv] = {};
    mapaCob[r.cod_pdv][r.categoria] = r.status;
  });

  // PDVs do dia com cobertura
  const pdvsComCob = pdvsDia.map((p) => ({
    ...p,
    cob: mapaCob[p.cod_pdv] || {},
  }));

  // Filtro de busca e status
  const pdvsFiltrados = pdvsComCob.filter((p) => {
    const buscaOk = !busca || p.nome_fantasia?.toLowerCase().includes(busca.toLowerCase()) || p.cod_pdv?.includes(busca);
    const statusOk = !filtroStatus || Object.values(p.cob).includes(filtroStatus);
    const catOk = !filtroCat || (p.cob[filtroCat] !== undefined);
    return buscaOk && statusOk && catOk;
  });

  // ── Mini Dashboard ────────────────────────────────────────────────────────
  function calcResumo(pdvList) {
    const resumo = {};
    CATEGORIAS.forEach((c) => {
      resumo[c.key] = { OK: 0, PENDENTE: 0, NOK: 0, total: 0 };
    });
    pdvList.forEach((p) => {
      CATEGORIAS.forEach((c) => {
        const st = mapaCob[p.cod_pdv]?.[c.key];
        if (st && resumo[c.key]) {
          resumo[c.key][st] = (resumo[c.key][st] || 0) + 1;
          resumo[c.key].total++;
        }
      });
    });
    return resumo;
  }

  const resumoTotal = calcResumo(pdvSetor);
  const resumoDia = calcResumo(pdvsDia);

  const totalOk  = pdvSetor.length > 0 ? Object.values(resumoTotal).reduce((a,b) => a + b.OK, 0) : 0;
  const totalPend = Object.values(resumoTotal).reduce((a,b) => a + b.PENDENTE, 0);
  const totalNok  = Object.values(resumoTotal).reduce((a,b) => a + b.NOK, 0);

  // ── Distribuição HE ──────────────────────────────────────────────────────
  // Para cada PDV calcula quantos SKUs HE estão OK
  const distHEPorPdv = pdvSetor.map((p) => calcDistHE(mapaCob[p.cod_pdv] || {}));
  const cobertosHE   = distHEPorPdv.filter((d) => d > 0).length;           // PDVs com ao menos 1 SKU HE
  const distHEMedia  = cobertosHE > 0
    ? (distHEPorPdv.reduce((s, d) => s + d, 0) / cobertosHE).toFixed(1)
    : "0.0";
  const distHEDia    = pdvsDia.map((p) => calcDistHE(mapaCob[p.cod_pdv] || {}));
  // Breakdown: quantos PDVs têm dist 0/1/2/3 (base total)
  const distBreak = [0, 1, 2, 3].map((n) => distHEPorPdv.filter((d) => d === n).length);

  return (
    <div style={styles.root}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <button style={styles.backBtn} onClick={() => navigate("/")}>← Voltar</button>
          <div>
            <h1 style={styles.title}>📊 Cobertura</h1>
            <p style={styles.subtitle}>Setor {usuario?.cod} · {usuario?.nome}</p>
          </div>
        </div>
        <button style={styles.logoutBtn} onClick={logout}>Sair</button>
      </div>

      <div style={styles.content}>
        {/* Mini Dashboard — Base Total */}
        <div style={styles.dashRow}>
          <div style={styles.dashCard}>
            <p style={styles.dashLabel}>PDVs na base</p>
            <p style={styles.dashVal}>{pdvSetor.length}</p>
          </div>
          <div style={{ ...styles.dashCard, borderColor: "rgba(34,197,94,0.3)" }}>
            <p style={styles.dashLabel}>✅ OK (total base)</p>
            <p style={{ ...styles.dashVal, color: "#4ade80" }}>{totalOk}</p>
          </div>
          <div style={{ ...styles.dashCard, borderColor: "rgba(251,185,0,0.3)" }}>
            <p style={styles.dashLabel}>⏳ Pendente</p>
            <p style={{ ...styles.dashVal, color: "#fbb900" }}>{totalPend}</p>
          </div>
          <div style={{ ...styles.dashCard, borderColor: "rgba(239,68,68,0.3)" }}>
            <p style={styles.dashLabel}>❌ NOK</p>
            <p style={{ ...styles.dashVal, color: "#f87171" }}>{totalNok}</p>
          </div>
          <div style={{ ...styles.dashCard, borderColor: "rgba(251,185,0,0.2)" }}>
            <p style={styles.dashLabel}>📅 Visitas hoje</p>
            <p style={{ ...styles.dashVal, color: "#fbb900" }}>{pdvsDia.length}</p>
          </div>
        </div>

        {/* Distribuição HE */}
        <div style={{ ...styles.section, borderColor: "rgba(251,185,0,0.2)", marginBottom: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
            <h3 style={{ ...styles.sectionTitle, margin: 0, color: "#fbb900" }}>🍺 Distribuição HE — Base Total</h3>
            <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
              <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.82rem" }}>
                PDVs cobertos: <strong style={{ color: "#fff" }}>{cobertosHE} / {pdvSetor.length}</strong>
              </span>
              <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.82rem" }}>
                Dist. média: <strong style={{ color: "#fbb900" }}>{distHEMedia} SKUs</strong>
              </span>
            </div>
          </div>
          {/* Breakdown 0/1/2/3 SKUs */}
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {[0, 1, 2, 3].map((n) => {
              const qtd = distBreak[n];
              const pct = pdvSetor.length > 0 ? Math.round((qtd / pdvSetor.length) * 100) : 0;
              const cor = corDistHE(n);
              const labels = ["0 SKUs (sem cobertura)", "1 SKU", "2 SKUs", "3 SKUs (completo)"];
              return (
                <div key={n} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${cor}40`, borderRadius: "10px", padding: "12px 16px", flex: 1, minWidth: "110px", textAlign: "center" }}>
                  <p style={{ margin: "0 0 4px", fontSize: "0.72rem", color: "rgba(255,255,255,0.45)" }}>{labels[n]}</p>
                  <p style={{ margin: "0 0 2px", fontSize: "1.5rem", fontWeight: "800", color: cor }}>{qtd}</p>
                  <p style={{ margin: 0, fontSize: "0.72rem", color: "rgba(255,255,255,0.3)" }}>{pct}% da base</p>
                </div>
              );
            })}
          </div>
          {/* Definição */}
          <p style={{ margin: "12px 0 0", fontSize: "0.72rem", color: "rgba(255,255,255,0.25)", lineHeight: "1.5" }}>
            <strong style={{ color: "rgba(255,255,255,0.4)" }}>Distribuição</strong>: qtd de SKUs HE únicos presentes no PDV (Original, Stella, Spaten) — 2 caixas do mesmo SKU = 1. &nbsp;
            <strong style={{ color: "rgba(255,255,255,0.4)" }}>Cobertura</strong>: qualquer SKU, independente de mix ou quantidade = 1.
          </p>
        </div>

        {/* Resumo por categoria — base total */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Resumo por Categoria — Base Total</h3>
          <div style={styles.catGrid}>
            {CATEGORIAS.map((c) => {
              const r = resumoTotal[c.key] || { OK: 0, PENDENTE: 0, NOK: 0, total: 0 };
              const pct = r.total > 0 ? Math.round((r.OK / r.total) * 100) : 0;
              return (
                <div key={c.key} style={styles.catCard}>
                  <p style={styles.catLabel}>{c.label}</p>
                  <p style={styles.catPct}>{pct}%</p>
                  <div style={styles.catBar}>
                    <div style={{ ...styles.catBarFill, width: `${pct}%`, background: pct >= 70 ? "#4ade80" : pct >= 40 ? "#fbb900" : "#f87171" }} />
                  </div>
                  <div style={styles.catCounts}>
                    <span style={{ color: "#4ade80" }}>{r.OK}</span>
                    <span style={{ color: "#fbb900" }}>{r.PENDENTE}</span>
                    <span style={{ color: "#f87171" }}>{r.NOK}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Seletor de dia */}
        <div style={styles.section}>
          <div style={styles.diaRow}>
            <h3 style={styles.sectionTitle}>Visitas do Dia</h3>
            <div style={styles.diasBtns}>
              {DIAS.map((d) => (
                <button
                  key={d.key}
                  style={{ ...styles.diaBtn, ...(diaFiltro === d.key ? styles.diaBtnAtivo : {}) }}
                  onClick={() => setDiaFiltro(d.key)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Filtros */}
          <div style={styles.filtrosRow}>
            <input
              style={styles.inputFiltro}
              placeholder="Buscar PDV..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <select style={styles.inputFiltro} value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
              <option value="">Todos os status</option>
              <option value="OK">OK</option>
              <option value="PENDENTE">Pendente</option>
              <option value="NOK">NOK</option>
            </select>
            <span style={styles.countLabel}>{pdvsFiltrados.length} PDVs</span>
          </div>

          {/* Tabela */}
          {loading ? (
            <p style={styles.msg}>Carregando...</p>
          ) : pdvsFiltrados.length === 0 ? (
            <p style={styles.msg}>Nenhum PDV encontrado para {diaFiltro}.</p>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={{ ...styles.th, ...styles.thFixed }}>Cód</th>
                    <th style={{ ...styles.th, minWidth: "180px" }}>Nome</th>
                    <th style={styles.th}>Cidade</th>
                    <th style={{ ...styles.th, ...styles.thCat, color: "#fbb900", background: "rgba(251,185,0,0.06)" }}>Dist. HE</th>
                    {CATEGORIAS.map((c) => (
                      <th key={c.key} style={{ ...styles.th, ...styles.thCat }}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pdvsFiltrados.map((p) => (
                    <tr key={p.cod_pdv} style={styles.tr}>
                      <td style={{ ...styles.td, ...styles.thFixed }}>
                        <span style={styles.codBadge}>{p.cod_pdv}</span>
                      </td>
                      <td style={{ ...styles.td, fontSize: "0.82rem" }}>{p.nome_fantasia}</td>
                      <td style={{ ...styles.td, fontSize: "0.78rem", color: "rgba(255,255,255,0.4)" }}>{p.cidade}</td>
                      {(() => {
                        const dist = calcDistHE(p.cob);
                        const cor = corDistHE(dist);
                        return (
                          <td style={{ ...styles.td, ...styles.tdCat, background: "rgba(251,185,0,0.04)" }}>
                            <span style={{ ...styles.statusPill, background: `${cor}22`, color: cor, fontWeight: "800", fontSize: "0.85rem" }}>
                              {dist}/3
                            </span>
                          </td>
                        );
                      })()}
                      {CATEGORIAS.map((c) => {
                        const st = p.cob[c.key] || "—";
                        const clr = STATUS_COLORS[st] || STATUS_COLORS["—"];
                        return (
                          <td key={c.key} style={{ ...styles.td, ...styles.tdCat }}>
                            <span style={{ ...styles.statusPill, background: clr.bg, color: clr.color }}>
                              {st === "PENDENTE" ? "PEN" : st}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  root: { minHeight: "100vh", background: "#0a0f1e", fontFamily: "'Segoe UI', system-ui, sans-serif", color: "#fff" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "clamp(12px,3vw,20px) clamp(16px,4vw,32px)", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", flexWrap: "wrap", gap: "12px" },
  headerLeft: { display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" },
  backBtn: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", padding: "10px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem", fontFamily: "inherit", minHeight: "44px" },
  title: { margin: 0, fontSize: "clamp(1rem,5vw,1.3rem)", fontWeight: "700" },
  subtitle: { margin: 0, fontSize: "0.8rem", color: "rgba(255,255,255,0.4)" },
  logoutBtn: { background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)", padding: "10px 12px", borderRadius: "8px", cursor: "pointer", fontSize: "0.82rem", fontFamily: "inherit", minHeight: "44px" },
  content: { padding: "clamp(16px,4vw,24px) clamp(16px,4vw,32px)", maxWidth: "1400px", margin: "0 auto" },
  dashRow: { display: "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap" },
  dashCard: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "16px 20px", minWidth: "120px", flex: 1 },
  dashLabel: { margin: "0 0 6px", fontSize: "0.78rem", color: "rgba(255,255,255,0.45)" },
  dashVal: { margin: 0, fontSize: "1.8rem", fontWeight: "700" },
  section: { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "20px", marginBottom: "20px" },
  sectionTitle: { margin: "0 0 16px", fontSize: "0.95rem", fontWeight: "600", color: "rgba(255,255,255,0.8)" },
  catGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: "10px" },
  catCard: { background: "rgba(255,255,255,0.04)", borderRadius: "10px", padding: "12px 10px", textAlign: "center" },
  catLabel: { margin: "0 0 4px", fontSize: "0.72rem", color: "rgba(255,255,255,0.5)", fontWeight: "600" },
  catPct: { margin: "0 0 8px", fontSize: "1.3rem", fontWeight: "700" },
  catBar: { height: "4px", background: "rgba(255,255,255,0.08)", borderRadius: "2px", overflow: "hidden", marginBottom: "6px" },
  catBarFill: { height: "100%", borderRadius: "2px", transition: "width 0.3s" },
  catCounts: { display: "flex", justifyContent: "space-around", fontSize: "0.72rem", fontWeight: "600" },
  diaRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" },
  diasBtns: { display: "flex", gap: "6px", flexWrap: "wrap" },
  diaBtn: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", padding: "10px 14px", borderRadius: "20px", cursor: "pointer", fontSize: "0.82rem", fontFamily: "inherit", minHeight: "44px" },
  diaBtnAtivo: { background: "rgba(251,185,0,0.15)", border: "1px solid rgba(251,185,0,0.4)", color: "#fbb900", fontWeight: "600" },
  filtrosRow: { display: "flex", gap: "10px", marginBottom: "16px", alignItems: "center", flexWrap: "wrap" },
  inputFiltro: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff", padding: "8px 12px", fontSize: "0.85rem", fontFamily: "inherit", outline: "none" },
  countLabel: { color: "rgba(255,255,255,0.35)", fontSize: "0.82rem", marginLeft: "auto" },
  msg: { color: "rgba(255,255,255,0.35)", textAlign: "center", padding: "40px" },
  tableWrap: { overflowX: "auto", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.08)" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)", fontSize: "0.70rem", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.03em", padding: "8px 6px", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", whiteSpace: "normal", lineHeight: "1.3", maxWidth: "80px" },
  thFixed: { textAlign: "left", padding: "10px 12px" },
  thCat: { minWidth: "60px" },
  tr: { borderBottom: "1px solid rgba(255,255,255,0.04)" },
  td: { padding: "10px 8px", color: "rgba(255,255,255,0.8)", fontSize: "0.85rem", textAlign: "center" },
  tdCat: { padding: "8px 4px" },
  codBadge: { background: "rgba(251,185,0,0.12)", color: "#fbb900", padding: "2px 8px", borderRadius: "6px", fontSize: "0.78rem", fontWeight: "700" },
  statusPill: { display: "inline-block", padding: "3px 6px", borderRadius: "6px", fontSize: "0.72rem", fontWeight: "700", minWidth: "36px" },
};
