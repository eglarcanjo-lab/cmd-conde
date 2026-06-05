import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";

const META_PONTOS = 100000;

// Pesos oficiais do regulamento (% do PO), fixos por segmento.
// OFF (AS/Rota/Sub) tem Marketplace 7,5% E Match 5%; ON (On Trade) só Marketplace 10%.
const PESOS = {
  OFF: { pontos: 50, cerveja: 25, nab: 12.5, marketplace: 7.5, match: 5 },
  ON:  { pontos: 50, cerveja: 25, nab: 15,   marketplace: 10,  match: 0 },
};

const KPIS_AP = [
  { key: "tasks_compra", label: "Tasks de Compra" },
  { key: "compradores", label: "Compradores" },
  { key: "rota_efetiva", label: "Rota Efetiva" },
  { key: "gps", label: "GPS" },
];

function BarIndicador({ label, real, meta, peso, po_total, bloqueado, minPct = 70 }) {
  const pct     = meta > 0 ? Math.min((real / meta) * 100, 150) : 0;
  const cor     = pct >= 100 ? "#4ade80" : pct >= 70 ? "#7DBA3D" : "#f87171";
  const base    = meta > 0 && pct >= minPct ? (po_total * (peso / 100)) * (pct / 100) : 0;
  const valReal = bloqueado ? 0 : base;
  const valPot  = base;

  return (
    <div style={styles.barCard}>
      <div style={styles.barHeader}>
        <span style={styles.barLabel}>{label}</span>
        <span style={styles.barPeso}>{peso}% do PO</span>
      </div>
      <div style={styles.barTrack}>
        <div style={{ ...styles.barFill, width: `${Math.min(pct, 100)}%`, background: cor }} />
        <div style={styles.barMark70} title="Mínimo 70%"/>
      </div>
      <div style={styles.barFooter}>
        <span style={{ color: cor, fontWeight: "700" }}>{pct.toFixed(1)}%</span>
        <span style={styles.barReal}>
          {Number(real).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} /&nbsp;
          {Number(meta).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
        </span>
        <span style={{ color: bloqueado ? "#7DBA3D" : cor, fontWeight: "600", fontSize: "0.82rem" }}>
          {bloqueado
            ? `⚠️ R$ ${valPot.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : `R$ ${valReal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        </span>
      </div>
    </div>
  );
}

export default function RV() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const [rv, setRv] = useState(null);
  const [pontos, setPontos] = useState(null);
  const [ap, setAp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mesRef, setMesRef] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  useEffect(() => { carregar(); }, [mesRef]);

  async function carregar() {
    setLoading(true);
    try {
      const [resRv, resPontos, resAp] = await Promise.all([
        api.get("/api/rv"),
        api.get("/api/rv/pontos"),
        api.get(`/api/rv/ap?mes=${mesRef}`),
      ]);
      const setor = usuario?.cod;
      setRv((resRv.data || []).find((r) => r.setor === setor) || null);
      setPontos((resPontos.data || []).find((r) => r.setor === setor) || null);
      setAp((resAp.data || []).find((r) => r.setor === setor) || null);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  const apOk = ap?.ap_ok === "OK";
  const poTotal = parseFloat(rv?.po_total || 1000);
  const segmento = rv?.segmento || (["101","102","103"].includes(usuario?.cod) ? "OFF" : "ON");
  const w = PESOS[segmento] || PESOS.ON;

  const pctPontos = pontos ? Math.min((parseFloat(pontos.pontos_real || 0) / META_PONTOS) * 100, 150) : 0;
  const pesoPontos = w.pontos;
  const rvPontos    = apOk && pctPontos >= 70 ? (poTotal * pesoPontos / 100) * (pctPontos / 100) : 0;
  const rvPontosPot = pctPontos >= 70 ? (poTotal * pesoPontos / 100) * (pctPontos / 100) : 0;

  // Pontos Bees: sem piso (paga de 0%), Resultados: piso 70%
  const calcRv = (real, meta, peso, minPct = 70) => {
    if (!apOk || !meta) return 0;
    const p = Math.min((real / meta) * 100, 150);
    if (p < minPct) return 0;
    return (poTotal * peso / 100) * (p / 100);
  };
  const calcPot = (real, meta, peso, minPct = 70) => {
    if (!meta) return 0;
    const p = Math.min((real / meta) * 100, 150);
    if (p < minPct) return 0;
    return (poTotal * peso / 100) * (p / 100);
  };

  // Indicadores de resultado com peso > 0 (OFF: Cerveja+NAB+Mktp+Match; ON: Cerveja+NAB+Mktp)
  const indicadoresRV = [
    { key: "cerveja",     label: "Cerveja (Volume HL)",   peso: w.cerveja,     real: parseFloat(rv?.real_cerveja || 0),     meta: parseFloat(rv?.meta_cerveja || 0) },
    { key: "nab",         label: "NAB (Volume HL)",       peso: w.nab,         real: parseFloat(rv?.real_nab || 0),         meta: parseFloat(rv?.meta_nab || 0) },
    { key: "marketplace", label: "Marketplace (GMV R$)",  peso: w.marketplace, real: parseFloat(rv?.real_marketplace || 0), meta: parseFloat(rv?.meta_marketplace || 0) },
    { key: "match",       label: "Match (Volume HL)",     peso: w.match,       real: parseFloat(rv?.real_match || 0),       meta: parseFloat(rv?.meta_match || 0) },
  ].filter((d) => d.peso > 0);

  const rvTotal    = rvPontos    + indicadoresRV.reduce((s, d) => s + calcRv(d.real, d.meta, d.peso), 0);
  const rvTotalPot = rvPontosPot + indicadoresRV.reduce((s, d) => s + calcPot(d.real, d.meta, d.peso), 0);

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <button style={styles.backBtn} onClick={() => navigate("/")}>← Voltar</button>
          <div>
            <h1 style={styles.title}>💰 Remuneração Variável</h1>
            <p style={styles.subtitle}>{usuario?.nome} · Setor {usuario?.cod} · {segmento}</p>
          </div>
        </div>
        <div style={styles.headerRight}>
          <input type="month" style={styles.inputMes} value={mesRef} onChange={(e) => setMesRef(e.target.value)} />
          <button style={styles.logoutBtn} onClick={logout}>Sair</button>
        </div>
      </div>

      <div style={styles.content}>
        {loading ? <p style={styles.msg}>Carregando...</p> : (
          <>
            {/* AP */}
            <div style={{ ...styles.apCard, borderColor: apOk ? "rgba(74,222,128,0.3)" : "rgba(248,113,113,0.3)" }}>
              <div style={styles.apHeader}>
                <h3 style={styles.sectionTitle}>🎯 Atendimento Produtivo</h3>
                <span style={{ ...styles.apBadge, background: apOk ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: apOk ? "#4ade80" : "#f87171" }}>
                  {apOk ? "✅ OK — RV Liberada" : "❌ NOK — RV Bloqueada"}
                </span>
              </div>
              <div style={styles.apGrid}>
                {KPIS_AP.map((kpi) => {
                  const real = parseFloat(ap?.[`${kpi.key}_real`] || 0);
                  const meta = parseFloat(ap?.[`${kpi.key}_meta`] || 0);
                  const ok = meta > 0 && real >= meta;
                  return (
                    <div key={kpi.key} style={{ ...styles.apKpi, borderColor: ok ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)" }}>
                      <span style={styles.apKpiLabel}>{kpi.label}</span>
                      <span style={{ fontSize: "1.3rem", fontWeight: "700", color: ok ? "#4ade80" : "#f87171" }}>
                        {real.toFixed(1)}%
                      </span>
                      <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.72rem" }}>meta: {meta.toFixed(1)}%</span>
                      <span style={{ fontSize: "1rem" }}>{ok ? "✅" : "❌"}</span>
                    </div>
                  );
                })}
              </div>
              {!apOk && <p style={styles.apAviso}>⚠️ Todos os 4 KPIs precisam ser atingidos para liberar a RV.</p>}
            </div>

            {/* Total */}
            <div style={styles.totalCard}>
              <div>
                <p style={{ margin: "0 0 4px", color: "rgba(255,255,255,0.5)", fontSize: "0.82rem" }}>
                  Estimativa RV — {mesRef}
                </p>
                <p style={{ margin: "0 0 4px", fontSize: "2rem", fontWeight: "800", color: apOk ? "#4ade80" : "#7DBA3D" }}>
                  R$ {(apOk ? rvTotal : rvTotalPot).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                {!apOk && (
                  <p style={{ margin: "0 0 2px", color: "#f87171", fontSize: "0.72rem", fontWeight: "600" }}>
                    ⚠️ potencial — bloqueado por AP NOK
                  </p>
                )}
                <p style={{ margin: 0, color: "rgba(255,255,255,0.35)", fontSize: "0.78rem" }}>
                  de R$ {poTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} possíveis (100% PO)
                </p>
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ margin: 0, fontSize: "2.5rem", fontWeight: "800", color: "#7DBA3D" }}>
                  {poTotal > 0 ? (((apOk ? rvTotal : rvTotalPot) / poTotal) * 100).toFixed(1) : "0"}%
                </p>
                <p style={{ margin: 0, color: "rgba(255,255,255,0.4)", fontSize: "0.8rem" }}>{apOk ? "do PO" : "potencial"}</p>
              </div>
            </div>

            {/* Pontos Bees */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>⭐ Pontos Bees</h3>
              <div style={styles.pontosGrid}>
                {[
                  { label: "Pontos realizados", val: Number(pontos?.pontos_real || 0).toLocaleString("pt-BR"), color: "#fff" },
                  { label: "Meta", val: META_PONTOS.toLocaleString("pt-BR"), color: "#fff" },
                  { label: "Atingimento", val: `${pctPontos.toFixed(1)}%`, color: pctPontos >= 100 ? "#4ade80" : pctPontos >= 70 ? "#7DBA3D" : "#f87171" },
                  { label: "Peso no PO", val: `${pesoPontos}%`, color: "#fff" },
                  { label: "Valor estimado", val: `${apOk ? "" : "⚠️ "}R$ ${(apOk ? rvPontos : rvPontosPot).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, color: apOk ? "#4ade80" : "#7DBA3D" },
                ].map((item) => (
                  <div key={item.label} style={styles.pontosItem}>
                    <span style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.78rem" }}>{item.label}</span>
                    <span style={{ color: item.color, fontWeight: "700", fontSize: "1rem" }}>{item.val}</span>
                  </div>
                ))}
              </div>
              <div style={styles.barTrack}>
                <div style={{ ...styles.barFill, width: `${Math.min(pctPontos, 100)}%`, background: pctPontos >= 100 ? "#4ade80" : pctPontos >= 70 ? "#7DBA3D" : "#f87171" }} />
                <div style={styles.barMark70}/>
              </div>
            </div>

            {/* Indicadores */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>📊 Indicadores de Volume / Faturamento</h3>
              <div style={styles.barsGrid}>
                {indicadoresRV.map((d) => (
                  <BarIndicador key={d.key} label={d.label} real={d.real} meta={d.meta} peso={d.peso} po_total={poTotal} bloqueado={!apOk}/>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  root: { minHeight: "100vh", background: "#0c1410", fontFamily: "'Poppins', 'Segoe UI', system-ui, sans-serif", color: "#fff" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "clamp(12px,3vw,20px) clamp(16px,4vw,32px)", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", flexWrap: "wrap", gap: "12px" },
  headerLeft: { display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" },
  headerRight: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" },
  backBtn: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", padding: "10px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem", fontFamily: "inherit", minHeight: "44px" },
  title: { margin: 0, fontSize: "clamp(1rem,5vw,1.3rem)", fontWeight: "700" },
  subtitle: { margin: 0, fontSize: "0.8rem", color: "rgba(255,255,255,0.4)" },
  inputMes: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff", padding: "10px", fontSize: "0.85rem", fontFamily: "inherit", outline: "none", minHeight: "44px" },
  logoutBtn: { background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)", padding: "10px 12px", borderRadius: "8px", cursor: "pointer", fontSize: "0.82rem", fontFamily: "inherit", minHeight: "44px" },
  content: { padding: "clamp(16px,4vw,24px) clamp(16px,4vw,32px)", maxWidth: "900px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "20px" },
  msg: { color: "rgba(255,255,255,0.35)", textAlign: "center", padding: "60px" },
  apCard: { background: "rgba(255,255,255,0.03)", border: "1px solid", borderRadius: "14px", padding: "20px" },
  apHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" },
  apBadge: { padding: "4px 14px", borderRadius: "20px", fontSize: "0.82rem", fontWeight: "700" },
  apGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "10px" },
  apKpi: { background: "rgba(255,255,255,0.04)", border: "1px solid", borderRadius: "10px", padding: "12px", display: "flex", flexDirection: "column", gap: "4px", alignItems: "center" },
  apKpiLabel: { color: "rgba(255,255,255,0.5)", fontSize: "0.75rem", textAlign: "center" },
  apAviso: { margin: "12px 0 0", color: "#f87171", fontSize: "0.82rem", textAlign: "center" },
  totalCard: { background: "linear-gradient(135deg, rgba(125,186,61,0.08), rgba(125,186,61,0.03))", border: "1px solid rgba(125,186,61,0.2)", borderRadius: "14px", padding: "clamp(16px,4vw,20px) clamp(16px,4vw,28px)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" },
  section: { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "20px" },
  sectionTitle: { margin: "0 0 16px", fontSize: "0.95rem", fontWeight: "600" },
  pontosGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "10px", marginBottom: "14px" },
  pontosItem: { background: "rgba(255,255,255,0.04)", borderRadius: "8px", padding: "10px 12px", display: "flex", flexDirection: "column", gap: "4px" },
  barsGrid: { display: "flex", flexDirection: "column", gap: "12px" },
  barCard: { background: "rgba(255,255,255,0.04)", borderRadius: "10px", padding: "14px 16px", display: "flex", flexDirection: "column", gap: "8px" },
  barHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  barLabel: { color: "rgba(255,255,255,0.75)", fontSize: "0.88rem", fontWeight: "500" },
  barPeso: { color: "rgba(255,255,255,0.35)", fontSize: "0.75rem" },
  barTrack: { height: "8px", background: "rgba(255,255,255,0.08)", borderRadius: "4px", overflow: "visible", position: "relative" },
  barFill: { height: "100%", borderRadius: "4px", transition: "width 0.4s" },
  barMark70: { position: "absolute", left: "70%", top: "-3px", width: "2px", height: "14px", background: "rgba(255,255,255,0.3)", borderRadius: "1px" },
  barFooter: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  barReal: { color: "rgba(255,255,255,0.35)", fontSize: "0.78rem" },
};
