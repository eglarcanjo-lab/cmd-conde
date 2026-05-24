import { useState, useEffect } from "react";
import api from "../../services/api";

const META_PONTOS = 100000;

const SETORES = [
  { cod: "101", nome: "João Victor",        tipo: "OFF" },
  { cod: "102", nome: "Eliel Lima",         tipo: "OFF" },
  { cod: "103", nome: "Bruno Leandro",      tipo: "OFF" },
  { cod: "104", nome: "Weferson Alexandre", tipo: "ON"  },
  { cod: "105", nome: "Iger Renan",         tipo: "ON"  },
  { cod: "106", nome: "Claudio Henrique",   tipo: "ON"  },
  { cod: "301", nome: "Luan Marques",       tipo: "ON"  },
  { cod: "302", nome: "Allan Fernando",     tipo: "ON"  },
  { cod: "303", nome: "Adriano Ferreira",   tipo: "ON"  },
  { cod: "304", nome: "Joicilene Alves",    tipo: "ON"  },
  { cod: "305", nome: "Manoel Roseno",      tipo: "ON"  },
];

const KPIS_AP = [
  { key: "tasks_compra",   label: "Tasks de Compra" },
  { key: "compradores",    label: "Compradores"     },
  { key: "rota_efetiva",   label: "Rota Efetiva"    },
  { key: "gps",            label: "GPS"             },
];

function pct(real, meta) {
  if (!meta || meta === 0) return 0;
  return Math.min((real / meta) * 100, 150);
}

// Garante que peso esteja em [0,100]. Se vier corrompido (>100), usa o fallback do regulamento.
function normPeso(val, fallback) {
  const v = parseFloat(val || 0);
  return (v > 0 && v <= 100) ? v : fallback;
}

// Pontos Bees: sem piso (paga de 0% a 150%)
// Resultados (volume/faturamento): piso 70% — abaixo não paga
function calcRv(real, meta, peso, poTotal, apOk, minPct = 70) {
  if (!apOk || !meta) return 0;
  const p = pct(real, meta);
  if (p < minPct) return 0;
  return (poTotal * peso / 100) * (p / 100);
}

function calcRvPot(real, meta, peso, poTotal, minPct = 70) {
  if (!meta) return 0;
  const p = pct(real, meta);
  if (p < minPct) return 0;
  return (poTotal * peso / 100) * (p / 100);
}

