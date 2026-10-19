/* BUILD_20260525_150000 */
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import { SPO_KPIS, SPO_KPIS_BASICO, realDaLinha } from "../../config/spoKpis";
import { useContarAba } from "../../utils/uso";
import { useAbaUrl } from "../../utils/abaUrl";

import KpisVisitacao from "./KpisVisitacao";
import KpisExecucao from "./KpisExecucao";
import KpisTasks from "./KpisTasks";
import KpisProgramas from "./KpisProgramas";
import FechamentoSpo, { triDoPainel } from "./FechamentoSpo"; // foto do painel consolidado por trimestre
import { BarraMeta, BarraProgresso, INICIO_AVAL_KPI, MESES_TRI, META_GV, SPO_ITEMS, mostra, rmTd, rmTh, styles } from "./shared";
export default function SPO() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const [aba, setAba] = useAbaUrl("aba", "operacao");
  useContarAba("/spo", aba); // Engajamento por aba
  const [kpiAtivo, setKpiAtivo] = useState(null);
  const [spoMetas, setSpoMetas] = useState([]);
  const [resumo, setResumo] = useState([]);
  const [detalhe, setDetalhe] = useState([]);
  const [loading, setLoading] = useState(true);
  const [coaching, setCoaching] = useState([]);
  const [periodoCoaching, setPeriodoCoaching] = useState("trimestral");
  const [semCoaching, setSemCoaching] = useState([]);
  const [coachingDet, setCoachingDet] = useState([]);
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
  const [tasksView, setTasksView] = useState("mensal"); // flag mês × tri das tabelas de tasks (KPIs 10–17)
  const [kpi11FiltroRN, setKpi11FiltroRN] = useState("TODOS");
  const [kpi11FiltroDia, setKpi11FiltroDia] = useState("TODOS");
  const [score5, setScore5] = useState([]);
  const [score5Det, setScore5Det] = useState([]);
  const [spoReal, setSpoReal] = useState({}); // mapa do "realizado" por KPI (vem de /api/spo/config)
  const [kpi12FiltroRN, setKpi12FiltroRN] = useState("TODOS");
  const [kpi12SoFalha, setKpi12SoFalha] = useState(false);
  const [tasksNab, setTasksNab] = useState([]);
  const [tasksVolume, setTasksVolume] = useState([]);
  const [tasksMktp, setTasksMktp] = useState([]);
  const [tasksMatch, setTasksMatch] = useState([]);
  const [tasksCervZero, setTasksCervZero] = useState([]);
  const [tasksDigit, setTasksDigit] = useState([]);
  const [tasksLn, setTasksLn] = useState([]);
  const [tasksLnDet, setTasksLnDet] = useState([]);
  const [tasksSkuPdv, setTasksSkuPdv] = useState([]);
  const [tasksSkuPdvDet, setTasksSkuPdvDet] = useState([]);
  const [skuRN, setSkuRN] = useState("TODOS");
  const [skuCat, setSkuCat] = useState("TODAS");
  const [skuSoAbertas, setSkuSoAbertas] = useState(false);
  const [lnRN, setLnRN] = useState("TODOS");
  const [lnSoFalha, setLnSoFalha] = useState(false);
  const [alone, setAlone] = useState([]);
  const [aloneDetalhe, setAloneDetalhe] = useState([]);
  const [aloneView, setAloneView] = useState("mensal");
  const [aloneFiltroRN, setAloneFiltroRN] = useState("TODOS");
  const [aloneFiltroDia, setAloneFiltroDia] = useState("TODOS");
  const [aloneFiltroPDV, setAloneFiltroPDV] = useState("TODOS");
  const [spoCfg, setSpoCfg] = useState({}); // { item: {pts, peso} } — config editável (spo_kpi_config)
  const [rotinaMais, setRotinaMais] = useState([]);       // resumo por setor + OPERACAO
  const [rotinaMaisDet, setRotinaMaisDet] = useState([]); // detalhe por visita
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
  const [apMes, setApMes] = useState(""); // mês selecionado nos cards do tri (KPI 18 / n=5)
  const [busca, setBusca] = useState("");
  const [filtroGv, setFiltroGv] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroDia, setFiltroDia] = useState("todos");
  const [painelFull, setPainelFull] = useState(false); // modo tela-cheia do painel consolidado
  const painelRef = useRef(null);                       // alvo da foto do fechamento do trimestre

  // Entra/sai do modo full-screen — tenta travar orientação em paisagem (Android Chrome)
  // Se não suportado (iOS), o CSS rotate(90deg) faz o fallback automaticamente
  async function togglePainelFull() {
    if (!painelFull) {
      setPainelFull(true);
      try { await screen.orientation.lock("landscape"); } catch (_) {}
    } else {
      setPainelFull(false);
      try { screen.orientation.unlock(); } catch (_) {}
    }
  }

  // ── Status TRI por KPI: true=bateu / false=não bateu / null=sem dados ──────
  // Acumula meta e real de spoMetas para os meses do TRI até o mês atual.
  // Usado para colorir as bordas dos cards do scoreboard (verde/vermelho).
  const _mesAtualStr = new Date().toISOString().slice(0, 7);
  const kpiTriStatus = (() => {
    const status = {};
    SPO_ITEMS.forEach(({ n }) => {
      const ini = spoCfg[String(n)]?.inicio || INICIO_AVAL_KPI[n] || MESES_TRI[0];
      const meses = MESES_TRI.filter(m => ini <= m && m <= _mesAtualStr);
      let metaTot = 0, realTot = 0, hasMeta = false, hasReal = false;
      for (const mes of meses) {
        const row = spoMetas.find(r => String(r.item) === String(n) && r.mes === mes);
        if (row?.meta !== "" && row?.meta != null) { metaTot += parseFloat(row.meta) || 0; hasMeta = true; }
        if (row?.real !== "" && row?.real != null) { realTot += parseFloat(row.real) || 0; hasReal = true; }
      }
      status[n] = (hasMeta && hasReal) ? realTot >= metaTot : null;
    });
    return status;
  })();

  useEffect(() => { carregar(); }, []);

  // Config editável de pts/peso por KPI (admin Metas SPO) — alimenta o consolidado.
  useEffect(() => {
    api.get("/api/spo/painel/config", { params: { tri: triDoPainel().id } })   // config do tri vigente
      .then((r) => { const m = {}; (r.data || []).forEach((x) => { m[String(x.item)] = { pts: x.pts, peso: x.peso, inicio: x.inicio }; }); setSpoCfg(m); })
      .catch(() => {});
  }, []);

  // Rota Coaching (KPI 2) — detalhe por GV×RN×dia (alimenta o "Detalhado RN").
  useEffect(() => {
    api.get("/api/spo/coaching/detalhe")
      .then((r) => setCoachingDet(r.data || []))
      .catch(() => {});
  }, []);

  // +LN (KPI 27) — task SKU/PDV Long Neck HE (resumo + detalhe de abertos).
  useEffect(() => {
    Promise.all([
      api.get("/api/spo/tasks-ln/resumo").catch(() => ({ data: [] })),
      api.get("/api/spo/tasks-ln/detalhe").catch(() => ({ data: [] })),
    ]).then(([a, b]) => { setTasksLn(a.data || []); setTasksLnDet(b.data || []); });
  }, []);

  // SKU/PDV TT (KPI 26) — tasks "SKUs distintos de CERVEJA/NAB/MATCH/MARKETPLACE",
  // calculado a partir do import de Tasks (rota genérica spo_tasks_sku_pdv_*).
  useEffect(() => {
    Promise.all([
      api.get("/api/spo/tasks-sku-pdv/resumo").catch(() => ({ data: [] })),
      api.get("/api/spo/tasks-sku-pdv/detalhe").catch(() => ({ data: [] })),
    ]).then(([a, b]) => { setTasksSkuPdv(a.data || []); setTasksSkuPdvDet(b.data || []); });
  }, []);

  // Rotina+ (KPI 25) — resumo (setor/OPERACAO) + detalhe por visita.
  useEffect(() => {
    Promise.all([
      api.get("/api/spo/rotina-mais/resumo").catch(() => ({ data: [] })),
      api.get("/api/spo/rotina-mais/detalhe").catch(() => ({ data: [] })),
    ]).then(([a, b]) => { setRotinaMais(a.data || []); setRotinaMaisDet(b.data || []); });
  }, []);

  // pts/peso do KPI: usa a config editável; se vazia, cai no registro (config/spoKpis.js).
  const ptsDe = (n) => {
    const c = spoCfg[String(n)];
    if (c && c.pts !== "" && c.pts != null) return parseFloat(c.pts) || 0;
    return SPO_ITEMS.find((s) => s.n === n)?.pts ?? 0;
  };
  const pesoDe = (n) => {
    const c = spoCfg[String(n)];
    if (c && c.peso !== "" && c.peso != null) return parseFloat(c.peso) || 0;
    return SPO_ITEMS.find((s) => s.n === n)?.peso ?? 0;
  };
  const totalPts = SPO_ITEMS.reduce((s, i) => s + ptsDe(i.n), 0);

  // Resetar aba quando KPI muda para evitar aba inválida visível
  useEffect(() => {
    if (kpiAtivo === null) return;
    if (kpiAtivo === 1) {
      // gv e detalhe são válidas para KPI 1 — mantém
      return;
    }
    if (kpiAtivo === 2) {
      // KPI 2 tem uma única visão: Detalhado RN
      setAba("detalhe_rn");
      return;
    }
    // Demais KPIs: só operacao faz sentido
    setAba("operacao");
  }, [kpiAtivo]);

  async function carregar() {
    setLoading(true);
    try {
      const [resResumo, resDetalhe, resCoaching, resSemCoaching, resDiasRota, resDesafios, resDto, resPromo, resPromoDetalhe, resPolitica, resMenu, resTasksCerveja, resTasksCervejaDetalhe, resScore5, resScore5Det, resTasksNab, resTasksVolume, resTasksMktp, resTasksMatch, resTasksCervZero, resTasksDigit, resAlone, resAloneDetalhe, resRgb, resRgbLit, resRgbInt, resRgbDet, resCupons, resCuponsDet, resLojaIdeal, resLojaIdealDet, resScanntech, resScanntechDet, resPortIdeal, resPortIdealDet, resAp, resApDet, resSpoMetas, resConfig] = await Promise.all([
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
        api.get("/api/spo/score5/detalhe").catch(() => ({ data: [] })),
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
        api.get("/api/spo/config").catch(() => ({ data: { real: {} } })),
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
      setScore5Det(resScore5Det?.data || []);
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
      setSpoReal(resConfig?.data?.real || {});
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

  // ── Tabela padrão dos KPIs de task (#10–#17) ────────────────────────────────
  // Mensal: uma linha por RN (ordem de setor) com realizadas + barra c/ linha de
  //   meta. A meta por RN = rateio do peso do RN (base de tasks/total) sobre a
  //   meta de operação do mês (mesma fórmula dos cards antigos — números idênticos).
  // Trimestral: o relatório de task só tem o mês vivo (sem retroativo), então
  //   agrega em OPERAÇÃO usando o acumulado que o fechamento manual grava em
  //   spo_metas (soma meta+real dos meses do tri). Sem detalhe por RN no tri.
  const toggleTasksView = (
    <div style={{ display: "flex", background: "rgba(255,255,255,0.05)", borderRadius: "8px", padding: "2px", width: "fit-content", marginBottom: "12px" }}>
      {["mensal", "trimestral"].map((v) => (
        <button key={v} onClick={() => setTasksView(v)}
          style={{ background: tasksView === v ? "rgba(125,186,61,0.2)" : "transparent", border: "none", color: tasksView === v ? "#7DBA3D" : "rgba(255,255,255,0.4)", padding: "5px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "0.78rem", fontFamily: "inherit", fontWeight: tasksView === v ? "600" : "400" }}>
          {v === "mensal" ? "📅 Mês" : "📊 Trimestre"}
        </button>
      ))}
    </div>
  );

  // Resumos acumulados por mês (+LN, SKU/PDV): a tabela mensal quer um mês só —
  // o atual, ou o último importado se o atual ainda não tiver dado.
  const soMesVivo = (arr) => {
    const ms = [...new Set(arr.map((r) => String(r.mes_referencia || "").slice(0, 7)))].sort();
    const alvo = ms.includes(mesAtual) ? mesAtual : ms[ms.length - 1];
    return arr.filter((r) => String(r.mes_referencia || "").startsWith(alvo || ""));
  };

  function renderTabelaTasks(dados, kpiN, opts = {}) {
    const realField = opts.realField || "tasks_validas";
    const totalField = opts.totalField || "tasks_total";
    const uplift = opts.uplift ?? 1.10;
    const isPct = !!opts.pct; // KPI percentual (ex.: Digitalização = validadas/total)
    const unidade = opts.unidade || (isPct ? "tasks" : "tasks");
    const semDados = opts.semDados || "Importe o arquivo de tasks para calcular automaticamente.";
    if (!dados || dados.length === 0) return <p style={styles.msg}>{semDados}</p>;

    const thL = { ...rmTh, textAlign: "left" };
    const tdC = { ...rmTd };
    const tdL = { ...rmTd, textAlign: "left" };
    const pctOf = (v, b) => (b > 0 ? Math.round((v / b) * 1000) / 10 : 0);

    // ── TRIMESTRAL — agrega em Operação pelo spo_metas (meses do tri até o atual) ──
    if (tasksView === "trimestral") {
      const ini = spoCfg[String(kpiN)]?.inicio || INICIO_AVAL_KPI[kpiN] || MESES_TRI[0];
      const meses = MESES_TRI.filter((m) => ini <= m && m <= mesAtual);
      // % + mês atual: usa o valor AO VIVO (Σvalidadas/Σtotais do resumo); jul/ago ficam
      // como cadastrado na aba Metas SPO.
      const opTri = dados.find((x) => x.setor === "OPERACAO") || {};
      const liveTot = parseFloat(opTri[totalField] || 0);
      const liveOpPct = pctOf(parseFloat(opTri[realField] || 0), liveTot);
      const metaAtual = spoMetaTotal(kpiN);
      let metaTot = 0, realTot = 0, nMeta = 0, nReal = 0;
      for (const mes of meses) {
        const row = spoMetas.find((r) => String(r.item) === String(kpiN) && r.mes === mes);
        let metaV = (row?.meta !== "" && row?.meta != null) ? parseFloat(row.meta) : null;
        let realV = (row?.real !== "" && row?.real != null) ? parseFloat(row.real) : null;
        if (isPct && mes === mesAtual && liveTot > 0) {
          realV = liveOpPct;                       // setembro ao vivo
          if (metaV == null) metaV = metaAtual;    // meta do mês atual, se ainda não lançada
        }
        if (metaV != null) { metaTot += metaV; nMeta++; }
        if (realV != null) { realTot += realV; nReal++; }
      }
      const hasMeta = nMeta > 0, hasReal = nReal > 0;
      // % → média dos meses (aprox. da média ponderada do doc); absoluto → soma.
      const metaShow = !hasMeta ? null : (isPct ? Math.round((metaTot / nMeta) * 10) / 10 : metaTot);
      const realShow = !hasReal ? null : (isPct ? Math.round((realTot / nReal) * 10) / 10 : realTot);
      const ok = hasMeta && hasReal && realShow >= metaShow;
      const pct = (metaShow && !isPct) ? Math.round((realShow / metaShow) * 100) : null;
      return (
        <>
          {toggleTasksView}
          <p style={{ fontSize: "0.74rem", color: "rgba(255,255,255,0.4)", margin: "0 0 10px" }}>
            Trimestre: {isPct ? "média dos meses" : "soma"} — {isPct ? <><b>{fmtMes(mesAtual)} ao vivo</b> (validadas/total do resumo); os demais como cadastrado na aba <b>Metas SPO</b></> : <>soma dos meses fechados na aba <b>Metas SPO</b></>} ({meses.map(fmtMes).join(" · ") || "—"}). Consolidado em Operação.
          </p>
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr><th style={thL}>Nível</th><th style={rmTh}>{isPct ? "Realizado" : "Realizadas"}</th><th style={rmTh}>Progresso × Meta</th><th style={rmTh}>Meta</th><th style={rmTh}>%</th><th style={rmTh}>Status</th></tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <td style={{ ...tdL, fontWeight: "700", color: "#7DBA3D" }}>🏭 Operação (tri)</td>
                  <td style={{ ...tdC, fontWeight: "700" }}>{realShow == null ? "—" : (isPct ? `${realShow}%` : realShow)}</td>
                  <td style={{ ...tdC, minWidth: "140px" }}><BarraMeta real={realShow ?? 0} meta={metaShow ?? 0} /></td>
                  <td style={tdC}>{metaShow == null ? "—" : (isPct ? `${metaShow}%` : metaShow)}</td>
                  <td style={{ ...tdC, fontWeight: "700", color: ok ? "#4ade80" : "#f87171" }}>{isPct ? (realShow == null ? "—" : `${realShow}%`) : (pct == null ? "—" : `${pct}%`)}</td>
                  <td style={tdC}><span style={{ ...styles.statusTag, background: ok ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: ok ? "#4ade80" : "#f87171" }}>{ok ? "✅ OK" : "❌ NOK"}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      );
    }

    // ── MENSAL — uma linha por RN (ordem de setor) ──
    const opRow = dados.find((x) => x.setor === "OPERACAO") || {};
    const opTot = parseFloat(opRow[totalField] || 0);
    const mOp = spoMetaTotal(kpiN);
    const linhas = dados
      .filter((x) => x.setor !== "OPERACAO")
      .sort((a, b) => String(a.setor).localeCompare(String(b.setor), undefined, { numeric: true }));
    const opReal = parseFloat(opRow[realField] || 0);

    return (
      <>
        {toggleTasksView}
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr><th style={thL}>Setor</th><th style={rmTh}>Realizadas</th><th style={rmTh}>Progresso × Meta</th><th style={rmTh}>Meta</th><th style={rmTh}>%</th><th style={rmTh}>Status</th></tr>
            </thead>
            <tbody>
              {/* Operação (total do mês) */}
              {(() => {
                const opPct = pctOf(opReal, opTot);
                const opShow = isPct ? opPct : opReal;
                const opOk = mOp !== null ? opShow >= mOp : opRow.ok === "OK";
                return (
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", background: "rgba(125,186,61,0.05)" }}>
                    <td style={{ ...tdL, fontWeight: "700", color: "#7DBA3D" }}>🏭 Operação</td>
                    <td style={{ ...tdC, fontWeight: "700" }}>{isPct ? `${opPct}%` : opReal}<span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.72rem" }}>{isPct ? ` (${opReal}/${opTot})` : ""}</span></td>
                    <td style={{ ...tdC, minWidth: "140px" }}><BarraMeta real={opShow} meta={mOp ?? 0} /></td>
                    <td style={tdC}>{mOp !== null ? (isPct ? `${mOp}%` : mOp) : "—"}</td>
                    <td style={{ ...tdC, fontWeight: "700", color: opOk ? "#4ade80" : "#f87171" }}>{isPct ? `${opPct}%` : (mOp !== null && mOp > 0 ? `${Math.round(opReal / mOp * 100)}%` : "—")}</td>
                    <td style={tdC}><span style={{ ...styles.statusTag, background: opOk ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: opOk ? "#4ade80" : "#f87171" }}>{opOk ? "✅ OK" : "❌ NOK"}</span></td>
                  </tr>
                );
              })()}
              {linhas.map((r) => {
                const real = parseFloat(r[realField] || 0);
                const base = parseFloat(r[totalField] || 0);
                if (isPct) {
                  const pctRn = pctOf(real, base);
                  const ok = mOp !== null ? pctRn >= mOp : r.ok === "OK";
                  return (
                    <tr key={r.setor} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <td style={{ ...tdL, fontWeight: "600", color: "#fff" }}>{r.setor}</td>
                      <td style={tdC}>{pctRn}%<span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.72rem" }}> ({real}/{base})</span></td>
                      <td style={{ ...tdC, minWidth: "140px" }}><BarraMeta real={pctRn} meta={mOp ?? 0} /></td>
                      <td style={{ ...tdC, fontWeight: "700" }}>{mOp !== null ? `${mOp}%` : "—"}</td>
                      <td style={{ ...tdC, color: ok ? "#4ade80" : "#f87171" }}>{`${pctRn}%`}</td>
                      <td style={tdC}><span style={{ ...styles.statusTag, background: ok ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: ok ? "#4ade80" : "#f87171" }}>{ok ? "✅ OK" : "❌ NOK"}</span></td>
                    </tr>
                  );
                }
                const metaRN = (mOp !== null && opTot > 0) ? Math.ceil(base * (mOp / opTot) * uplift) : null;
                const ok = metaRN !== null ? real >= metaRN : r.ok === "OK";
                const pct = metaRN !== null && metaRN > 0 ? Math.round(real / metaRN * 100) : parseFloat(r.pct || 0);
                return (
                  <tr key={r.setor} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <td style={{ ...tdL, fontWeight: "600", color: "#fff" }}>{r.setor}</td>
                    <td style={tdC}>{real}<span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.72rem" }}> / {base} {unidade}</span></td>
                    <td style={{ ...tdC, minWidth: "140px" }}><BarraMeta real={real} meta={metaRN ?? 0} /></td>
                    <td style={{ ...tdC, fontWeight: "700" }}>{metaRN !== null ? metaRN : "—"}</td>
                    <td style={{ ...tdC, color: ok ? "#4ade80" : "#f87171" }}>{`${pct}%`}</td>
                    <td style={tdC}><span style={{ ...styles.statusTag, background: ok ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: ok ? "#4ade80" : "#f87171" }}>{ok ? "✅ OK" : "❌ NOK"}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {mOp === null && <p style={{ fontSize: "0.72rem", color: "#f5c451", marginTop: "8px" }}>⚠️ Sem meta de operação lançada para {fmtMes(mesAtual)} na aba Metas SPO — a linha de meta e o rateio por RN não aparecem até você lançar.</p>}
      </>
    );
  }

  // Tudo o que os blocos de KPI (Kpis*.jsx) usam do componente — montado a cada render.
  const spoCtx = {
    aba, alone, aloneDetalhe, aloneFiltroDia, aloneFiltroPDV, aloneFiltroRN, aloneView, ap, apDet,
    apFiltroGV, apFiltroStatus, apMes, coaching, coachingDet, cupons, cuponsDet, cuponsDia, cuponsGV,
    cuponsMarca, cuponsRN, desafios, diasRota, dto, dtoView, fmtMes, kpi11FiltroDia, kpi11FiltroRN,
    kpi12FiltroRN, kpi12SoFalha, kpiAtivo, lnRN, lnSoFalha, lojaFiltroDia, lojaFiltroRN,
    lojaFiltroStatus, lojaIdeal, lojaIdealDet, menu, mesAtual, pctOp, periodoCoaching, periodoDiasRota,
    politica, portFiltroDia, portFiltroGV, portFiltroRN, portFiltroStatus, portIdeal, portIdealDet,
    promo, promoBusca, promoDetalhe, promoFiltroDia, promoFiltroSetor, renderTabelaTasks, rgb, rgbInt,
    rgbLit, rotinaMais, rotinaMaisDet, scanFiltroDia, scanFiltroRN, scanFiltroStatus, scanntech,
    scanntechDet, score5, score5Det, semCoaching, setAloneFiltroDia, setAloneFiltroPDV, setAloneFiltroRN,
    setAloneView, setApFiltroGV, setApFiltroStatus, setApMes, setCuponsDia, setCuponsGV, setCuponsMarca,
    setCuponsRN, setDtoView, setKpi11FiltroDia, setKpi11FiltroRN, setKpi12FiltroRN, setKpi12SoFalha,
    setLnRN, setLnSoFalha, setLojaFiltroDia, setLojaFiltroRN, setLojaFiltroStatus, setPeriodoCoaching,
    setPeriodoDiasRota, setPortFiltroDia, setPortFiltroGV, setPortFiltroRN, setPortFiltroStatus,
    setPromoBusca, setPromoFiltroDia, setPromoFiltroSetor, setScanFiltroDia, setScanFiltroRN,
    setScanFiltroStatus, setSkuCat, setSkuRN, setSkuSoAbertas, skuCat, skuRN, skuSoAbertas, soMesVivo,
    spoMetaTotal, spoMetas, tasksCervZero, tasksCerveja, tasksCervejaDetalhe, tasksDigit, tasksLn,
    tasksLnDet, tasksMatch, tasksMktp, tasksNab, tasksSkuPdv, tasksSkuPdvDet, tasksVolume, totalMeta,
    totalVisitados
  };

  return (
    <div style={styles.root}>
      <style>{`
        @media (max-width: 768px) {
          .spo-layout { flex-direction: column !important; }
          .spo-col-left  { flex: 0 0 100% !important; width: 100%; order: 2; }
          .spo-col-right { flex: 0 0 100% !important; width: 100%; position: static !important; order: 1; }
          .spo-header { padding: 8px 12px !important; gap: 8px !important; }
          .spo-header h1 { font-size: 0.82rem !important; margin: 0 !important; }
          .spo-header p  { font-size: 0.65rem !important; margin: 0 !important; }
          .spo-kpi-grid { grid-template-columns: repeat(3, 1fr) !important; }
          .spo-backBtn { min-height: 36px !important; padding: 6px 10px !important; font-size: 0.78rem !important; }
          .spo-logoutBtn { min-height: 36px !important; padding: 6px 10px !important; font-size: 0.78rem !important; }
          .spo-painel-tr { cursor: pointer; }
        }
        @media (max-width: 420px) {
          .spo-kpi-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        /* Painel full-screen (lupa) */
        .spo-painel-fullscreen {
          position: fixed !important;
          top: 0 !important; left: 0 !important;
          width: 100vw !important; height: 100vh !important;
          z-index: 9999;
          background: #0c1410;
          overflow: auto;
          -webkit-overflow-scrolling: touch;
          padding: 0;
          border-radius: 0 !important;
          border: none !important;
        }
        /* Fallback iOS: rotaciona via CSS quando orientation lock não é suportado */
        @media (orientation: portrait) {
          .spo-painel-fullscreen {
            width: 100vh !important;
            height: 100vw !important;
            top: calc(50vh - 50vw) !important;
            left: calc(50vw - 50vh) !important;
            transform: rotate(90deg) !important;
            transform-origin: center center !important;
          }
        }
      `}</style>
      <div style={styles.header} className="spo-header">
        <div style={styles.headerLeft}>
          <button style={styles.backBtn} className="spo-backBtn" onClick={() => navigate("/")}>← Voltar</button>
          <div>
            <h1 style={styles.title}>📊 SPO — Excelência Operacional</h1>
            <p style={styles.subtitle}>Hop Follow-up</p>
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
            <span style={styles.scoreboardTitle}>Painel SPO — {totalPts} pontos</span>
            <span style={styles.scoreboardSub}>KPIs ativos em amarelo</span>
          </div>
          <div className="spo-kpi-grid" style={styles.kpiGrid}>
            {SPO_ITEMS.map((item) => {
              const triOk = kpiTriStatus[item.n];
              // Selecionado → borda amarela; bateu TRI → verde; não bateu → vermelho; sem dados → neutro
              const isSelected = kpiAtivo === item.n;
              const borderColor = isSelected
                ? "#7DBA3D"
                : triOk === true  ? "#4ade80"
                : triOk === false ? "#f87171"
                : item.ativo ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.06)";
              const borderWidth = isSelected || triOk !== null ? "2px" : "1px";
              const glow = isSelected
                ? "0 0 12px rgba(125,186,61,0.35)"
                : triOk === true
                  ? "0 0 6px #4ade80, 0 0 18px rgba(74,222,128,0.45), inset 0 0 6px rgba(74,222,128,0.08)"
                : triOk === false
                  ? "0 0 6px #f87171, 0 0 18px rgba(248,113,113,0.45), inset 0 0 6px rgba(248,113,113,0.08)"
                : "none";
              return (
                <div
                  key={item.n}
                  onClick={() => setKpiAtivo(kpiAtivo === item.n ? null : item.n)}
                  style={{
                    ...styles.kpiCard,
                    ...(item.ativo ? styles.kpiCardAtivo : {}),
                    border: `${borderWidth} solid ${borderColor}`,
                    boxShadow: glow,
                    cursor: "pointer",
                  }}
                >
                  <span style={styles.kpiN}>#{item.ord ?? item.n}</span>
                  <span style={styles.kpiLabel}>{item.label}</span>
                  <div style={styles.kpiPts}>
                    <span style={{ color: item.ativo ? "#7DBA3D" : "rgba(255,255,255,0.3)", fontWeight: "700" }}>{ptsDe(item.n)} pts</span>
                    <span style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.7rem" }}>{pesoDe(item.n)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Abas de visão — contextuais por KPI */}
        {(() => {
          let abasVisiveis = ["operacao"];
          if (mostra(kpiAtivo, 1)) abasVisiveis = ["operacao", "gv", "detalhe"];
          if (kpiAtivo === 2) abasVisiveis = ["detalhe_rn"];
          return (
            <div style={styles.abas}>
              {abasVisiveis.map((a) => (
                <button key={a} style={{ ...styles.abaBtn, ...(aba === a ? styles.abaBtnAtivo : {}) }} onClick={() => setAba(a)}>
                  {a === "operacao" ? "🏭 Operação" : a === "gv" ? "👥 Por GV" : a === "detalhe" ? "📋 Detalhe" : a === "detalhe_rn" ? "👤 Detalhado RN" : `⚠️ Sem Coaching${semCoaching.length > 0 ? ` (${semCoaching.length})` : ""}`}
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




            {/* Blocos de KPI — um arquivo por tema (Auditoria out/26: o arquivo tinha 2.754 linhas) */}
            <KpisVisitacao ctx={spoCtx} />
            <KpisExecucao ctx={spoCtx} />
            <KpisTasks ctx={spoCtx} />
            <KpisProgramas ctx={spoCtx} />
            {/* KPIs sem relatório automático (Academia, e os novos do Q4) — explica de onde vem o número */}
            {[10, 28, 29].includes(kpiAtivo) && (
              <div style={{ ...styles.section, border: "1px dashed rgba(245,196,81,0.4)", borderRadius: 12, padding: 16 }}>
                <h3 style={styles.sectionTitle}>📝 {SPO_ITEMS.find((k) => k.n === kpiAtivo)?.label}</h3>
                <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.85rem", margin: 0 }}>
                  Este KPI ainda não tem relatório automático na HOP: a <b>meta</b> e o <b>realizado</b> de cada mês são lançados em
                  <b> Admin › Metas SPO</b> e entram no Painel Consolidado.
                </p>
              </div>
            )}

            {/* POR GV */}
            {aba === "gv" && mostra(kpiAtivo, 1) && (
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>Item 1 — Visitação por GV</h3>
                <div style={styles.gvGrid}>
                  {resumo.map((r) => {
                    const pct = Math.round((parseInt(r.visitados) / parseInt(r.meta)) * 100);
                    const cor = pct >= 100 ? "#4ade80" : pct >= 70 ? "#7DBA3D" : "#f87171";
                    return (
                      <div key={r.gv} style={styles.gvCard}>
                        <div style={styles.gvHeader}>
                          <span style={styles.gvLabel}>GV {r.gv}</span>
                          <span style={{ color: cor, fontWeight: "700", fontSize: "1.1rem" }}>{pct}%</span>
                        </div>
                        <BarraProgresso pct={pct} cor={cor} />
                        <div style={styles.gvFooter}>
                          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.82rem" }}>{r.visitados} / {r.meta} PDVs</span>
                          <span style={{ color: "#7DBA3D", fontSize: "0.82rem", fontWeight: "600" }}>
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

            {/* DETALHE */}
            {aba === "detalhe" && mostra(kpiAtivo, 1) && (
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
          <div
            ref={painelRef} data-spo-painel
            className={painelFull ? "spo-painel-fullscreen" : ""}
            style={painelFull
              ? { padding: "0" }
              : { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "16px", overflowX: "auto" }
            }
          >
            {/* Header do painel: título + botão lupa/fechar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px",
              ...(painelFull ? { position: "sticky", top: 0, background: "#0c1410", padding: "12px 14px 8px", zIndex: 10, borderBottom: "1px solid rgba(255,255,255,0.08)" } : {}) }}>
              <p style={{ margin: 0, fontWeight: "700", fontSize: "0.98rem", color: "#7DBA3D" }}>📊 Painel SPO Consolidado</p>
              <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <FechamentoSpo alvoRef={painelRef} isAdmin={usuario?.perfil === "admin"} />
              <button data-sem-foto
                onClick={togglePainelFull}
                title={painelFull ? "Fechar" : "Expandir tabela"}
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: "8px", color: "#fff", padding: "5px 10px", cursor: "pointer", fontSize: "1rem", lineHeight: 1, fontFamily: "inherit", flexShrink: 0 }}
              >
                {painelFull ? "✕" : "🔍"}
              </button>
              </span>
            </div>
            {/* Wrapper de scroll da tabela */}
            <div style={painelFull ? { padding: "0 14px 14px", overflowX: "auto" } : {}}>
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
                            const MESES = MESES_TRI;
                            const MESES_LABEL = Object.fromEntries(MESES_TRI.map((m) => [m, ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"][Number(m.slice(5, 7)) - 1]]));
                            // Início do apontamento: usa o configurado no painel Metas
                            // (spo_kpi_config.inicio) com fallback no mapa padrão.
                            const INICIO_AVAL = {};
                            SPO_ITEMS.forEach(({ n }) => { INICIO_AVAL[n] = spoCfg[String(n)]?.inicio || INICIO_AVAL_KPI[n] || MESES_TRI[0]; });
              
                            const ITENS_SPO = SPO_KPIS_BASICO; // registro único (config/spoKpis.js)
              
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
                              // Mapa aba->array carregado, p/ o realizado genérico (KPIs simples via SPO_REAL)
                              const ABAS_REAL = {
                                spo_ap_resumo: ap, spo_politica_resumo: politica, spo_menu_resumo: menu,
                                spo_tasks_cerveja_resumo: tasksCerveja, spo_score5_resumo: score5,
                                spo_tasks_nab_resumo: tasksNab, spo_tasks_volume_resumo: tasksVolume,
                                spo_tasks_marketplace_resumo: tasksMktp, spo_tasks_match_resumo: tasksMatch,
                                spo_tasks_cerv_zero_resumo: tasksCervZero, spo_tasks_digit_resumo: tasksDigit,
                                spo_pedido_alone_resumo: alone, spo_rgb_total: rgb, spo_cupons_resumo: cupons,
                                spo_loja_ideal_resumo: lojaIdeal, spo_scanntech_resumo: scanntech,
                                spo_portfolio_ideal_resumo: portIdeal,
                                spo_rotina_mais_resumo: rotinaMais,
                                spo_tasks_ln_resumo: tasksLn,
                                spo_tasks_sku_pdv_resumo: tasksSkuPdv,
                              };

                              switch(n) {
                                case 1:  {
                                  // Filtra visitação pelo mês — evita exibir dados de mês anterior como "atual"
                                  const gvs = resumo.filter(r => r.gv && !isNaN(parseInt(r.gv)) && (r.mes_referencia||"").startsWith(mes));
                                  if (gvs.length === 0) return null;
                                  return gvs.reduce((s, r) => s + parseInt(r.visitados||0), 0);
                                }
                                case 2:  {
                                  const gvs = coaching.filter(r => r.gv && !isNaN(parseInt(r.gv)) && r.periodo === "mensal" && (r.mes_referencia||"").startsWith(mes));
                                  if (gvs.length === 0) return null;
                                  return gvs.reduce((s, r) => s + parseInt(r.coachings_validos||0), 0);
                                }
                                case 3:  {
                                  const gvs = diasRota.filter(r => r.gv && !isNaN(parseInt(r.gv)) && r.periodo === "mensal" && (r.mes_referencia||"").startsWith(mes));
                                  if (gvs.length === 0) return null;
                                  return gvs.reduce((s, r) => s + parseInt(r.dias_validos||0), 0);
                                }
                                case 4:  {
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
                                // case 5 (AP) agora é genérico via SPO_REAL (ver default)
                                case 6:  { const d = dto.find(x => (x.mes_referencia||"").startsWith(mes)); return d ? parseFloat(d.matinal_real || 0) + parseFloat(d.vespertina_real || 0) + parseFloat(d.coaching_real || 0) : null; }
                                // Todos os casos abaixo usam opMes (sem || op fallback) para garantir que
                                // apenas dados do mês exato apareçam — evita que dados de maio "vazem" para junho
                                case 7:  { const d = opMes(promo); if (!d) return null; const _vis = parseFloat(d.visitas||0); const _ac = parseFloat(d.acesso_promo||0); return _vis > 0 ? parseFloat((_ac / _vis * 100).toFixed(1)) : null; }
                                // KPIs simples (5,8,9,11-24): realizado vem do registro
                                // SPO_REAL servido pelo backend em /api/spo/config (spoReal).
                                default: {
                                  const rc = spoReal[n];
                                  if (!rc) return null;
                                  const arr = ABAS_REAL[rc.aba];
                                  if (!arr) return null; // aba ainda não mapeada no front → não quebra
                                  return realDaLinha(rc, opMes(arr));
                                }
                              }
                            };
                            const getReal = (n, mes) => getRealDados(n, mes);
              
                            // Busca pts do item no SPO_ITEMS (ITENS_SPO interno não tem pts)
                            const getPts = ptsDe; // pts da config editável (fallback no registro)

                            // Total de pontos por mês — soma pts de cada KPI que bateu a meta
                            const pontosMes = (mes) => ITENS_SPO.reduce((acc, item) => {
                              if (INICIO_AVAL[item.n] > mes) return acc;
                              const meta = getMeta(item.n, mes);
                              const real = getReal(item.n, mes);
                              if (meta === null || real === null) return acc;
                              return acc + (real >= meta ? getPts(item.n) : 0);
                            }, 0);
              
                            // mesAtual definido no escopo do componente

                            // TRI: acumula metas e reais dos meses disponíveis
                            // KPIs 1-7: particularidades pendentes — usa mesma lógica por ora
                            // Acumula só até o mês atual (Abr→só Abr, Mai→Abr+Mai, Jun→os 3)
                            const triAccumMeta = (n) => {
                              const meses = MESES.filter(m => INICIO_AVAL[n] <= m && m <= mesAtual);
                              let soma = 0, temDado = false;
                              for (const mes of meses) {
                                const v = getMeta(n, mes);
                                if (v !== null) { soma += v; temDado = true; }
                              }
                              return temDado ? parseFloat(soma.toFixed(1)) : null;
                            };
                            const triAccumReal = (n) => {
                              const meses = MESES.filter(m => INICIO_AVAL[n] <= m && m <= mesAtual);
                              let soma = 0, temDado = false;
                              for (const mes of meses) {
                                const v = getReal(n, mes);
                                if (v !== null) { soma += v; temDado = true; }
                              }
                              return temDado ? parseFloat(soma.toFixed(1)) : null;
                            };
                            const triBateu = (n) => {
                              const meta = triAccumMeta(n);
                              const real = triAccumReal(n);
                              if (meta === null || real === null) return null;
                              return real >= meta;
                            };

                            const thStyle = { padding: "6px 7px", color: "rgba(255,255,255,0.5)", fontSize: "0.76rem", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", whiteSpace: "nowrap" };
                            const thSubStyle = { padding: "4px 6px", color: "rgba(255,255,255,0.35)", fontSize: "0.7rem", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap" };
                            const tdStyle = { padding: "5px 6px", color: "rgba(255,255,255,0.6)", textAlign: "center", whiteSpace: "nowrap" };

                            return (
                              <div style={{ overflowX: "auto" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.83rem" }}>
                                  <thead>
                                    <tr>
                                      <th style={thStyle}>#</th>
                                      <th style={{ ...thStyle, textAlign: "left", minWidth: "140px" }}>Indicador</th>
                                      <th style={thStyle}>Início</th>
                                      {MESES.map(mes => (
                                        <th key={mes} colSpan={4} style={{ ...thStyle, background: mes === mesAtual ? "rgba(125,186,61,0.15)" : "rgba(255,255,255,0.04)", borderLeft: "1px solid rgba(255,255,255,0.1)" }}>
                                          {MESES_LABEL[mes]}
                                        </th>
                                      ))}
                                      <th colSpan={5} style={{ ...thStyle, background: "rgba(125,186,61,0.1)", borderLeft: "1px solid rgba(255,255,255,0.15)" }}>TRI</th>
                                    </tr>
                                    <tr>
                                      <th style={thSubStyle} colSpan={3}></th>
                                      {MESES.map(mes => (
                                        ["Meta","Real","% Ating","Pts"].map(h => (
                                          <th key={mes+h} style={{ ...thSubStyle, background: mes === mesAtual ? "rgba(125,186,61,0.08)" : "" }}>{h}</th>
                                        ))
                                      ))}
                                      {["Pts","Meta","Real","Pts SPO","% SPO"].map(h => <th key={"tri"+h} style={{ ...thSubStyle, background: "rgba(125,186,61,0.06)" }}>{h}</th>)}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {ITENS_SPO.map((item) => {
                                      const tOK     = triBateu(item.n);
                                      const tMeta   = triAccumMeta(item.n);
                                      const tReal   = triAccumReal(item.n);
                                      const tPts    = tOK !== null ? (tOK ? 3 : 0) : null;
                                      const tPtsSPO = tOK !== null ? (tOK ? getPts(item.n) : 0) : null;
                                      const tPctSPO = tOK !== null ? (tOK ? (getPts(item.n) / totalPts * 100).toFixed(1) + "%" : "0.0%") : null;
                                      const corTri  = tOK === true ? "#4ade80" : tOK === false ? "#f87171" : "rgba(255,255,255,0.25)";
                                      return (
                                        <tr key={item.n} className="spo-painel-tr" onClick={() => setKpiAtivo(kpiAtivo === item.n ? null : item.n)} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", ...(kpiAtivo === item.n ? { background: "rgba(125,186,61,0.08)", boxShadow: "inset 3px 0 0 #7DBA3D" } : {}) }}>
                                          <td style={tdStyle}>{item.ord ?? item.n}</td>
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
                                            const corAting = bateu ? "#4ade80" : (ating !== null && parseFloat(ating) >= 70) ? "#7DBA3D" : "#f87171";
                                            return [
                                              <td key={mes+"m"} style={tdStyle}>{meta !== null ? meta : <span style={{color:"rgba(255,255,255,0.2)"}}>—</span>}</td>,
                                              <td key={mes+"r"} style={tdStyle}>{real !== null ? real : <span style={{color:"rgba(255,255,255,0.2)"}}>—</span>}</td>,
                                              <td key={mes+"a"} style={{ ...tdStyle, color: ating !== null ? corAting : "rgba(255,255,255,0.2)", fontWeight: ating ? "600" : "400" }}>{ating !== null ? `${ating}%` : "—"}</td>,
                                              <td key={mes+"p"} style={{ ...tdStyle, color: pts > 0 ? "#4ade80" : pts === 0 ? "#f87171" : "rgba(255,255,255,0.2)", fontWeight: "700" }}>{pts !== null ? pts : "—"}</td>,
                                            ];
                                          })}
                                          {/* TRI: Pts | Meta | Real | Pts SPO | % SPO */}
                                          <td style={{ ...tdStyle, color: tPts !== null ? corTri : "rgba(255,255,255,0.2)", fontWeight: "700", background: "rgba(125,186,61,0.04)" }}>{tPts !== null ? tPts : <span style={{color:"rgba(255,255,255,0.2)"}}>—</span>}</td>
                                          <td style={{ ...tdStyle, color: "rgba(255,255,255,0.4)", background: "rgba(125,186,61,0.04)" }}>{tMeta}</td>
                                          <td style={{ ...tdStyle, color: corTri, fontWeight: "700", background: "rgba(125,186,61,0.04)" }}>{tReal !== null ? tReal : <span style={{color:"rgba(255,255,255,0.2)"}}>—</span>}</td>
                                          <td style={{ ...tdStyle, color: tPtsSPO !== null ? corTri : "rgba(255,255,255,0.2)", fontWeight: "700", background: "rgba(125,186,61,0.04)" }}>{tPtsSPO !== null ? tPtsSPO : <span style={{color:"rgba(255,255,255,0.2)"}}>—</span>}</td>
                                          <td style={{ ...tdStyle, color: tPctSPO !== null ? corTri : "rgba(255,255,255,0.2)", fontWeight: "600", background: "rgba(125,186,61,0.04)" }}>{tPctSPO ?? "—"}</td>
                                        </tr>
                                      );
                                    })}
                                    {/* Rodapé pontos */}
                                    <tr style={{ borderTop: "2px solid rgba(255,255,255,0.15)", background: "rgba(125,186,61,0.05)" }}>
                                      <td colSpan={3} style={{ ...tdStyle, color: "#7DBA3D", fontWeight: "700", textAlign: "left" }}>Total de Pontos</td>
                                      {MESES.map(mes => [
                                        <td key={mes+"tm"} style={tdStyle}></td>,
                                        <td key={mes+"tr"} style={tdStyle}></td>,
                                        <td key={mes+"ta"} style={tdStyle}></td>,
                                        <td key={mes+"tp"} style={{ ...tdStyle, color: "#7DBA3D", fontWeight: "700", fontSize: "0.9rem" }}>{pontosMes(mes)}</td>,
                                      ])}
                                      {/* TRI rodapé: Pts | Meta | Real | Pts SPO total | % SPO total */}
                                      <td style={{ ...tdStyle, background: "rgba(125,186,61,0.06)" }}></td>
                                      <td style={{ ...tdStyle, background: "rgba(125,186,61,0.06)" }}></td>
                                      <td style={{ ...tdStyle, background: "rgba(125,186,61,0.06)" }}></td>
                                      <td style={{ ...tdStyle, color: "#4ade80", fontWeight: "700", fontSize: "0.9rem", background: "rgba(125,186,61,0.06)" }}>
                                        {ITENS_SPO.reduce((acc, item) => acc + (triBateu(item.n) ? getPts(item.n) : 0), 0)}
                                      </td>
                                      <td style={{ ...tdStyle, color: "#4ade80", fontWeight: "700", fontSize: "0.9rem", background: "rgba(125,186,61,0.06)" }}>
                                        {(ITENS_SPO.reduce((acc, item) => acc + (triBateu(item.n) ? getPts(item.n) : 0), 0) / totalPts * 100).toFixed(1)}%
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
            </div>{/* fim wrapper scroll */}
          </div>
        </div>

        </div>{/* fim flex */}
      </div>
    </div>
  );
}
