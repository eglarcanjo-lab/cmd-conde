/* BUILD_20260525_150000 */
import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";

const META_GV = 36;

const SPO_ITEMS = [
  { n: 1,  label: "Visitação GV na Base Foco",         pts: 14, peso: 7.8,  ativo: true },
  { n: 2,  label: "Rota Coaching",                      pts: 10, peso: 5.6,  ativo: true },
  { n: 3,  label: "TT Dias com Rotas",                  pts: 6,  peso: 3.3,  ativo: true },
  { n: 4,  label: "Abertura de Desafios Diários",       pts: 4,  peso: 2.2,  ativo: true },
  { n: 5,  label: "Atendimento Produtivo",              pts: 14, peso: 7.8,  ativo: true  },
  // BUILD_20260517_004902
  { n: 6,  label: "DTO GC",                             pts: 6,  peso: 3.3,  ativo: true },
  { n: 7,  label: "% PDVs abrindo Promoção no BEES",   pts: 10, peso: 5.6,  ativo: true },
  { n: 8,  label: "Aderência de Política Comercial",    pts: 8,  peso: 4.4,  ativo: true },
  { n: 9,  label: "Execução Menu de Cerveja",           pts: 10, peso: 5.6,  ativo: true },
  { n: 10, label: "Academia Bees RN",                   pts: 14, peso: 7.8,  ativo: false },
  { n: 11, label: "Tasks Cerveja TT (Portfolio)",       pts: 10, peso: 5.6,  ativo: true  },
  { n: 12, label: "Tasks Faturamento Score 5",          pts: 6,  peso: 3.3,  ativo: true  },
  { n: 13, label: "Tasks NAB TT (Portfolio)",           pts: 10, peso: 5.6,  ativo: true  },
  { n: 14, label: "Tasks de Volume",                    pts: 6,  peso: 3.3,  ativo: true },
  { n: 15, label: "Tasks de Marketplace",               pts: 8,  peso: 4.4,  ativo: true  },
  { n: 16, label: "Tasks de Match (Portfolio)",         pts: 8,  peso: 4.4,  ativo: true  },
  { n: 17, label: "Tasks Cerveja Zero (Portfolio)",     pts: 6,  peso: 3.3,  ativo: true  },
  { n: 18, label: "Tarefa de Digitalização",            pts: 4,  peso: 2.2,  ativo: true  },
  { n: 19, label: "PDVs com Compra Independente",       pts: 4,  peso: 2.2,  ativo: true  },
  { n: 20, label: "+RGB",                               pts: 6,  peso: 3.3,  ativo: true  },
  { n: 21, label: "Cupons Digitais - Score 5",          pts: 6,  peso: 3.3,  ativo: true  },
  { n: 22, label: "% Lojas Ideais",                     pts: 4,  peso: 2.2,  ativo: true  },
  { n: 23, label: "Expansão Scanntech",                 pts: 2,  peso: 1.1,  ativo: true  },
  { n: 24, label: "Portfólio Ideal Score 5",            pts: 8,  peso: 4.4,  ativo: true  },
];

const TOTAL_PTS = SPO_ITEMS.reduce((s, i) => s + i.pts, 0); // 180

function BarraProgresso({ pct, cor }) {
  const w = Math.min(pct, 100);
  const c = pct >= 100 ? "#4ade80" : pct >= 70 ? "#fbb900" : "#f87171";

  return (
    <div style={{ height: "8px", background: "rgba(255,255,255,0.08)", borderRadius: "4px", overflow: "hidden", marginTop: "6px" }}>
      <div style={{ height: "100%", width: `${w}%`, background: cor || c, borderRadius: "4px", transition: "width 0.4s" }} />
    </div>
  );
}