function fmtBrl(v) {
  return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtNum(v, dec = 1) {
  return Number(v).toLocaleString("pt-BR", { maximumFractionDigits: dec });
}

function BarRow({ label, real, meta, peso, poTotal, apOk, minPct = 70 }) {
  const p      = pct(real, meta);
  const cor    = p >= 100 ? "#4ade80" : p >= 70 ? "#fbb900" : "#f87171";
  const val    = calcRv(real, meta, peso, poTotal, apOk, minPct);
  const valPot = calcRvPot(real, meta, peso, poTotal, minPct);
  return (
    <div style={s.barRow}>
      <div style={s.barRowTop}>
        <span style={s.barLabel}>{label}</span>
        <span style={{ ...s.barPeso, color: cor }}>{p.toFixed(1)}% · <span style={s.barPesoSub}>{peso}% PO</span></span>
      </div>
      <div style={s.barTrack}>
        <div style={{ ...s.barFill, width: `${Math.min(p, 100)}%`, background: cor }} />
        <div style={s.barMark} />
      </div>
      <div style={s.barRowBot}>
        <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.76rem" }}>
          {fmtNum(real, 2)} / {fmtNum(meta, 2)}
        </span>
        <span style={{ color: apOk ? cor : "#fbb900", fontWeight: "600", fontSize: "0.82rem" }}>
          {apOk ? `R$ ${fmtBrl(val)}` : `⚠️ R$ ${fmtBrl(valPot)}`}
        </span>
      </div>
    </div>
  );
}

export default function RvSimulador() {
  const [mesRef, setMesRef] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [setorSel, setSetorSel] = useState("101");
  const [rvData,   setRvData]   = useState([]);
  const [pontosData, setPontosData] = useState([]);
  const [apData,   setApData]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [recalc,   setRecalc]   = useState(false);
  const [msg,      setMsg]      = useState("");

  useEffect(() => { carregar(); }, [mesRef]);

  async function carregar() {
    setLoading(true);
    try {
      const [r1, r2, r3] = await Promise.all([
        api.get("/api/rv"),
        api.get("/api/rv/pontos"),
        api.get(`/api/rv/ap?mes=${mesRef}`),
      ]);
      setRvData(r1.data || []);
      setPontosData(r2.data || []);
      setApData(r3.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function recalcular() {
    setRecalc(true);
    setMsg("");
    try {
      await api.post("/api/rv/calcular");
      setMsg("✅ RV recalculada!");
      await carregar();
    } catch { setMsg("❌ Erro ao recalcular."); }
    finally {
      setRecalc(false);
      setTimeout(() => setMsg(""), 3000);
    }
  }

  // ── helpers ───────────────────────────────────────────────────────────────
  function getRv(cod)     { return rvData.find(r => r.setor === cod) || null; }
  function getPontos(cod) { return pontosData.find(r => r.setor === cod) || null; }
  function getAp(cod)     { return apData.find(r => r.setor === cod) || null; }

  function computeTotals(cod) {
    const rv     = getRv(cod);
    const pontos = getPontos(cod);
    const ap     = getAp(cod);
    const seg    = SETORES.find(s => s.cod === cod)?.tipo || "ON";

    const apOk    = ap?.ap_ok === "OK";
    const poTotal = parseFloat(rv?.po_total || 1000);

    const pontosReal = parseFloat(pontos?.pontos_real || 0);
    const pesoPontos = normPeso(rv?.peso_pontos, 50);
    const pctPts = Math.min(pontosReal / META_PONTOS * 100, 150);
    const rvPontos = apOk && pctPts >= 70 ? (poTotal * pesoPontos / 100) * (pctPts / 100) : 0;

    const realCerv   = parseFloat(rv?.real_cerveja  || 0);
    const metaCerv   = parseFloat(rv?.meta_cerveja  || 0);
    const pesoCerv   = normPeso(rv?.peso_cerveja, 25);

    const realNab    = parseFloat(rv?.real_nab   || 0);
    const metaNab    = parseFloat(rv?.meta_nab   || 0);
    const pesoNab    = normPeso(rv?.peso_nab, 15);

    const realVar    = seg === "OFF"
      ? parseFloat(rv?.real_match  || 0)
      : parseFloat(rv?.real_marketplace  || 0);
    const metaVar    = seg === "OFF"
      ? parseFloat(rv?.meta_match  || 0)
      : parseFloat(rv?.meta_marketplace  || 0);
    const pesoVar    = seg === "OFF"
      ? normPeso(rv?.peso_match, 10)
      : normPeso(rv?.peso_marketplace, 10);
    const varLabel   = seg === "OFF" ? "Match" : "Marketplace";

    const rvCerv = calcRv(realCerv, metaCerv, pesoCerv, poTotal, apOk);
    const rvNab  = calcRv(realNab,  metaNab,  pesoNab,  poTotal, apOk);
    const rvVar  = calcRv(realVar,  metaVar,  pesoVar,  poTotal, apOk);
    // Pontos Bees não tem mínimo — paga proporcional a partir de 0%
    // (regra do regulamento: "0% - 150%" no range de Meios)
    const total  = rvPontos + rvCerv + rvNab + rvVar;

    // Potencial (como se AP fosse OK) — exibido em amarelo quando bloqueado
    const rvPontsPot = pctPts >= 70 ? (poTotal * pesoPontos / 100) * (pctPts / 100) : 0;
    const rvCervPot  = calcRvPot(realCerv, metaCerv, pesoCerv, poTotal);
    const rvNabPot   = calcRvPot(realNab,  metaNab,  pesoNab,  poTotal);
    const rvVarPot   = calcRvPot(realVar,  metaVar,  pesoVar,  poTotal);
    const totalPot   = rvPontsPot + rvCervPot + rvNabPot + rvVarPot;

    return {
      apOk, poTotal, seg, varLabel,
      pontosReal, pesoPontos, pctPontos: pct(pontosReal, META_PONTOS), rvPontos,
      realCerv, metaCerv, pesoCerv, rvCerv,
      realNab,  metaNab,  pesoNab,  rvNab,
      realVar,  metaVar,  pesoVar,  rvVar,
      total, totalPot,
    };
  }

  const sel  = SETORES.find(s => s.cod === setorSel);
  const tot  = computeTotals(setorSel);
  const apSel = getAp(setorSel);

  // ── totalizador (todas as RNs) ────────────────────────────────────────────
  const linhas = SETORES.map(s => ({ ...s, ...computeTotals(s.cod) }));
  const somaTotal    = linhas.reduce((acc, l) => acc + l.total, 0);
  const somaPotencial = linhas.reduce((acc, l) => acc + (l.apOk ? l.total : l.totalPot), 0);

  return (
    <div>
      {/* Toolbar */}
      <div style={s.toolbar}>
        <div>
          <h3 style={s.title}>💰 Simulador RV</h3>
          <p style={s.desc}>Visualize e confira a RV de qualquer RN sem sair do painel admin.</p>
        </div>
        <div style={s.toolbarRight}>
          <input type="month" style={s.inputMes} value={mesRef} onChange={e => setMesRef(e.target.value)} />
          <button style={{ ...s.btnCalc, opacity: recalc ? 0.7 : 1 }} onClick={recalcular} disabled={recalc}>
            {recalc ? "Recalculando..." : "🔄 Recalcular RV"}
          </button>
        </div>
      </div>
      {msg && <p style={{ color: msg.startsWith("✅") ? "#4ade80" : "#f87171", fontSize: "0.85rem", marginBottom: "12px" }}>{msg}</p>}

      {loading ? <p style={s.msgLoad}>Carregando...</p> : (
        <>
          {/* ── Seletor de RN ─────────────────────────────────────────── */}
          <div style={s.seletorWrap}>
            {SETORES.map(s2 => {
              const t = computeTotals(s2.cod);
              const ativo = s2.cod === setorSel;
              return (
                <button
                  key={s2.cod}
                  style={{
                    ...s.rnBtn,
                    ...(ativo ? s.rnBtnAtivo : {}),
                    borderColor: t.apOk ? "rgba(74,222,128,0.3)" : "rgba(248,113,113,0.3)",
                  }}
                  onClick={() => setSetorSel(s2.cod)}
                >
                  <span style={s.rnCod}>{s2.cod}</span>
                  <span style={s.rnNome}>{s2.nome.split(" ")[0]}</span>
                  <span style={{ ...s.rnTipo, color: s2.tipo === "OFF" ? "#60a5fa" : "#4ade80" }}>{s2.tipo}</span>
                  <span style={{
                    ...s.rnAp,
                    color: t.apOk ? "#4ade80" : "#f87171",
                  }}>{t.apOk ? "✅" : "❌"}</span>
                  <span style={{ color: t.apOk ? "#fbb900" : "#fbb900", fontSize: "0.7rem", fontWeight: "700" }}>
                    {t.apOk ? "" : "⚠️ "}R$ {fmtBrl(t.apOk ? t.total : t.totalPot)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── Detalhe do RN selecionado ─────────────────────────────── */}
          <div style={s.detalhe}>
            <div style={s.detalheHeader}>
              <div>
                <span style={s.detalheCod}>{sel?.cod}</span>
                <span style={s.detalheNome}>{sel?.nome}</span>
                <span style={{ ...s.detalheTipo, color: sel?.tipo === "OFF" ? "#60a5fa" : "#4ade80" }}>{sel?.tipo}</span>
              </div>
              <div style={s.apBadge(tot.apOk)}>
                {tot.apOk ? "✅ AP OK — RV Liberada" : "❌ AP NOK — RV Bloqueada"}
              </div>
            </div>

            {/* AP KPIs */}
            <div style={s.apGrid}>
              {KPIS_AP.map(kpi => {
                const real = parseFloat(apSel?.[`${kpi.key}_real`] || 0);
                const meta = parseFloat(apSel?.[`${kpi.key}_meta`] || 0);
                const ok   = meta > 0 && real >= meta;
                return (
                  <div key={kpi.key} style={{ ...s.apKpi, borderColor: ok ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)" }}>
                    <span style={s.apKpiLabel}>{kpi.label}</span>
                    <span style={{ fontSize: "1.2rem", fontWeight: "700", color: ok ? "#4ade80" : "#f87171" }}>
                      {real.toFixed(1)}%
                    </span>
                    <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.7rem" }}>meta: {meta.toFixed(1)}%</span>
                    <span>{ok ? "✅" : "❌"}</span>
                  </div>
                );
              })}
            </div>

            {/* RV Total */}
            <div style={s.totalCard}>
              <div>
                <p style={s.totalLabel}>Estimativa RV — {mesRef}</p>
                <p style={{ ...s.totalValor, color: tot.apOk ? "#4ade80" : "#fbb900" }}>
                  R$ {fmtBrl(tot.apOk ? tot.total : tot.totalPot)}
                </p>
                {!tot.apOk && (
                  <p style={{ margin: "0 0 2px", color: "#f87171", fontSize: "0.72rem", fontWeight: "600" }}>
                    ⚠️ potencial — bloqueado por AP NOK
                  </p>
                )}
                <p style={s.totalSub}>de R$ {fmtBrl(tot.poTotal)} possíveis (100% PO)</p>
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ ...s.totalPct, color: tot.apOk ? "#fbb900" : "#fbb900" }}>
                  {tot.poTotal > 0 ? (((tot.apOk ? tot.total : tot.totalPot) / tot.poTotal) * 100).toFixed(1) : "0"}%
                </p>
                <p style={s.totalPctLabel}>{tot.apOk ? "do PO" : "potencial"}</p>
              </div>
            </div>

            {/* Indicadores */}
            <div style={s.barsWrap}>
              <BarRow
                label={`⭐ Pontos Bees`}
                real={tot.pontosReal} meta={META_PONTOS}
                peso={tot.pesoPontos} poTotal={tot.poTotal} apOk={tot.apOk}
              />
              <BarRow
                label="🍺 Cerveja (Volume HL)"
                real={tot.realCerv} meta={tot.metaCerv}
                peso={tot.pesoCerv} poTotal={tot.poTotal} apOk={tot.apOk}
              />
              <BarRow
                label="🥤 NAB (Volume HL)"
                real={tot.realNab} meta={tot.metaNab}
                peso={tot.pesoNab} poTotal={tot.poTotal} apOk={tot.apOk}
              />
              <BarRow
                label={`${tot.varLabel === "Match" ? "🤝" : "🛒"} ${tot.varLabel} (${tot.varLabel === "Match" ? "Vol HL" : "GMV R$"})`}
                real={tot.realVar} meta={tot.metaVar}
                peso={tot.pesoVar} poTotal={tot.poTotal} apOk={tot.apOk}
              />
            </div>
          </div>

          {/* ── Totalizador ───────────────────────────────────────────── */}
          <div style={s.section}>
            <div style={s.sectionHeader}>
              <h3 style={s.sectionTitle}>📊 Totalizador — Todos os RNs</h3>
              <span style={s.somaChip}>
                Confirmado: <strong>R$ {fmtBrl(somaTotal)}</strong>
                &nbsp;·&nbsp;
                <span style={{ color: "#fbb900" }}>⚠️ Potencial: <strong>R$ {fmtBrl(somaPotencial)}</strong></span>
              </span>
            </div>
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    {["RN","Nome","Seg","AP","Pts %","Cerv %","NAB %","Var %","RV Est.","% PO"].map(h => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {linhas
                    .slice()
                    .sort((a, b) => b.total - a.total)
                    .map(l => {
                      const pPts  = l.pctPontos;
                      const pCerv = pct(l.realCerv, l.metaCerv);
                      const pNab  = pct(l.realNab,  l.metaNab);
                      const pVar  = pct(l.realVar,  l.metaVar);
                      const ppPO  = l.poTotal > 0 ? (l.total / l.poTotal * 100) : 0;
                      const cor = (v) => v >= 100 ? "#4ade80" : v >= 70 ? "#fbb900" : "#f87171";
                      return (
                        <tr
                          key={l.cod}
                          style={{ ...s.tr, cursor: "pointer", background: l.cod === setorSel ? "rgba(251,185,0,0.06)" : "" }}
                          onClick={() => setSetorSel(l.cod)}
                        >
                          <td style={s.td}><span style={s.codBadge}>{l.cod}</span></td>
                          <td style={{ ...s.td, textAlign: "left", fontSize: "0.8rem" }}>{l.nome}</td>
                          <td style={s.td}><span style={{ color: l.tipo === "OFF" ? "#60a5fa" : "#4ade80", fontSize: "0.75rem", fontWeight: "600" }}>{l.tipo}</span></td>
                          <td style={s.td}><span style={{ color: l.apOk ? "#4ade80" : "#f87171", fontWeight: "700" }}>{l.apOk ? "✅" : "❌"}</span></td>
                          <td style={{ ...s.td, color: cor(pPts),  fontWeight: "600" }}>{pPts.toFixed(0)}%</td>
                          <td style={{ ...s.td, color: cor(pCerv), fontWeight: "600" }}>{pCerv.toFixed(0)}%</td>
                          <td style={{ ...s.td, color: cor(pNab),  fontWeight: "600" }}>{pNab.toFixed(0)}%</td>
                          <td style={{ ...s.td, color: cor(pVar),  fontWeight: "600" }}>{pVar.toFixed(0)}%</td>
                          <td style={{ ...s.td, color: "#fbb900", fontWeight: "700" }}>
                            {!l.apOk && <span style={{ fontSize: "0.65rem", marginRight: "2px" }}>⚠️</span>}
                            R$ {fmtBrl(l.apOk ? l.total : l.totalPot)}
                          </td>
                          <td style={{ ...s.td, color: ppPO >= 100 ? "#4ade80" : ppPO >= 70 ? "#fbb900" : "#f87171", fontWeight: "600" }}>
                            {ppPO.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={8} style={{ ...s.td, textAlign: "right", color: "rgba(255,255,255,0.4)", fontSize: "0.8rem", fontWeight: "600", paddingRight: "12px" }}>
                      TOTAL EQUIPE
                    </td>
                    <td style={{ ...s.td, color: "#fbb900", fontWeight: "800", fontSize: "0.95rem" }}>
                      R$ {fmtBrl(somaTotal)}
                    </td>
                    <td style={s.td} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  toolbar: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", flexWrap: "wrap", gap: "12px" },
  toolbarRight: { display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" },
  title: { margin: "0 0 4px", fontSize: "1rem", fontWeight: "600" },
  desc: { margin: 0, color: "rgba(255,255,255,0.4)", fontSize: "0.82rem" },
  inputMes: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff", padding: "8px 12px", fontSize: "0.85rem", fontFamily: "inherit", outline: "none" },
  btnCalc: { background: "linear-gradient(135deg, #fbb900, #e6a200)", color: "#0a0f1e", border: "none", borderRadius: "8px", padding: "8px 18px", fontWeight: "700", cursor: "pointer", fontSize: "0.85rem", fontFamily: "inherit" },
  msgLoad: { color: "rgba(255,255,255,0.35)", textAlign: "center", padding: "60px" },

  // Seletor de RN
  seletorWrap: { display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "20px" },
  rnBtn: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", padding: "8px 12px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", minWidth: "80px", transition: "all 0.15s", fontFamily: "inherit" },
  rnBtnAtivo: { background: "rgba(251,185,0,0.1)", border: "1px solid rgba(251,185,0,0.4)" },
  rnCod: { color: "#fbb900", fontSize: "0.85rem", fontWeight: "700" },
  rnNome: { color: "rgba(255,255,255,0.6)", fontSize: "0.7rem" },
  rnTipo: { fontSize: "0.65rem", fontWeight: "600" },
  rnAp: { fontSize: "0.9rem" },

  // Detalhe
  detalhe: { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "20px", marginBottom: "20px" },
  detalheHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" },
  detalheCod: { background: "rgba(251,185,0,0.12)", color: "#fbb900", padding: "3px 10px", borderRadius: "6px", fontSize: "0.85rem", fontWeight: "700", marginRight: "8px" },
  detalheNome: { color: "#fff", fontSize: "1rem", fontWeight: "600", marginRight: "8px" },
  detalheTipo: { fontSize: "0.8rem", fontWeight: "600" },
  apBadge: (ok) => ({ padding: "5px 14px", borderRadius: "20px", fontSize: "0.82rem", fontWeight: "700", background: ok ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: ok ? "#4ade80" : "#f87171" }),

  apGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "8px", marginBottom: "16px" },
  apKpi: { background: "rgba(255,255,255,0.04)", border: "1px solid", borderRadius: "10px", padding: "10px 12px", display: "flex", flexDirection: "column", gap: "3px", alignItems: "center" },
  apKpiLabel: { color: "rgba(255,255,255,0.5)", fontSize: "0.72rem", textAlign: "center" },

  totalCard: { background: "linear-gradient(135deg, rgba(251,185,0,0.08), rgba(251,185,0,0.03))", border: "1px solid rgba(251,185,0,0.2)", borderRadius: "12px", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" },
  totalLabel: { margin: "0 0 4px", color: "rgba(255,255,255,0.5)", fontSize: "0.78rem" },
  totalValor: { margin: "0 0 4px", fontSize: "1.8rem", fontWeight: "800" },
  totalSub: { margin: 0, color: "rgba(255,255,255,0.3)", fontSize: "0.74rem" },
  totalPct: { margin: 0, fontSize: "2.2rem", fontWeight: "800", color: "#fbb900" },
  totalPctLabel: { margin: 0, color: "rgba(255,255,255,0.4)", fontSize: "0.76rem" },

  barsWrap: { display: "flex", flexDirection: "column", gap: "10px" },
  barRow: { background: "rgba(255,255,255,0.03)", borderRadius: "8px", padding: "12px 14px", display: "flex", flexDirection: "column", gap: "6px" },
  barRowTop: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  barLabel: { color: "rgba(255,255,255,0.75)", fontSize: "0.84rem", fontWeight: "500" },
  barPeso: { fontSize: "0.8rem", fontWeight: "700" },
  barPesoSub: { color: "rgba(255,255,255,0.35)", fontWeight: "400", fontSize: "0.74rem" },
  barTrack: { height: "7px", background: "rgba(255,255,255,0.08)", borderRadius: "4px", overflow: "visible", position: "relative" },
  barFill: { height: "100%", borderRadius: "4px", transition: "width 0.4s" },
  barMark: { position: "absolute", left: "70%", top: "-3px", width: "2px", height: "13px", background: "rgba(255,255,255,0.25)", borderRadius: "1px" },
  barRowBot: { display: "flex", justifyContent: "space-between", alignItems: "center" },

  // Totalizador
  section: { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "20px" },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "8px" },
  sectionTitle: { margin: 0, fontSize: "0.95rem", fontWeight: "600" },
  somaChip: { background: "rgba(251,185,0,0.1)", color: "#fbb900", padding: "4px 12px", borderRadius: "20px", fontSize: "0.82rem" },
  tableWrap: { overflowX: "auto", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.45)", fontSize: "0.68rem", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.04em", padding: "8px 10px", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.06)", whiteSpace: "nowrap" },
  tr: { borderBottom: "1px solid rgba(255,255,255,0.04)" },
  td: { padding: "8px 10px", color: "rgba(255,255,255,0.8)", fontSize: "0.82rem", textAlign: "center" },
  codBadge: { background: "rgba(251,185,0,0.12)", color: "#fbb900", padding: "2px 7px", borderRadius: "5px", fontSize: "0.72rem", fontWeight: "700" },
};
