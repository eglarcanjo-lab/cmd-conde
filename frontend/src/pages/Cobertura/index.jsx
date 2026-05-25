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
  { key: "TRIMARCA RGB HE (Original)", label: "Trimarca HE Original" },
  { key: "TRIMARCA RGB HE (Stella)",   label: "Trimarca HE Stella" },
  { key: "TRIMARCA RGB HE (Spaten)",   label: "Trimarca HE Spaten" },
];

// Sub-SKUs HE para distribuição
const HE_SKUS = [
  "TRIMARCA RGB HE (Original)",
  "TRIMARCA RGB HE (Stella)",
  "TRIMARCA RGB HE (Spaten)",
];

function calcDistHE(cob) {
  return HE_SKUS.filter((sku) => cob[sku] === "OK").length;
}
function corDist(dist, max) {
  const pct = max > 0 ? dist / max : 0;
  if (pct >= 1)   return "#4ade80";
  if (pct >= 0.6) return "#fbb900";
  if (pct > 0)    return "#fb923c";
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
  OK:       { bg: "rgba(34,197,94,0.15)",  color: "#4ade80" },
  PENDENTE: { bg: "rgba(251,185,0,0.15)",  color: "#fbb900" },
  NOK:      { bg: "rgba(239,68,68,0.15)",  color: "#f87171" },
  "—":      { bg: "transparent",           color: "rgba(255,255,255,0.15)" },
};

function getDiaHoje() {
  const dias = ["DOM","SEG","TER","QUA","QUI","SEX","SAB"];
  return dias[new Date().getDay()];
}

