import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";

const DIAS = [
  { key: "SEG", label: "Segunda" },
  { key: "TER", label: "Terça" },
  { key: "QUA", label: "Quarta" },
  { key: "QUI", label: "Quinta" },
  { key: "SEX", label: "Sexta" },
  { key: "SAB", label: "Sábado" },
];

const STATUS_CONFIG = {
  VALID:   { label: "Validada", bg: "rgba(34,197,94,0.15)",  color: "#4ade80" },
  INVALID: { label: "Inválida", bg: "rgba(239,68,68,0.15)",  color: "#f87171" },
  OPEN:    { label: "Aberta",   bg: "rgba(251,185,0,0.15)",  color: "#fbb900" },
};

function getDiaHoje() {
  const dias = ["DOM","SEG","TER","QUA","QUI","SEX","SAB"];
  return dias[new Date().getDay()];
}

function QtdBar({ solicitada, comprada }) {
  const sol = Number(solicitada) || 0;
  const com = Number(comprada)   || 0;
  const pct = sol > 0 ? Math.min(100, Math.round((com / sol) * 100)) : 0;
  const cor  = pct >= 100 ? "#4ade80" : pct > 0 ? "#fbb900" : "rgba(255,255,255,0.2)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
      <span style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.75rem" }}>
        Solicitado: <strong style={{ color: "#fff" }}>{sol || "—"}</strong>
      </span>
      <span style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.75rem" }}>
        Comprado: <strong style={{ color: cor }}>{com || "—"}</strong>
      </span>
      {sol > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <div style={{ width: "60px", height: "4px", background: "rgba(255,255,255,0.1)", borderRadius: "2px" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: cor, borderRadius: "2px", transition: "width 0.3s" }} />
          </div>
          <span style={{ color: cor, fontSize: "0.7rem", fontWeight: "700" }}>{pct}%</span>
        </div>
      )}
    </div>
  );
}