export default function SPO() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const [aba, setAba] = useState("operacao");
  const [kpiAtivo, setKpiAtivo] = useState(null);
  const [spoMetas, setSpoMetas] = useState([]);
  const [resumo, setResumo] = useState([]);
  const [detalhe, setDetalhe] = useState([]);
  const [loading, setLoading] = useState(true);
  const [coaching, setCoaching] = useState([]);
  const [periodoCoaching, setPeriodoCoaching] = useState("trimestral");
  const [semCoaching, setSemCoaching] = useState([]);
  const [diasRota, setDiasRota] = useState([]);
  const [periodoDiasRota, setPeriodoDiasRota] = useState("trimestral");
  const [desafios, setDesafios] = useState([]);
  const [dto, setDto] = useState([]);        // array de meses
  const [dtoView, setDtoView] = useState("mensal"); // "mensal" | "trimestral" 
  const [promo, setPromo] = useState([]);
  const [promoDetalhe, setPromoDetalhe] = useState([]);
  const [promoBusca, setPromoBusca] = useState("");
  const [promoFiltroSetor, setPromoFiltroSetor] = useState("todos");
  const [promoFiltroDia, setPromoFiltroDia] = useState("todos");
  const [politica, setPolitica] = useState([]);
  const [menu, setMenu] = useState([]);
  const [tasksCerveja, setTasksCerveja] = useState([]);
  const [tasksCervejaDetalhe, setTasksCervejaDetalhe] = useState([]);
  const [kpi11FiltroRN, setKpi11FiltroRN] = useState("TODOS");
  const [kpi11FiltroDia, setKpi11FiltroDia] = useState("TODOS");
  const [score5, setScore5] = useState([]);
  const [tasksNab, setTasksNab] = useState([]);
  const [tasksVolume, setTasksVolume] = useState([]);
  const [tasksMktp, setTasksMktp] = useState([]);
  const [tasksMatch, setTasksMatch] = useState([]);
  const [tasksCervZero, setTasksCervZero] = useState([]);
  const [tasksDigit, setTasksDigit] = useState([]);
  const [alone, setAlone] = useState([]);
  const [aloneDetalhe, setAloneDetalhe] = useState([]);
  const [aloneView, setAloneView] = useState("mensal");
  const [aloneFiltroRN, setAloneFiltroRN] = useState("TODOS");
  const [aloneFiltroDia, setAloneFiltroDia] = useState("TODOS");
  const [aloneFiltroPDV, setAloneFiltroPDV] = useState("TODOS");
  const [rgb, setRgb] = useState([]);
  const [rgbLit, setRgbLit] = useState([]);
  const [rgbInt, setRgbInt] = useState([]);
  const [rgbDet, setRgbDet] = useState([]);
  const [cupons, setCupons] = useState([]);
  const [cuponsDet, setCuponsDet] = useState([]);
  const [cuponsMarca, setCuponsMarca] = useState("TODAS");
  const [cuponsGV, setCuponsGV] = useState("TODOS");
  const [cuponsRN, setCuponsRN] = useState("TODOS");
  const [cuponsDia, setCuponsDia] = useState("TODOS");
  const [lojaIdeal, setLojaIdeal] = useState([]);
  const [lojaIdealDet, setLojaIdealDet] = useState([]);
  const [lojaFiltroRN, setLojaFiltroRN] = useState("TODOS");
  const [lojaFiltroStatus, setLojaFiltroStatus] = useState("TODOS");
  const [scanntech, setScanntech] = useState([]);
  const [scanntechDet, setScanntechDet] = useState([]);
  const [scanFiltroStatus, setScanFiltroStatus] = useState("TODOS");
  const [scanFiltroRN, setScanFiltroRN] = useState("TODOS");
  const [scanFiltroDia, setScanFiltroDia] = useState("TODOS");
  const [lojaFiltroDia, setLojaFiltroDia] = useState("TODOS");
  const [portIdeal, setPortIdeal] = useState([]);
  const [portIdealDet, setPortIdealDet] = useState([]);
  const [portFiltroGV, setPortFiltroGV] = useState("TODOS");
  const [portFiltroRN, setPortFiltroRN] = useState("TODOS");
  const [portFiltroDia, setPortFiltroDia] = useState("TODOS");
  const [portFiltroStatus, setPortFiltroStatus] = useState("TODOS");
  const [ap, setAp] = useState([]);
  const [apDet, setApDet] = useState([]);
  const [apFiltroGV, setApFiltroGV] = useState("TODOS");
  const [apFiltroStatus, setApFiltroStatus] = useState("TODOS");
  const [busca, setBusca] = useState("");
  const [filtroGv, setFiltroGv] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroDia, setFiltroDia] = useState("todos");

  useEffect(() => { carregar(); }, []);

  // Resetar aba quando KPI muda para evitar aba inválida visível
  useEffect(() => {
    if (kpiAtivo === null) return;
    if (kpiAtivo === 1) {
      // gv e detalhe são válidas para KPI 1 — mantém
      return;
    }
    if (kpiAtivo === 2) {
      // sem_coaching é válida para KPI 2 — mantém se estiver nela
      if (!["operacao", "sem_coaching"].includes(aba)) setAba("operacao");
      return;
    }
    // Demais KPIs: só operacao faz sentido
    setAba("operacao");
  }, [kpiAtivo]);

  async function carregar() {
    setLoading(true);
    try {
      const [resResumo, resDetalhe, resCoaching, resSemCoaching, resDiasRota, resDesafios, resDto, resPromo, resPromoDetalhe, resPolitica, resMenu, resTasksCerveja, resTasksCervejaDetalhe, resScore5, resTasksNab, resTasksVolume, resTasksMktp, resTasksMatch, resTasksCervZero, resTasksDigit, resAlone, resAloneDetalhe, resRgb, resRgbLit, resRgbInt, resRgbDet, resCupons, resCuponsDet, resLojaIdeal, resLojaIdealDet, resScanntech, resScanntechDet, resPortIdeal, resPortIdealDet, resAp, resApDet, resSpoMetas] = await Promise.all([
        api.get("/api/spo/visitacao-gv/resumo").catch(() => ({ data: [] })),
        api.get("/api/spo/visitacao-gv/detalhe").catch(() => ({ data: [] })),
        api.get("/api/spo/coaching/resumo").catch(() => ({ data: [] })),
        api.get("/api/spo/coaching/sem-coaching").catch(() => ({ data: [] })),
        api.get("/api/spo/dias-rota/resumo").catch(() => ({ data: [] })),
        api.get(`/api/spo/desafios?mes=${new Date().toISOString().slice(0,7)}`).catch(() => ({ data: [] })),
        api.get("/api/spo/dto").catch(() => ({ data: [] })),
        api.get("/api/spo/promo/resumo").catch(() => ({ data: [] })),
        api.get("/api/spo/promo/detalhe").catch(() => ({ data: [] })),
        api.get("/api/spo/politica-comercial/resumo").catch(() => ({ data: [] })),
        api.get("/api/spo/menu/resumo").catch(() => ({ data: [] })),
        api.get("/api/spo/tasks-cerveja/resumo").catch(() => ({ data: [] })),
        api.get("/api/spo/tasks-cerveja/detalhe").catch(() => ({ data: [] })),
        api.get("/api/spo/score5/resumo").catch(() => ({ data: [] })),
        api.get("/api/spo/tasks-nab/resumo").catch(() => ({ data: [] })),
        api.get("/api/spo/tasks-volume/resumo").catch(() => ({ data: [] })),
        api.get("/api/spo/tasks-marketplace/resumo").catch(() => ({ data: [] })),
        api.get("/api/spo/tasks-match/resumo").catch(() => ({ data: [] })),
        api.get("/api/spo/tasks-cerv-zero/resumo").catch(() => ({ data: [] })),
        api.get("/api/spo/tasks-digitalizacao/resumo").catch(() => ({ data: [] })),
        api.get("/api/spo/pedido-alone/resumo").catch(() => ({ data: [] })),
        api.get("/api/spo/pedido-alone/detalhe").catch(() => ({ data: [] })),
        api.get("/api/spo/rgb/resumo").catch(() => ({ data: [] })),
        api.get("/api/spo/rgb/litrinho").catch(() => ({ data: [] })),
        api.get("/api/spo/rgb/inteira").catch(() => ({ data: [] })),
        api.get("/api/spo/rgb/detalhe").catch(() => ({ data: [] })),
        api.get("/api/spo/cupons/resumo").catch(() => ({ data: [] })),
        api.get("/api/spo/cupons/detalhe").catch(() => ({ data: [] })),
        api.get("/api/spo/loja-ideal/resumo").catch(() => ({ data: [] })),
        api.get("/api/spo/loja-ideal/detalhe").catch(() => ({ data: [] })),
        api.get("/api/spo/scanntech/resumo").catch(() => ({ data: [] })),
        api.get("/api/spo/scanntech/detalhe").catch(() => ({ data: [] })),
        api.get("/api/spo/portfolio-ideal/resumo").catch(() => ({ data: [] })),
        api.get("/api/spo/portfolio-ideal/detalhe").catch(() => ({ data: [] })),
        api.get("/api/spo/ap/resumo").catch(() => ({ data: [] })),
        api.get("/api/spo/ap/detalhe").catch(() => ({ data: [] })),
        api.get("/api/spo/painel/metas").catch(() => ({ data: [] })),
      ]);
      setResumo(resResumo.data || []);
      setDetalhe(resDetalhe.data || []);
      setCoaching(resCoaching.data || []);
      setSemCoaching(resSemCoaching?.data || []);
      setDiasRota(resDiasRota?.data || []);
      setDesafios(resDesafios?.data || []);
      const dtoData = resDto?.data || [];
      setDto(Array.isArray(dtoData) ? dtoData : (dtoData ? [dtoData] : []));
      const promoData = resPromo?.data || [];
      setPromo(Array.isArray(promoData) ? promoData : []);
      const promoDetData = resPromoDetalhe?.data || [];
      setPromoDetalhe(Array.isArray(promoDetData) ? promoDetData : []);
      setPolitica(resPolitica?.data || []);
      setMenu(resMenu?.data || []);
      setTasksCerveja(resTasksCerveja?.data || []);
      setTasksCervejaDetalhe(resTasksCervejaDetalhe?.data || []);
      setScore5(resScore5?.data || []);
      setTasksNab(resTasksNab?.data || []);
      setTasksVolume(resTasksVolume?.data || []);
      setTasksMktp(resTasksMktp?.data || []);
      setTasksMatch(resTasksMatch?.data || []);
      setTasksCervZero(resTasksCervZero?.data || []);
      setTasksDigit(resTasksDigit?.data || []);
      setAlone(resAlone?.data || []);
      setAloneDetalhe(resAloneDetalhe?.data || []);
      setRgb(resRgb?.data || []);
      setRgbLit(resRgbLit?.data || []);
      setRgbInt(resRgbInt?.data || []);
      setRgbDet(resRgbDet?.data || []);
      setCupons(resCupons?.data || []);
      setCuponsDet(resCuponsDet?.data || []);
      setLojaIdeal(resLojaIdeal?.data || []);
      setLojaIdealDet(resLojaIdealDet?.data || []);
      setScanntech(resScanntech?.data || []);
      setScanntechDet(resScanntechDet?.data || []);
      setPortIdeal(resPortIdeal?.data || []);
      setPortIdealDet(resPortIdealDet?.data || []);
      setAp(resAp?.data || []);
      setApDet(resApDet?.data || []);
      setSpoMetas(resSpoMetas?.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  // Resumo operação — filtra só linhas de GV (numérico) para não misturar com agregados
  const gvsResumo = resumo.filter(r => r.gv && !isNaN(parseInt(r.gv)));
  const totalVisitados = gvsResumo.reduce((s, r) => s + parseInt(r.visitados || 0), 0);
  const totalMeta      = gvsResumo.reduce((s, r) => s + parseInt(r.meta || META_GV), 0);
  // Atingimento: soma bruta / soma das metas (= média das % por GV quando metas iguais)
  const pctOp = totalMeta > 0 ? parseFloat((totalVisitados / totalMeta * 100).toFixed(1)) : 0;

  // Detalhe filtrado
  const detalheFiltrado = detalhe.filter((d) => {
    const buscaOk = !busca || d.cod_pdv?.includes(busca) || d.nome_pdv?.toLowerCase().includes(busca.toLowerCase());
    const gvOk = filtroGv === "todos" || d.gv === filtroGv;
    const stOk = filtroStatus === "todos" || (filtroStatus === "ok" && d.valida === "SIM") || (filtroStatus === "nok" && d.valida === "NÃO");
    const diaOk = filtroDia === "todos" || (d.dia_visita || "").toUpperCase().includes(filtroDia.toUpperCase());
    return buscaOk && gvOk && stOk && diaOk;
  });


  const MESES_NOMES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const fmtMes = (m) => {
    if (!m) return "—";
    const [ano, mes] = m.split("-");
    if (!mes) return m;
    const nome = MESES_NOMES[parseInt(mes, 10) - 1];
    return nome ? `${nome}/${String(ano).slice(2)}` : m;
  };
  const gvsUnicos = [...new Set(detalhe.map((d) => d.gv))].sort();
  const diasUnicos = [...new Set(detalhe.map((d) => (d.dia_visita || "").split("/")[0].trim()).filter(Boolean))].sort();

  // Helpers para meta individual por RN nos cards de detalhe
  const mesAtual = new Date().toISOString().slice(0, 7);
  const spoMetaTotal = (kpiN) => {
    const m = spoMetas.find(x => String(x.item) === String(kpiN) && x.mes === mesAtual);
    return (m && m.meta !== "" && m.meta !== null && m.meta !== undefined) ? parseFloat(m.meta) : null;
  };
  // KPI 8: meta RN = ceil(pdvs_aderidos × 0.60) — sem uplift
  // KPI 12: meta RN = ceil(pdvs_total × (meta_op / op_pdvs_total)) — sem uplift
  // KPIs tasks (9,11,13-18): meta RN = ceil(tasks_total × (meta_op / op_tasks_total) × 1.10)

  return (
    <div style={styles.root}>
      <style>{`
        @media (max-width: 768px) {
          .spo-layout { flex-direction: column !important; }
          .spo-col-left  { flex: 0 0 100% !important; width: 100%; order: 2; }
          .spo-col-right { flex: 0 0 100% !important; width: 100%; position: static !important; order: 1; }
          .spo-header { padding: clamp(12px,3vw,20px) clamp(14px,4vw,32px) !important; }
          .spo-header h1 { font-size: clamp(1rem,5vw,1.3rem) !important; }
          .spo-kpi-grid { grid-template-columns: repeat(3, 1fr) !important; }
          .spo-backBtn { min-height: 44px; padding: 10px 14px !important; }
          .spo-logoutBtn { min-height: 44px; }
          .spo-painel-tr { cursor: pointer; }
        }
        @media (max-width: 420px) {
          .spo-kpi-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
      <div style={styles.header} className="spo-header">
        <div style={styles.headerLeft}>
          <button style={styles.backBtn} className="spo-backBtn" onClick={() => navigate("/")}>← Voltar</button>
          <div>
            <h1 style={styles.title}>📊 SPO — Excelência Operacional</h1>
            <p style={styles.subtitle}>CMD Ambev · Conde</p>
          </div>
        </div>
        <button style={styles.logoutBtn} className="spo-logoutBtn" onClick={logout}>Sair</button>
      </div>

      <div style={styles.content}>
        {/* Layout side-by-side */}
        <div className="spo-layout" style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>

        {/* COLUNA ESQUERDA — Cards + Detalhe KPI */}
        <div className="spo-col-left" style={{ flex: "0 0 35%", minWidth: 0 }}>

        {/* Scoreboard dos 24 KPIs */}
        <div style={styles.scoreboard}>
          <div style={styles.scoreboardHeader}>
            <span style={styles.scoreboardTitle}>Painel SPO — {TOTAL_PTS} pontos</span>
            <span style={styles.scoreboardSub}>KPIs ativos em amarelo</span>
          </div>
          <div className="spo-kpi-grid" style={styles.kpiGrid}>
            {SPO_ITEMS.map((item) => (
              <div
                key={item.n}
                onClick={() => setKpiAtivo(kpiAtivo === item.n ? null : item.n)}
                style={{
                  ...styles.kpiCard,
                  ...(item.ativo ? styles.kpiCardAtivo : {}),
                  ...(kpiAtivo === item.n ? { border: "1px solid #fbb900", boxShadow: "0 0 12px rgba(251,185,0,0.2)" } : {}),
                  cursor: "pointer",
                }}
              >
                <span style={styles.kpiN}>#{item.n}</span>
                <span style={styles.kpiLabel}>{item.label}</span>
                <div style={styles.kpiPts}>
                  <span style={{ color: item.ativo ? "#fbb900" : "rgba(255,255,255,0.3)", fontWeight: "700" }}>{item.pts} pts</span>
                  <span style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.7rem" }}>{item.peso}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Abas de visão — contextuais por KPI */}
        {(() => {
          let abasVisiveis = ["operacao"];
          if (kpiAtivo === null || kpiAtivo === 1) abasVisiveis = ["operacao", "gv", "detalhe"];
          if (kpiAtivo === 2) abasVisiveis = ["operacao", "sem_coaching"];
          return (
            <div style={styles.abas}>
              {abasVisiveis.map((a) => (
                <button key={a} style={{ ...styles.abaBtn, ...(aba === a ? styles.abaBtnAtivo : {}) }} onClick={() => setAba(a)}>
                  {a === "operacao" ? "🏭 Operação" : a === "gv" ? "👥 Por GV" : a === "detalhe" ? "📋 Detalhe" : `⚠️ Sem Coaching${semCoaching.length > 0 ? ` (${semCoaching.length})` : ""}`}
                </button>
              ))}
            </div>
          );
        })()}

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "8px 0" }}>
            {[1,2,3].map(i => (
              <div key={i} style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "14px",
                padding: "20px",
                position: "relative",
                overflow: "hidden",
              }}>
                <div style={{ height: "14px", width: "40%", background: "rgba(255,255,255,0.06)", borderRadius: "6px", marginBottom: "12px" }} />
                <div style={{ height: "10px", width: "70%", background: "rgba(255,255,255,0.04)", borderRadius: "6px", marginBottom: "8px" }} />
                <div style={{ height: "10px", width: "55%", background: "rgba(255,255,255,0.04)", borderRadius: "6px" }} />
                <div style={{
                  position: "absolute", top: 0, left: "-100%", width: "60%", height: "100%",
                  background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)",
                  animation: "shimmer 1.4s infinite",
                }} />
              </div>
            ))}
            <style>{`@keyframes shimmer { 0% { left: -100% } 100% { left: 200% } }`}</style>
          </div>
        ) : (
          <>




            {/* OPERAÇÃO */}
            {aba === "operacao" && (kpiAtivo === null || kpiAtivo === 1) && (
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>Item 1 — Visitação GV na Base Foco</h3>
                <div style={styles.opGrid}>
                  {[
                    { label: "Meta Total", val: totalMeta, color: "#fff" },
                    { label: "Visitados", val: totalVisitados, color: "#4ade80" },
                    { label: "Atingimento", val: `${pctOp}%`, color: pctOp >= 100 ? "#4ade80" : pctOp >= 70 ? "#fbb900" : "#f87171" },
                    { label: "Pontos SPO", val: pctOp >= 100 ? "14 pts" : `${Math.round(14 * pctOp / 100)} pts`, color: "#fbb900" },
                  ].map((c) => (
                    <div key={c.label} style={styles.opCard}>
                      <p style={styles.opLabel}>{c.label}</p>
                      <p style={{ ...styles.opVal, color: c.color }}>{c.val}</p>
                    </div>
                  ))}
                </div>
                <BarraProgresso pct={pctOp} />
              </div>
            )}

            {/* COACHING */}
            {(kpiAtivo === null || kpiAtivo === 2) && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 2 — Rota Coaching</h3>
              <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                {["mensal", "trimestral"].map((p) => (
                  <button key={p} onClick={() => setPeriodoCoaching(p)}
                    style={{ ...styles.abaBtn, ...(periodoCoaching === p ? styles.abaBtnAtivo : {}), padding: "6px 14px", fontSize: "0.82rem", borderBottom: "none", borderRadius: "6px", background: periodoCoaching === p ? "rgba(251,185,0,0.12)" : "rgba(255,255,255,0.04)" }}>
                    {p === "mensal" ? "📅 Mensal" : "📊 Trimestral"}
                  </button>
                ))}
              </div>
              <div style={styles.gvGrid}>
                {coaching.filter(c => c.periodo === periodoCoaching).map((c) => {
                  const pct = parseFloat(c.pct || 0);
                  const cor = pct >= 100 ? "#4ade80" : pct >= 70 ? "#fbb900" : "#f87171";
                  return (
                    <div key={`${c.gv}-${c.periodo}-${c.mes_referencia}`} style={styles.gvCard}>
                      <div style={styles.gvHeader}>
                        <span style={styles.gvLabel}>GV {c.gv}</span>
                        <span style={{ ...styles.apBadge, background: c.gv_ok === "OK" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: c.gv_ok === "OK" ? "#4ade80" : "#f87171" }}>{c.gv_ok}</span>
                      </div>
                      <BarraProgresso pct={pct} cor={cor} />
                      <div style={styles.gvFooter}>
                        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.82rem" }}>{c.coachings_validos} / {c.meta} coachings</span>
                        <span style={{ color: cor, fontWeight: "700" }}>{pct}%</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "rgba(255,255,255,0.35)", marginTop: "2px" }}>
                        <span>RNs cobertos: {c.rns_cobertos}/{c.total_rns_sala}</span>
                        <span>{fmtMes(c.mes_referencia)}</span>
                      </div>
                    </div>
                  );
                })}
                {coaching.filter(c => c.periodo === periodoCoaching).length === 0 && (
                  <p style={styles.msg}>Importe o relatório em Admin → Arquivos → SPO Rota Coaching.</p>
                )}
              </div>
            </div>
            )}

            {/* DIAS EM ROTA TT */}
            {(kpiAtivo === null || kpiAtivo === 3) && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 3 — TT Dias com Rotas</h3>
              <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                {["mensal", "trimestral"].map((p) => (
                  <button key={p} onClick={() => setPeriodoDiasRota(p)}
                    style={{ ...styles.abaBtn, ...(periodoDiasRota === p ? styles.abaBtnAtivo : {}), padding: "6px 14px", fontSize: "0.82rem", borderBottom: "none", borderRadius: "6px", background: periodoDiasRota === p ? "rgba(251,185,0,0.12)" : "rgba(255,255,255,0.04)" }}>
                    {p === "mensal" ? "📅 Mensal" : "📊 Trimestral"}
                  </button>
                ))}
              </div>
              <div style={styles.gvGrid}>
                {diasRota.filter(d => d.periodo === periodoDiasRota).map((d) => {
                  const pct = parseFloat(d.pct || 0);
                  const cor = pct >= 100 ? "#4ade80" : pct >= 70 ? "#fbb900" : "#f87171";
                  return (
                    <div key={`${d.gv}-${d.periodo}-${d.mes_referencia}`} style={styles.gvCard}>
                      <div style={styles.gvHeader}>
                        <span style={styles.gvLabel}>GV {d.gv}</span>
                        <span style={{ ...styles.apBadge, background: d.gv_ok === "OK" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: d.gv_ok === "OK" ? "#4ade80" : "#f87171" }}>{d.gv_ok}</span>
                      </div>
                      <BarraProgresso pct={pct} cor={cor} />
                      <div style={styles.gvFooter}>
                        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.82rem" }}>{d.dias_validos} / {d.meta} dias</span>
                        <span style={{ color: cor, fontWeight: "700" }}>{pct}%</span>
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.25)", marginTop: "2px" }}>{fmtMes(d.mes_referencia)}</div>
                    </div>
                  );
                })}
                {diasRota.filter(d => d.periodo === periodoDiasRota).length === 0 && (
                  <p style={styles.msg}>Importe o relatório de Rota Coaching — os dias em rota são calculados automaticamente.</p>
                )}
              </div>
            </div>
            )}

            {/* DESAFIOS DIÁRIOS */}
            {(kpiAtivo === null || kpiAtivo === 4) && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 4 — Abertura de Desafios Diários</h3>
              <div style={styles.gvGrid}>
                {/* Card OPERAÇÃO — média dos dois GVs */}
                {(() => {
                  const ok1 = desafios.filter(d => d.gv === "1" && d.status === "OK").length;
                  const tot1 = desafios.filter(d => d.gv === "1").length;
                  const ok3 = desafios.filter(d => d.gv === "3" && d.status === "OK").length;
                  const tot3 = desafios.filter(d => d.gv === "3").length;
                  const realOp = (ok1 + ok3) / 2;
                  const metaOp = (tot1 * 0.9 + tot3 * 0.9) / 2;
                  const pctOp = metaOp > 0 ? Math.round(realOp / metaOp * 100) : 0;
                  const corOp = pctOp >= 100 ? "#4ade80" : pctOp >= 70 ? "#fbb900" : "#f87171";
                  const okOp = realOp >= metaOp && metaOp > 0;
                  if (tot1 === 0 && tot3 === 0) return null;
                  return (
                    <div style={{ ...styles.gvCard, borderColor: "rgba(251,185,0,0.25)", background: "rgba(251,185,0,0.04)" }}>
                      <div style={styles.gvHeader}>
                        <span style={{ ...styles.gvLabel, color: "#fbb900" }}>Operação</span>
                        <span style={{ ...styles.apBadge, background: okOp ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: okOp ? "#4ade80" : "#f87171" }}>{okOp ? "OK" : "NOK"}</span>
                      </div>
                      <div style={{ height: "6px", background: "rgba(255,255,255,0.08)", borderRadius: "3px", margin: "8px 0" }}>
                        <div style={{ height: "100%", width: `${Math.min(pctOp,100)}%`, background: corOp, borderRadius: "3px" }} />
                      </div>
                      <div style={styles.gvFooter}>
                        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.82rem" }}>{realOp.toFixed(1)} / {metaOp.toFixed(1)} dias (média)</span>
                        <span style={{ color: corOp, fontWeight: "700" }}>{pctOp}%</span>
                      </div>
                      <p style={{ margin: "4px 0 0", color: "rgba(255,255,255,0.25)", fontSize: "0.72rem" }}>Meta: média ≥ 90% dos dias úteis</p>
                    </div>
                  );
                })()}
                {["1","3"].map((gv) => {
                  const dias = desafios.filter(d => d.gv === gv);
                  const ok = dias.filter(d => d.status === "OK").length;
                  const total = dias.length;
                  const pct = total > 0 ? Math.round((ok / total) * 100) : 0;
                  const cor = pct >= 90 ? "#4ade80" : pct >= 70 ? "#fbb900" : "#f87171";
                  return (
                    <div key={gv} style={styles.gvCard}>
                      <div style={styles.gvHeader}>
                        <span style={styles.gvLabel}>GV {gv}</span>
                        <span style={{ ...styles.apBadge, background: pct >= 90 ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: pct >= 90 ? "#4ade80" : "#f87171" }}>{pct >= 90 ? "OK" : "NOK"}</span>
                      </div>
                      <div style={{ height: "6px", background: "rgba(255,255,255,0.08)", borderRadius: "3px", margin: "8px 0" }}>
                        <div style={{ height: "100%", width: `${Math.min(pct,100)}%`, background: cor, borderRadius: "3px" }} />
                      </div>
                      <div style={styles.gvFooter}>
                        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.82rem" }}>{ok} / {total} dias com desafio</span>
                        <span style={{ color: cor, fontWeight: "700" }}>{pct}%</span>
                      </div>
                      <p style={{ margin: "4px 0 0", color: "rgba(255,255,255,0.25)", fontSize: "0.72rem" }}>Meta: ≥ 90% dos dias úteis</p>
                    </div>
                  );
                })}
                {desafios.length === 0 && <p style={styles.msg}>Preencha em Admin → SPO Desafios.</p>}
              </div>
            </div>
            )}

            {/* DTO GC */}
            {(kpiAtivo === null || kpiAtivo === 6) && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 6 — DTO GC x GV</h3>
              {dto.length === 0 ? (
                <p style={styles.msg}>Importe o relatório em Admin → Arquivos → SPO DTO GC.</p>
              ) : (() => {
                // Mês mais recente disponível
                const meses = [...dto].sort((a,b) => (b.mes_referencia||"").localeCompare(a.mes_referencia||""));
                const dtoMes = meses[0] || {};
                // Trimestral: soma real e meta dos últimos 3 meses
                const ultimos3 = meses.slice(0, 3);
                const tri = {
                  matinal_real:     ultimos3.reduce((s,r) => s + Number(r.matinal_real||0), 0),
                  matinal_meta:     ultimos3.reduce((s,r) => s + Number(r.matinal_meta||0), 0),
                  vespertina_real:  ultimos3.reduce((s,r) => s + Number(r.vespertina_real||0), 0),
                  vespertina_meta:  ultimos3.reduce((s,r) => s + Number(r.vespertina_meta||0), 0),
                  coaching_real:    ultimos3.reduce((s,r) => s + Number(r.coaching_real||0), 0),
                  coaching_meta:    ultimos3.reduce((s,r) => s + Number(r.coaching_meta||0), 0),
                };
                tri.matinal_pct     = tri.matinal_meta  > 0 ? Math.round(tri.matinal_real    / tri.matinal_meta    * 100) : 0;
                tri.vespertina_pct  = tri.vespertina_meta > 0 ? Math.round(tri.vespertina_real / tri.vespertina_meta * 100) : 0;
                tri.coaching_pct    = tri.coaching_meta  > 0 ? Math.round(tri.coaching_real   / tri.coaching_meta   * 100) : 0;
                tri.status_final    = (tri.matinal_pct >= 100 && tri.vespertina_pct >= 100 && tri.coaching_pct >= 100) ? "OK" : "NOK";

                const d = dtoView === "trimestral" ? tri : dtoMes;
                const periodoLabel = dtoView === "trimestral"
                  ? `Trimestral (${ultimos3.map(r => fmtMes(r.mes_referencia)).reverse().join(" · ")})`
                  : fmtMes(dtoMes.mes_referencia);

                return (
                  <div>
                    {/* Botão mensal/trimestral */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                      <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.8rem" }}>{periodoLabel}</span>
                      <div style={{ display: "flex", background: "rgba(255,255,255,0.05)", borderRadius: "8px", padding: "2px" }}>
                        {["mensal","trimestral"].map(v => (
                          <button key={v} onClick={() => setDtoView(v)}
                            style={{ background: dtoView === v ? "rgba(251,185,0,0.2)" : "transparent", border: "none", color: dtoView === v ? "#fbb900" : "rgba(255,255,255,0.4)", padding: "4px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "0.78rem", fontFamily: "inherit", fontWeight: dtoView === v ? "600" : "400" }}>
                            {v === "mensal" ? "Mensal" : "Trimestral"}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Badge status */}
                    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "12px" }}>
                      <span style={{ ...styles.apBadge, background: d.status_final === "OK" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: d.status_final === "OK" ? "#4ade80" : "#f87171" }}>
                        {d.status_final === "OK" ? "✅ OK" : "❌ NOK"}
                      </span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px" }}>
                      {[
                        { label: "Matinal",       real: d.matinal_real,    meta: d.matinal_meta,    pct: d.matinal_pct,    status: d.matinal_status },
                        { label: "Vespertina",    real: d.vespertina_real, meta: d.vespertina_meta, pct: d.vespertina_pct, status: d.vespertina_status },
                        { label: "Rota Coaching", real: d.coaching_real,   meta: d.coaching_meta,   pct: d.coaching_pct,   status: d.coaching_status },
                      ].map((item) => {
                        const pct = parseFloat(item.pct || 0);
                        const cor = pct >= 100 ? "#4ade80" : pct >= 70 ? "#fbb900" : "#f87171";
                        return (
                          <div key={item.label} style={styles.gvCard}>
                            <div style={styles.gvHeader}>
                              <span style={{ fontSize: "0.88rem", fontWeight: "600" }}>{item.label}</span>
                              {item.status && <span style={{ ...styles.apBadge, background: item.status === "OK" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: item.status === "OK" ? "#4ade80" : "#f87171", fontSize: "0.72rem" }}>{item.status}</span>}
                            </div>
                            <BarraProgresso pct={pct} cor={cor} />
                            <div style={styles.gvFooter}>
                              <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.82rem" }}>{item.real} / {item.meta}</span>
                              <span style={{ color: cor, fontWeight: "700" }}>{pct}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
            )}

            {/* ABA PROMOÇÃO */}
            {(kpiAtivo === null || kpiAtivo === 7) && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 7 — % PDVs abrindo Aba de Promoção no BEES</h3>
              {promo.length === 0 ? (
                <p style={styles.msg}>Importe o relatório em Admin → Arquivos → SPO Aba Promoção BEES.</p>
              ) : (() => {
                // Meta vem do spo_metas (item 7, mês atual) — entra como 10 para 10%
                const meta7 = parseFloat(spoMetas.find(m => String(m.item) === "7" && m.mes === mesAtual)?.meta) || 10;

                // Memória de cálculo trimestral — lê os 3 meses do spo_metas (real = % do mês)
                const mesesTri = spoMetas
                  .filter(m => String(m.item) === "7" && m.mes !== "TRI" && m.real !== "" && m.real != null)
                  .sort((a, b) => a.mes.localeCompare(b.mes))
                  .slice(-3);
                const triPct7 = mesesTri.length >= 2
                  ? (mesesTri.reduce((s, m) => s + parseFloat(m.real || 0), 0) / mesesTri.length)
                  : null;

                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {/* Cards por setor */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "10px" }}>
                      {[...promo].sort((a,b) => (b.setor === "OPERACAO" ? 1 : 0) - (a.setor === "OPERACAO" ? 1 : 0)).map((r) => {
                        // Calcula sempre de acesso_promo / visitas para evitar pct desatualizado na aba
                        const ac  = parseFloat(r.acesso_promo || 0);
                        const vis = parseFloat(r.visitas || 0);
                        const pct = vis > 0 ? parseFloat((ac / vis * 100).toFixed(1)) : parseFloat(r.pct || 0);
                        const cor = pct >= meta7 ? "#4ade80" : pct >= meta7 * 0.7 ? "#fbb900" : "#f87171";
                        const isOp = r.setor === "OPERACAO";
                        const barPct = meta7 > 0 ? Math.min(pct / meta7 * 100, 150) : 0;
                        return (
                          <div key={r.setor} style={{ ...styles.gvCard, ...(isOp ? { border: "1px solid rgba(251,185,0,0.3)", gridColumn: "1/-1" } : {}) }}>
                            <div style={styles.gvHeader}>
                              <span style={{ fontWeight: "700", fontSize: isOp ? "1rem" : "0.88rem" }}>
                                {isOp ? "🏭 Operação Total" : `Setor ${r.setor}`}
                              </span>
                              <span style={{ ...styles.apBadge, background: pct >= meta7 ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: pct >= meta7 ? "#4ade80" : "#f87171" }}>
                                {pct >= meta7 ? "OK" : "NOK"}
                              </span>
                            </div>
                            <BarraProgresso pct={barPct} cor={cor} />
                            <div style={styles.gvFooter}>
                              {/* Memória: acesso / visitas = % */}
                              <span style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.75rem" }}>
                                {ac} / {vis} = {pct}%
                              </span>
                              <span style={{ color: cor, fontWeight: "700" }}>{pct}%</span>
                            </div>
                            <p style={{ margin: "2px 0 0", color: "rgba(255,255,255,0.25)", fontSize: "0.7rem" }}>Meta: ≥ {meta7}%</p>
                          </div>
                        );
                      })}
                    </div>

                    {/* Memória de cálculo trimestral */}
                    {mesesTri.length >= 2 && (
                      <div style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "10px", padding: "14px 16px" }}>
                        <p style={{ margin: "0 0 10px", fontSize: "0.78rem", fontWeight: "600", color: "rgba(255,255,255,0.5)" }}>📊 Memória de Cálculo — Trimestral</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: "5px", fontSize: "0.78rem" }}>
                          {mesesTri.map((m, i) => {
                            const v = parseFloat(m.real || 0);
                            const cor = v >= meta7 ? "#4ade80" : "#f87171";
                            return (
                              <div key={m.mes} style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ color: "rgba(255,255,255,0.4)" }}>Mês {i + 1} ({fmtMes(m.mes)}):</span>
                                <span style={{ color: cor, fontWeight: "600" }}>{v.toFixed(1)}%</span>
                              </div>
                            );
                          })}
                          <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", marginTop: "6px", paddingTop: "6px", display: "flex", justifyContent: "space-between", fontWeight: "700" }}>
                            <span style={{ color: "rgba(255,255,255,0.7)" }}>
                              Fechamento Tri (média simples):
                            </span>
                            <span style={{ color: triPct7 >= meta7 ? "#4ade80" : "#f87171" }}>
                              {triPct7 != null ? triPct7.toFixed(1) : "—"}%
                            </span>
                          </div>
                          <p style={{ margin: "4px 0 0", color: "rgba(255,255,255,0.2)", fontSize: "0.7rem" }}>
                            Fórmula: ({mesesTri.map(m => `${parseFloat(m.real||0).toFixed(1)}%`).join(" + ")}) ÷ {mesesTri.length} = {triPct7?.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    )}
                    {/* Detalhe por PDV */}
                    {promoDetalhe.length > 0 && (
                      <div>
                        <div style={styles.filtrosRow}>
                          <input style={styles.inputFiltro} placeholder="Buscar PDV..." value={promoBusca} onChange={(e) => setPromoBusca(e.target.value)} />
                          <select style={styles.inputFiltro} value={promoFiltroSetor} onChange={(e) => setPromoFiltroSetor(e.target.value)}>
                            <option value="todos">Todos os setores</option>
                            {[...new Set(promoDetalhe.filter(d => d.setor).map(d => d.setor))].sort().map(s => <option key={s} value={s}>Setor {s}</option>)}
                          </select>
                          <select style={styles.inputFiltro} value={promoFiltroDia} onChange={(e) => setPromoFiltroDia(e.target.value)}>
                            <option value="todos">Todos os dias</option>
                            {[...new Set(promoDetalhe.map(d => (d.dia_visita || "").split("/")[0].trim()).filter(Boolean))].sort().map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                          <span style={styles.countLabel}>{promoDetalhe.filter(d => (!promoBusca || d.cod_pdv?.includes(promoBusca)) && (promoFiltroSetor === "todos" || d.setor === promoFiltroSetor) && (promoFiltroDia === "todos" || (d.dia_visita || "").toUpperCase().includes(promoFiltroDia.toUpperCase()))).length} PDVs</span>
                        </div>
                        <div style={styles.tableWrap}>
                          <table style={styles.table}>
                            <thead>
                              <tr>{["Setor","PDV","Dia Visita","Visitas","Acesso Promo","%"].map(h => <th key={h} style={styles.th}>{h}</th>)}</tr>
                            </thead>
                            <tbody>
                              {promoDetalhe
                                .filter(d => (!promoBusca || d.cod_pdv?.includes(promoBusca)) && (promoFiltroSetor === "todos" || d.setor === promoFiltroSetor) && (promoFiltroDia === "todos" || (d.dia_visita || "").toUpperCase().includes(promoFiltroDia.toUpperCase())))
                                .slice(0, 100)
                                .map((d, i) => {
                                  const pct = parseFloat(d.pct || 0);
                                  const cor = pct >= 10 ? "#4ade80" : pct >= 5 ? "#fbb900" : "#f87171";
                                  return (
                                    <tr key={i} style={styles.tr}>
                                      <td style={styles.td}>{d.setor || "—"}</td>
                                      <td style={styles.td}><span style={styles.codBadge}>{d.cod_pdv}</span></td>
                                      <td style={styles.td}>{d.dia_visita || "—"}</td>
                                      <td style={styles.td}>{d.visitas}</td>
                                      <td style={styles.td}>{d.acesso_promo}</td>
                                      <td style={styles.td}><span style={{ color: cor, fontWeight: "700" }}>{pct}%</span></td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
            )}

            {/* POLÍTICA COMERCIAL */}
            {(kpiAtivo === null || kpiAtivo === 8) && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 8 — Aderência de Política Comercial</h3>
              {politica.length === 0 ? (
                <p style={styles.msg}>Importe o arquivo de tasks para calcular automaticamente.</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "10px" }}>
                  {politica.map((r) => {
                    const isOp = r.setor === "OPERACAO";
                    const real = parseFloat(r.pdvs_execucao || 0);
                    const _ader = parseFloat(r.pdvs_aderidos || 0);
                    const metaRef = _ader > 0 ? Math.ceil(_ader * 0.60) : (isOp ? spoMetaTotal(8) : null);
                    const pct = metaRef !== null && metaRef > 0 ? Math.round(real / metaRef * 100) : parseFloat(r.pct || 0);
                    const cor = pct >= 100 ? "#4ade80" : pct >= 70 ? "#fbb900" : "#f87171";
                    const okBadge = metaRef !== null ? real >= metaRef : r.ok === "OK";
                    return (
                      <div key={r.setor} style={{ ...styles.gvCard, ...(isOp ? { border: "1px solid rgba(251,185,0,0.3)", gridColumn: "1/-1" } : {}) }}>
                        <div style={styles.gvHeader}>
                          <span style={{ fontWeight: "700", fontSize: isOp ? "1rem" : "0.88rem" }}>
                            {isOp ? "🏭 Operação" : `Setor ${r.setor}`}
                          </span>
                          <span style={{ ...styles.apBadge, background: okBadge ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: okBadge ? "#4ade80" : "#f87171" }}>{okBadge ? "OK" : "NOK"}</span>
                        </div>
                        <BarraProgresso pct={pct} cor={cor} />
                        <div style={styles.gvFooter}>
                          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.78rem" }}>{real} / {metaRef !== null ? metaRef : r.pdvs_aderidos} PDVs</span>
                          <span style={{ color: cor, fontWeight: "700" }}>{pct}%</span>
                        </div>
                        <p style={{ margin: "2px 0 0", color: "rgba(255,255,255,0.25)", fontSize: "0.7rem" }}>Meta: {metaRef !== null ? `${metaRef} PDVs` : "≥ 60%"}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            )}


            {/* MENU DE CERVEJA */}
            {(kpiAtivo === null || kpiAtivo === 9) && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 9 — Execução Menu de Cerveja</h3>
              {menu.length === 0 ? (
                <p style={styles.msg}>Importe o arquivo de tasks para calcular automaticamente.</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "10px" }}>
                  {menu.map((r) => {
                    const isOp = r.setor === "OPERACAO";
                    const real = parseFloat(r.tasks_validas || 0);
                    const mOp = spoMetaTotal(9);
                    const _opTot9 = parseFloat(menu.find(x => x.setor === "OPERACAO")?.tasks_total || 0);
                    const mRN = (mOp !== null && _opTot9 > 0) ? Math.ceil(parseFloat(r.tasks_total || 0) * (mOp / _opTot9) * 1.10) : null;
                    const metaRef = isOp ? mOp : mRN;
                    const pct = metaRef !== null ? Math.round(real / metaRef * 100) : parseFloat(r.pct || 0);
                    const cor = pct >= 100 ? "#4ade80" : pct >= 70 ? "#fbb900" : "#f87171";
                    const okBadge = metaRef !== null ? real >= metaRef : r.ok === "OK";
                    return (
                      <div key={r.setor} style={{ ...styles.gvCard, ...(isOp ? { border: "1px solid rgba(251,185,0,0.3)", gridColumn: "1/-1" } : {}) }}>
                        <div style={styles.gvHeader}>
                          <span style={{ fontWeight: "700", fontSize: isOp ? "1rem" : "0.88rem" }}>
                            {isOp ? "🏭 Operação" : `Setor ${r.setor}`}
                          </span>
                          <span style={{ ...styles.apBadge, background: okBadge ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: okBadge ? "#4ade80" : "#f87171" }}>{okBadge ? "OK" : "NOK"}</span>
                        </div>
                        <BarraProgresso pct={pct} cor={cor} />
                        <div style={styles.gvFooter}>
                          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.78rem" }}>{real} / {metaRef !== null ? metaRef : r.tasks_total} tasks</span>
                          <span style={{ color: cor, fontWeight: "700" }}>{pct}%</span>
                        </div>
                        <p style={{ margin: "2px 0 0", color: "rgba(255,255,255,0.25)", fontSize: "0.7rem" }}>Meta: {metaRef !== null ? `${metaRef} tasks` : "≥ 60%"}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            )}


            {/* TASKS PORTFÓLIO CERVEJA */}
            {(kpiAtivo === null || kpiAtivo === 11) && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 11 — Tasks de Portfólio Cerveja</h3>
              {tasksCerveja.length === 0 ? (
                <p style={styles.msg}>Importe o arquivo de tasks para calcular automaticamente.</p>
              ) : (
                <>
                  {/* Consolidado por setor — contador POR PDV */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "10px", marginBottom: "16px" }}>
                    {[...tasksCerveja].sort((a,b) => (b.setor === "OPERACAO" ? 1 : 0) - (a.setor === "OPERACAO" ? 1 : 0)).map((r) => {
                      const isOp = r.setor === "OPERACAO";
                      const real = parseFloat(r.tasks_validas || 0);
                      const mOp = spoMetaTotal(11);
                      const _opTot11 = parseFloat(tasksCerveja.find(x => x.setor === "OPERACAO")?.tasks_total || 0);
                      const mRN = (mOp !== null && _opTot11 > 0) ? Math.ceil(parseFloat(r.tasks_total || 0) * (mOp / _opTot11) * 1.10) : null;
                      const metaRef = isOp ? mOp : mRN;
                      const pct = metaRef !== null ? Math.round(real / metaRef * 100) : parseFloat(r.pct || 0);
                      const cor = pct >= 100 ? "#4ade80" : pct >= 70 ? "#fbb900" : "#f87171";
                      const okBadge = metaRef !== null ? real >= metaRef : r.ok === "OK";
                      return (
                        <div key={r.setor} style={{ ...styles.gvCard, ...(isOp ? { border: "1px solid rgba(251,185,0,0.3)", gridColumn: "1/-1" } : {}) }}>
                          <div style={styles.gvHeader}>
                            <span style={{ fontWeight: "700", fontSize: isOp ? "1rem" : "0.88rem" }}>
                              {isOp ? "🏭 Operação" : `Setor ${r.setor}`}
                            </span>
                            <span style={{ ...styles.apBadge, background: okBadge ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: okBadge ? "#4ade80" : "#f87171" }}>{okBadge ? "OK" : "NOK"}</span>
                          </div>
                          <BarraProgresso pct={pct} cor={cor} />
                          <div style={styles.gvFooter}>
                            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.78rem" }}>
                              {r.tasks_validas}/{r.tasks_total} tasks
                            </span>
                            <span style={{ color: cor, fontWeight: "700" }}>{pct}%</span>
                          </div>
                          <p style={{ margin: "2px 0 0", color: "rgba(255,255,255,0.25)", fontSize: "0.7rem" }}>Meta: {metaRef !== null ? `${metaRef} tasks` : "≥ 60%"}</p>
                        </div>
                      );
                    })}
                  </div>
                  {/* Detalhe — PDVs com task em aberto */}
                  {tasksCervejaDetalhe.length > 0 && (
                    <>
                      <p style={{ margin: "0 0 8px", color: "rgba(255,255,255,0.4)", fontSize: "0.8rem" }}>
                        PDVs com task em aberto ({tasksCervejaDetalhe.filter(r =>
                          (kpi11FiltroRN === "TODOS" || r.setor === kpi11FiltroRN) &&
                          (kpi11FiltroDia === "TODOS" || r.dia_visita === kpi11FiltroDia)
                        ).length})
                      </p>
                      <div style={{ display: "flex", gap: "6px", marginBottom: "10px", flexWrap: "nowrap", overflowX: "auto" }}>
                        {[
                          { label: "RN",  val: kpi11FiltroRN,  set: setKpi11FiltroRN,  opts: ["TODOS", ...new Set(tasksCervejaDetalhe.map(r => r.setor).filter(Boolean))].sort() },
                          { label: "Dia", val: kpi11FiltroDia, set: setKpi11FiltroDia, opts: ["TODOS", ...new Set(tasksCervejaDetalhe.map(r => r.dia_visita).filter(Boolean))].sort() },
                        ].map(({ label, val, set, opts }) => (
                          <select key={label} value={val} onChange={e => set(e.target.value)}
                            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "#fff", padding: "3px 8px", fontSize: "0.75rem", cursor: "pointer", flexShrink: 0 }}>
                            {opts.map(o => <option key={o} value={o}>{label}: {o}</option>)}
                          </select>
                        ))}
                      </div>
                      <div style={{ overflowX: "auto", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                          <thead>
                            <tr>
                              {["RN","PDV","Nome","Dia","Status Task"].map(h => (
                                <th key={h} style={{ padding: "8px 10px", color: "rgba(255,255,255,0.4)", textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {tasksCervejaDetalhe.filter(r =>
                              (kpi11FiltroRN === "TODOS" || r.setor === kpi11FiltroRN) &&
                              (kpi11FiltroDia === "TODOS" || r.dia_visita === kpi11FiltroDia)
                            ).map((r, i) => (
                              <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                <td style={{ padding: "7px 10px", color: "rgba(255,255,255,0.7)" }}>{r.setor}</td>
                                <td style={{ padding: "7px 10px", color: "rgba(255,255,255,0.5)" }}>{r.cod_pdv}</td>
                                <td style={{ padding: "7px 10px", color: "rgba(255,255,255,0.7)", maxWidth: "140px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.nome_pdv}</td>
                                <td style={{ padding: "7px 10px", color: "#4ade80" }}>{r.dia_visita}</td>
                                <td style={{ padding: "7px 10px" }}>
                                  <span style={{ color: r.status_task === "OPEN" ? "#fbb900" : "#f87171", fontWeight: "600", fontSize: "0.75rem" }}>{r.status_task}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
            )}


            {/* TASKS FATURAMENTO SCORE 5 */}
            {(kpiAtivo === null || kpiAtivo === 12) && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 12 — Tasks Faturamento Score 5</h3>
              {score5.length === 0 ? (
                <p style={styles.msg}>Importe o relatório ON_TRADE para calcular automaticamente.</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "10px" }}>
                  {score5.map((r) => {
                    const isOp = r.setor === "OPERACAO";
                    const real = parseFloat(r.pdvs_ok || 0);
                    const mOp = spoMetaTotal(12);
                    const _opTot12 = parseFloat(score5.find(x => x.setor === "OPERACAO")?.pdvs_total || 0);
                    const mRN = (mOp !== null && _opTot12 > 0) ? Math.ceil(parseFloat(r.pdvs_total || 0) * (mOp / _opTot12)) : null;
                    const metaRef = isOp ? mOp : mRN;
                    const pct = metaRef !== null ? Math.round(real / metaRef * 100) : parseFloat(r.pct || 0);
                    const cor = pct >= 100 ? "#4ade80" : pct >= 70 ? "#fbb900" : "#f87171";
                    const okBadge = metaRef !== null ? real >= metaRef : r.ok === "OK";
                    return (
                      <div key={r.setor} style={{ ...styles.gvCard, ...(isOp ? { border: "1px solid rgba(251,185,0,0.3)", gridColumn: "1/-1" } : {}) }}>
                        <div style={styles.gvHeader}>
                          <span style={{ fontWeight: "700", fontSize: isOp ? "1rem" : "0.88rem" }}>
                            {isOp ? "🏭 Operação" : `Setor ${r.setor}`}
                          </span>
                          <span style={{ ...styles.apBadge, background: okBadge ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: okBadge ? "#4ade80" : "#f87171" }}>{okBadge ? "OK" : "NOK"}</span>
                        </div>
                        <BarraProgresso pct={pct} cor={cor} />
                        <div style={styles.gvFooter}>
                          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.78rem" }}>{real} / {metaRef !== null ? metaRef : r.pdvs_total} PDVs</span>
                          <span style={{ color: cor, fontWeight: "700" }}>{pct}%</span>
                        </div>
                        <p style={{ margin: "2px 0 0", color: "rgba(255,255,255,0.25)", fontSize: "0.7rem" }}>Meta: {metaRef !== null ? `${metaRef} PDVs` : "≥ 46%"}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            )}


            {/* TASKS NAB */}
            {(kpiAtivo === null || kpiAtivo === 13) && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 13 — Tasks de Portfólio NAB</h3>
              {tasksNab.length === 0 ? (
                <p style={styles.msg}>Importe o arquivo de tasks para calcular automaticamente.</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "10px" }}>
                  {tasksNab.map((r) => {
                    const isOp = r.setor === "OPERACAO";
                    const real = parseFloat(r.tasks_validas || 0);
                    const mOp = spoMetaTotal(13);
                    const _opTot13 = parseFloat(tasksNab.find(x => x.setor === "OPERACAO")?.tasks_total || 0);
                    const mRN = (mOp !== null && _opTot13 > 0) ? Math.ceil(parseFloat(r.tasks_total || 0) * (mOp / _opTot13) * 1.10) : null;
                    const metaRef = isOp ? mOp : mRN;
                    const pct = metaRef !== null ? Math.round(real / metaRef * 100) : parseFloat(r.pct || 0);
                    const cor = pct >= 100 ? "#4ade80" : pct >= 70 ? "#fbb900" : "#f87171";
                    const okBadge = metaRef !== null ? real >= metaRef : r.ok === "OK";
                    return (
                      <div key={r.setor} style={{ ...styles.gvCard, ...(isOp ? { border: "1px solid rgba(251,185,0,0.3)", gridColumn: "1/-1" } : {}) }}>
                        <div style={styles.gvHeader}>
                          <span style={{ fontWeight: "700", fontSize: isOp ? "1rem" : "0.88rem" }}>
                            {isOp ? "🏭 Operação" : `Setor ${r.setor}`}
                          </span>
                          <span style={{ ...styles.apBadge, background: okBadge ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: okBadge ? "#4ade80" : "#f87171" }}>{okBadge ? "OK" : "NOK"}</span>
                        </div>
                        <BarraProgresso pct={pct} cor={cor} />
                        <div style={styles.gvFooter}>
                          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.78rem" }}>{real} / {metaRef !== null ? metaRef : r.tasks_total} tasks</span>
                          <span style={{ color: cor, fontWeight: "700" }}>{pct}%</span>
                        </div>
                        <p style={{ margin: "2px 0 0", color: "rgba(255,255,255,0.25)", fontSize: "0.7rem" }}>Meta: {metaRef !== null ? `${metaRef} tasks` : "≥ 60%"}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            )}


            {/* TASKS VOLUME */}
            {(kpiAtivo === null || kpiAtivo === 14) && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 14 — Tasks de Volume</h3>
              {tasksVolume.length === 0 ? (
                <p style={styles.msg}>Importe o arquivo de tasks para calcular automaticamente.</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "10px" }}>
                  {tasksVolume.map((r) => {
                    const isOp = r.setor === "OPERACAO";
                    const real = parseFloat(r.tasks_validas || 0);
                    const mOp = spoMetaTotal(14);
                    const _opTot14 = parseFloat(tasksVolume.find(x => x.setor === "OPERACAO")?.tasks_total || 0);
                    const mRN = (mOp !== null && _opTot14 > 0) ? Math.ceil(parseFloat(r.tasks_total || 0) * (mOp / _opTot14) * 1.10) : null;
                    const metaRef = isOp ? mOp : mRN;
                    const pct = metaRef !== null ? Math.round(real / metaRef * 100) : parseFloat(r.pct || 0);
                    const cor = pct >= 100 ? "#4ade80" : pct >= 70 ? "#fbb900" : "#f87171";
                    const okBadge = metaRef !== null ? real >= metaRef : r.ok === "OK";
                    return (
                      <div key={r.setor} style={{ ...styles.gvCard, ...(isOp ? { border: "1px solid rgba(251,185,0,0.3)", gridColumn: "1/-1" } : {}) }}>
                        <div style={styles.gvHeader}>
                          <span style={{ fontWeight: "700", fontSize: isOp ? "1rem" : "0.88rem" }}>
                            {isOp ? "🏭 Operação" : `Setor ${r.setor}`}
                          </span>
                          <span style={{ ...styles.apBadge, background: okBadge ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: okBadge ? "#4ade80" : "#f87171" }}>{okBadge ? "OK" : "NOK"}</span>
                        </div>
                        <BarraProgresso pct={pct} cor={cor} />
                        <div style={styles.gvFooter}>
                          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.78rem" }}>{real} / {metaRef !== null ? metaRef : r.tasks_total} tasks</span>
                          <span style={{ color: cor, fontWeight: "700" }}>{pct}%</span>
                        </div>
                        <p style={{ margin: "2px 0 0", color: "rgba(255,255,255,0.25)", fontSize: "0.7rem" }}>Meta: {metaRef !== null ? `${metaRef} tasks` : "≥ 60%"}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            )}


            {/* TASKS MARKETPLACE */}
            {(kpiAtivo === null || kpiAtivo === 15) && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 15 — Tasks de Marketplace</h3>
              {tasksMktp.length === 0 ? (
                <p style={styles.msg}>Importe o arquivo de tasks para calcular automaticamente.</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "10px" }}>
                  {tasksMktp.map((r) => {
                    const isOp = r.setor === "OPERACAO";
                    const real = parseFloat(r.tasks_validas || 0);
                    const mOp = spoMetaTotal(15);
                    const _opTot15 = parseFloat(tasksMktp.find(x => x.setor === "OPERACAO")?.tasks_total || 0);
                    const mRN = (mOp !== null && _opTot15 > 0) ? Math.ceil(parseFloat(r.tasks_total || 0) * (mOp / _opTot15) * 1.10) : null;
                    const metaRef = isOp ? mOp : mRN;
                    const pct = metaRef !== null ? Math.round(real / metaRef * 100) : parseFloat(r.pct || 0);
                    const cor = pct >= 100 ? "#4ade80" : pct >= 70 ? "#fbb900" : "#f87171";
                    const okBadge = metaRef !== null ? real >= metaRef : r.ok === "OK";
                    return (
                      <div key={r.setor} style={{ ...styles.gvCard, ...(isOp ? { border: "1px solid rgba(251,185,0,0.3)", gridColumn: "1/-1" } : {}) }}>
                        <div style={styles.gvHeader}>
                          <span style={{ fontWeight: "700", fontSize: isOp ? "1rem" : "0.88rem" }}>
                            {isOp ? "🏭 Operação" : `Setor ${r.setor}`}
                          </span>
                          <span style={{ ...styles.apBadge, background: okBadge ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: okBadge ? "#4ade80" : "#f87171" }}>{okBadge ? "OK" : "NOK"}</span>
                        </div>
                        <BarraProgresso pct={pct} cor={cor} />
                        <div style={styles.gvFooter}>
                          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.78rem" }}>{real} / {metaRef !== null ? metaRef : r.tasks_total} tasks</span>
                          <span style={{ color: cor, fontWeight: "700" }}>{pct}%</span>
                        </div>
                        <p style={{ margin: "2px 0 0", color: "rgba(255,255,255,0.25)", fontSize: "0.7rem" }}>Meta: {metaRef !== null ? `${metaRef} tasks` : "≥ 60%"}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            )}


            {/* TASKS MATCH */}
            {(kpiAtivo === null || kpiAtivo === 16) && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 16 — Tasks de Portfólio MATCH</h3>
              {tasksMatch.length === 0 ? (
                <p style={styles.msg}>Importe o arquivo de tasks para calcular automaticamente.</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "10px" }}>
                  {tasksMatch.map((r) => {
                    const isOp = r.setor === "OPERACAO";
                    const real = parseFloat(r.tasks_validas || 0);
                    const mOp = spoMetaTotal(16);
                    const _opTot16 = parseFloat(tasksMatch.find(x => x.setor === "OPERACAO")?.tasks_total || 0);
                    const mRN = (mOp !== null && _opTot16 > 0) ? Math.ceil(parseFloat(r.tasks_total || 0) * (mOp / _opTot16) * 1.10) : null;
                    const metaRef = isOp ? mOp : mRN;
                    const pct = metaRef !== null ? Math.round(real / metaRef * 100) : parseFloat(r.pct || 0);
                    const cor = pct >= 100 ? "#4ade80" : pct >= 70 ? "#fbb900" : "#f87171";
                    const okBadge = metaRef !== null ? real >= metaRef : r.ok === "OK";
                    return (
                      <div key={r.setor} style={{ ...styles.gvCard, ...(isOp ? { border: "1px solid rgba(251,185,0,0.3)", gridColumn: "1/-1" } : {}) }}>
                        <div style={styles.gvHeader}>
                          <span style={{ fontWeight: "700", fontSize: isOp ? "1rem" : "0.88rem" }}>
                            {isOp ? "🏭 Operação" : `Setor ${r.setor}`}
                          </span>
                          <span style={{ ...styles.apBadge, background: okBadge ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: okBadge ? "#4ade80" : "#f87171" }}>{okBadge ? "OK" : "NOK"}</span>
                        </div>
                        <BarraProgresso pct={pct} cor={cor} />
                        <div style={styles.gvFooter}>
                          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.78rem" }}>{real} / {metaRef !== null ? metaRef : r.tasks_total} tasks</span>
                          <span style={{ color: cor, fontWeight: "700" }}>{pct}%</span>
                        </div>
                        <p style={{ margin: "2px 0 0", color: "rgba(255,255,255,0.25)", fontSize: "0.7rem" }}>Meta: {metaRef !== null ? `${metaRef} tasks` : "≥ 60%"}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            )}


            {/* TASKS CERVEJA ZERO */}
            {(kpiAtivo === null || kpiAtivo === 17) && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 17 — Tasks de Portfólio Cerveja Zero</h3>
              {tasksCervZero.length === 0 ? (
                <p style={styles.msg}>Importe o arquivo de tasks para calcular automaticamente.</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "10px" }}>
                  {tasksCervZero.map((r) => {
                    const isOp = r.setor === "OPERACAO";
                    const real = parseFloat(r.tasks_validas || 0);
                    const mOp = spoMetaTotal(17);
                    const _opTot17 = parseFloat(tasksCervZero.find(x => x.setor === "OPERACAO")?.tasks_total || 0);
                    const mRN = (mOp !== null && _opTot17 > 0) ? Math.ceil(parseFloat(r.tasks_total || 0) * (mOp / _opTot17) * 1.10) : null;
                    const metaRef = isOp ? mOp : mRN;
                    const pct = metaRef !== null ? Math.round(real / metaRef * 100) : parseFloat(r.pct || 0);
                    const cor = pct >= 100 ? "#4ade80" : pct >= 70 ? "#fbb900" : "#f87171";
                    const okBadge = metaRef !== null ? real >= metaRef : r.ok === "OK";
                    return (
                      <div key={r.setor} style={{ ...styles.gvCard, ...(isOp ? { border: "1px solid rgba(251,185,0,0.3)", gridColumn: "1/-1" } : {}) }}>
                        <div style={styles.gvHeader}>
                          <span style={{ fontWeight: "700", fontSize: isOp ? "1rem" : "0.88rem" }}>
                            {isOp ? "🏭 Operação" : `Setor ${r.setor}`}
                          </span>
                          <span style={{ ...styles.apBadge, background: okBadge ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: okBadge ? "#4ade80" : "#f87171" }}>{okBadge ? "OK" : "NOK"}</span>
                        </div>
                        <BarraProgresso pct={pct} cor={cor} />
                        <div style={styles.gvFooter}>
                          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.78rem" }}>{real} / {metaRef !== null ? metaRef : r.tasks_total} tasks</span>
                          <span style={{ color: cor, fontWeight: "700" }}>{pct}%</span>
                        </div>
                        <p style={{ margin: "2px 0 0", color: "rgba(255,255,255,0.25)", fontSize: "0.7rem" }}>Meta: {metaRef !== null ? `${metaRef} tasks` : "≥ 60%"}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            )}


            {/* TASKS DIGITALIZAÇÃO */}
            {(kpiAtivo === null || kpiAtivo === 18) && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 18 — Tasks de Digitalização</h3>
              {tasksDigit.length === 0 ? (
                <p style={styles.msg}>Importe o arquivo de tasks para calcular automaticamente.</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "10px" }}>
                  {tasksDigit.map((r) => {
                    const isOp = r.setor === "OPERACAO";
                    const real = parseFloat(r.tasks_validas || 0);
                    const mOp = spoMetaTotal(18);
                    const _opTot18 = parseFloat(tasksDigit.find(x => x.setor === "OPERACAO")?.tasks_total || 0);
                    const mRN = (mOp !== null && _opTot18 > 0) ? Math.ceil(parseFloat(r.tasks_total || 0) * (mOp / _opTot18) * 1.10) : null;
                    const metaRef = isOp ? mOp : mRN;
                    const pct = metaRef !== null ? Math.round(real / metaRef * 100) : parseFloat(r.pct || 0);
                    const cor = pct >= 100 ? "#4ade80" : pct >= 70 ? "#fbb900" : "#f87171";
                    const okBadge = metaRef !== null ? real >= metaRef : r.ok === "OK";
                    return (
                      <div key={r.setor} style={{ ...styles.gvCard, ...(isOp ? { border: "1px solid rgba(251,185,0,0.3)", gridColumn: "1/-1" } : {}) }}>
                        <div style={styles.gvHeader}>
                          <span style={{ fontWeight: "700", fontSize: isOp ? "1rem" : "0.88rem" }}>
                            {isOp ? "🏭 Operação" : `Setor ${r.setor}`}
                          </span>
                          <span style={{ ...styles.apBadge, background: okBadge ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: okBadge ? "#4ade80" : "#f87171" }}>{okBadge ? "OK" : "NOK"}</span>
                        </div>
                        <BarraProgresso pct={pct} cor={cor} />
                        <div style={styles.gvFooter}>
                          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.78rem" }}>{real} / {metaRef !== null ? metaRef : r.tasks_total} tasks</span>
                          <span style={{ color: cor, fontWeight: "700" }}>{pct}%</span>
                        </div>
                        <p style={{ margin: "2px 0 0", color: "rgba(255,255,255,0.25)", fontSize: "0.7rem" }}>Meta: {metaRef !== null ? `${metaRef} tasks` : "≥ 60%"}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            )}


            {/* PDV COMPRA INDEPENDENTE */}
            {(kpiAtivo === null || kpiAtivo === 19) && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 19 — PDVs com Compra Independente</h3>
              {alone.length === 0 ? (
                <p style={styles.msg}>Importe o relatório de Pedido Alone para calcular automaticamente.</p>
              ) : (
                <>
                  {/* Botão mensal/trimestral */}
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "12px" }}>
                    <div style={{ display: "flex", background: "rgba(255,255,255,0.05)", borderRadius: "8px", padding: "2px" }}>
                      {["mensal","trimestral"].map(v => (
                        <button key={v} onClick={() => setAloneView(v)}
                          style={{ background: aloneView === v ? "rgba(251,185,0,0.2)" : "transparent", border: "none", color: aloneView === v ? "#fbb900" : "rgba(255,255,255,0.4)", padding: "4px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "0.78rem", fontFamily: "inherit", fontWeight: aloneView === v ? "600" : "400" }}>
                          {v === "mensal" ? "Mensal" : "Trimestral"}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Card Operação — meta do spo_metas KPI 19 */}
                  {(() => {
                    const opRow = alone.find(r => r.setor === "OPERACAO");
                    const val   = parseInt(opRow?.pdvs_alone || 0);
                    const mOp   = spoMetaTotal(19);
                    const pct   = mOp ? Math.round(val / mOp * 100) : 0;
                    const cor   = pct >= 100 ? "#4ade80" : pct >= 70 ? "#fbb900" : "#f87171";
                    const okBadge = mOp !== null ? val >= mOp : opRow?.ok === "OK";
                    return (
                      <div style={{ ...styles.gvCard, border: "1px solid rgba(251,185,0,0.3)", marginBottom: "12px" }}>
                        <div style={styles.gvHeader}>
                          <span style={{ fontWeight: "700", fontSize: "1rem" }}>🏭 Operação</span>
                          <span style={{ ...styles.apBadge, background: okBadge ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: okBadge ? "#4ade80" : "#f87171" }}>{okBadge ? "OK" : "NOK"}</span>
                        </div>
                        <BarraProgresso pct={pct} cor={cor} />
                        <div style={styles.gvFooter}>
                          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.78rem" }}>{val} / {mOp ?? "—"} PDVs alone</span>
                          <span style={{ color: cor, fontWeight: "700" }}>{pct}%</span>
                        </div>
                        <p style={{ margin: "2px 0 0", color: "rgba(255,255,255,0.25)", fontSize: "0.7rem" }}>Meta: {mOp !== null ? `${mOp} PDVs` : "—"}</p>
                      </div>
                    );
                  })()}
                  {/* Cards por RN — meta individual = 90% da base do RN */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "10px", marginBottom: "16px" }}>
                    {alone.filter(r => r.setor !== "OPERACAO").map(r => {
                      const val     = parseInt(r.pdvs_alone || 0);
                      const total   = parseInt(r.pdvs_total || 0);
                      const metaRN  = total > 0 ? Math.ceil(total * 0.90) : 0;
                      const pct     = metaRN > 0 ? Math.round(val / metaRN * 100) : 0;
                      const okBadge = val >= metaRN && metaRN > 0;
                      const cor     = pct >= 100 ? "#4ade80" : pct >= 70 ? "#fbb900" : "#f87171";
                      const tarjaBg     = okBadge ? "rgba(74,222,128,0.08)" : pct >= 70 ? "rgba(251,185,0,0.08)" : "rgba(248,113,113,0.08)";
                      const tarjaBorder = okBadge ? "rgba(74,222,128,0.25)" : pct >= 70 ? "rgba(251,185,0,0.25)" : "rgba(248,113,113,0.25)";
                      return (
                        <div key={r.setor} style={{ ...styles.gvCard, background: tarjaBg, border: `1px solid ${tarjaBorder}` }}>
                          <div style={styles.gvHeader}>
                            <span style={{ fontWeight: "700", fontSize: "0.88rem" }}>Setor {r.setor}</span>
                            <span style={{ color: cor, fontWeight: "700", fontSize: "0.9rem" }}>{pct}%</span>
                          </div>
                          <BarraProgresso pct={pct} cor={cor} />
                          <div style={styles.gvFooter}>
                            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.75rem" }}>
                              {val} / {metaRN} PDVs
                            </span>
                          </div>
                          <p style={{ margin: "2px 0 0", color: "rgba(255,255,255,0.25)", fontSize: "0.7rem" }}>Meta: {metaRN} (90% de {total})</p>
                        </div>
                      );
                    })}
                  </div>
                  {/* Detalhe por PDV */}
                  {aloneDetalhe.length > 0 && (
                    <>
                      <div style={{ display: "flex", gap: "6px", marginBottom: "10px", flexWrap: "nowrap", overflowX: "auto", alignItems: "center" }}>
                        {[
                          { label: "RN",     val: aloneFiltroRN,  set: setAloneFiltroRN,  opts: ["TODOS", ...new Set(aloneDetalhe.map(r => r.setor).filter(Boolean))].sort() },
                          { label: "Dia",    val: aloneFiltroDia, set: setAloneFiltroDia, opts: ["TODOS", ...new Set(aloneDetalhe.map(r => r.dia_visita).filter(Boolean))].sort() },
                          { label: "Alone",  val: aloneFiltroPDV, set: setAloneFiltroPDV, opts: ["TODOS", "SIM", "NÃO"] },
                        ].map(({ label, val, set, opts }) => (
                          <select key={label} value={val} onChange={e => set(e.target.value)}
                            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "#fff", padding: "3px 8px", fontSize: "0.75rem", cursor: "pointer", flexShrink: 0 }}>
                            {opts.map(o => <option key={o} value={o}>{label}: {o}</option>)}
                          </select>
                        ))}
                        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.72rem", whiteSpace: "nowrap" }}>
                          {aloneDetalhe.filter(r =>
                            (aloneFiltroRN  === "TODOS" || r.setor      === aloneFiltroRN) &&
                            (aloneFiltroDia === "TODOS" || r.dia_visita === aloneFiltroDia) &&
                            (aloneFiltroPDV === "TODOS" || r.is_alone   === aloneFiltroPDV)
                          ).length} PDVs
                        </span>
                      </div>
                      <div style={{ overflowX: "auto", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                          <thead>
                            <tr>
                              {["RN","PDV","Nome","Dia","Ped. Total","Ped. Alone","Alone","SKU Top"].map(h => (
                                <th key={h} style={{ padding: "8px 10px", color: "rgba(255,255,255,0.4)", textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {aloneDetalhe.filter(r =>
                              (aloneFiltroRN  === "TODOS" || r.setor      === aloneFiltroRN) &&
                              (aloneFiltroDia === "TODOS" || r.dia_visita === aloneFiltroDia) &&
                              (aloneFiltroPDV === "TODOS" || r.is_alone   === aloneFiltroPDV)
                            ).map((r, i) => (
                              <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                <td style={{ padding: "7px 10px", color: "rgba(255,255,255,0.7)" }}>{r.setor}</td>
                                <td style={{ padding: "7px 10px", color: "rgba(255,255,255,0.5)" }}>{r.cod_pdv}</td>
                                <td style={{ padding: "7px 10px", color: "rgba(255,255,255,0.7)", maxWidth: "130px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.nome_pdv}</td>
                                <td style={{ padding: "7px 10px", color: "#4ade80" }}>{r.dia_visita}</td>
                                <td style={{ padding: "7px 10px", color: "rgba(255,255,255,0.5)", textAlign: "right" }}>{r.pedidos_total}</td>
                                <td style={{ padding: "7px 10px", color: "#fbb900", textAlign: "right", fontWeight: "600" }}>{r.pedidos_alone}</td>
                                <td style={{ padding: "7px 10px" }}>
                                  <span style={{ color: r.is_alone === "SIM" ? "#4ade80" : "#f87171", fontWeight: "600" }}>{r.is_alone}</span>
                                </td>
                                <td style={{ padding: "7px 10px", color: "rgba(255,255,255,0.5)", fontSize: "0.72rem", maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.sku_top || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
            )}


            {/* +RGB */}
            {(kpiAtivo === null || kpiAtivo === 20) && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 20 — +RGB</h3>
              {rgb.length === 0 ? (
                <p style={styles.msg}>Importe o relatório +RGB para calcular automaticamente.</p>
              ) : (
                <>
                  {["Total","Litrinho","Inteira"].map((tipo) => {
                    const dados = tipo === "Total" ? rgb : tipo === "Litrinho" ? rgbLit : rgbInt;
                    const op = dados.find(r => r.setor === "OPERACAO");
                    if (!op && tipo !== "Total") return null;
                    return (
                      <div key={tipo} style={{ marginBottom: "16px" }}>
                        <p style={{ margin: "0 0 8px", color: "rgba(255,255,255,0.5)", fontSize: "0.8rem", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" }}>{tipo}</p>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "8px" }}>
                          {dados.map((r) => {
                            const pct = parseFloat(r.pct_meta || 0);
                            const cor = pct >= 60 ? "#4ade80" : pct >= 40 ? "#fbb900" : "#f87171";
                            const isOp = r.setor === "OPERACAO";
                            return (
                              <div key={r.setor} style={{ ...styles.gvCard, ...(isOp ? { border: "1px solid rgba(251,185,0,0.3)", gridColumn: "1/-1" } : {}) }}>
                                <div style={styles.gvHeader}>
                                  <span style={{ fontWeight: "700", fontSize: isOp ? "1rem" : "0.85rem" }}>
                                    {isOp ? "🏭 Operação" : `Setor ${r.setor}`}
                                  </span>
                                </div>
                                <BarraProgresso pct={pct} cor={cor} />
                                <div style={styles.gvFooter}>
                                  <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.75rem" }}>{r.pdvs_bateu_meta}/{r.pdvs_total} PDVs</span>
                                  <span style={{ color: cor, fontWeight: "700" }}>{pct}%</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
            )}


            {/* CUPONS DIGITAIS */}
            {(kpiAtivo === null || kpiAtivo === 21) && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 21 — Cupons Digitais Score 5</h3>
              {cupons.length === 0 ? (
                <p style={styles.msg}>Importe o planificador de Cupons para calcular automaticamente.</p>
              ) : (
                <>
                  {/* Consolidado — Operação primeiro, depois setores */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "8px", marginBottom: "16px" }}>
                    {[...cupons].sort((a,b) => (b.setor === "OPERACAO" ? 1 : 0) - (a.setor === "OPERACAO" ? 1 : 0)).map((r) => {
                      const isOp = r.setor === "OPERACAO";
                      const meta = parseInt(r.meta || 0);
                      const real = parseInt(r.cupons_mes || 0);
                      const pct  = meta > 0 ? Math.round(real / meta * 100) : null;
                      const cor  = pct === null ? "#fbb900" : pct >= 100 ? "#4ade80" : pct >= 70 ? "#fbb900" : "#f87171";
                      return (
                        <div key={r.setor} style={{ ...styles.gvCard, ...(isOp ? { border: "1px solid rgba(251,185,0,0.3)", gridColumn: "1/-1" } : {}) }}>
                          <div style={styles.gvHeader}>
                            <span style={{ fontWeight: "700", fontSize: isOp ? "1rem" : "0.85rem" }}>
                              {isOp ? "🏭 Operação" : `Setor ${r.setor}`}
                            </span>
                            {pct !== null && (
                              <span style={{ color: cor, fontWeight: "700", fontSize: isOp ? "1rem" : "0.9rem" }}>{pct}%</span>
                            )}
                          </div>
                          {pct !== null && <BarraProgresso pct={pct} cor={cor} />}
                          <div style={styles.gvFooter}>
                            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.75rem" }}>
                              {real}{meta > 0 ? ` / ${meta}` : ""} cupons
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {cuponsDet.length > 0 && (
                    <>
                      {/* Filtros em linha única com fonte reduzida */}
                      <div style={{ display: "flex", gap: "6px", marginBottom: "10px", flexWrap: "nowrap", overflowX: "auto", alignItems: "center" }}>
                        <p style={{ margin: 0, color: "rgba(255,255,255,0.4)", fontSize: "0.75rem", whiteSpace: "nowrap" }}>PDVs sem resgate:</p>
                        {[
                          { label: "GV", val: cuponsGV, set: setCuponsGV, opts: ["TODOS", ...new Set(cuponsDet.map(r => r.gv).filter(Boolean))].sort() },
                          { label: "RN", val: cuponsRN, set: setCuponsRN, opts: ["TODOS", ...new Set(cuponsDet.map(r => r.setor).filter(Boolean))].sort() },
                          { label: "Dia", val: cuponsDia, set: setCuponsDia, opts: ["TODOS", ...new Set(cuponsDet.map(r => r.dia_visita).filter(Boolean))].sort() },
                          { label: "Marca", val: cuponsMarca, set: setCuponsMarca, opts: ["TODAS", ...new Set(cuponsDet.map(r => r.campanha).filter(Boolean))].sort() },
                        ].map(({ label, val, set, opts }) => (
                          <select key={label} value={val} onChange={e => set(e.target.value)}
                            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "#fff", padding: "3px 8px", fontSize: "0.75rem", cursor: "pointer", flexShrink: 0 }}>
                            {opts.map(o => <option key={o} value={o}>{label}: {o}</option>)}
                          </select>
                        ))}
                        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.72rem", whiteSpace: "nowrap" }}>
                          {cuponsDet.filter(r =>
                            (cuponsGV === "TODOS" || r.gv === cuponsGV) &&
                            (cuponsRN === "TODOS" || r.setor === cuponsRN) &&
                            (cuponsDia === "TODOS" || r.dia_visita === cuponsDia) &&
                            (cuponsMarca === "TODAS" || r.campanha === cuponsMarca)
                          ).length} registros
                        </span>
                      </div>
                      <div style={{ overflowX: "auto", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                          <thead>
                            <tr>
                              {["GV","RN","PDV","Nome","Dia Visita","Marca","Cupons","Próx. Visita","Último Resgate"].map(h => (
                                <th key={h} style={{ padding: "8px 10px", color: "rgba(255,255,255,0.4)", textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {cuponsDet.filter(r =>
                              (cuponsGV === "TODOS" || r.gv === cuponsGV) &&
                              (cuponsRN === "TODOS" || r.setor === cuponsRN) &&
                              (cuponsDia === "TODOS" || r.dia_visita === cuponsDia) &&
                              (cuponsMarca === "TODAS" || r.campanha === cuponsMarca)
                            ).map((r, i) => (
                              <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                <td style={{ padding: "7px 10px", color: "rgba(255,255,255,0.5)" }}>{r.gv}</td>
                                <td style={{ padding: "7px 10px", color: "rgba(255,255,255,0.7)" }}>{r.setor}</td>
                                <td style={{ padding: "7px 10px", color: "rgba(255,255,255,0.5)" }}>{r.pdv}</td>
                                <td style={{ padding: "7px 10px", color: "rgba(255,255,255,0.7)", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.nome_pdv}</td>
                                <td style={{ padding: "7px 10px", color: "#4ade80" }}>{r.dia_visita}</td>
                                <td style={{ padding: "7px 10px", color: "#fbb900" }}>{r.campanha}</td>
                                <td style={{ padding: "7px 10px", color: "#4ade80", fontWeight: "600" }}>{r.cupons}</td>
                                <td style={{ padding: "7px 10px", color: "rgba(255,255,255,0.5)" }}>{r.proxima_visita}</td>
                                <td style={{ padding: "7px 10px", color: "rgba(255,255,255,0.4)" }}>{r.ultimo_resgate}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
            )}


            {/* LOJA IDEAL VIZINHANÇA */}
            {(kpiAtivo === null || kpiAtivo === 22) && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 22 — % Lojas Ideais Vizinhança</h3>
              {lojaIdeal.length === 0 ? (
                <p style={styles.msg}>Importe o Planificador de Loja Ideal para calcular automaticamente.</p>
              ) : (
                <>
                  {/* Consolidado — Operação primeiro */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "8px", marginBottom: "16px" }}>
                    {[...lojaIdeal].sort((a,b) => (b.setor === "OPERACAO" ? 1 : 0) - (a.setor === "OPERACAO" ? 1 : 0)).map((r) => {
                      const pct = parseFloat(r.pct || 0);
                      const cor = pct >= 40 ? "#4ade80" : pct >= 25 ? "#fbb900" : "#f87171";
                      const isOp = r.setor === "OPERACAO";
                      return (
                        <div key={r.setor} style={{ ...styles.gvCard, ...(isOp ? { border: "1px solid rgba(251,185,0,0.3)", gridColumn: "1/-1" } : {}) }}>
                          <div style={styles.gvHeader}>
                            <span style={{ fontWeight: "700", fontSize: isOp ? "1rem" : "0.85rem" }}>
                              {isOp ? "🏭 Operação" : `Setor ${r.setor}`}
                            </span>
                            <span style={{ ...styles.apBadge, background: r.ok === "OK" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: r.ok === "OK" ? "#4ade80" : "#f87171" }}>{r.ok}</span>
                          </div>
                          <BarraProgresso pct={pct} cor={cor} />
                          <div style={styles.gvFooter}>
                            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.75rem" }}>{r.pdvs_ideais}/{r.pdvs_total} PDVs</span>
                            <span style={{ color: cor, fontWeight: "700" }}>{pct}%</span>
                          </div>
                          <p style={{ margin: "2px 0 0", color: "rgba(255,255,255,0.25)", fontSize: "0.7rem" }}>Meta: ≥ 40%</p>
                        </div>
                      );
                    })}
                  </div>
                  {/* Detalhe */}
                  {lojaIdealDet.length > 0 && (
                    <>
                      <div style={{ display: "flex", gap: "6px", marginBottom: "10px", flexWrap: "nowrap", overflowX: "auto", alignItems: "center" }}>
                        {[
                          { label: "RN",     val: lojaFiltroRN,     set: setLojaFiltroRN,     opts: ["TODOS", ...new Set(lojaIdealDet.map(r => r.setor))].sort() },
                          { label: "Dia",    val: lojaFiltroDia,    set: setLojaFiltroDia,    opts: ["TODOS", ...new Set(lojaIdealDet.map(r => r.dia_visita).filter(Boolean))].sort() },
                          { label: "Status", val: lojaFiltroStatus, set: setLojaFiltroStatus, opts: ["TODOS", "SIM", "NÃO"] },
                        ].map(({ label, val, set, opts }) => (
                          <select key={label} value={val} onChange={e => set(e.target.value)}
                            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "#fff", padding: "3px 8px", fontSize: "0.75rem", cursor: "pointer", flexShrink: 0 }}>
                            {opts.map(o => <option key={o} value={o}>{label}: {o}</option>)}
                          </select>
                        ))}
                        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.72rem", whiteSpace: "nowrap" }}>
                          {lojaIdealDet.filter(r =>
                            (lojaFiltroRN === "TODOS" || r.setor === lojaFiltroRN) &&
                            (lojaFiltroDia === "TODOS" || r.dia_visita === lojaFiltroDia) &&
                            (lojaFiltroStatus === "TODOS" || r.loja_ideal === lojaFiltroStatus)
                          ).length} PDVs
                        </span>
                      </div>
                      <div style={{ overflowX: "auto", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                          <thead>
                            <tr>
                              {["RN","PDV","Nome","Dia","Total","Sort.","Exec.","Desafio","Ideal"].map(h => (
                                <th key={h} style={{ padding: "8px 10px", color: "rgba(255,255,255,0.4)", textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {lojaIdealDet.filter(r =>
                              (lojaFiltroRN === "TODOS" || r.setor === lojaFiltroRN) &&
                              (lojaFiltroDia === "TODOS" || r.dia_visita === lojaFiltroDia) &&
                              (lojaFiltroStatus === "TODOS" || r.loja_ideal === lojaFiltroStatus)
                            ).sort((a,b) => parseFloat(b.pts_total||0) - parseFloat(a.pts_total||0)).map((r, i) => {
                              const pts = parseFloat(r.pts_total || 0);
                              const cor = pts >= 60 ? "#4ade80" : pts >= 40 ? "#fbb900" : "#f87171";
                              return (
                                <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                  <td style={{ padding: "7px 10px", color: "rgba(255,255,255,0.7)" }}>{r.setor}</td>
                                  <td style={{ padding: "7px 10px", color: "rgba(255,255,255,0.5)" }}>{r.cod_pdv}</td>
                                  <td style={{ padding: "7px 10px", color: "rgba(255,255,255,0.7)", maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.nome_pdv}</td>
                                  <td style={{ padding: "7px 10px", color: "#4ade80" }}>{r.dia_visita}</td>
                                  <td style={{ padding: "7px 10px", color: cor, fontWeight: "700" }}>{r.pts_total}</td>
                                  <td style={{ padding: "7px 10px", color: "rgba(255,255,255,0.6)" }}>{r.pts_sortimento}</td>
                                  <td style={{ padding: "7px 10px", color: "rgba(255,255,255,0.6)" }}>{r.pts_execucao}</td>
                                  <td style={{ padding: "7px 10px", color: "rgba(255,255,255,0.6)" }}>{r.pts_desafio}</td>
                                  <td style={{ padding: "7px 10px" }}>
                                    <span style={{ color: r.loja_ideal === "SIM" ? "#4ade80" : "#f87171", fontWeight: "600" }}>{r.loja_ideal}</span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
            )}


            {/* EXPANSÃO SCANNTECH */}
            {(kpiAtivo === null || kpiAtivo === 23) && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 23 — Expansão Scanntech</h3>
              {scanntech.length === 0 ? (
                <p style={styles.msg}>Importe a base Scanntech para calcular automaticamente.</p>
              ) : (
                <>
                  {/* Card Operação — meta do spo_metas */}
                  {(() => {
                    const opRow = scanntech.find(r => r.setor === "OPERACAO");
                    const real  = parseInt(opRow?.pdvs_ativos || opRow?.ativos || 0);
                    const mOp   = spoMetaTotal(23);
                    const pct   = mOp ? Math.round(real / mOp * 100) : 0;
                    const cor   = pct >= 100 ? "#4ade80" : pct >= 70 ? "#fbb900" : "#f87171";
                    const okBadge = mOp !== null ? real >= mOp : opRow?.ok === "OK";
                    return (
                      <div style={{ ...styles.gvCard, border: "1px solid rgba(251,185,0,0.3)", marginBottom: "14px" }}>
                        <div style={styles.gvHeader}>
                          <span style={{ fontWeight: "700", fontSize: "1rem" }}>🏭 Operação</span>
                          <span style={{ ...styles.apBadge, background: okBadge ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: okBadge ? "#4ade80" : "#f87171" }}>{okBadge ? "OK" : "NOK"}</span>
                        </div>
                        <BarraProgresso pct={pct} cor={cor} />
                        <div style={styles.gvFooter}>
                          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.78rem" }}>{real} / {mOp ?? "—"} PDVs ativos</span>
                          <span style={{ color: cor, fontWeight: "700" }}>{pct}%</span>
                        </div>
                        <p style={{ margin: "2px 0 0", color: "rgba(255,255,255,0.25)", fontSize: "0.7rem" }}>Meta: {mOp !== null ? `${mOp} PDVs` : "—"}</p>
                      </div>
                    );
                  })()}
                  {/* Cards por GV */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "8px", marginBottom: "16px" }}>
                    {[...scanntech].filter(r => r.gv && r.gv !== "NaN" && String(r.gv).trim() !== "" && r.setor !== "OPERACAO").sort((a,b) => String(a.gv).localeCompare(String(b.gv))).map((r) => {
                      const ativos = parseInt(r.pdvs_ativos || r.ativos || 0);
                      const total  = parseInt(r.pdvs_total  || 0);
                      const cor    = "#4ade80";
                      return (
                        <div key={r.gv} style={styles.gvCard}>
                          <div style={styles.gvHeader}>
                            <span style={{ fontWeight: "700", fontSize: "0.88rem" }}>GV {r.gv}</span>
                          </div>
                          <div style={styles.gvFooter}>
                            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.75rem" }}>{ativos}/{total} PDVs</span>
                            <span style={{ color: cor, fontWeight: "700" }}>{ativos} ativos</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Detalhe */}
                  {scanntechDet.length > 0 && (
                    <>
                      <div style={{ display: "flex", gap: "6px", marginBottom: "10px", flexWrap: "nowrap", overflowX: "auto", alignItems: "center" }}>
                        {[
                          { label: "RN",     val: scanFiltroRN,     set: setScanFiltroRN,     opts: ["TODOS", ...new Set(scanntechDet.map(r => r.setor).filter(Boolean))].sort() },
                          { label: "Dia",    val: scanFiltroDia,    set: setScanFiltroDia,    opts: ["TODOS", ...new Set(scanntechDet.map(r => r.dia_visita).filter(Boolean))].sort() },
                          { label: "Status", val: scanFiltroStatus, set: setScanFiltroStatus, opts: ["TODOS", ...new Set(scanntechDet.map(r => r.status_scanntech).filter(Boolean))].sort() },
                        ].map(({ label, val, set, opts }) => (
                          <select key={label} value={val} onChange={e => set(e.target.value)}
                            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "#fff", padding: "3px 8px", fontSize: "0.75rem", cursor: "pointer", flexShrink: 0 }}>
                            {opts.map(o => <option key={o} value={o}>{label}: {o}</option>)}
                          </select>
                        ))}
                        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.72rem", whiteSpace: "nowrap" }}>
                          {scanntechDet.filter(r =>
                            (scanFiltroRN === "TODOS" || r.setor === scanFiltroRN) &&
                            (scanFiltroDia === "TODOS" || r.dia_visita === scanFiltroDia) &&
                            (scanFiltroStatus === "TODOS" || r.status_scanntech === scanFiltroStatus)
                          ).length} PDVs
                        </span>
                      </div>
                      <div style={{ overflowX: "auto", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                          <thead>
                            <tr>
                              {["GV","PDV","Nome","Dia","Status","Ativo"].map(h => (
                                <th key={h} style={{ padding: "8px 10px", color: "rgba(255,255,255,0.4)", textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {scanntechDet.filter(r =>
                              (scanFiltroRN === "TODOS" || r.setor === scanFiltroRN) &&
                              (scanFiltroDia === "TODOS" || r.dia_visita === scanFiltroDia) &&
                              (scanFiltroStatus === "TODOS" || r.status_scanntech === scanFiltroStatus)
                            ).sort((a,b) => a.status_scanntech.localeCompare(b.status_scanntech))
                              .map((r, i) => (
                                <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                  <td style={{ padding: "7px 10px", color: "rgba(255,255,255,0.5)" }}>{r.gv}</td>
                                  <td style={{ padding: "7px 10px", color: "rgba(255,255,255,0.5)" }}>{r.cod_pdv}</td>
                                  <td style={{ padding: "7px 10px", color: "rgba(255,255,255,0.7)", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.nome_pdv}</td>
                                  <td style={{ padding: "7px 10px", color: "#4ade80" }}>{r.dia_visita}</td>
                                  <td style={{ padding: "7px 10px", color: "rgba(255,255,255,0.6)" }}>{r.status_scanntech}</td>
                                  <td style={{ padding: "7px 10px" }}>
                                    <span style={{ color: r.is_ativo === "SIM" ? "#4ade80" : "#f87171", fontWeight: "600" }}>{r.is_ativo}</span>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
            )}


            {/* PORTFÓLIO IDEAL SCORE 5 */}
            {(kpiAtivo === null || kpiAtivo === 24) && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 24 — Portfólio Ideal Score 5</h3>
              {portIdeal.length === 0 ? (
                <p style={styles.msg}>Importe o relatório ON_TRADE para calcular automaticamente.</p>
              ) : (
                <>
                  {/* Resumo */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "8px", marginBottom: "16px" }}>
                    {portIdeal.map((r) => {
                      const pct = parseFloat(r.pct || 0);
                      const cor = pct >= 46 ? "#4ade80" : pct >= 30 ? "#fbb900" : "#f87171";
                      const isOp = r.setor === "OPERACAO";
                      return (
                        <div key={r.setor} style={{ ...styles.gvCard, ...(isOp ? { border: "1px solid rgba(251,185,0,0.3)", gridColumn: "1/-1" } : {}) }}>
                          <div style={styles.gvHeader}>
                            <span style={{ fontWeight: "700", fontSize: isOp ? "1rem" : "0.85rem" }}>
                              {isOp ? "🏭 Operação" : `Setor ${r.setor}`}
                            </span>
                            <span style={{ ...styles.apBadge, background: r.ok === "OK" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: r.ok === "OK" ? "#4ade80" : "#f87171" }}>{r.ok}</span>
                          </div>
                          <BarraProgresso pct={pct} cor={cor} />
                          <div style={styles.gvFooter}>
                            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.75rem" }}>{r.pdvs_ideais}/{r.pdvs_total} PDVs</span>
                            <span style={{ color: cor, fontWeight: "700" }}>{pct}%</span>
                          </div>
                          <p style={{ margin: "2px 0 0", color: "rgba(255,255,255,0.25)", fontSize: "0.7rem" }}>Meta: ≥ 46%</p>
                        </div>
                      );
                    })}
                  </div>
                  {/* Detalhe com filtros */}
                  {portIdealDet.length > 0 && (
                    <>
                      <div style={{ display: "flex", gap: "8px", marginBottom: "10px", flexWrap: "wrap", alignItems: "center" }}>
                        {[
                          { label: "GV",     val: portFiltroGV,     set: setPortFiltroGV,     opts: ["TODOS", ...new Set(portIdealDet.map(r => r.gv).filter(Boolean))].sort() },
                          { label: "RN",     val: portFiltroRN,     set: setPortFiltroRN,     opts: ["TODOS", ...new Set(portIdealDet.map(r => r.setor).filter(Boolean))].sort() },
                          { label: "Dia",    val: portFiltroDia,    set: setPortFiltroDia,    opts: ["TODOS", ...new Set(portIdealDet.map(r => r.dia_visita).filter(Boolean))].sort() },
                          { label: "Status", val: portFiltroStatus, set: setPortFiltroStatus, opts: ["TODOS", "SIM", "NÃO"] },
                        ].map(({ label, val, set, opts }) => (
                          <select key={label} value={val} onChange={e => set(e.target.value)}
                            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "#fff", padding: "4px 10px", fontSize: "0.8rem", cursor: "pointer" }}>
                            {opts.map(o => <option key={o} value={o}>{label}: {o}</option>)}
                          </select>
                        ))}
                        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.75rem" }}>
                          {portIdealDet.filter(r =>
                            (portFiltroGV === "TODOS" || r.gv === portFiltroGV) &&
                            (portFiltroRN === "TODOS" || r.setor === portFiltroRN) &&
                            (portFiltroDia === "TODOS" || r.dia_visita === portFiltroDia) &&
                            (portFiltroStatus === "TODOS" || r.portfolio_ideal === portFiltroStatus)
                          ).length} PDVs
                        </span>
                      </div>
                      <div style={{ overflowX: "auto", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                          <thead>
                            <tr>
                              {["GV","RN","PDV","Nome","Base","Dia","Port. Ideal","Itens Faltando"].map(h => (
                                <th key={h} style={{ padding: "8px 10px", color: "rgba(255,255,255,0.4)", textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {portIdealDet.filter(r =>
                              (portFiltroGV === "TODOS" || r.gv === portFiltroGV) &&
                              (portFiltroRN === "TODOS" || r.setor === portFiltroRN) &&
                              (portFiltroDia === "TODOS" || r.dia_visita === portFiltroDia) &&
                              (portFiltroStatus === "TODOS" || r.portfolio_ideal === portFiltroStatus)
                            ).map((r, i) => (
                              <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                <td style={{ padding: "7px 10px", color: "rgba(255,255,255,0.5)" }}>{r.gv}</td>
                                <td style={{ padding: "7px 10px", color: "rgba(255,255,255,0.7)" }}>{r.setor}</td>
                                <td style={{ padding: "7px 10px", color: "rgba(255,255,255,0.5)" }}>{r.cod_pdv}</td>
                                <td style={{ padding: "7px 10px", color: "rgba(255,255,255,0.7)", maxWidth: "140px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.nome_pdv}</td>
                                <td style={{ padding: "7px 10px", color: "rgba(255,255,255,0.5)", fontSize: "0.72rem" }}>{r.base}</td>
                                <td style={{ padding: "7px 10px", color: "#4ade80" }}>{r.dia_visita}</td>
                                <td style={{ padding: "7px 10px" }}>
                                  <span style={{ color: r.portfolio_ideal === "SIM" ? "#4ade80" : "#f87171", fontWeight: "600" }}>{r.portfolio_ideal}</span>
                                </td>
                                <td style={{ padding: "7px 10px", color: "#fbb900", fontSize: "0.75rem" }}>{r.itens_faltantes}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
            )}


            {/* ATENDIMENTO PRODUTIVO */}
            {(kpiAtivo === null || kpiAtivo === 5) && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 5 — Atendimento Produtivo</h3>
              {ap.length === 0 ? (
                <p style={styles.msg}>Importe o relatório de Atendimento Produtivo para calcular automaticamente.</p>
              ) : (
                <>
                  {/* Resumo */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "8px", marginBottom: "16px" }}>
                    {ap.map((r) => {
                      const pct = parseFloat(r.pct || 0);
                      const cor = pct >= 90 ? "#4ade80" : pct >= 60 ? "#fbb900" : "#f87171";
                      const isOp = r.setor === "OPERACAO";
                      return (
                        <div key={r.setor} style={{ ...styles.gvCard, ...(isOp ? { border: "1px solid rgba(251,185,0,0.3)", gridColumn: "1/-1" } : {}) }}>
                          <div style={styles.gvHeader}>
                            <span style={{ fontWeight: "700", fontSize: isOp ? "1rem" : "0.85rem" }}>
                              {isOp ? "🏭 Operação" : `GV ${r.gv}`}
                            </span>
                            <span style={{ ...styles.apBadge, background: r.ok === "OK" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: r.ok === "OK" ? "#4ade80" : "#f87171" }}>{r.ok}</span>
                          </div>
                          <BarraProgresso pct={pct} cor={cor} />
                          <div style={styles.gvFooter}>
                            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.75rem" }}>{r.rns_ap_ok}/{r.rns_total} RNs</span>
                            <span style={{ color: cor, fontWeight: "700" }}>{pct}%</span>
                          </div>
                          <p style={{ margin: "2px 0 0", color: "rgba(255,255,255,0.25)", fontSize: "0.7rem" }}>Meta: ≥ 90%</p>
                        </div>
                      );
                    })}
                  </div>
                  {/* Detalhe por RN */}
                  {apDet.length > 0 && (
                    <>
                      <div style={{ display: "flex", gap: "8px", marginBottom: "10px", flexWrap: "wrap", alignItems: "center" }}>
                        {[
                          { label: "GV",     val: apFiltroGV,     set: setApFiltroGV,     opts: ["TODOS", ...new Set(apDet.map(r => r.gv).filter(Boolean))].sort() },
                          { label: "AP OK",  val: apFiltroStatus, set: setApFiltroStatus, opts: ["TODOS", "Sim", "Não"] },
                        ].map(({ label, val, set, opts }) => (
                          <select key={label} value={val} onChange={e => set(e.target.value)}
                            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "#fff", padding: "4px 10px", fontSize: "0.8rem", cursor: "pointer" }}>
                            {opts.map(o => <option key={o} value={o}>{label}: {o}</option>)}
                          </select>
                        ))}
                      </div>
                      <div style={{ overflowX: "auto", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
                          <thead>
                            <tr>
                              {["GV","RN","Segmento","AP OK","KPIs OK","Positiv %","Carteira","GPS %","Rota %"].map(h => (
                                <th key={h} style={{ padding: "8px 10px", color: "rgba(255,255,255,0.4)", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {apDet.filter(r =>
                              (apFiltroGV === "TODOS" || r.gv === apFiltroGV) &&
                              (apFiltroStatus === "TODOS" || r.ap_ok === apFiltroStatus)
                            ).map((r, i) => {
                              const corAP = r.ap_ok === "Sim" ? "#4ade80" : "#f87171";
                              const corKPI = parseInt(r.kpis_ok) === 4 ? "#4ade80" : parseInt(r.kpis_ok) >= 2 ? "#fbb900" : "#f87171";
                              return (
                                <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                  <td style={{ padding: "7px 10px", textAlign: "center", color: "rgba(255,255,255,0.5)" }}>{r.gv}</td>
                                  <td style={{ padding: "7px 10px", textAlign: "center", color: "rgba(255,255,255,0.8)", fontWeight: "600" }}>{r.setor}</td>
                                  <td style={{ padding: "7px 10px", textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: "0.7rem" }}>{r.segmento}</td>
                                  <td style={{ padding: "7px 10px", textAlign: "center" }}>
                                    <span style={{ color: corAP, fontWeight: "700" }}>{r.ap_ok}</span>
                                  </td>
                                  <td style={{ padding: "7px 10px", textAlign: "center" }}>
                                    <span style={{ color: corKPI, fontWeight: "700" }}>{r.kpis_ok}/4</span>
                                  </td>
                                  <td style={{ padding: "7px 10px", textAlign: "center", color: parseFloat(r.positiv_real) >= parseFloat(r.positiv_meta) ? "#4ade80" : "#f87171" }}>{r.positiv_real !== null ? `${r.positiv_real}%` : "—"}</td>
                                  <td style={{ padding: "7px 10px", textAlign: "center", color: parseInt(r.carteira_real) >= parseInt(r.carteira_meta) ? "#4ade80" : "#f87171" }}>{r.carteira_real || "—"}</td>
                                  <td style={{ padding: "7px 10px", textAlign: "center", color: parseFloat(r.gps_real) >= parseFloat(r.gps_meta) ? "#4ade80" : "#f87171" }}>{r.gps_real !== null ? `${r.gps_real}%` : "—"}</td>
                                  <td style={{ padding: "7px 10px", textAlign: "center", color: parseFloat(r.rota_real) >= parseFloat(r.rota_meta) ? "#4ade80" : "#f87171" }}>{r.rota_real !== null ? `${r.rota_real}%` : "—"}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
            )}

            {/* POR GV */}
            {aba === "gv" && (kpiAtivo === null || kpiAtivo === 1) && (
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>Item 1 — Visitação por GV</h3>
                <div style={styles.gvGrid}>
                  {resumo.map((r) => {
                    const pct = Math.round((parseInt(r.visitados) / parseInt(r.meta)) * 100);
                    const cor = pct >= 100 ? "#4ade80" : pct >= 70 ? "#fbb900" : "#f87171";
                    return (
                      <div key={r.gv} style={styles.gvCard}>
                        <div style={styles.gvHeader}>
                          <span style={styles.gvLabel}>GV {r.gv}</span>
                          <span style={{ color: cor, fontWeight: "700", fontSize: "1.1rem" }}>{pct}%</span>
                        </div>
                        <BarraProgresso pct={pct} cor={cor} />
                        <div style={styles.gvFooter}>
                          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.82rem" }}>{r.visitados} / {r.meta} PDVs</span>
                          <span style={{ color: "#fbb900", fontSize: "0.82rem", fontWeight: "600" }}>
                            {pct >= 100 ? "14 pts" : `~${Math.round(14 * pct / 100)} pts`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {resumo.length === 0 && <p style={styles.msg}>Nenhum dado disponível. Importe o relatório em Admin → Arquivos.</p>}
                </div>
              </div>
            )}

            {/* SEM COACHING */}
            {aba === "sem_coaching" && (kpiAtivo === null || kpiAtivo === 2) && (
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>RNs sem Coaching no Trimestre</h3>
                {semCoaching.length === 0 ? (
                  <p style={{ ...styles.msg, color: "#4ade80" }}>✅ Todos os RNs receberam coaching no trimestre!</p>
                ) : (
                  <div style={styles.tableWrap}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          {["GV", "Setor", "Último mês de dados"].map((h) => (
                            <th key={h} style={styles.th}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {semCoaching.map((r, i) => (
                          <tr key={i} style={styles.tr}>
                            <td style={styles.td}>{r.gv}</td>
                            <td style={styles.td}><span style={styles.codBadge}>{r.setor}</span></td>
                            <td style={styles.td}>{r.mes_referencia}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* DETALHE */}
            {aba === "detalhe" && (kpiAtivo === null || kpiAtivo === 1) && (
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>Item 1 — Visitas Detalhadas</h3>
                <div style={styles.filtrosRow}>
                  <input style={styles.inputFiltro} placeholder="Buscar PDV..." value={busca} onChange={(e) => setBusca(e.target.value)} />
                  <select style={styles.inputFiltro} value={filtroGv} onChange={(e) => setFiltroGv(e.target.value)}>
                    <option value="todos">Todos os GVs</option>
                    {gvsUnicos.map((g) => <option key={g} value={g}>GV {g}</option>)}
                  </select>
                  <select style={styles.inputFiltro} value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
                    <option value="todos">Todos</option>
                    <option value="ok">✅ Válidas</option>
                    <option value="nok">❌ Inválidas</option>
                  </select>
                  <select style={styles.inputFiltro} value={filtroDia} onChange={(e) => setFiltroDia(e.target.value)}>
                    <option value="todos">Todos os dias</option>
                    {diasUnicos.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <span style={styles.countLabel}>{detalheFiltrado.length} visitas</span>
                </div>
                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        {["GV", "Setor", "PDV", "Nome", "Dia Visita", "Visita", "GPS", "Status"].map((h) => (
                          <th key={h} style={styles.th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {detalheFiltrado.slice(0, 200).map((d, i) => {
                        const ok = d.valida === "SIM";
                        return (
                          <tr key={i} style={styles.tr}>
                            <td style={styles.td}>{d.gv}</td>
                            <td style={styles.td}>{d.setor}</td>
                            <td style={styles.td}><span style={styles.codBadge}>{d.cod_pdv}</span></td>
                            <td style={{ ...styles.td, textAlign: "left", fontSize: "0.8rem" }}>{d.nome_pdv || "—"}</td>
                            <td style={styles.td}>{d.dia_visita || "—"}</td>
                            <td style={styles.td}><span style={{ color: d.visita_ok === "OK" ? "#4ade80" : "#f87171" }}>{d.visita_ok}</span></td>
                            <td style={styles.td}><span style={{ color: d.gps_ok === "OK" ? "#4ade80" : "#f87171" }}>{d.gps_ok}</span></td>
                            <td style={styles.td}>
                              <span style={{ ...styles.statusTag, background: ok ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: ok ? "#4ade80" : "#f87171" }}>
                                {ok ? "✅ Válida" : "❌ Inválida"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {detalheFiltrado.length > 200 && (
                    <p style={{ textAlign: "center", color: "rgba(255,255,255,0.35)", fontSize: "0.82rem", padding: "12px" }}>
                      Mostrando 200 de {detalheFiltrado.length}. Use os filtros para refinar.
                    </p>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        </div>{/* fim coluna esquerda */}

        {/* COLUNA DIREITA — Painel SPO fixo */}
        <div className="spo-col-right" style={{ flex: "0 0 63%", minWidth: 0, position: "sticky", top: "16px", alignSelf: "flex-start" }}>
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "16px", overflowX: "auto" }}>
            <p style={{ margin: "0 0 12px", fontWeight: "700", fontSize: "0.9rem", color: "#fbb900" }}>📊 Painel SPO Consolidado</p>
            {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "8px 0" }}>
            {[1,2,3].map(i => (
              <div key={i} style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "14px",
                padding: "20px",
                position: "relative",
                overflow: "hidden",
              }}>
                <div style={{ height: "14px", width: "40%", background: "rgba(255,255,255,0.06)", borderRadius: "6px", marginBottom: "12px" }} />
                <div style={{ height: "10px", width: "70%", background: "rgba(255,255,255,0.04)", borderRadius: "6px", marginBottom: "8px" }} />
                <div style={{ height: "10px", width: "55%", background: "rgba(255,255,255,0.04)", borderRadius: "6px" }} />
                <div style={{
                  position: "absolute", top: 0, left: "-100%", width: "60%", height: "100%",
                  background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)",
                  animation: "shimmer 1.4s infinite",
                }} />
              </div>
            ))}
            <style>{`@keyframes shimmer { 0% { left: -100% } 100% { left: 200% } }`}</style>
          </div>
        ) : (
              <>
                          {/* PAINEL SPO CONSOLIDADO */}
                          {(() => {
                            const MESES = ["2026-04","2026-05","2026-06"];
                            const MESES_LABEL = {"2026-04":"Abril","2026-05":"Maio","2026-06":"Junho"};
                            const INICIO_AVAL = {1:"2026-04",2:"2026-04",3:"2026-04",4:"2026-04",5:"2026-04",6:"2026-04",7:"2026-05",8:"2026-04",9:"2026-04",10:"2026-04",11:"2026-04",12:"2026-04",13:"2026-04",14:"2026-04",15:"2026-04",16:"2026-04",17:"2026-04",18:"2026-04",19:"2026-05",20:"2026-04",21:"2026-04",22:"2026-04",23:"2026-04",24:"2026-04"};
              
                            const ITENS_SPO = [
                              {n:1,  label:"Visitação GV na Base Foco"},
                              {n:2,  label:"Rota Coaching"},
                              {n:3,  label:"TT Dias com Rotas"},
                              {n:4,  label:"Abertura de Desafios Diários"},
                              {n:5,  label:"Atendimento Produtivo"},
                              {n:6,  label:"DTO GC"},
                              {n:7,  label:"% Visitas RN abrindo Promoção"},
                              {n:8,  label:"Aderência de Política Comercial"},
                              {n:9,  label:"Execução Menu de Cerveja"},
                              {n:10, label:"Academia Bees RN"},
                              {n:11, label:"Tasks Cerveja TT (Portfolio)"},
                              {n:12, label:"Tasks Faturamento Score 5"},
                              {n:13, label:"Tasks NAB TT (Portfolio)"},
                              {n:14, label:"Tasks de Volume"},
                              {n:15, label:"Tasks de Marketplace"},
                              {n:16, label:"Tasks de Match (Portfolio)"},
                              {n:17, label:"Tasks Cerveja Zero (Portfolio)"},
                              {n:18, label:"Tarefa de Digitalização"},
                              {n:19, label:"PDVs com Compra Independente"},
                              {n:20, label:"+RGB"},
                              {n:21, label:"Cupons Digitais - Score 5"},
                              {n:22, label:"% Lojas Ideais"},
                              {n:23, label:"Expansão Scanntech"},
                              {n:24, label:"Portfólio Ideal Score 5"},
                            ];
              
                            const getMeta = (n, mes) => {
                              const r = spoMetas.find(m => String(m.item) === String(n) && m.mes === mes);
                              return r ? parseFloat(r.meta) : null;
                            };

                            // Real: busca primeiro em spoMetas (histórico), depois nas abas processadas (mês atual)
                            const getRealDados = (n, mes) => {
                              // 1. Tenta spoMetas (histórico importado)
                              const r = spoMetas.find(m => String(m.item) === String(n) && m.mes === mes);
                              if (r && r.real !== "" && r.real !== null && r.real !== undefined) return parseFloat(r.real);

                              // 2. Fallback: dado real das abas processadas — apenas para o mês atual
                              if (mes !== mesAtual) return null;
                              const op = (arr) => arr.find(x => x.setor === "OPERACAO" || x.setor === "operacao");
                              const opMes = (arr) => arr.find(x => (x.setor === "OPERACAO" || x.setor === "operacao") && (x.mes_referencia || "").startsWith(mes));

                              switch(n) {
                                case 1:  {
                                  // Total de visitas realizadas (sem cap por GV)
                                  const gvs = resumo.filter(r => r.gv && !isNaN(parseInt(r.gv)));
                                  if (gvs.length === 0) return null;
                                  return gvs.reduce((s, r) => s + parseInt(r.visitados||0), 0);
                                }
                                case 2:  {
                                  // Total de coachings realizados no mês (soma dos GVs, filtrado por mês)
                                  const gvs = coaching.filter(r => r.gv && !isNaN(parseInt(r.gv)) && r.periodo === "mensal" && (r.mes_referencia||"").startsWith(mes));
                                  if (gvs.length === 0) return null;
                                  return gvs.reduce((s, r) => s + parseInt(r.coachings_validos||0), 0);
                                }
                                case 3:  {
                                  // Total de dias válidos em rota no mês (soma dos GVs, filtrado por mês)
                                  const gvs = diasRota.filter(r => r.gv && !isNaN(parseInt(r.gv)) && r.periodo === "mensal" && (r.mes_referencia||"").startsWith(mes));
                                  if (gvs.length === 0) return null;
                                  return gvs.reduce((s, r) => s + parseInt(r.dias_validos||0), 0);
                                }
                                case 4:  {
                                  // Média de dias abertos por GV (ex: GV1=11, GV2=11 → média=11)
                                  const mesDesafios = desafios.filter(x => (x.mes_referencia||"").startsWith(mes));
                                  if (mesDesafios.length === 0) return null;
                                  const gvsUnicos = [...new Set(mesDesafios.map(d => d.gv).filter(Boolean))];
                                  if (gvsUnicos.length === 0) return null;
                                  const somaOk = gvsUnicos.reduce((acc, gv) => {
                                    const ok = mesDesafios.filter(d => d.gv === gv && d.status === "OK").length;
                                    return acc + ok;
                                  }, 0);
                                  return parseFloat((somaOk / gvsUnicos.length).toFixed(1));
                                }
                                case 5:  {
                                  // Conta RNs com AP OK (total da operação)
                                  const d = op(ap);
                                  return d ? parseFloat(d.rns_ap_ok || 0) : null;
                                }
                                case 6:  { const d = dto.find(x => (x.mes_referencia||"").startsWith(mes)); return d ? parseFloat(d.matinal_real || 0) + parseFloat(d.vespertina_real || 0) + parseFloat(d.coaching_real || 0) : null; }
                                case 7:  { const d = opMes(promo) || op(promo); if (!d) return null; const _vis = parseFloat(d.visitas||0); const _ac = parseFloat(d.acesso_promo||0); return _vis > 0 ? parseFloat((_ac / _vis * 100).toFixed(1)) : null; }
                                case 8:  { const d = op(politica); return d ? parseFloat(d.pdvs_execucao || 0) : null; }
                                case 9:  { const d = op(menu);     return d ? parseFloat(d.tasks_validas || 0) : null; }
                                case 11: { const d = opMes(tasksCerveja) || op(tasksCerveja); return d ? parseFloat(d.tasks_validas || d.pdvs_ok || 0) : null; }
                                case 12: { const d = op(score5);   return d ? parseFloat(d.pdvs_ok || 0) : null; }
                                case 13: { const d = opMes(tasksNab) || op(tasksNab); return d ? parseFloat(d.tasks_validas || 0) : null; }
                                case 14: { const d = opMes(tasksVolume) || op(tasksVolume); return d ? parseFloat(d.tasks_validas || 0) : null; }
                                case 15: { const d = opMes(tasksMktp) || op(tasksMktp); return d ? parseFloat(d.tasks_validas || 0) : null; }
                                case 16: { const d = opMes(tasksMatch) || op(tasksMatch); return d ? parseFloat(d.tasks_validas || 0) : null; }
                                case 17: { const d = opMes(tasksCervZero) || op(tasksCervZero); return d ? parseFloat(d.tasks_validas || 0) : null; }
                                case 18: { const d = opMes(tasksDigit) || op(tasksDigit); return d ? parseFloat(d.tasks_validas || 0) : null; }
                                case 19: { const d = opMes(alone) || op(alone); return d ? parseFloat(d.pdvs_alone || 0) : null; }
                                case 20: { const d = opMes(rgb) || op(rgb); return d ? parseFloat(d.pdvs_bateu_meta || 0) : null; }
                                case 21: { const d = opMes(cupons) || op(cupons); return d ? parseFloat(d.cupons_mes || 0) : null; }
                                case 22: { const d = opMes(lojaIdeal) || op(lojaIdeal); return d ? parseFloat(d.pdvs_ideais || 0) : null; }
                                case 23: { const d = opMes(scanntech) || op(scanntech); return d ? parseFloat(d.pdvs_ativos || d.ativos || 0) : null; }
                                case 24: { const d = opMes(portIdeal) || op(portIdeal); return d ? parseFloat(d.pdvs_ideais || 0) : null; }
                                default: return null;
                              }
                            };
                            const getReal = (n, mes) => getRealDados(n, mes);
              
                            // Busca pts do item no SPO_ITEMS (ITENS_SPO interno não tem pts)
                            const getPts = (n) => SPO_ITEMS.find(s => s.n === n)?.pts ?? 0;

                            // Total de pontos por mês — soma pts de cada KPI que bateu a meta
                            const pontosMes = (mes) => ITENS_SPO.reduce((acc, item) => {
                              if (INICIO_AVAL[item.n] > mes) return acc;
                              const meta = getMeta(item.n, mes);
                              const real = getReal(item.n, mes);
                              if (meta === null || real === null) return acc;
                              return acc + (real >= meta ? getPts(item.n) : 0);
                            }, 0);
              
                            // mesAtual definido no escopo do componente

                            // Tri: auto-calculado para KPI >= 8 (conta meses onde real >= meta → 0-3)
                            // KPI < 8: particularidades pendentes — lê entrada manual de spo_metas mes="TRI"
                            const triReal = (n) => {
                              if (n >= 8) {
                                const mesesValidos = MESES.filter(m => INICIO_AVAL[n] <= m);
                                let count = 0;
                                for (const mes of mesesValidos) {
                                  const meta = getMeta(n, mes);
                                  const real = getReal(n, mes);
                                  if (meta !== null && real !== null && real >= meta) count++;
                                }
                                return count;
                              }
                              // KPIs 1-7: entrada manual
                              const m = spoMetas.find(x => String(x.item) === String(n) && x.mes === "TRI");
                              return (m && m.real !== "" && m.real !== null && m.real !== undefined) ? parseInt(m.real) : null;
                            };
                            // 3 meses OK → pts inteiro | 2 → 2/3 pts | 1 → 1/3 pts | 0 → 0
                            const triPtsReal = (n, pts) => {
                              const r = triReal(n);
                              if (r === null) return null;
                              if (r === 3) return pts;
                              if (r === 2) return Math.round(pts * 2 / 3);
                              if (r === 1) return Math.round(pts / 3);
                              return 0;
                            };

                            const thStyle = { padding: "5px 6px", color: "rgba(255,255,255,0.5)", fontSize: "0.7rem", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", whiteSpace: "nowrap" };
                            const thSubStyle = { padding: "3px 5px", color: "rgba(255,255,255,0.35)", fontSize: "0.65rem", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap" };
                            const tdStyle = { padding: "4px 5px", color: "rgba(255,255,255,0.6)", textAlign: "center", whiteSpace: "nowrap" };
              
                            return (
                              <div style={{ overflowX: "auto" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
                                  <thead>
                                    <tr>
                                      <th style={thStyle}>#</th>
                                      <th style={{ ...thStyle, textAlign: "left", minWidth: "140px" }}>Indicador</th>
                                      <th style={thStyle}>Início</th>
                                      {MESES.map(mes => (
                                        <th key={mes} colSpan={4} style={{ ...thStyle, background: mes === mesAtual ? "rgba(251,185,0,0.15)" : "rgba(255,255,255,0.04)", borderLeft: "1px solid rgba(255,255,255,0.1)" }}>
                                          {MESES_LABEL[mes]}
                                        </th>
                                      ))}
                                      <th colSpan={4} style={{ ...thStyle, background: "rgba(251,185,0,0.1)", borderLeft: "1px solid rgba(255,255,255,0.15)" }}>TRI</th>
                                    </tr>
                                    <tr>
                                      <th style={thSubStyle} colSpan={3}></th>
                                      {MESES.map(mes => (
                                        ["Meta","Real","% Ating","Pts"].map(h => (
                                          <th key={mes+h} style={{ ...thSubStyle, background: mes === mesAtual ? "rgba(251,185,0,0.08)" : "" }}>{h}</th>
                                        ))
                                      ))}
                                      {["Pts","Meses OK","Pts TRI","% SPO"].map(h => <th key={"tri"+h} style={{ ...thSubStyle, background: "rgba(251,185,0,0.06)" }}>{h}</th>)}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {ITENS_SPO.map((item) => {
                                      const tReal   = triReal(item.n);
                                      const tPtsR   = triPtsReal(item.n, getPts(item.n));
                                      const tPct    = tPtsR !== null ? (tPtsR / TOTAL_PTS * 100).toFixed(1) : null;
                                      const corTri  = tReal === 3 ? "#4ade80" : tReal === 1 ? "#fbb900" : tReal === 0 ? "#f87171" : "rgba(255,255,255,0.25)";
                                      return (
                                        <tr key={item.n} className="spo-painel-tr" onClick={() => setKpiAtivo(kpiAtivo === item.n ? null : item.n)} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", ...(kpiAtivo === item.n ? { background: "rgba(251,185,0,0.08)", boxShadow: "inset 3px 0 0 #fbb900" } : {}) }}>
                                          <td style={tdStyle}>{item.n}</td>
                                          <td style={{ ...tdStyle, textAlign: "left", color: "rgba(255,255,255,0.85)" }}>{item.label}</td>
                                          <td style={{ ...tdStyle, color: "rgba(255,255,255,0.4)", fontSize: "0.72rem" }}>{MESES_LABEL[INICIO_AVAL[item.n]]}</td>
                                          {MESES.map(mes => {
                                            if (INICIO_AVAL[item.n] > mes) {
                                              return [null,null,null,null].map((_,i) => <td key={mes+i} style={tdStyle}>—</td>);
                                            }
                                            const meta = getMeta(item.n, mes);
                                            const real = getReal(item.n, mes);
                                            const ating = (meta !== null && real !== null && meta > 0) ? (real / meta * 100).toFixed(1) : null;
                                            const bateu = meta !== null && real !== null && real >= meta;
                                            const pts = (meta !== null && real !== null) ? (bateu ? 3 : 0) : null;
                                            const corAting = bateu ? "#4ade80" : (ating !== null && parseFloat(ating) >= 70) ? "#fbb900" : "#f87171";
                                            return [
                                              <td key={mes+"m"} style={tdStyle}>{meta !== null ? meta : <span style={{color:"rgba(255,255,255,0.2)"}}>—</span>}</td>,
                                              <td key={mes+"r"} style={tdStyle}>{real !== null ? real : <span style={{color:"rgba(255,255,255,0.2)"}}>—</span>}</td>,
                                              <td key={mes+"a"} style={{ ...tdStyle, color: ating !== null ? corAting : "rgba(255,255,255,0.2)", fontWeight: ating ? "600" : "400" }}>{ating !== null ? `${ating}%` : "—"}</td>,
                                              <td key={mes+"p"} style={{ ...tdStyle, color: pts > 0 ? "#4ade80" : pts === 0 ? "#f87171" : "rgba(255,255,255,0.2)", fontWeight: "700" }}>{pts !== null ? pts : "—"}</td>,
                                            ];
                                          })}
                                          {/* TRI: Pts | Real | Pts Real | % Real */}
                                          <td style={{ ...tdStyle, color: "#fbb900", fontWeight: "700", background: "rgba(251,185,0,0.04)" }}>{getPts(item.n)}</td>
                                          <td style={{ ...tdStyle, color: corTri, fontWeight: "700", background: "rgba(251,185,0,0.04)" }}>{tReal !== null ? tReal : <span style={{color:"rgba(255,255,255,0.2)"}}>—</span>}</td>
                                          <td style={{ ...tdStyle, color: corTri, fontWeight: "700", background: "rgba(251,185,0,0.04)" }}>{tPtsR !== null ? tPtsR : <span style={{color:"rgba(255,255,255,0.2)"}}>—</span>}</td>
                                          <td style={{ ...tdStyle, color: tPct !== null ? corTri : "rgba(255,255,255,0.2)", fontWeight: "600", background: "rgba(251,185,0,0.04)" }}>{tPct !== null ? `${tPct}%` : "—"}</td>
                                        </tr>
                                      );
                                    })}
                                    {/* Rodapé pontos */}
                                    <tr style={{ borderTop: "2px solid rgba(255,255,255,0.15)", background: "rgba(251,185,0,0.05)" }}>
                                      <td colSpan={3} style={{ ...tdStyle, color: "#fbb900", fontWeight: "700", textAlign: "left" }}>Total de Pontos</td>
                                      {MESES.map(mes => [
                                        <td key={mes+"tm"} style={tdStyle}></td>,
                                        <td key={mes+"tr"} style={tdStyle}></td>,
                                        <td key={mes+"ta"} style={tdStyle}></td>,
                                        <td key={mes+"tp"} style={{ ...tdStyle, color: "#fbb900", fontWeight: "700", fontSize: "0.9rem" }}>{pontosMes(mes)}</td>,
                                      ])}
                                      {/* TRI rodapé: Pts total | — | Pts Real total | % Real total */}
                                      <td style={{ ...tdStyle, color: "#fbb900", fontWeight: "700", background: "rgba(251,185,0,0.06)" }}>{TOTAL_PTS}</td>
                                      <td style={{ ...tdStyle, background: "rgba(251,185,0,0.06)" }}></td>
                                      <td style={{ ...tdStyle, color: "#4ade80", fontWeight: "700", fontSize: "0.9rem", background: "rgba(251,185,0,0.06)" }}>
                                        {ITENS_SPO.reduce((acc, item) => acc + (triPtsReal(item.n, getPts(item.n)) ?? 0), 0)}
                                      </td>
                                      <td style={{ ...tdStyle, color: "#4ade80", fontWeight: "700", fontSize: "0.9rem", background: "rgba(251,185,0,0.06)" }}>
                                        {(ITENS_SPO.reduce((acc, item) => acc + (triPtsReal(item.n, getPts(item.n)) ?? 0), 0) / TOTAL_PTS * 100).toFixed(1)}%
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                                {spoMetas.length === 0 && (
                                  <p style={{ ...styles.msg, marginTop: "16px" }}>
                                    ⚠️ Metas não importadas — importe as metas no Admin → SPO → Metas para ver o painel completo.
                                  </p>
                                )}
                              </div>
                            );
                          })()}
              </>
            )}
          </div>
        </div>

        </div>{/* fim flex */}
      </div>
    </div>
  );
}

const styles = {
  root: { minHeight: "100vh", background: "#0a0f1e", fontFamily: "'Segoe UI', system-ui, sans-serif", color: "#fff" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 32px", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", flexWrap: "wrap", gap: "12px" },
  headerLeft: { display: "flex", alignItems: "center", gap: "16px" },
  backBtn: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", padding: "8px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem", fontFamily: "inherit" },
  title: { margin: 0, fontSize: "1.3rem", fontWeight: "700" },
  subtitle: { margin: 0, fontSize: "0.8rem", color: "rgba(255,255,255,0.4)" },
  logoutBtn: { background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)", padding: "6px 12px", borderRadius: "8px", cursor: "pointer", fontSize: "0.82rem", fontFamily: "inherit" },
  content: { padding: "16px 0px", display: "flex", flexDirection: "column", gap: "16px" },
  msg: { color: "rgba(255,255,255,0.35)", textAlign: "center", padding: "40px" },
  scoreboard: { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "20px" },
  scoreboardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" },
  scoreboardTitle: { fontWeight: "700", fontSize: "0.95rem" },
  scoreboardSub: { color: "rgba(255,255,255,0.35)", fontSize: "0.78rem" },
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px" },
  kpiCard: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", padding: "10px 12px", display: "flex", flexDirection: "column", gap: "4px" },
  kpiCardAtivo: { border: "1px solid rgba(251,185,0,0.3)", background: "rgba(251,185,0,0.04)" },
  kpiN: { color: "rgba(255,255,255,0.3)", fontSize: "0.7rem" },
  kpiLabel: { color: "rgba(255,255,255,0.7)", fontSize: "0.78rem", lineHeight: "1.3" },
  kpiPts: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" },
  abas: { display: "flex", gap: "4px", borderBottom: "1px solid rgba(255,255,255,0.08)" },
  abaBtn: { background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", padding: "10px 20px", cursor: "pointer", fontSize: "0.9rem", fontFamily: "inherit", borderBottom: "2px solid transparent", marginBottom: "-1px" },
  abaBtnAtivo: { color: "#fbb900", borderBottom: "2px solid #fbb900" },
  section: { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "20px" },
  sectionTitle: { margin: "0 0 16px", fontSize: "0.95rem", fontWeight: "600" },
  opGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "12px", marginBottom: "12px" },
  opCard: { background: "rgba(255,255,255,0.04)", borderRadius: "10px", padding: "14px", display: "flex", flexDirection: "column", gap: "6px" },
  opLabel: { margin: 0, color: "rgba(255,255,255,0.45)", fontSize: "0.78rem" },
  opVal: { margin: 0, fontSize: "1.6rem", fontWeight: "800" },
  gvGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "14px" },
  gvCard: { background: "rgba(255,255,255,0.04)", borderRadius: "12px", padding: "18px", display: "flex", flexDirection: "column", gap: "8px" },
  gvHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  gvLabel: { fontWeight: "600", fontSize: "0.95rem" },
  gvFooter: { display: "flex", justifyContent: "space-between" },
  filtrosRow: { display: "flex", gap: "10px", marginBottom: "14px", flexWrap: "wrap", alignItems: "center" },
  inputFiltro: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff", padding: "7px 12px", fontSize: "0.85rem", fontFamily: "inherit", outline: "none" },
  countLabel: { color: "rgba(255,255,255,0.35)", fontSize: "0.82rem", marginLeft: "auto" },
  tableWrap: { overflowX: "auto", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.08)" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)", fontSize: "0.75rem", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.04em", padding: "9px 12px", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.08)" },
  tr: { borderBottom: "1px solid rgba(255,255,255,0.04)" },
  td: { padding: "8px 12px", color: "rgba(255,255,255,0.75)", fontSize: "0.85rem", textAlign: "center" },
  codBadge: { background: "rgba(251,185,0,0.12)", color: "#fbb900", padding: "2px 7px", borderRadius: "6px", fontSize: "0.75rem", fontWeight: "700" },
  statusTag: { padding: "2px 8px", borderRadius: "6px", fontSize: "0.75rem", fontWeight: "600", whiteSpace: "nowrap" },
};
