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
  { n: 5,  label: "Atendimento Produtivo",              pts: 14, peso: 7.8,  ativo: false },
  // v3.2 politica fix 00:29:07
  { n: 6,  label: "DTO GC",                             pts: 6,  peso: 3.3,  ativo: true },
  { n: 7,  label: "% PDVs abrindo Promoção no BEES",   pts: 10, peso: 5.6,  ativo: true },
  { n: 8,  label: "Aderência de Política Comercial",    pts: 8,  peso: 4.4,  ativo: true },
  { n: 9,  label: "Execução Menu de Cerveja",           pts: 10, peso: 5.6,  ativo: false },
  { n: 10, label: "Academia Bees RN",                   pts: 14, peso: 7.8,  ativo: false },
  { n: 11, label: "Tasks Cerveja TT (Portfolio)",       pts: 10, peso: 5.6,  ativo: false },
  { n: 12, label: "Tasks Faturamento Score 5",          pts: 6,  peso: 3.3,  ativo: false },
  { n: 13, label: "Tasks NAB TT (Portfolio)",           pts: 10, peso: 5.6,  ativo: false },
  { n: 14, label: "Tasks de Volume",                    pts: 6,  peso: 3.3,  ativo: false },
  { n: 15, label: "Tasks de Marketplace",               pts: 8,  peso: 4.4,  ativo: false },
  { n: 16, label: "Tasks de Match (Portfolio)",         pts: 8,  peso: 4.4,  ativo: false },
  { n: 17, label: "Tasks Cerveja Zero (Portfolio)",     pts: 6,  peso: 3.3,  ativo: false },
  { n: 18, label: "Tarefa de Digitalização",            pts: 4,  peso: 2.2,  ativo: false },
  { n: 19, label: "PDVs com Compra Independente",       pts: 4,  peso: 2.2,  ativo: false },
  { n: 20, label: "+RGB",                               pts: 6,  peso: 3.3,  ativo: false },
  { n: 21, label: "Cupons Digitais - Score 5",          pts: 6,  peso: 3.3,  ativo: false },
  { n: 22, label: "% Lojas Ideais",                     pts: 4,  peso: 2.2,  ativo: false },
  { n: 23, label: "Expansão Scanntech",                 pts: 2,  peso: 1.1,  ativo: false },
  { n: 24, label: "Portfólio Ideal Score 5",            pts: 8,  peso: 4.4,  ativo: false },
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
  const [busca, setBusca] = useState("");
  const [filtroGv, setFiltroGv] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroDia, setFiltroDia] = useState("todos");

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setLoading(true);
    try {
      const [resResumo, resDetalhe, resCoaching, resSemCoaching, resDiasRota, resDesafios, resDto, resPromo, resPromoDetalhe, resPolitica] = await Promise.all([
        api.get("/api/spo/visitacao-gv/resumo"),
        api.get("/api/spo/visitacao-gv/detalhe"),
        api.get("/api/spo/coaching/resumo"),
        api.get("/api/spo/coaching/sem-coaching"),
        api.get("/api/spo/dias-rota/resumo"),
        api.get(`/api/spo/desafios?mes=${new Date().toISOString().slice(0,7)}`),
        api.get("/api/spo/dto"),
        api.get("/api/spo/promo/resumo"),
        api.get("/api/spo/promo/detalhe"),
        api.get("/api/spo/politica-comercial/resumo"),
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
        {/* Scoreboard dos 24 KPIs */}
        <div style={styles.scoreboard}>
          <div style={styles.scoreboardHeader}>
            <span style={styles.scoreboardTitle}>Painel SPO — {TOTAL_PTS} pontos</span>
            <span style={styles.scoreboardSub}>KPIs ativos em amarelo</span>
          </div>
          <div style={styles.kpiGrid}>
            {SPO_ITEMS.map((item) => (
              <div key={item.n} style={{ ...styles.kpiCard, ...(item.ativo ? styles.kpiCardAtivo : {}) }}>
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