export default function Cobertura() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const [cobertura, setCobertura]   = useState([]);
  const [pdvBase, setPdvBase]       = useState([]);
  const [pdvMix, setPdvMix]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [diaFiltro, setDiaFiltro]   = useState(getDiaHoje());
  const [busca, setBusca]           = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [aba, setAba]               = useState("cobertura"); // "cobertura" | "distribuicao"

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setLoading(true);
    try {
      const [resC, resP, resM] = await Promise.all([
        api.get("/api/cobertura"),
        api.get("/api/cobertura/pdv-base"),
        api.get("/api/pdvs/mix").catch(() => ({ data: [] })),
      ]);
      setCobertura(resC.data || []);
      setPdvBase(resP.data || []);
      setPdvMix(resM.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const isGestor = ["admin","director","gv1","gv3"].includes(usuario?.perfil);

  const coberturaSetor = isGestor ? cobertura
    : cobertura.filter((r) => r.setor === usuario?.cod);

  const pdvSetor = isGestor ? pdvBase
    : pdvBase.filter((r) => r.setor === usuario?.cod);

  const pdvsDia = pdvSetor.filter((p) => {
    const dia = String(p.dia_visita || "").trim().toUpperCase().split("/")[0].trim();
    return dia === diaFiltro;
  });

  // Mapa cobertura: { cod_pdv: { categoria: status } }
  const mapaCob = {};
  coberturaSetor.forEach((r) => {
    if (!mapaCob[r.cod_pdv]) mapaCob[r.cod_pdv] = {};
    mapaCob[r.cod_pdv][r.categoria] = r.status;
  });

  // Mapa distribuição: { cod_pdv: [produto, produto, ...] }
  const mapaDist = {};
  pdvMix.forEach((r) => {
    if (!mapaDist[r.cod_pdv]) mapaDist[r.cod_pdv] = new Set();
    if (r.produto) mapaDist[r.cod_pdv].add(r.produto);
  });

  // ── PDVs do dia com dados enriquecidos ────────────────────────────────────
  const pdvsComDados = pdvsDia.map((p) => ({
    ...p,
    cob:      mapaCob[p.cod_pdv] || {},
    distTotal: mapaDist[p.cod_pdv]?.size ?? 0,
    distHE:   calcDistHE(mapaCob[p.cod_pdv] || {}),
    skus:     mapaDist[p.cod_pdv] ? [...mapaDist[p.cod_pdv]] : [],
  }));

  const pdvsFiltrados = pdvsComDados.filter((p) => {
    const buscaOk = !busca
      || p.nome_fantasia?.toLowerCase().includes(busca.toLowerCase())
      || p.cod_pdv?.includes(busca);
    const statusOk = !filtroStatus || Object.values(p.cob).includes(filtroStatus);
    return buscaOk && statusOk;
  });

  // ── Resumo cobertura por categoria ───────────────────────────────────────
  function calcResumo(pdvList) {
    const resumo = {};
    CATEGORIAS.forEach((c) => { resumo[c.key] = { OK: 0, PENDENTE: 0, NOK: 0, total: 0 }; });
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
  const totalOk    = Object.values(resumoTotal).reduce((a,b) => a + b.OK, 0);
  const totalPend  = Object.values(resumoTotal).reduce((a,b) => a + b.PENDENTE, 0);
  const totalNok   = Object.values(resumoTotal).reduce((a,b) => a + b.NOK, 0);

  // ── Resumo distribuição por categoria (base total) ───────────────────────
  // Para cada categoria, conta PDVs com ao menos 1 OK = "cobertos"
  // e média de OK entre os cobertos = proxy de distribuição até ter SKU-level
  const resumoDist = CATEGORIAS.map((c) => {
    const cobertos = pdvSetor.filter((p) => mapaCob[p.cod_pdv]?.[c.key] === "OK").length;
    const pct = pdvSetor.length > 0 ? Math.round((cobertos / pdvSetor.length) * 100) : 0;
    return { ...c, cobertos, pct };
  }).sort((a, b) => b.cobertos - a.cobertos);

  // Distribuição total (pdv_mix) — base completa
  const allDist = pdvSetor.map((p) => mapaDist[p.cod_pdv]?.size ?? 0);
  const mediaDistTotal = allDist.length > 0
    ? (allDist.reduce((s,v) => s + v, 0) / allDist.filter(v => v > 0).length || 0).toFixed(1)
    : "0.0";
  const maxDist = Math.max(...allDist, 1);

  // HE breakdown (base total)
  const distHEArr = pdvSetor.map((p) => calcDistHE(mapaCob[p.cod_pdv] || {}));
  const distHEBreak = [0,1,2,3].map((n) => distHEArr.filter((d) => d === n).length);
  const cobertosHE = distHEArr.filter((d) => d > 0).length;
  const mediaHE = cobertosHE > 0
    ? (distHEArr.reduce((s,v) => s + v, 0) / cobertosHE).toFixed(1)
    : "0.0";

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <button style={styles.backBtn} onClick={() => navigate("/")}>← Voltar</button>
          <div>
            <h1 style={styles.title}>📊 Cobertura & Distribuição</h1>
            <p style={styles.subtitle}>Setor {usuario?.cod} · {usuario?.nome}</p>
          </div>
        </div>
        <button style={styles.logoutBtn} onClick={logout}>Sair</button>
      </div>

      <div style={styles.content}>

        {/* ── Sub-abas ── */}
        <div style={styles.abas}>
          <button
            style={{ ...styles.abaBtn, ...(aba === "cobertura" ? styles.abaBtnAtivo : {}) }}
            onClick={() => setAba("cobertura")}
          >
            📊 Cobertura
          </button>
          <button
            style={{ ...styles.abaBtn, ...(aba === "distribuicao" ? styles.abaBtnAtivo : {}) }}
            onClick={() => setAba("distribuicao")}
          >
            📦 Distribuição
          </button>
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            ABA COBERTURA
        ════════════════════════════════════════════════════════════════════ */}
        {aba === "cobertura" && (
          <>
            {/* Dashboard */}
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

            {/* Resumo por categoria */}
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

            {/* Visitas do dia */}
            <div style={styles.section}>
              <div style={styles.diaRow}>
                <h3 style={styles.sectionTitle}>Visitas do Dia</h3>
                <div style={styles.diasBtns}>
                  {DIAS.map((d) => (
                    <button key={d.key}
                      style={{ ...styles.diaBtn, ...(diaFiltro === d.key ? styles.diaBtnAtivo : {}) }}
                      onClick={() => setDiaFiltro(d.key)}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={styles.filtrosRow}>
                <input style={styles.inputFiltro} placeholder="Buscar PDV..." value={busca} onChange={(e) => setBusca(e.target.value)} />
                <select style={styles.inputFiltro} value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
                  <option value="">Todos os status</option>
                  <option value="OK">OK</option>
                  <option value="PENDENTE">Pendente</option>
                  <option value="NOK">NOK</option>
                </select>
                <span style={styles.countLabel}>{pdvsFiltrados.length} PDVs</span>
              </div>
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
                        <th style={{ ...styles.th, minWidth: "160px" }}>Nome</th>
                        <th style={styles.th}>Cidade</th>
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
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            ABA DISTRIBUIÇÃO
        ════════════════════════════════════════════════════════════════════ */}
        {aba === "distribuicao" && (
          <>
            {/* Dashboard distribuição */}
            <div style={styles.dashRow}>
              <div style={styles.dashCard}>
                <p style={styles.dashLabel}>PDVs na base</p>
                <p style={styles.dashVal}>{pdvSetor.length}</p>
              </div>
              <div style={{ ...styles.dashCard, borderColor: "rgba(251,185,0,0.3)" }}>
                <p style={styles.dashLabel}>Média SKUs únicos / PDV</p>
                <p style={{ ...styles.dashVal, color: "#fbb900" }}>{mediaDistTotal}</p>
              </div>
              <div style={{ ...styles.dashCard, borderColor: "rgba(251,185,0,0.2)" }}>
                <p style={styles.dashLabel}>📅 PDVs no dia</p>
                <p style={{ ...styles.dashVal, color: "#fbb900" }}>{pdvsDia.length}</p>
              </div>
            </div>

            {/* Cobertura por categoria (ordenado por maior cobertura) */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Cobertura por Categoria — Base Total</h3>
              <p style={{ margin: "-8px 0 16px", fontSize: "0.75rem", color: "rgba(255,255,255,0.3)" }}>
                Cobertura = PDV tem qualquer SKU da categoria (independente de mix ou quantidade)
              </p>
              <div style={styles.catGrid}>
                {resumoDist.map((c) => {
                  const cor = c.pct >= 70 ? "#4ade80" : c.pct >= 40 ? "#fbb900" : "#f87171";
                  return (
                    <div key={c.key} style={styles.catCard}>
                      <p style={styles.catLabel}>{c.label}</p>
                      <p style={{ ...styles.catPct, color: cor }}>{c.pct}%</p>
                      <div style={styles.catBar}>
                        <div style={{ ...styles.catBarFill, width: `${c.pct}%`, background: cor }} />
                      </div>
                      <p style={{ margin: "4px 0 0", fontSize: "0.72rem", color: "rgba(255,255,255,0.35)" }}>
                        {c.cobertos} / {pdvSetor.length} PDVs
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Distribuição HE (multi-SKU) */}
            <div style={{ ...styles.section, borderColor: "rgba(251,185,0,0.2)" }}>
              <h3 style={{ ...styles.sectionTitle, color: "#fbb900" }}>🍺 Distribuição HE — SKUs Únicos</h3>
              <p style={{ margin: "-8px 0 16px", fontSize: "0.75rem", color: "rgba(255,255,255,0.3)" }}>
                Distribuição = qtd de SKUs distintos presentes (Original, Stella, Spaten). 2 caixas do mesmo SKU = 1.
              </p>
              <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
                <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.82rem" }}>
                  PDVs cobertos: <strong style={{ color: "#fff" }}>{cobertosHE} / {pdvSetor.length}</strong>
                </span>
                <span style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.82rem" }}>·</span>
                <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.82rem" }}>
                  Média: <strong style={{ color: "#fbb900" }}>{mediaHE} SKUs</strong>
                </span>
              </div>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                {[0,1,2,3].map((n) => {
                  const qtd = distHEBreak[n];
                  const pct = pdvSetor.length > 0 ? Math.round((qtd / pdvSetor.length) * 100) : 0;
                  const cor = corDist(n, 3);
                  const labels = ["0 SKUs","1 SKU","2 SKUs","3 SKUs ✓"];
                  return (
                    <div key={n} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${cor}40`, borderRadius: "10px", padding: "12px 16px", flex: 1, minWidth: "100px", textAlign: "center" }}>
                      <p style={{ margin: "0 0 4px", fontSize: "0.72rem", color: "rgba(255,255,255,0.45)" }}>{labels[n]}</p>
                      <p style={{ margin: "0 0 2px", fontSize: "1.5rem", fontWeight: "800", color: cor }}>{qtd}</p>
                      <p style={{ margin: 0, fontSize: "0.72rem", color: "rgba(255,255,255,0.3)" }}>{pct}%</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tabela do dia — distribuição */}
            <div style={styles.section}>
              <div style={styles.diaRow}>
                <h3 style={styles.sectionTitle}>Distribuição por PDV — Visitas do Dia</h3>
                <div style={styles.diasBtns}>
                  {DIAS.map((d) => (
                    <button key={d.key}
                      style={{ ...styles.diaBtn, ...(diaFiltro === d.key ? styles.diaBtnAtivo : {}) }}
                      onClick={() => setDiaFiltro(d.key)}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={styles.filtrosRow}>
                <input style={styles.inputFiltro} placeholder="Buscar PDV..." value={busca} onChange={(e) => setBusca(e.target.value)} />
                <span style={styles.countLabel}>{pdvsFiltrados.length} PDVs</span>
              </div>
              {loading ? (
                <p style={styles.msg}>Carregando...</p>
              ) : pdvsFiltrados.length === 0 ? (
                <p style={styles.msg}>Nenhum PDV para {diaFiltro}.</p>
              ) : (
                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={{ ...styles.th, ...styles.thFixed }}>Cód</th>
                        <th style={{ ...styles.th, minWidth: "160px" }}>Nome</th>
                        <th style={styles.th}>Cidade</th>
                        <th style={{ ...styles.th, color: "#fbb900" }}>SKUs únicos</th>
                        <th style={{ ...styles.th, color: "#fbb900" }}>Dist. HE</th>
                        {CATEGORIAS.slice(0, 11).map((c) => (
                          <th key={c.key} style={{ ...styles.th, ...styles.thCat }}>{c.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...pdvsFiltrados]
                        .sort((a, b) => b.distTotal - a.distTotal)
                        .map((p) => {
                          const corTotal = corDist(p.distTotal, maxDist);
                          const corHE    = corDist(p.distHE, 3);
                          return (
                            <tr key={p.cod_pdv} style={styles.tr}>
                              <td style={{ ...styles.td, ...styles.thFixed }}>
                                <span style={styles.codBadge}>{p.cod_pdv}</span>
                              </td>
                              <td style={{ ...styles.td, fontSize: "0.82rem" }}>{p.nome_fantasia}</td>
                              <td style={{ ...styles.td, fontSize: "0.78rem", color: "rgba(255,255,255,0.4)" }}>{p.cidade}</td>
                              <td style={{ ...styles.td, ...styles.tdCat, background: "rgba(251,185,0,0.04)" }}>
                                <span style={{ ...styles.statusPill, background: `${corTotal}22`, color: corTotal, fontWeight: "800" }}>
                                  {p.distTotal}
                                </span>
                              </td>
                              <td style={{ ...styles.td, ...styles.tdCat, background: "rgba(251,185,0,0.04)" }}>
                                <span style={{ ...styles.statusPill, background: `${corHE}22`, color: corHE, fontWeight: "800" }}>
                                  {p.distHE}/3
                                </span>
                              </td>
                              {CATEGORIAS.slice(0, 11).map((c) => {
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
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

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
  abas: { display: "flex", gap: "6px", marginBottom: "24px", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "0" },
  abaBtn: { background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", padding: "10px 20px", cursor: "pointer", fontSize: "0.9rem", fontFamily: "inherit", borderBottom: "2px solid transparent", marginBottom: "-1px", fontWeight: "500" },
  abaBtnAtivo: { color: "#fbb900", borderBottom: "2px solid #fbb900", fontWeight: "700" },
  dashRow: { display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" },
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
