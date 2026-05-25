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
  VALID:   { label: "Validada",  bg: "rgba(34,197,94,0.15)",  color: "#4ade80" },
  INVALID: { label: "Inválida",  bg: "rgba(239,68,68,0.15)",  color: "#f87171" },
  OPEN:    { label: "Aberta",    bg: "rgba(251,185,0,0.15)",   color: "#fbb900" },
};

const TIPOS_COLOR = {
  "Atendimento": "#60a5fa",
  "Devolução":   "#f87171",
  "Reversão":    "#fbb900",
  "Cadastro":    "#a78bfa",
  "":            "rgba(255,255,255,0.4)",
};

function getDiaHoje() {
  const dias = ["DOM","SEG","TER","QUA","QUI","SEX","SAB"];
  return dias[new Date().getDay()];
}

function dataParaDia(dataStr) {
  // Converte "dd/mm/yyyy" para dia da semana abreviado
  try {
    const [d, m, y] = dataStr.split("/").map(Number);
    const dia = new Date(y, m - 1, d).getDay();
    return ["DOM","SEG","TER","QUA","QUI","SEX","SAB"][dia];
  } catch {
    return "";
  }
}

export default function Tasks() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [pdvBase, setPdvBase] = useState([]);
  const [loading, setLoading] = useState(true);
  const [diaFiltro, setDiaFiltro] = useState(getDiaHoje());
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [busca, setBusca] = useState("");
  const [pdvExpandido, setPdvExpandido] = useState(null);
  const [viewMode, setViewMode] = useState("pdv");     // "pdv" | "task"
  const [taskExpandida, setTaskExpandida] = useState(null);

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

  // Mapa de PDVs com dia de visita
  const mapaPdv = {};
  pdvBase.forEach((p) => { mapaPdv[p.cod_pdv] = p; });

  // Filtra tasks pelo setor do usuário
  const isGestor = ["admin","director","gv1","gv3"].includes(usuario?.perfil);
  const tasksFiltradas = tasks.filter((t) => {
    if (!isGestor && t.setor !== usuario?.cod) return false;
    if (isGestor && usuario?.perfil === "gv1" && !t.setor?.startsWith("1")) return false;
    if (isGestor && usuario?.perfil === "gv3" && !t.setor?.startsWith("3")) return false;
    return true;
  });

  // Filtra pelo dia de visita do PDV — mostra apenas OPEN
  const tasksDia = tasksFiltradas.filter((t) => {
    const pdv = mapaPdv[t.cod_pdv];
    if (!pdv) return false;
    const dia = String(pdv.dia_visita || "").trim().toUpperCase().split("/")[0].trim();
    return dia === diaFiltro && t.status === "OPEN";
  });

  // Aplica filtros adicionais
  const tasksVisiveis = tasksDia.filter((t) => {
    const statusOk = !filtroStatus || t.status === filtroStatus;
    const tipoOk = !filtroTipo || t.tipo === filtroTipo;
    const buscaOk = !busca ||
      t.cod_pdv?.includes(busca) ||
      (mapaPdv[t.cod_pdv]?.nome_fantasia || "").toLowerCase().includes(busca.toLowerCase()) ||
      t.descricao?.toLowerCase().includes(busca.toLowerCase());
    return statusOk && tipoOk && buscaOk;
  });

  // Agrupa por PDV
  const porPdv = {};
  tasksVisiveis.forEach((t) => {
    if (!porPdv[t.cod_pdv]) porPdv[t.cod_pdv] = [];
    porPdv[t.cod_pdv].push(t);
  });

  // Dashboard
  const totalTasks = tasksDia.length;
  const pdvsComTask = Object.keys(porPdv).length;

  const tipos = [...new Set(tasksDia.map((t) => t.tipo).filter(Boolean))];

  // Agrupamento Por Task — agrupa por descrição, ordena por mais abertas
  const porTask = {};
  tasksVisiveis.forEach((t) => {
    const key = t.descricao || t.tipo || "(sem descrição)";
    if (!porTask[key]) porTask[key] = { tipo: t.tipo, pdvs: [] };
    porTask[key].pdvs.push(t);
  });
  const taskGroups = Object.entries(porTask)
    .sort((a, b) => b[1].pdvs.length - a[1].pdvs.length);

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <button style={styles.backBtn} onClick={() => navigate("/")}>← Voltar</button>
          <div>
            <h1 style={styles.title}>✅ Tasks</h1>
            <p style={styles.subtitle}>Setor {usuario?.cod} · {usuario?.nome}</p>
          </div>
        </div>
        <button style={styles.logoutBtn} onClick={logout}>Sair</button>
      </div>

      <div style={styles.content}>
        {/* Seletor de dia */}
        <div style={styles.diasRow}>
          {DIAS.map((d) => (
            <button
              key={d.key}
              style={{ ...styles.diaBtn, ...(diaFiltro === d.key ? styles.diaBtnAtivo : {}) }}
              onClick={() => { setDiaFiltro(d.key); setPdvExpandido(null); }}
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* Dashboard */}
        <div style={styles.dashRow}>
          <div style={styles.dashCard}>
            <p style={styles.dashLabel}>PDVs com tasks</p>
            <p style={styles.dashVal}>{pdvsComTask}</p>
          </div>
          <div style={styles.dashCard}>
            <p style={styles.dashLabel}>Total tasks abertas</p>
            <p style={styles.dashVal}>{totalTasks}</p>
          </div>
        </div>

        {/* Toggle de visualização */}
        <div style={styles.viewToggle}>
          <button
            style={{ ...styles.viewBtn, ...(viewMode === "pdv" ? styles.viewBtnAtivo : {}) }}
            onClick={() => { setViewMode("pdv"); setPdvExpandido(null); setTaskExpandida(null); }}
          >
            🏪 Por PDV
          </button>
          <button
            style={{ ...styles.viewBtn, ...(viewMode === "task" ? styles.viewBtnAtivo : {}) }}
            onClick={() => { setViewMode("task"); setPdvExpandido(null); setTaskExpandida(null); }}
          >
            📋 Por Task
          </button>
        </div>

        {/* Filtros */}
        <div style={styles.filtrosRow}>
          <input
            style={styles.inputFiltro}
            placeholder="Buscar PDV ou descrição..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <select style={styles.inputFiltro} value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
            <option value="">Todos os status</option>
            <option value="OPEN">Abertas</option>
            <option value="VALID">Validadas</option>
            <option value="INVALID">Inválidas</option>
          </select>
          <select style={styles.inputFiltro} value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
            <option value="">Todos os tipos</option>
            {tipos.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <span style={styles.countLabel}>{Object.keys(porPdv).length} PDVs · {tasksVisiveis.length} tasks</span>
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
              const pdv = mapaPdv[codPdv];
              const aberto = pdvExpandido === codPdv;
              return (
                <div key={codPdv} style={styles.pdvCard}>
                  <div
                    style={{ ...styles.pdvHeader, ...styles.pdvHeaderAberto }}
                    onClick={() => setPdvExpandido(aberto ? null : codPdv)}
                  >
                    <div style={styles.pdvHeaderLeft}>
                      <span style={styles.codBadge}>{codPdv}</span>
                      <span style={styles.pdvNome}>{pdv?.nome_fantasia || codPdv}</span>
                      <span style={styles.pdvCidade}>{pdv?.cidade}</span>
                    </div>
                    <div style={styles.pdvHeaderRight}>
                      <span style={styles.tagAberta}>{tasksPdv.length} aberta(s)</span>
                      <span style={styles.expandIcon}>{aberto ? "▲" : "▼"}</span>
                    </div>
                  </div>
                  {aberto && (
                    <div style={styles.tasksList}>
                      {tasksPdv.map((t, i) => {
                        const tipoColor = TIPOS_COLOR[t.tipo] || TIPOS_COLOR[""];
                        return (
                          <div key={i} style={styles.taskItem}>
                            <div style={styles.taskLeft}>
                              <span style={{ ...styles.statusTag, background: STATUS_CONFIG.OPEN.bg, color: STATUS_CONFIG.OPEN.color }}>
                                Aberta
                              </span>
                              <span style={{ ...styles.tipoTag, color: tipoColor }}>{t.tipo}</span>
                            </div>
                            <p style={styles.taskDesc}>{t.descricao}</p>
                            <div style={styles.taskMeta}>
                              <span style={styles.taskMetaItem}>📅 {t.data_visita}</span>
                              <span style={styles.taskMetaItem}>⭐ {t.pontuacao} pts</span>
                              <span style={styles.taskMetaItem}>#{t.id_task}</span>
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
              const aberto = taskExpandida === descricao;
              const pdvsUnicos = [...new Map(grupo.pdvs.map((t) => [t.cod_pdv, t])).values()];
              const tipoColor = TIPOS_COLOR[grupo.tipo] || TIPOS_COLOR[""];
              return (
                <div key={descricao} style={styles.pdvCard}>
                  <div
                    style={{ ...styles.pdvHeader, borderLeft: "3px solid rgba(251,185,0,0.5)" }}
                    onClick={() => setTaskExpandida(aberto ? null : descricao)}
                  >
                    <div style={{ ...styles.pdvHeaderLeft, flexDirection: "column", alignItems: "flex-start", gap: "4px" }}>
                      <span style={{ ...styles.tipoTag, color: tipoColor, fontSize: "0.72rem" }}>{grupo.tipo}</span>
                      <span style={styles.pdvNome}>{descricao}</span>
                    </div>
                    <div style={styles.pdvHeaderRight}>
                      <span style={styles.tagAberta}>{pdvsUnicos.length} PDV{pdvsUnicos.length !== 1 ? "s" : ""}</span>
                      <span style={styles.expandIcon}>{aberto ? "▲" : "▼"}</span>
                    </div>
                  </div>
                  {aberto && (
                    <div style={styles.tasksList}>
                      {pdvsUnicos.map((t) => {
                        const pdv = mapaPdv[t.cod_pdv];
                        return (
                          <div key={t.cod_pdv} style={{ ...styles.taskItem, flexDirection: "row", alignItems: "center", gap: "12px" }}>
                            <span style={styles.codBadge}>{t.cod_pdv}</span>
                            <span style={{ ...styles.pdvNome, flex: 1 }}>{pdv?.nome_fantasia || t.cod_pdv}</span>
                            <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.75rem" }}>{pdv?.cidade}</span>
                            <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.75rem" }}>📅 {t.data_visita}</span>
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
  content: { padding: "clamp(16px,4vw,24px) clamp(16px,4vw,32px)", maxWidth: "1100px", margin: "0 auto" },
  diasRow: { display: "flex", gap: "6px", marginBottom: "20px", flexWrap: "wrap" },
  diaBtn: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", padding: "10px 16px", borderRadius: "20px", cursor: "pointer", fontSize: "0.82rem", fontFamily: "inherit", minHeight: "44px" },
  diaBtnAtivo: { background: "rgba(251,185,0,0.15)", border: "1px solid rgba(251,185,0,0.4)", color: "#fbb900", fontWeight: "600" },
  dashRow: { display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" },
  dashCard: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "14px 18px", flex: 1, minWidth: "100px" },
  dashLabel: { margin: "0 0 6px", fontSize: "0.75rem", color: "rgba(255,255,255,0.45)" },
  dashVal: { margin: 0, fontSize: "1.6rem", fontWeight: "700" },
  viewToggle: { display: "flex", gap: "6px", marginBottom: "16px" },
  viewBtn: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", padding: "8px 18px", borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem", fontFamily: "inherit", fontWeight: "500", minHeight: "40px" },
  viewBtnAtivo: { background: "rgba(251,185,0,0.12)", border: "1px solid rgba(251,185,0,0.4)", color: "#fbb900", fontWeight: "700" },
  filtrosRow: { display: "flex", gap: "10px", marginBottom: "16px", alignItems: "center", flexWrap: "wrap" },
  inputFiltro: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff", padding: "8px 12px", fontSize: "0.85rem", fontFamily: "inherit", outline: "none" },
  countLabel: { color: "rgba(255,255,255,0.35)", fontSize: "0.82rem", marginLeft: "auto" },
  msg: { color: "rgba(255,255,255,0.35)", textAlign: "center", padding: "40px" },
  lista: { display: "flex", flexDirection: "column", gap: "8px" },
  pdvCard: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", overflow: "hidden" },
  pdvHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", cursor: "pointer", transition: "background 0.15s", minHeight: "56px" },
  pdvHeaderAberto: { borderLeft: "3px solid #fbb900" },
  pdvHeaderLeft: { display: "flex", alignItems: "center", gap: "8px", flex: 1, flexWrap: "wrap" },
  pdvHeaderRight: { display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 },
  codBadge: { background: "rgba(251,185,0,0.12)", color: "#fbb900", padding: "2px 8px", borderRadius: "6px", fontSize: "0.78rem", fontWeight: "700", whiteSpace: "nowrap" },
  pdvNome: { color: "#fff", fontSize: "0.88rem", fontWeight: "500" },
  pdvCidade: { color: "rgba(255,255,255,0.35)", fontSize: "0.78rem" },
  tagAberta: { background: "rgba(251,185,0,0.15)", color: "#fbb900", padding: "2px 8px", borderRadius: "20px", fontSize: "0.72rem", fontWeight: "600" },
  tagValid: { background: "rgba(34,197,94,0.12)", color: "#4ade80", padding: "2px 8px", borderRadius: "20px", fontSize: "0.72rem", fontWeight: "600" },
  expandIcon: { color: "rgba(255,255,255,0.3)", fontSize: "0.75rem", marginLeft: "4px" },
  tasksList: { borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column" },
  taskItem: { padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", flexDirection: "column", gap: "6px" },
  taskLeft: { display: "flex", gap: "8px", alignItems: "center" },
  statusTag: { padding: "2px 8px", borderRadius: "6px", fontSize: "0.72rem", fontWeight: "700" },
  tipoTag: { fontSize: "0.75rem", fontWeight: "600" },
  taskDesc: { margin: 0, color: "rgba(255,255,255,0.75)", fontSize: "0.85rem", lineHeight: "1.4" },
  taskMeta: { display: "flex", gap: "16px", flexWrap: "wrap" },
  taskMetaItem: { color: "rgba(255,255,255,0.3)", fontSize: "0.75rem" },
};