export default function Tasks() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks]       = useState([]);
  const [pdvBase, setPdvBase]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [diaFiltro, setDiaFiltro]         = useState(getDiaHoje());
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroCluster, setFiltroCluster]     = useState("");
  const [busca, setBusca]       = useState("");
  const [pdvExpandido, setPdvExpandido]   = useState(null);
  const [viewMode, setViewMode] = useState("pdv");
  const [taskExpandida, setTaskExpandida] = useState(null);
  const [taskDetalhe, setTaskDetalhe]     = useState(null); // modal detalhe Por Task

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setLoading(true);
    try {
      const [resTasks, resBase] = await Promise.all([
        api.get("/api/tasks"),
        api.get("/api/cobertura/pdv-base"),
      ]);
      setTasks(resTasks.data || []);
      setPdvBase(resBase.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const mapaPdv = {};
  pdvBase.forEach((p) => { mapaPdv[p.cod_pdv] = p; });

  const isGestor = ["admin","director","gv1","gv3"].includes(usuario?.perfil);
  const tasksFiltradas = tasks.filter((t) => {
    if (!isGestor && t.setor !== usuario?.cod) return false;
    if (isGestor && usuario?.perfil === "gv1" && !t.setor?.startsWith("1")) return false;
    if (isGestor && usuario?.perfil === "gv3" && !t.setor?.startsWith("3")) return false;
    return true;
  });

  // Tasks do dia selecionado (só OPEN)
  const tasksDia = tasksFiltradas.filter((t) => {
    const pdv = mapaPdv[t.cod_pdv];
    if (!pdv) return false;
    const dia = String(pdv.dia_visita || "").trim().toUpperCase().split("/")[0].trim();
    return dia === diaFiltro && t.status === "OPEN";
  });

  // Opções dos filtros dinâmicos
  const categorias = [...new Set(tasksDia.map((t) => t.categoria).filter(Boolean))].sort();
  const clusters   = [...new Set(tasksDia.map((t) => t.cluster_primario).filter(Boolean))].sort();

  // Aplica filtros
  const tasksVisiveis = tasksDia.filter((t) => {
    const catOk     = !filtroCategoria || t.categoria === filtroCategoria;
    const clusterOk = !filtroCluster   || t.cluster_primario === filtroCluster;
    const buscaOk   = !busca ||
      t.cod_pdv?.includes(busca) ||
      (mapaPdv[t.cod_pdv]?.nome_fantasia || "").toLowerCase().includes(busca.toLowerCase()) ||
      t.descricao?.toLowerCase().includes(busca.toLowerCase());
    return catOk && clusterOk && buscaOk;
  });

  // Agrupa por PDV
  const porPdv = {};
  tasksVisiveis.forEach((t) => {
    if (!porPdv[t.cod_pdv]) porPdv[t.cod_pdv] = [];
    porPdv[t.cod_pdv].push(t);
  });

  // Dashboard
  const totalTasks  = tasksDia.length;
  const pdvsComTask = Object.keys(porPdv).length;

  // Agrupa Por Task (por descrição)
  const porTask = {};
  tasksVisiveis.forEach((t) => {
    const key = t.descricao || t.cluster_primario || "(sem descrição)";
    if (!porTask[key]) porTask[key] = { cluster: t.cluster_primario, categoria: t.categoria, pdvs: [] };
    porTask[key].pdvs.push(t);
  });
  const taskGroups = Object.entries(porTask)
    .sort((a, b) => b[1].pdvs.length - a[1].pdvs.length);

  return (
    <div style={styles.root}>
      <style>{`
        @media (max-width: 600px) {
          .tk-content  { padding: 12px 14px !important; }
          .tk-header   { padding: 10px 14px !important; }
          .tk-title    { font-size: 1rem !important; }
          .tk-subtitle { font-size: 0.67rem !important; max-width: 200px;
                         overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .tk-back-btn   { padding: 5px 10px !important; font-size: 0.76rem !important; }
          .tk-logout-btn { padding: 4px 9px  !important; font-size: 0.74rem !important; }

          .tk-dias { flex-wrap: nowrap !important; overflow-x: auto !important;
                     padding-bottom: 4px; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
          .tk-dias::-webkit-scrollbar { display: none; }
          .tk-dia-btn { flex-shrink: 0 !important; font-size: 0.74rem !important;
                        padding: 5px 11px !important; min-height: 36px !important; }

          .tk-dash { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 8px !important; }
          .tk-dash-val   { font-size: 1.35rem !important; }
          .tk-dash-label { font-size: 0.69rem !important; }

          .tk-filtros { gap: 6px !important; }
          .tk-search  { width: 100% !important; box-sizing: border-box !important; font-size: 0.8rem !important; }
          .tk-select  { flex: 1 !important; min-width: 0 !important; font-size: 0.78rem !important; padding: 7px 8px !important; }
          .tk-selects-row { display: flex !important; gap: 6px !important; width: 100% !important; }

          .tk-toggle-btn { font-size: 0.78rem !important; padding: 7px 12px !important; }

          .tk-pdv-nome   { font-size: 0.82rem !important; }
          .tk-pdv-cidade { display: none !important; }
          .tk-tag-aberta { font-size: 0.68rem !important; padding: 2px 6px !important; }
          .tk-cod-badge  { font-size: 0.68rem !important; padding: 2px 5px !important; }
          .tk-task-desc  { font-size: 0.8rem !important; }
          .tk-task-item  { padding: 10px 12px !important; }
          .tk-count      { font-size: 0.75rem !important; }
        }
      `}</style>

      {/* Header */}
      <div style={styles.header} className="tk-header">
        <div style={styles.headerLeft}>
          <button style={styles.backBtn} className="tk-back-btn" onClick={() => navigate("/")}>← Voltar</button>
          <div>
            <h1 style={styles.title} className="tk-title">✅ Tasks</h1>
            <p style={styles.subtitle} className="tk-subtitle">Setor {usuario?.cod} · {usuario?.nome}</p>
          </div>
        </div>
        <button style={styles.logoutBtn} className="tk-logout-btn" onClick={logout}>Sair</button>
      </div>

      <div style={styles.content} className="tk-content">
        {/* Seletor de dia */}
        <div style={styles.diasRow} className="tk-dias">
          {DIAS.map((d) => (
            <button
              key={d.key}
              className="tk-dia-btn"
              style={{ ...styles.diaBtn, ...(diaFiltro === d.key ? styles.diaBtnAtivo : {}) }}
              onClick={() => { setDiaFiltro(d.key); setPdvExpandido(null); setTaskExpandida(null); }}
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* Dashboard */}
        <div style={styles.dashRow} className="tk-dash">
          <div style={styles.dashCard}>
            <p style={styles.dashLabel} className="tk-dash-label">PDVs com tasks</p>
            <p style={styles.dashVal} className="tk-dash-val">{pdvsComTask}</p>
          </div>
          <div style={styles.dashCard}>
            <p style={styles.dashLabel} className="tk-dash-label">Total tasks abertas</p>
            <p style={styles.dashVal} className="tk-dash-val">{totalTasks}</p>
          </div>
        </div>

        {/* Toggle */}
        <div style={styles.viewToggle}>
          <button
            className="tk-toggle-btn"
            style={{ ...styles.viewBtn, ...(viewMode === "pdv" ? styles.viewBtnAtivo : {}) }}
            onClick={() => { setViewMode("pdv"); setPdvExpandido(null); setTaskExpandida(null); }}
          >
            🏪 Por PDV
          </button>
          <button
            className="tk-toggle-btn"
            style={{ ...styles.viewBtn, ...(viewMode === "task" ? styles.viewBtnAtivo : {}) }}
            onClick={() => { setViewMode("task"); setPdvExpandido(null); setTaskExpandida(null); }}
          >
            📋 Por Task
          </button>
        </div>

        {/* Filtros */}
        <div style={styles.filtrosRow} className="tk-filtros">
          <input
            className="tk-search"
            style={styles.inputBusca}
            placeholder="Buscar PDV ou descrição..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <div className="tk-selects-row" style={{ display: "flex", gap: "10px" }}>
            <select
              className="tk-select"
              style={styles.inputSelect}
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
            >
              <option value="">Todas categorias</option>
              {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              className="tk-select"
              style={styles.inputSelect}
              value={filtroCluster}
              onChange={(e) => setFiltroCluster(e.target.value)}
            >
              <option value="">Todos clusters</option>
              {clusters.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <span style={styles.countLabel} className="tk-count">
            {Object.keys(porPdv).length} PDVs · {tasksVisiveis.length} tasks
          </span>
        </div>

        {/* Lista */}
        {loading ? (
          <p style={styles.msg}>Carregando...</p>
        ) : tasksVisiveis.length === 0 ? (
          <p style={styles.msg}>Nenhuma task aberta para {diaFiltro}.</p>
        ) : viewMode === "pdv" ? (

          /* ── VISÃO POR PDV ── */
          <div style={styles.lista}>
            {Object.entries(porPdv).map(([codPdv, tasksPdv]) => {
              const pdv   = mapaPdv[codPdv];
              const aberto = pdvExpandido === codPdv;
              return (
                <div key={codPdv} style={styles.pdvCard}>
                  <div
                    style={{ ...styles.pdvHeader, ...(aberto ? styles.pdvHeaderAberto : {}) }}
                    onClick={() => setPdvExpandido(aberto ? null : codPdv)}
                  >
                    <div style={styles.pdvHeaderLeft}>
                      <span className="tk-cod-badge" style={styles.codBadge}>{codPdv}</span>
                      <span className="tk-pdv-nome" style={styles.pdvNome}>{pdv?.nome_fantasia || codPdv}</span>
                      <span className="tk-pdv-cidade" style={styles.pdvCidade}>{pdv?.cidade}</span>
                    </div>
                    <div style={styles.pdvHeaderRight}>
                      <span className="tk-tag-aberta" style={styles.tagAberta}>{tasksPdv.length} aberta(s)</span>
                      <span style={styles.expandIcon}>{aberto ? "▲" : "▼"}</span>
                    </div>
                  </div>

                  {aberto && (
                    <div style={styles.tasksList}>
                      {tasksPdv.map((t, i) => {
                        const sc = STATUS_CONFIG[t.status] || STATUS_CONFIG.OPEN;
                        return (
                          <div key={i} className="tk-task-item" style={styles.taskItem}>
                            {/* Cabeçalho da task */}
                            <div style={styles.taskLeft}>
                              <span style={{ ...styles.statusTag, background: sc.bg, color: sc.color }}>{sc.label}</span>
                              {t.categoria && (
                                <span style={styles.catTag}>{t.categoria}</span>
                              )}
                              {t.cluster_primario && (
                                <span style={styles.clusterTag}>{t.cluster_primario}</span>
                              )}
                            </div>
                            {/* Descrição */}
                            <p className="tk-task-desc" style={styles.taskDesc}>{t.descricao}</p>
                            {/* Quantidades + pontuação */}
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                              <QtdBar solicitada={t.qtd_solicitada} comprada={t.qtd_comprada} />
                              {t.pontuacao && (
                                <span style={styles.ptsTag}>⭐ {t.pontuacao} pts</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        ) : (

          /* ── VISÃO POR TASK ── */
          <div style={styles.lista}>
            {taskGroups.map(([descricao, grupo]) => {
              const aberto    = taskExpandida === descricao;
              const pdvsUnicos = [...new Map(grupo.pdvs.map((t) => [t.cod_pdv, t])).values()];
              return (
                <div key={descricao} style={styles.pdvCard}>
                  <div
                    style={{ ...styles.pdvHeader, borderLeft: "3px solid rgba(251,185,0,0.5)" }}
                    onClick={() => setTaskExpandida(aberto ? null : descricao)}
                  >
                    <div style={{ ...styles.pdvHeaderLeft, flexDirection: "column", alignItems: "flex-start", gap: "4px" }}>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        {grupo.categoria && <span style={styles.catTag}>{grupo.categoria}</span>}
                        {grupo.cluster   && <span style={styles.clusterTag}>{grupo.cluster}</span>}
                      </div>
                      <span className="tk-pdv-nome" style={styles.pdvNome}>{descricao}</span>
                    </div>
                    <div style={styles.pdvHeaderRight}>
                      <span className="tk-tag-aberta" style={styles.tagAberta}>{pdvsUnicos.length} PDV{pdvsUnicos.length !== 1 ? "s" : ""}</span>
                      <span style={styles.expandIcon}>{aberto ? "▲" : "▼"}</span>
                    </div>
                  </div>

                  {aberto && (
                    <div style={styles.tasksList}>
                      {pdvsUnicos.map((t) => {
                        const pdv = mapaPdv[t.cod_pdv];
                        return (
                          <div
                            key={t.cod_pdv}
                            className="tk-task-item"
                            style={{ ...styles.taskItem, flexDirection: "row", alignItems: "center", gap: "10px", cursor: "pointer" }}
                            onClick={() => setTaskDetalhe({ task: t, pdv })}
                          >
                            <span className="tk-cod-badge" style={styles.codBadge}>{t.cod_pdv}</span>
                            <span className="tk-pdv-nome" style={{ ...styles.pdvNome, flex: 1 }}>{pdv?.nome_fantasia || t.cod_pdv}</span>
                            <QtdBar solicitada={t.qtd_solicitada} comprada={t.qtd_comprada} />
                            <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.75rem", flexShrink: 0 }}>›</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        )}
      </div>

      {/* Modal detalhe task (Por Task → clique no PDV) */}
      {taskDetalhe && (
        <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && setTaskDetalhe(null)}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                  <span style={styles.codBadge}>{taskDetalhe.task.cod_pdv}</span>
                  <h2 style={styles.modalTitle}>{taskDetalhe.pdv?.nome_fantasia || taskDetalhe.task.cod_pdv}</h2>
                </div>
                {taskDetalhe.pdv?.cidade && (
                  <p style={{ margin: 0, fontSize: "0.78rem", color: "rgba(255,255,255,0.4)" }}>{taskDetalhe.pdv.cidade}</p>
                )}
              </div>
              <button style={styles.closeBtn} onClick={() => setTaskDetalhe(null)}>✕</button>
            </div>

            <div style={styles.modalBody}>
              {/* Descrição */}
              <p style={{ margin: 0, color: "rgba(255,255,255,0.85)", fontSize: "0.95rem", lineHeight: "1.5" }}>
                {taskDetalhe.task.descricao}
              </p>

              {/* Tags */}
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {taskDetalhe.task.categoria && <span style={styles.catTag}>{taskDetalhe.task.categoria}</span>}
                {taskDetalhe.task.cluster_primario && <span style={styles.clusterTag}>{taskDetalhe.task.cluster_primario}</span>}
                {(() => { const sc = STATUS_CONFIG[taskDetalhe.task.status] || STATUS_CONFIG.OPEN;
                  return <span style={{ ...styles.statusTag, background: sc.bg, color: sc.color }}>{sc.label}</span>; })()}
              </div>

              {/* Quantidades */}
              <div style={styles.detalheGrid}>
                <div style={styles.detalheItem}>
                  <span style={styles.detalheLabel}>Qtd Solicitada</span>
                  <span style={styles.detalheVal}>{taskDetalhe.task.qtd_solicitada || "—"}</span>
                </div>
                <div style={styles.detalheItem}>
                  <span style={styles.detalheLabel}>Qtd Comprada</span>
                  <span style={{ ...styles.detalheVal, color: Number(taskDetalhe.task.qtd_comprada) > 0 ? "#4ade80" : "rgba(255,255,255,0.4)" }}>
                    {taskDetalhe.task.qtd_comprada || "—"}
                  </span>
                </div>
                <div style={styles.detalheItem}>
                  <span style={styles.detalheLabel}>Pontuação</span>
                  <span style={{ ...styles.detalheVal, color: "#fbb900" }}>
                    {taskDetalhe.task.pontuacao ? `${taskDetalhe.task.pontuacao} pts` : "—"}
                  </span>
                </div>
                <div style={styles.detalheItem}>
                  <span style={styles.detalheLabel}>Mensal/Diária</span>
                  <span style={styles.detalheVal}>{taskDetalhe.task.mensal_diaria || "—"}</span>
                </div>
              </div>

              {/* Barra de progresso */}
              <QtdBar solicitada={taskDetalhe.task.qtd_solicitada} comprada={taskDetalhe.task.qtd_comprada} />

              {/* Justificativa */}
              {taskDetalhe.task.justificativa && taskDetalhe.task.justificativa !== "nan" && (
                <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "8px", padding: "12px" }}>
                  <p style={{ margin: "0 0 4px", fontSize: "0.72rem", color: "#f87171", textTransform: "uppercase", letterSpacing: "0.05em" }}>Justificativa</p>
                  <p style={{ margin: 0, color: "rgba(255,255,255,0.7)", fontSize: "0.85rem" }}>{taskDetalhe.task.justificativa}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  root:       { minHeight: "100vh", background: "#0a0f1e", fontFamily: "'Segoe UI', system-ui, sans-serif", color: "#fff" },
  header:     { display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "20px 32px", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", flexWrap: "wrap", gap: "12px" },
  headerLeft: { display: "flex", alignItems: "center", gap: "12px" },
  backBtn:    { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", padding: "8px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem", fontFamily: "inherit" },
  title:      { margin: 0, fontSize: "1.3rem", fontWeight: "700" },
  subtitle:   { margin: 0, fontSize: "0.8rem", color: "rgba(255,255,255,0.4)" },
  logoutBtn:  { background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)", padding: "6px 12px", borderRadius: "8px", cursor: "pointer", fontSize: "0.82rem", fontFamily: "inherit" },
  content:    { padding: "24px 32px", maxWidth: "1100px", margin: "0 auto" },
  diasRow:    { display: "flex", gap: "6px", marginBottom: "20px", flexWrap: "wrap" },
  diaBtn:     { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", padding: "6px 16px", borderRadius: "20px", cursor: "pointer", fontSize: "0.82rem", fontFamily: "inherit" },
  diaBtnAtivo:{ background: "rgba(251,185,0,0.15)", border: "1px solid rgba(251,185,0,0.4)", color: "#fbb900", fontWeight: "600" },
  dashRow:    { display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" },
  dashCard:   { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "14px 18px", flex: 1, minWidth: "100px" },
  dashLabel:  { margin: "0 0 6px", fontSize: "0.75rem", color: "rgba(255,255,255,0.45)" },
  dashVal:    { margin: 0, fontSize: "1.6rem", fontWeight: "700" },
  viewToggle: { display: "flex", gap: "6px", marginBottom: "16px" },
  viewBtn:    { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", padding: "8px 18px", borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem", fontFamily: "inherit", fontWeight: "500" },
  viewBtnAtivo:{ background: "rgba(251,185,0,0.12)", border: "1px solid rgba(251,185,0,0.4)", color: "#fbb900", fontWeight: "700" },
  filtrosRow: { display: "flex", gap: "10px", marginBottom: "16px", alignItems: "center", flexWrap: "wrap" },
  inputBusca: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff", padding: "8px 12px", fontSize: "0.85rem", fontFamily: "inherit", outline: "none", minWidth: "200px" },
  inputSelect:{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff", padding: "8px 12px", fontSize: "0.85rem", fontFamily: "inherit", outline: "none", cursor: "pointer" },
  countLabel: { color: "rgba(255,255,255,0.35)", fontSize: "0.82rem", marginLeft: "auto" },
  msg:        { color: "rgba(255,255,255,0.35)", textAlign: "center", padding: "40px" },
  lista:      { display: "flex", flexDirection: "column", gap: "8px" },
  pdvCard:    { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", overflow: "hidden" },
  pdvHeader:  { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", cursor: "pointer", transition: "background 0.15s" },
  pdvHeaderAberto: { borderLeft: "3px solid #fbb900" },
  pdvHeaderLeft:   { display: "flex", alignItems: "center", gap: "8px", flex: 1, flexWrap: "wrap" },
  pdvHeaderRight:  { display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 },
  codBadge:   { background: "rgba(251,185,0,0.12)", color: "#fbb900", padding: "2px 8px", borderRadius: "6px", fontSize: "0.78rem", fontWeight: "700", whiteSpace: "nowrap" },
  pdvNome:    { color: "#fff", fontSize: "0.88rem", fontWeight: "500" },
  pdvCidade:  { color: "rgba(255,255,255,0.35)", fontSize: "0.78rem" },
  tagAberta:  { background: "rgba(251,185,0,0.15)", color: "#fbb900", padding: "2px 8px", borderRadius: "20px", fontSize: "0.72rem", fontWeight: "600" },
  expandIcon: { color: "rgba(255,255,255,0.3)", fontSize: "0.75rem", marginLeft: "4px" },
  tasksList:  { borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column" },
  taskItem:   { padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", flexDirection: "column", gap: "8px" },
  taskLeft:   { display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" },
  statusTag:  { padding: "2px 8px", borderRadius: "6px", fontSize: "0.72rem", fontWeight: "700" },
  catTag:     { background: "rgba(96,165,250,0.15)", color: "#60a5fa", padding: "2px 8px", borderRadius: "6px", fontSize: "0.7rem", fontWeight: "600" },
  clusterTag: { background: "rgba(167,139,250,0.15)", color: "#a78bfa", padding: "2px 7px", borderRadius: "6px", fontSize: "0.68rem", fontWeight: "500" },
  ptsTag:     { color: "#fbb900", fontSize: "0.75rem", fontWeight: "600" },
  taskDesc:   { margin: 0, color: "rgba(255,255,255,0.75)", fontSize: "0.85rem", lineHeight: "1.4" },
  // Modal
  overlay:    { position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" },
  modal:      { background: "#111827", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", width: "100%", maxWidth: "520px", maxHeight: "90vh", overflow: "auto" },
  modalHeader:{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.08)" },
  modalTitle: { margin: 0, fontSize: "1rem", fontWeight: "700" },
  closeBtn:   { background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", fontSize: "1.2rem", cursor: "pointer", flexShrink: 0 },
  modalBody:  { padding: "20px 24px", display: "flex", flexDirection: "column", gap: "16px" },
  detalheGrid:{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "12px" },
  detalheItem:{ display: "flex", flexDirection: "column", gap: "4px", background: "rgba(255,255,255,0.04)", borderRadius: "8px", padding: "10px 12px" },
  detalheLabel:{ color: "rgba(255,255,255,0.4)", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em" },
  detalheVal: { color: "#fff", fontSize: "1rem", fontWeight: "700" },
};
