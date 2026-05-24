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
  const open = tasksDia.filter((t) => t.status === "OPEN").length;
  const valid = tasksDia.filter((t) => t.status === "VALID").length;
  const invalid = tasksDia.filter((t) => t.status === "INVALID").length;
  const pdvsComTask = Object.keys(porPdv).length;

  const tipos = [...new Set(tasksDia.map((t) => t.tipo).filter(Boolean))];

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
            <p style={styles.dashLabel}>Total tasks</p>
            <p style={styles.dashVal}>{totalTasks}</p>
          </div>
          <div style={{ ...styles.dashCard, borderColor: "rgba(251,185,0,0.3)" }}>
            <p style={styles.dashLabel}>🟡 Abertas</p>
            <p style={{ ...styles.dashVal, color: "#fbb900" }}>{open}</p>
          </div>
          <div style={{ ...styles.dashCard, borderColor: "rgba(34,197,94,0.3)" }}>
            <p style={styles.dashLabel}>✅ Validadas</p>
            <p style={{ ...styles.dashVal, color: "#4ade80" }}>{valid}</p>
          </div>
          <div style={{ ...styles.dashCard, borderColor: "rgba(239,68,68,0.3)" }}>
            <p style={styles.dashLabel}>❌ Inválidas</p>
            <p style={{ ...styles.dashVal, color: "#f87171" }}>{invalid}</p>
          </div>
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

        {/* Lista agrupada por PDV */}
        {loading ? (
          <p style={styles.msg}>Carregando...</p>
        ) : Object.keys(porPdv).length === 0 ? (
          <p style={styles.msg}>Nenhuma task encontrada para {diaFiltro}.</p>
        ) : (
          <div style={styles.lista}>
            {Object.entries(porPdv).map(([codPdv, tasksPdv]) => {
              const pdv = mapaPdv[codPdv];
              const aberto = pdvExpandido === codPdv;
              const temAberta = tasksPdv.some((t) => t.status === "OPEN");
              return (
                <div key={codPdv} style={styles.pdvCard}>
                  {/* Header do PDV */}
                  <div
                    style={{ ...styles.pdvHeader, ...(temAberta ? styles.pdvHeaderAberto : {}) }}
                    onClick={() => setPdvExpandido(aberto ? null : codPdv)}
                  >
                    <div style={styles.pdvHeaderLeft}>
                      <span style={styles.codBadge}>{codPdv}</span>
                      <span style={styles.pdvNome}>{pdv?.nome_fantasia || codPdv}</span>
                      <span style={styles.pdvCidade}>{pdv?.cidade}</span>
                    </div>
                    <div style={styles.pdvHeaderRight}>
                      {tasksPdv.filter((t) => t.status === "OPEN").length > 0 && (
                        <span style={styles.tagAberta}>{tasksPdv.filter((t) => t.status === "OPEN").length} aberta(s)</span>
                      )}
                      {tasksPdv.filter((t) => t.status === "VALID").length > 0 && (
                        <span style={styles.tagValid}>{tasksPdv.filter((t) => t.status === "VALID").length} válida(s)</span>
                      )}
                      <span style={styles.expandIcon}>{aberto ? "▲" : "▼"}</span>
                    </div>
                  </div>

                  {/* Tasks do PDV */}
                  {aberto && (
                    <div style={styles.tasksList}>
                      {tasksPdv.map((t, i) => {
                        const stConf = STATUS_CONFIG[t.status] || STATUS_CONFIG.OPEN;
                        const tipoColor = TIPOS_COLOR[t.tipo] || TIPOS_COLOR[""];
                        return (
                          <div key={i} style={styles.taskItem}>
                            <div style={styles.taskLeft}>
                              <span style={{ ...styles.statusTag, background: stConf.bg, color: stConf.color }}>
                                {stConf.label}
                              </span>
                              <span style={{ ...styles.tipoTag, color: tipoColor }}>
                                {t.tipo}
                              </span>
                            </div>
                            <p style={styles.taskDesc}>{t.descricao}</p>
                            <div style={styles.taskMeta}>
                              <span style={styles.taskMetaItem}>📅 Visita: {t.data_visita}</span>
                              {t.data_conclusao && <span style={styles.taskMetaItem}>✅ Concluída: {t.data_conclusao}</span>}
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
