/* BUILD_20260517_004909 */
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
  const [dto, setDto] = useState(null);
  const [promo, setPromo] = useState([]);
  const [promoDetalhe, setPromoDetalhe] = useState([]);
  const [promoBusca, setPromoBusca] = useState("");
  const [promoFiltroSetor, setPromoFiltroSetor] = useState("todos");
  const [promoFiltroDia, setPromoFiltroDia] = useState("todos");
  const [politica, setPolitica] = useState([]);
  const [menu, setMenu] = useState([]);
  const [tasksCerveja, setTasksCerveja] = useState([]);
  const [score5, setScore5] = useState([]);
  const [tasksNab, setTasksNab] = useState([]);
  const [tasksVolume, setTasksVolume] = useState([]);
  const [tasksMktp, setTasksMktp] = useState([]);
  const [tasksMatch, setTasksMatch] = useState([]);
  const [tasksCervZero, setTasksCervZero] = useState([]);
  const [tasksDigit, setTasksDigit] = useState([]);
  const [alone, setAlone] = useState([]);
  const [aloneDetalhe, setAloneDetalhe] = useState([]);
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

  async function carregar() {
    setLoading(true);
    try {
      const [resResumo, resDetalhe, resCoaching, resSemCoaching, resDiasRota, resDesafios, resDto, resPromo, resPromoDetalhe, resPolitica, resMenu, resTasksCerveja, resScore5, resTasksNab, resTasksVolume, resTasksMktp, resTasksMatch, resTasksCervZero, resTasksDigit, resAlone, resAloneDetalhe, resRgb, resRgbLit, resRgbInt, resRgbDet, resCupons, resCuponsDet, resLojaIdeal, resLojaIdealDet, resScanntech, resScanntechDet, resPortIdeal, resPortIdealDet, resAp, resApDet, resSpoMetas] = await Promise.all([
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
      setDto(Array.isArray(dtoData) && dtoData.length > 0 ? dtoData[0] : (dtoData && !Array.isArray(dtoData) ? dtoData : null));
      const promoData = resPromo?.data || [];
      setPromo(Array.isArray(promoData) ? promoData : []);
      const promoDetData = resPromoDetalhe?.data || [];
      setPromoDetalhe(Array.isArray(promoDetData) ? promoDetData : []);
      setPolitica(resPolitica?.data || []);
      setMenu(resMenu?.data || []);
      setTasksCerveja(resTasksCerveja?.data || []);
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

  // Resumo operação
  const totalVisitados = resumo.reduce((s, r) => s + parseInt(r.visitados || 0), 0);
  const totalMeta = resumo.reduce((s, r) => s + parseInt(r.meta || META_GV), 0);
  const pctOp = totalMeta > 0 ? Math.round((totalVisitados / totalMeta) * 100) : 0;

  // Detalhe filtrado
  const detalheFiltrado = detalhe.filter((d) => {
    const buscaOk = !busca || d.cod_pdv?.includes(busca) || d.nome_pdv?.toLowerCase().includes(busca.toLowerCase());
    const gvOk = filtroGv === "todos" || d.gv === filtroGv;
    const stOk = filtroStatus === "todos" || (filtroStatus === "ok" && d.valida === "SIM") || (filtroStatus === "nok" && d.valida === "NÃO");
    const diaOk = filtroDia === "todos" || (d.dia_visita || "").toUpperCase().includes(filtroDia.toUpperCase());
    return buscaOk && gvOk && stOk && diaOk;
  });

  const gvsUnicos = [...new Set(detalhe.map((d) => d.gv))].sort();
  const diasUnicos = [...new Set(detalhe.map((d) => (d.dia_visita || "").split("/")[0].trim()).filter(Boolean))].sort();

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <button style={styles.backBtn} onClick={() => navigate("/")}>← Voltar</button>
          <div>
            <h1 style={styles.title}>📊 SPO — Excelência Operacional</h1>
            <p style={styles.subtitle}>CMD Ambev · Conde</p>
          </div>
        </div>
        <button style={styles.logoutBtn} onClick={logout}>Sair</button>
      </div>

      <div style={styles.content}>
        {/* Layout side-by-side */}
        <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>

        {/* COLUNA ESQUERDA — Cards + Detalhe KPI */}
        <div style={{ flex: "1 1 0", minWidth: 0 }}>

        {/* Scoreboard dos 24 KPIs */}
        <div style={styles.scoreboard}>
          <div style={styles.scoreboardHeader}>
            <span style={styles.scoreboardTitle}>Painel SPO — {TOTAL_PTS} pontos</span>
            <span style={styles.scoreboardSub}>KPIs ativos em amarelo</span>
          </div>
          <div style={styles.kpiGrid}>
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

        {/* Abas de visão */}
        <div style={styles.abas}>
          {["operacao", "gv", "detalhe", "sem_coaching"].map((a) => (
            <button key={a} style={{ ...styles.abaBtn, ...(aba === a ? styles.abaBtnAtivo : {}) }} onClick={() => setAba(a)}>
              {a === "operacao" ? "🏭 Operação" : a === "gv" ? "👥 Por GV" : a === "detalhe" ? "📋 Detalhe" : `⚠️ Sem Coaching${semCoaching.length > 0 ? ` (${semCoaching.length})` : ""}`}
            </button>
          ))}
        </div>

        {loading ? <p style={styles.msg}>Carregando...</p> : (
          <>




            {/* OPERAÇÃO */}
            {aba === "operacao" && (
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
                        <span>{c.mes_referencia}</span>
                      </div>
                    </div>
                  );
                })}
                {coaching.filter(c => c.periodo === periodoCoaching).length === 0 && (
                  <p style={styles.msg}>Importe o relatório em Admin → Arquivos → SPO Rota Coaching.</p>
                )}
              </div>
            </div>

            {/* DIAS EM ROTA TT */}
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
                      <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.25)", marginTop: "2px" }}>{d.mes_referencia}</div>
                    </div>
                  );
                })}
                {diasRota.filter(d => d.periodo === periodoDiasRota).length === 0 && (
                  <p style={styles.msg}>Importe o relatório de Rota Coaching — os dias em rota são calculados automaticamente.</p>
                )}
              </div>
            </div>

            {/* DESAFIOS DIÁRIOS */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 4 — Abertura de Desafios Diários</h3>
              <div style={styles.gvGrid}>
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

            {/* DTO GC */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 6 — DTO GC x GV</h3>
              {!dto ? (
                <p style={styles.msg}>Importe o relatório em Admin → Arquivos → SPO DTO GC.</p>
              ) : (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.82rem" }}>{dto.mes_referencia}</span>
                    <span style={{ ...styles.apBadge, background: dto.status_final === "OK" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: dto.status_final === "OK" ? "#4ade80" : "#f87171" }}>
                      {dto.status_final === "OK" ? "✅ OK" : "❌ NOK"}
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px" }}>
                    {[
                      { label: "Matinal", real: dto.matinal_real, meta: dto.matinal_meta, pct: dto.matinal_pct, status: dto.matinal_status },
                      { label: "Vespertina", real: dto.vespertina_real, meta: dto.vespertina_meta, pct: dto.vespertina_pct, status: dto.vespertina_status },
                      { label: "Rota Coaching", real: dto.coaching_real, meta: dto.coaching_meta, pct: dto.coaching_pct, status: dto.coaching_status },
                    ].map((item) => {
                      const pct = parseFloat(item.pct || 0);
                      const cor = pct >= 100 ? "#4ade80" : pct >= 70 ? "#fbb900" : "#f87171";
                      return (
                        <div key={item.label} style={styles.gvCard}>
                          <div style={styles.gvHeader}>
                            <span style={{ fontSize: "0.88rem", fontWeight: "600" }}>{item.label}</span>
                            <span style={{ ...styles.apBadge, background: item.status === "OK" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: item.status === "OK" ? "#4ade80" : "#f87171", fontSize: "0.72rem" }}>{item.status}</span>
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
              )}
            </div>

            {/* ABA PROMOÇÃO */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 7 — % PDVs abrindo Aba de Promoção no BEES</h3>
              {promo.length === 0 ? (
                <p style={styles.msg}>Importe o relatório em Admin → Arquivos → SPO Aba Promoção BEES.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {/* Cards por setor */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "10px" }}>
                    {promo.map((r) => {
                      const pct = parseFloat(r.pct || 0);
                      const cor = pct >= 10 ? "#4ade80" : pct >= 7 ? "#fbb900" : "#f87171";
                      const isOp = r.setor === "OPERACAO";
                      return (
                        <div key={r.setor} style={{ ...styles.gvCard, ...(isOp ? { border: "1px solid rgba(251,185,0,0.3)", gridColumn: "1/-1" } : {}) }}>
                          <div style={styles.gvHeader}>
                            <span style={{ fontWeight: "700", fontSize: isOp ? "1rem" : "0.88rem" }}>
                              {isOp ? "🏭 Operação Total" : `Setor ${r.setor}`}
                            </span>
                            <span style={{ ...styles.apBadge, background: r.ok === "OK" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: r.ok === "OK" ? "#4ade80" : "#f87171" }}>{r.ok}</span>
                          </div>
                          <BarraProgresso pct={pct * 10} cor={cor} />
                          <div style={styles.gvFooter}>
                            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.78rem" }}>{r.acesso_promo}/{r.visitas} visitas</span>
                            <span style={{ color: cor, fontWeight: "700" }}>{pct}%</span>
                          </div>
                          <p style={{ margin: "2px 0 0", color: "rgba(255,255,255,0.25)", fontSize: "0.7rem" }}>Meta: ≥ 10%</p>
                        </div>
                      );
                    })}
                  </div>
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
              )}
            </div>

            {/* POLÍTICA COMERCIAL */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 8 — Aderência de Política Comercial</h3>
              {politica.length === 0 ? (
                <p style={styles.msg}>Importe o arquivo de tasks para calcular automaticamente.</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "10px" }}>
                  {politica.map((r) => {
                    const pct = parseFloat(r.pct || 0);
                    const cor = pct >= 60 ? "#4ade80" : pct >= 40 ? "#fbb900" : "#f87171";
                    const isOp = r.setor === "OPERACAO";
                    return (
                      <div key={r.setor} style={{ ...styles.gvCard, ...(isOp ? { border: "1px solid rgba(251,185,0,0.3)", gridColumn: "1/-1" } : {}) }}>
                        <div style={styles.gvHeader}>
                          <span style={{ fontWeight: "700", fontSize: isOp ? "1rem" : "0.88rem" }}>
                            {isOp ? "🏭 Operação" : `Setor ${r.setor}`}
                          </span>
                          <span style={{ ...styles.apBadge, background: r.ok === "OK" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: r.ok === "OK" ? "#4ade80" : "#f87171" }}>{r.ok}</span>
                        </div>
                        <BarraProgresso pct={pct} cor={cor} />
                        <div style={styles.gvFooter}>
                          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.78rem" }}>{r.pdvs_execucao}/{r.pdvs_aderidos} PDVs</span>
                          <span style={{ color: cor, fontWeight: "700" }}>{pct}%</span>
                        </div>
                        <p style={{ margin: "2px 0 0", color: "rgba(255,255,255,0.25)", fontSize: "0.7rem" }}>Meta: ≥ 60%</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>


            {/* MENU DE CERVEJA */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 9 — Execução Menu de Cerveja</h3>
              {menu.length === 0 ? (
                <p style={styles.msg}>Importe o arquivo de tasks para calcular automaticamente.</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "10px" }}>
                  {menu.map((r) => {
                    const pct = parseFloat(r.pct || 0);
                    const cor = pct >= 60 ? "#4ade80" : pct >= 40 ? "#fbb900" : "#f87171";
                    const isOp = r.setor === "OPERACAO";
                    return (
                      <div key={r.setor} style={{ ...styles.gvCard, ...(isOp ? { border: "1px solid rgba(251,185,0,0.3)", gridColumn: "1/-1" } : {}) }}>
                        <div style={styles.gvHeader}>
                          <span style={{ fontWeight: "700", fontSize: isOp ? "1rem" : "0.88rem" }}>
                            {isOp ? "🏭 Operação" : `Setor ${r.setor}`}
                          </span>
                          <span style={{ ...styles.apBadge, background: r.ok === "OK" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: r.ok === "OK" ? "#4ade80" : "#f87171" }}>{r.ok}</span>
                        </div>
                        <BarraProgresso pct={pct} cor={cor} />
                        <div style={styles.gvFooter}>
                          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.78rem" }}>{r.tasks_validas}/{r.tasks_total} tasks</span>
                          <span style={{ color: cor, fontWeight: "700" }}>{pct}%</span>
                        </div>
                        <p style={{ margin: "2px 0 0", color: "rgba(255,255,255,0.25)", fontSize: "0.7rem" }}>Meta: ≥ 60%</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>


            {/* TASKS PORTFÓLIO CERVEJA */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 11 — Tasks de Portfólio Cerveja</h3>
              {tasksCerveja.length === 0 ? (
                <p style={styles.msg}>Importe o arquivo de tasks para calcular automaticamente.</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "10px" }}>
                  {tasksCerveja.map((r) => {
                    const pct = parseFloat(r.pct || 0);
                    const cor = pct >= 60 ? "#4ade80" : pct >= 40 ? "#fbb900" : "#f87171";
                    const isOp = r.setor === "OPERACAO";
                    return (
                      <div key={r.setor} style={{ ...styles.gvCard, ...(isOp ? { border: "1px solid rgba(251,185,0,0.3)", gridColumn: "1/-1" } : {}) }}>
                        <div style={styles.gvHeader}>
                          <span style={{ fontWeight: "700", fontSize: isOp ? "1rem" : "0.88rem" }}>
                            {isOp ? "🏭 Operação" : `Setor ${r.setor}`}
                          </span>
                          <span style={{ ...styles.apBadge, background: r.ok === "OK" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: r.ok === "OK" ? "#4ade80" : "#f87171" }}>{r.ok}</span>
                        </div>
                        <BarraProgresso pct={pct} cor={cor} />
                        <div style={styles.gvFooter}>
                          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.78rem" }}>{r.tasks_validas}/{r.tasks_total} tasks</span>
                          <span style={{ color: cor, fontWeight: "700" }}>{pct}%</span>
                        </div>
                        <p style={{ margin: "2px 0 0", color: "rgba(255,255,255,0.25)", fontSize: "0.7rem" }}>Meta: ≥ 60%</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>


            {/* TASKS FATURAMENTO SCORE 5 */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 12 — Tasks Faturamento Score 5</h3>
              {score5.length === 0 ? (
                <p style={styles.msg}>Importe o relatório ON_TRADE para calcular automaticamente.</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "10px" }}>
                  {score5.map((r) => {
                    const pct = parseFloat(r.pct || 0);
                    const cor = pct >= 46 ? "#4ade80" : pct >= 30 ? "#fbb900" : "#f87171";
                    const isOp = r.setor === "OPERACAO";
                    return (
                      <div key={r.setor} style={{ ...styles.gvCard, ...(isOp ? { border: "1px solid rgba(251,185,0,0.3)", gridColumn: "1/-1" } : {}) }}>
                        <div style={styles.gvHeader}>
                          <span style={{ fontWeight: "700", fontSize: isOp ? "1rem" : "0.88rem" }}>
                            {isOp ? "🏭 Operação" : `Setor ${r.setor}`}
                          </span>
                          <span style={{ ...styles.apBadge, background: r.ok === "OK" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: r.ok === "OK" ? "#4ade80" : "#f87171" }}>{r.ok}</span>
                        </div>
                        <BarraProgresso pct={pct} cor={cor} />
                        <div style={styles.gvFooter}>
                          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.78rem" }}>{r.pdvs_ok}/{r.pdvs_total} PDVs</span>
                          <span style={{ color: cor, fontWeight: "700" }}>{pct}%</span>
                        </div>
                        <p style={{ margin: "2px 0 0", color: "rgba(255,255,255,0.25)", fontSize: "0.7rem" }}>Meta: ≥ 46%</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>


            {/* TASKS NAB */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 13 — Tasks de Portfólio NAB</h3>
              {tasksNab.length === 0 ? (
                <p style={styles.msg}>Importe o arquivo de tasks para calcular automaticamente.</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "10px" }}>
                  {tasksNab.map((r) => {
                    const pct = parseFloat(r.pct || 0);
                    const cor = pct >= 60 ? "#4ade80" : pct >= 40 ? "#fbb900" : "#f87171";
                    const isOp = r.setor === "OPERACAO";
                    return (
                      <div key={r.setor} style={{ ...styles.gvCard, ...(isOp ? { border: "1px solid rgba(251,185,0,0.3)", gridColumn: "1/-1" } : {}) }}>
                        <div style={styles.gvHeader}>
                          <span style={{ fontWeight: "700", fontSize: isOp ? "1rem" : "0.88rem" }}>
                            {isOp ? "🏭 Operação" : `Setor ${r.setor}`}
                          </span>
                          <span style={{ ...styles.apBadge, background: r.ok === "OK" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: r.ok === "OK" ? "#4ade80" : "#f87171" }}>{r.ok}</span>
                        </div>
                        <BarraProgresso pct={pct} cor={cor} />
                        <div style={styles.gvFooter}>
                          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.78rem" }}>{r.tasks_validas}/{r.tasks_total} tasks</span>
                          <span style={{ color: cor, fontWeight: "700" }}>{pct}%</span>
                        </div>
                        <p style={{ margin: "2px 0 0", color: "rgba(255,255,255,0.25)", fontSize: "0.7rem" }}>Meta: ≥ 60%</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>


            {/* TASKS VOLUME */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 14 — Tasks de Volume</h3>
              {tasksVolume.length === 0 ? (
                <p style={styles.msg}>Importe o arquivo de tasks para calcular automaticamente.</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "10px" }}>
                  {tasksVolume.map((r) => {
                    const pct = parseFloat(r.pct || 0);
                    const cor = pct >= 60 ? "#4ade80" : pct >= 40 ? "#fbb900" : "#f87171";
                    const isOp = r.setor === "OPERACAO";
                    return (
                      <div key={r.setor} style={{ ...styles.gvCard, ...(isOp ? { border: "1px solid rgba(251,185,0,0.3)", gridColumn: "1/-1" } : {}) }}>
                        <div style={styles.gvHeader}>
                          <span style={{ fontWeight: "700", fontSize: isOp ? "1rem" : "0.88rem" }}>
                            {isOp ? "🏭 Operação" : `Setor ${r.setor}`}
                          </span>
                          <span style={{ ...styles.apBadge, background: r.ok === "OK" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: r.ok === "OK" ? "#4ade80" : "#f87171" }}>{r.ok}</span>
                        </div>
                        <BarraProgresso pct={pct} cor={cor} />
                        <div style={styles.gvFooter}>
                          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.78rem" }}>{r.tasks_validas}/{r.tasks_total} tasks</span>
                          <span style={{ color: cor, fontWeight: "700" }}>{pct}%</span>
                        </div>
                        <p style={{ margin: "2px 0 0", color: "rgba(255,255,255,0.25)", fontSize: "0.7rem" }}>Meta: ≥ 60%</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>


            {/* TASKS MARKETPLACE */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 15 — Tasks de Marketplace</h3>
              {tasksMktp.length === 0 ? (
                <p style={styles.msg}>Importe o arquivo de tasks para calcular automaticamente.</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "10px" }}>
                  {tasksMktp.map((r) => {
                    const pct = parseFloat(r.pct || 0);
                    const cor = pct >= 60 ? "#4ade80" : pct >= 40 ? "#fbb900" : "#f87171";
                    const isOp = r.setor === "OPERACAO";
                    return (
                      <div key={r.setor} style={{ ...styles.gvCard, ...(isOp ? { border: "1px solid rgba(251,185,0,0.3)", gridColumn: "1/-1" } : {}) }}>
                        <div style={styles.gvHeader}>
                          <span style={{ fontWeight: "700", fontSize: isOp ? "1rem" : "0.88rem" }}>
                            {isOp ? "🏭 Operação" : `Setor ${r.setor}`}
                          </span>
                          <span style={{ ...styles.apBadge, background: r.ok === "OK" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: r.ok === "OK" ? "#4ade80" : "#f87171" }}>{r.ok}</span>
                        </div>
                        <BarraProgresso pct={pct} cor={cor} />
                        <div style={styles.gvFooter}>
                          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.78rem" }}>{r.tasks_validas}/{r.tasks_total} tasks</span>
                          <span style={{ color: cor, fontWeight: "700" }}>{pct}%</span>
                        </div>
                        <p style={{ margin: "2px 0 0", color: "rgba(255,255,255,0.25)", fontSize: "0.7rem" }}>Meta: ≥ 60%</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>


            {/* TASKS MATCH */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 16 — Tasks de Portfólio MATCH</h3>
              {tasksMatch.length === 0 ? (
                <p style={styles.msg}>Importe o arquivo de tasks para calcular automaticamente.</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "10px" }}>
                  {tasksMatch.map((r) => {
                    const pct = parseFloat(r.pct || 0);
                    const cor = pct >= 60 ? "#4ade80" : pct >= 40 ? "#fbb900" : "#f87171";
                    const isOp = r.setor === "OPERACAO";
                    return (
                      <div key={r.setor} style={{ ...styles.gvCard, ...(isOp ? { border: "1px solid rgba(251,185,0,0.3)", gridColumn: "1/-1" } : {}) }}>
                        <div style={styles.gvHeader}>
                          <span style={{ fontWeight: "700", fontSize: isOp ? "1rem" : "0.88rem" }}>
                            {isOp ? "🏭 Operação" : `Setor ${r.setor}`}
                          </span>
                          <span style={{ ...styles.apBadge, background: r.ok === "OK" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: r.ok === "OK" ? "#4ade80" : "#f87171" }}>{r.ok}</span>
                        </div>
                        <BarraProgresso pct={pct} cor={cor} />
                        <div style={styles.gvFooter}>
                          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.78rem" }}>{r.tasks_validas}/{r.tasks_total} tasks</span>
                          <span style={{ color: cor, fontWeight: "700" }}>{pct}%</span>
                        </div>
                        <p style={{ margin: "2px 0 0", color: "rgba(255,255,255,0.25)", fontSize: "0.7rem" }}>Meta: ≥ 60%</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>


            {/* TASKS CERVEJA ZERO */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 17 — Tasks de Portfólio Cerveja Zero</h3>
              {tasksCervZero.length === 0 ? (
                <p style={styles.msg}>Importe o arquivo de tasks para calcular automaticamente.</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "10px" }}>
                  {tasksCervZero.map((r) => {
                    const pct = parseFloat(r.pct || 0);
                    const cor = pct >= 60 ? "#4ade80" : pct >= 40 ? "#fbb900" : "#f87171";
                    const isOp = r.setor === "OPERACAO";
                    return (
                      <div key={r.setor} style={{ ...styles.gvCard, ...(isOp ? { border: "1px solid rgba(251,185,0,0.3)", gridColumn: "1/-1" } : {}) }}>
                        <div style={styles.gvHeader}>
                          <span style={{ fontWeight: "700", fontSize: isOp ? "1rem" : "0.88rem" }}>
                            {isOp ? "🏭 Operação" : `Setor ${r.setor}`}
                          </span>
                          <span style={{ ...styles.apBadge, background: r.ok === "OK" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: r.ok === "OK" ? "#4ade80" : "#f87171" }}>{r.ok}</span>
                        </div>
                        <BarraProgresso pct={pct} cor={cor} />
                        <div style={styles.gvFooter}>
                          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.78rem" }}>{r.tasks_validas}/{r.tasks_total} tasks</span>
                          <span style={{ color: cor, fontWeight: "700" }}>{pct}%</span>
                        </div>
                        <p style={{ margin: "2px 0 0", color: "rgba(255,255,255,0.25)", fontSize: "0.7rem" }}>Meta: ≥ 60%</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>


            {/* TASKS DIGITALIZAÇÃO */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 18 — Tasks de Digitalização</h3>
              {tasksDigit.length === 0 ? (
                <p style={styles.msg}>Importe o arquivo de tasks para calcular automaticamente.</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "10px" }}>
                  {tasksDigit.map((r) => {
                    const pct = parseFloat(r.pct || 0);
                    const cor = pct >= 60 ? "#4ade80" : pct >= 40 ? "#fbb900" : "#f87171";
                    const isOp = r.setor === "OPERACAO";
                    return (
                      <div key={r.setor} style={{ ...styles.gvCard, ...(isOp ? { border: "1px solid rgba(251,185,0,0.3)", gridColumn: "1/-1" } : {}) }}>
                        <div style={styles.gvHeader}>
                          <span style={{ fontWeight: "700", fontSize: isOp ? "1rem" : "0.88rem" }}>
                            {isOp ? "🏭 Operação" : `Setor ${r.setor}`}
                          </span>
                          <span style={{ ...styles.apBadge, background: r.ok === "OK" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: r.ok === "OK" ? "#4ade80" : "#f87171" }}>{r.ok}</span>
                        </div>
                        <BarraProgresso pct={pct} cor={cor} />
                        <div style={styles.gvFooter}>
                          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.78rem" }}>{r.tasks_validas}/{r.tasks_total} tasks</span>
                          <span style={{ color: cor, fontWeight: "700" }}>{pct}%</span>
                        </div>
                        <p style={{ margin: "2px 0 0", color: "rgba(255,255,255,0.25)", fontSize: "0.7rem" }}>Meta: ≥ 60%</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>


            {/* PDV COMPRA INDEPENDENTE */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 19 — PDVs com Compra Independente</h3>
              {alone.length === 0 ? (
                <p style={styles.msg}>Importe o relatório de Pedido Alone para calcular automaticamente.</p>
              ) : (
                <>
                  {/* Card Operação */}
                  {alone.filter(r => r.setor === "OPERACAO").map(r => {
                    const val = parseInt(r.pdvs_alone || 0);
                    const meta = parseInt(r.meta || 0);
                    const pct = meta > 0 ? Math.round(val / meta * 100) : 0;
                    const cor = pct >= 100 ? "#4ade80" : pct >= 70 ? "#fbb900" : "#f87171";
                    return (
                      <div key="op" style={{ ...styles.gvCard, border: "1px solid rgba(251,185,0,0.3)", marginBottom: "10px" }}>
                        <div style={styles.gvHeader}>
                          <span style={{ fontWeight: "700", fontSize: "1rem" }}>🏭 Operação</span>
                          <span style={{ ...styles.apBadge, background: r.ok === "OK" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: r.ok === "OK" ? "#4ade80" : "#f87171" }}>{r.ok}</span>
                        </div>
                        <BarraProgresso pct={pct} cor={cor} />
                        <div style={styles.gvFooter}>
                          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.78rem" }}>{val} / meta {meta} PDVs</span>
                          <span style={{ color: cor, fontWeight: "700" }}>{pct}%</span>
                        </div>
                      </div>
                    );
                  })}
                  {/* Cards por setor */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "10px" }}>
                    {alone.filter(r => r.setor !== "OPERACAO").map(r => (
                      <div key={r.setor} style={styles.gvCard}>
                        <div style={styles.gvHeader}>
                          <span style={{ fontWeight: "700", fontSize: "0.88rem" }}>Setor {r.setor}</span>
                        </div>
                        <div style={styles.gvFooter}>
                          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.78rem" }}>{r.pdvs_total} PDVs</span>
                          <span style={{ color: "#4ade80", fontWeight: "700" }}>{r.pdvs_alone} alone</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>


            {/* +RGB */}
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


            {/* CUPONS DIGITAIS */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 21 — Cupons Digitais Score 5</h3>
              {cupons.length === 0 ? (
                <p style={styles.msg}>Importe o planificador de Cupons para calcular automaticamente.</p>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "8px", marginBottom: "16px" }}>
                    {cupons.map((r) => {
                      const isOp = r.setor === "OPERACAO";
                      return (
                        <div key={r.setor} style={{ ...styles.gvCard, ...(isOp ? { border: "1px solid rgba(251,185,0,0.3)", gridColumn: "1/-1" } : {}) }}>
                          <div style={styles.gvHeader}>
                            <span style={{ fontWeight: "700", fontSize: isOp ? "1rem" : "0.85rem" }}>
                              {isOp ? "🏭 Operação" : `Setor ${r.setor}`}
                            </span>
                          </div>
                          <div style={styles.gvFooter}>
                            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.75rem" }}>Cupons resgatados</span>
                            <span style={{ color: "#fbb900", fontWeight: "700", fontSize: "1.1rem" }}>{r.cupons_mes}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {cuponsDet.length > 0 && (
                    <>
                      {/* Filtros */}
                      <div style={{ display: "flex", gap: "8px", marginBottom: "10px", flexWrap: "wrap", alignItems: "center" }}>
                        <p style={{ margin: 0, color: "rgba(255,255,255,0.4)", fontSize: "0.8rem" }}>PDVs sem resgate no mês atual</p>
                        {[
                          { label: "GV", val: cuponsGV, set: setCuponsGV, opts: ["TODOS", ...new Set(cuponsDet.map(r => r.gv).filter(Boolean))].sort() },
                          { label: "RN", val: cuponsRN, set: setCuponsRN, opts: ["TODOS", ...new Set(cuponsDet.map(r => r.setor).filter(Boolean))].sort() },
                          { label: "Dia", val: cuponsDia, set: setCuponsDia, opts: ["TODOS", ...new Set(cuponsDet.map(r => r.dia_visita).filter(Boolean))].sort() },
                          { label: "Marca", val: cuponsMarca, set: setCuponsMarca, opts: ["TODAS", ...new Set(cuponsDet.map(r => r.campanha).filter(Boolean))].sort() },
                        ].map(({ label, val, set, opts }) => (
                          <select key={label} value={val} onChange={e => set(e.target.value)}
                            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "#fff", padding: "4px 10px", fontSize: "0.8rem", cursor: "pointer" }}>
                            {opts.map(o => <option key={o} value={o}>{label}: {o}</option>)}
                          </select>
                        ))}
                        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.75rem" }}>
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


            {/* LOJA IDEAL VIZINHANÇA */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 22 — % Lojas Ideais Vizinhança</h3>
              {lojaIdeal.length === 0 ? (
                <p style={styles.msg}>Importe o Planificador de Loja Ideal para calcular automaticamente.</p>
              ) : (
                <>
                  {/* Resumo por setor */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "8px", marginBottom: "16px" }}>
                    {lojaIdeal.map((r) => {
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
                      <div style={{ display: "flex", gap: "8px", marginBottom: "10px", flexWrap: "wrap", alignItems: "center" }}>
                        {[
                          { label: "RN", val: lojaFiltroRN, set: setLojaFiltroRN, opts: ["TODOS", ...new Set(lojaIdealDet.map(r => r.setor))].sort() },
                          { label: "Status", val: lojaFiltroStatus, set: setLojaFiltroStatus, opts: ["TODOS", "SIM", "NÃO"] },
                        ].map(({ label, val, set, opts }) => (
                          <select key={label} value={val} onChange={e => set(e.target.value)}
                            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "#fff", padding: "4px 10px", fontSize: "0.8rem", cursor: "pointer" }}>
                            {opts.map(o => <option key={o} value={o}>{label}: {o}</option>)}
                          </select>
                        ))}
                        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.75rem" }}>
                          {lojaIdealDet.filter(r =>
                            (lojaFiltroRN === "TODOS" || r.setor === lojaFiltroRN) &&
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


            {/* EXPANSÃO SCANNTECH */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 23 — Expansão Scanntech</h3>
              {scanntech.length === 0 ? (
                <p style={styles.msg}>Importe a base Scanntech para calcular automaticamente.</p>
              ) : (
                <>
                  {/* Resumo */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "8px", marginBottom: "16px" }}>
                    {scanntech.map((r) => {
                      const isOp = r.setor === "OPERACAO";
                      const ativos = parseInt(r.pdvs_ativos || 0);
                      const total  = parseInt(r.pdvs_total  || 0);
                      const meta   = parseInt(r.meta || 0);
                      const pct    = meta > 0 ? Math.round(ativos / meta * 100) : 0;
                      const cor    = isOp ? (r.ok === "OK" ? "#4ade80" : "#f87171") : "#4ade80";
                      return (
                        <div key={r.setor} style={{ ...styles.gvCard, ...(isOp ? { border: "1px solid rgba(251,185,0,0.3)", gridColumn: "1/-1" } : {}) }}>
                          <div style={styles.gvHeader}>
                            <span style={{ fontWeight: "700", fontSize: isOp ? "1rem" : "0.85rem" }}>
                              {isOp ? "🏭 Operação" : `GV ${r.gv}`}
                            </span>
                            {isOp && <span style={{ ...styles.apBadge, background: r.ok === "OK" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: r.ok === "OK" ? "#4ade80" : "#f87171" }}>{r.ok}</span>}
                          </div>
                          {isOp && <BarraProgresso pct={pct} cor={cor} />}
                          <div style={styles.gvFooter}>
                            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.75rem" }}>{ativos}/{total} PDVs</span>
                            {isOp && <span style={{ color: cor, fontWeight: "700" }}>{ativos} ativos</span>}
                          </div>
                          {isOp && <p style={{ margin: "2px 0 0", color: "rgba(255,255,255,0.25)", fontSize: "0.7rem" }}>Meta: ≥ {meta} PDVs</p>}
                        </div>
                      );
                    })}
                  </div>
                  {/* Detalhe */}
                  {scanntechDet.length > 0 && (
                    <>
                      <div style={{ display: "flex", gap: "8px", marginBottom: "10px", flexWrap: "wrap", alignItems: "center" }}>
                        <select value={scanFiltroStatus} onChange={e => setScanFiltroStatus(e.target.value)}
                          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "#fff", padding: "4px 10px", fontSize: "0.8rem", cursor: "pointer" }}>
                          <option value="TODOS">Todos os status</option>
                          {[...new Set(scanntechDet.map(r => r.status_scanntech))].sort().map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.75rem" }}>
                          {scanntechDet.filter(r => scanFiltroStatus === "TODOS" || r.status_scanntech === scanFiltroStatus).length} PDVs
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
                            {scanntechDet.filter(r => scanFiltroStatus === "TODOS" || r.status_scanntech === scanFiltroStatus)
                              .sort((a,b) => a.status_scanntech.localeCompare(b.status_scanntech))
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


            {/* PORTFÓLIO IDEAL SCORE 5 */}
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


            {/* ATENDIMENTO PRODUTIVO */}
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

            {/* POR GV */}
            {aba === "gv" && (
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
            {aba === "sem_coaching" && (
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
            {aba === "detalhe" && (
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
        <div style={{ flex: "0 0 40%", minWidth: "380px", position: "sticky", top: "20px" }}>
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "16px", overflowX: "auto" }}>
            <p style={{ margin: "0 0 12px", fontWeight: "700", fontSize: "0.9rem", color: "#fbb900" }}>📊 Painel SPO Consolidado</p>
            {loading ? <p style={styles.msg}>Carregando...</p> : (
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
                            const getReal = (n, mes) => {
                              const r = spoMetas.find(m => String(m.item) === String(n) && m.mes === mes);
                              return r ? parseFloat(r.real) : null;
                            };
              
                            // Total de pontos por mês
                            const pontosMes = (mes) => ITENS_SPO.reduce((acc, item) => {
                              if (INICIO_AVAL[item.n] > mes) return acc;
                              const meta = getMeta(item.n, mes);
                              const real = getReal(item.n, mes);
                              if (meta === null || real === null) return acc;
                              return acc + (real >= meta ? 3 : 0);
                            }, 0);
              
                            const mesAtual = new Date().toISOString().slice(0,7);
              
                            const thStyle = { padding: "8px 10px", color: "rgba(255,255,255,0.5)", fontSize: "0.7rem", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", whiteSpace: "nowrap" };
                            const thSubStyle = { padding: "5px 8px", color: "rgba(255,255,255,0.35)", fontSize: "0.65rem", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap" };
                            const tdStyle = { padding: "7px 8px", color: "rgba(255,255,255,0.6)", textAlign: "center", whiteSpace: "nowrap" };
              
                            return (
                              <div style={{ overflowX: "auto" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem", minWidth: "900px" }}>
                                  <thead>
                                    <tr>
                                      <th style={thStyle}>#</th>
                                      <th style={{ ...thStyle, textAlign: "left", minWidth: "200px" }}>Indicador</th>
                                      <th style={thStyle}>Início</th>
                                      {MESES.map(mes => (
                                        <th key={mes} colSpan={4} style={{ ...thStyle, background: mes === mesAtual ? "rgba(251,185,0,0.15)" : "rgba(255,255,255,0.04)", borderLeft: "1px solid rgba(255,255,255,0.1)" }}>
                                          {MESES_LABEL[mes]}
                                        </th>
                                      ))}
                                      <th colSpan={3} style={{ ...thStyle, background: "rgba(251,185,0,0.1)", borderLeft: "1px solid rgba(255,255,255,0.15)" }}>TRI</th>
                                    </tr>
                                    <tr>
                                      <th style={thSubStyle} colSpan={3}></th>
                                      {MESES.map(mes => (
                                        ["Meta","Real","% Ating","Pts"].map(h => (
                                          <th key={mes+h} style={{ ...thSubStyle, background: mes === mesAtual ? "rgba(251,185,0,0.08)" : "" }}>{h}</th>
                                        ))
                                      ))}
                                      {["Pts","Real","Meta"].map(h => <th key={"tri"+h} style={{ ...thSubStyle, background: "rgba(251,185,0,0.06)" }}>{h}</th>)}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {ITENS_SPO.map((item) => {
                                      let triPts = 0;
                                      return (
                                        <tr key={item.n} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", ...(kpiAtivo === item.n ? { background: "rgba(251,185,0,0.08)", boxShadow: "inset 3px 0 0 #fbb900" } : {}) }}>
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
                                            if (pts === 3) triPts += 3;
                                            const corAting = bateu ? "#4ade80" : (ating !== null && parseFloat(ating) >= 70) ? "#fbb900" : "#f87171";
                                            return [
                                              <td key={mes+"m"} style={tdStyle}>{meta !== null ? meta : <span style={{color:"rgba(255,255,255,0.2)"}}>—</span>}</td>,
                                              <td key={mes+"r"} style={tdStyle}>{real !== null ? real : <span style={{color:"rgba(255,255,255,0.2)"}}>—</span>}</td>,
                                              <td key={mes+"a"} style={{ ...tdStyle, color: ating !== null ? corAting : "rgba(255,255,255,0.2)", fontWeight: ating ? "600" : "400" }}>{ating !== null ? `${ating}%` : "—"}</td>,
                                              <td key={mes+"p"} style={{ ...tdStyle, color: pts === 3 ? "#4ade80" : pts === 0 ? "#f87171" : "rgba(255,255,255,0.2)", fontWeight: "700" }}>{pts !== null ? pts : "—"}</td>,
                                            ];
                                          })}
                                          <td style={{ ...tdStyle, color: triPts > 0 ? "#4ade80" : "#f87171", fontWeight: "700", background: "rgba(251,185,0,0.04)" }}>{triPts > 0 ? triPts : 0}</td>
                                          <td style={{ ...tdStyle, color: "rgba(255,255,255,0.5)", background: "rgba(251,185,0,0.04)" }}>—</td>
                                          <td style={{ ...tdStyle, color: "rgba(255,255,255,0.3)", background: "rgba(251,185,0,0.04)" }}>—</td>
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
                                      <td colSpan={3} style={{ ...tdStyle, color: "#fbb900", fontWeight: "700", fontSize: "0.9rem", background: "rgba(251,185,0,0.06)" }}>
                                        {MESES.reduce((acc, mes) => acc + pontosMes(mes), 0)}
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
  content: { padding: "24px 32px", maxWidth: "1100px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "20px" },
  msg: { color: "rgba(255,255,255,0.35)", textAlign: "center", padding: "40px" },
  scoreboard: { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "20px" },
  scoreboardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" },
  scoreboardTitle: { fontWeight: "700", fontSize: "0.95rem" },
  scoreboardSub: { color: "rgba(255,255,255,0.35)", fontSize: "0.78rem" },
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "6px" },
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
