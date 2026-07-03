// v1.1 - 3 cards (sem tendência), categorias breakdown, motivo no sku_foco
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import api from "../../services/api";

/* ─── helpers ──────────────────────────────────────────────────────────────── */
function hojeStr() {
  const now = new Date();
  const br  = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return `${String(br.getDate()).padStart(2,"0")}/${String(br.getMonth()+1).padStart(2,"0")}/${br.getFullYear()}`;
}
function toInputDate(s) {
  const [dd, mm, yyyy] = s.split("/");
  return `${yyyy}-${mm}-${dd}`;
}
function fromInputDate(s) {
  const [yyyy, mm, dd] = s.split("-");
  return `${dd}/${mm}/${yyyy}`;
}
function fmtHL(v) {
  return Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
function fmtRS(v) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

/* ─── sub-components ───────────────────────────────────────────────────────── */
function ProgressBar({ pct, thin }) {
  const p = Math.min(100, Math.max(0, pct || 0));
  const cor = p >= 100 ? "#4ade80" : p >= 70 ? "#7DBA3D" : "#f87171";
  return (
    <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: "4px", height: thin ? "5px" : "8px", overflow: "hidden" }}>
      <div style={{ width: `${p}%`, background: cor, height: "100%", borderRadius: "4px", transition: "width 0.5s ease" }} />
    </div>
  );
}

function Card({ label, children }) {
  return (
    <div style={S.card}>
      <div style={S.cardLabel}>{label}</div>
      {children}
    </div>
  );
}

/* ─── main ─────────────────────────────────────────────────────────────────── */
export default function VolumeDiario() {
  const { usuario } = useAuth();
  const navigate    = useNavigate();
  const perfil      = usuario?.perfil;
  const canFilter   = ["admin", "director", "gv1", "gv3"].includes(perfil);

  const [data,    setData]    = useState(hojeStr());
  const [setor,   setSetor]   = useState("");
  const [setores, setSetores] = useState([]);
  const [dados,   setDados]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro,    setErro]    = useState("");
  const [verMes,  setVerMes]  = useState(false); // ver o mês inteiro em vez do dia

  /* carrega lista de setores disponíveis para filtro */
  useEffect(() => {
    if (!canFilter) return;
    api.get("/api/volume-diario/setores")
      .then((r) => setSetores(r.data))
      .catch(() => {});
  }, [canFilter]);

  /* fetch principal */
  const fetchDados = useCallback(async () => {
    setLoading(true);
    setErro("");
    try {
      const params = new URLSearchParams({ data });
      if (setor) params.set("setor", setor);
      const r = await api.get(`/api/volume-diario?${params}`);
      setDados(r.data);
    } catch {
      setErro("Erro ao carregar dados. Tente novamente.");
      setDados(null);
    } finally {
      setLoading(false);
    }
  }, [data, setor]);

  useEffect(() => { fetchDados(); }, [fetchDados]);

  const d = dados;
  // Meta Diária + Acumulado só fazem sentido por setor; na visão consolidada
  // ("Todos", admin/gestor) elas somam tudo e não ajudam — então escondemos.
  const mostrarMetas = !canFilter || !!setor;
  const [catSel, setCatSel] = useState(null); // categoria aberta (modal top SKUs)

  return (
    <div style={S.root}>
      <style>{CSS}</style>

      {/* Header */}
      <div style={S.header}>
        <button style={S.backBtn} onClick={() => navigate("/")}>← Voltar</button>
        <div>
          <h1 style={S.title}>📈 Volume Diário</h1>
          <p style={S.subtitle}>Acompanhamento de vendas por dia</p>
        </div>
      </div>
      {d?.atualizado_em && (
        <div style={S.atualizado} title="Horário da última importação de pedidos">
          🔄 atualizado em {d.atualizado_em}
        </div>
      )}

      {/* Filtros */}
      <div style={S.filters}>
        <div style={S.filterGroup}>
          <label style={S.filterLabel}>Data</label>
          <input
            type="date"
            style={{ ...S.filterInput, opacity: verMes ? 0.5 : 1 }}
            value={toInputDate(data)}
            onChange={(e) => setData(fromInputDate(e.target.value))}
            disabled={verMes}
          />
        </div>
        {canFilter && setores.length > 0 && (
          <div style={S.filterGroup}>
            <label style={S.filterLabel}>Setor</label>
            <select style={S.filterInput} value={setor} onChange={(e) => setSetor(e.target.value)}>
              <option value="">Todos</option>
              {setores.map((s) => <option key={s} value={s}>Setor {s}</option>)}
            </select>
          </div>
        )}
        <div style={S.filterGroup}>
          <label style={S.filterLabel}>Período</label>
          <label style={{ ...S.mesToggle, ...(verMes ? S.mesToggleOn : {}) }}>
            <input type="checkbox" checked={verMes} onChange={(e) => { setVerMes(e.target.checked); if (e.target.checked) setData(hojeStr()); }} style={{ accentColor: "#7DBA3D", width: "16px", height: "16px" }} />
            📅 Mês inteiro
          </label>
        </div>
      </div>

      {loading && (
        <div style={S.loadingWrap}>
          <div className="vd-spinner" />
        </div>
      )}

      {erro && <div style={S.erro}>{erro}</div>}

      {d && !loading && (
        <>
          {/* ── 3 Cards ── */}
          <div className="vd-cards">

            {/* Volume Hoje / do Mês */}
            <Card label={verMes ? "Volume do Mês" : "Volume Hoje"}>
              <div style={S.cardValue}>
                {fmtHL(verMes ? d.volume_acumulado_mes_hl : d.volume_hoje_hl)} <span style={S.cardUnit}>HL</span>
              </div>
              {verMes ? (
                <div style={S.cardPct}>{d.dias_uteis_passados} de {d.dias_uteis_mes} dias úteis · mês {d.mes_referencia}</div>
              ) : (
                <div style={{ ...S.cardDelta, color: d.delta_hl >= 0 ? "#4ade80" : "#f87171" }}>
                  {d.delta_hl >= 0 ? "▲" : "▼"} {fmtHL(Math.abs(d.delta_hl))} HL
                  {d.delta_pct !== null && ` (${d.delta_pct >= 0 ? "+" : ""}${d.delta_pct.toFixed(1)}%)`}
                  <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.68rem" }}> vs {d.data_comparacao}</span>
                </div>
              )}
            </Card>

            {/* Meta Diária + Acumulado — só por setor (na consolidada somam tudo) */}
            {mostrarMetas && !verMes && (
              <Card label="Meta Diária">
                <div style={S.cardValue}>
                  {fmtHL(d.volume_hoje_hl)}{" "}
                  <span style={S.cardUnit}>/ {fmtHL(d.meta_diaria_hl)} HL</span>
                </div>
                <div style={{ margin: "10px 0 4px" }}>
                  <ProgressBar pct={d.pct_meta_diaria} />
                </div>
                <div style={S.cardPct}>{d.pct_meta_diaria}% da meta diária</div>
              </Card>
            )}

            {mostrarMetas && (
              <Card label="Acumulado no Mês">
                <div style={S.cardValue}>
                  {fmtHL(d.volume_acumulado_mes_hl)}{" "}
                  <span style={S.cardUnit}>/ {fmtHL(d.meta_mensal_hl)} HL</span>
                </div>
                <div style={{ margin: "10px 0 4px" }}>
                  <ProgressBar pct={d.meta_mensal_hl > 0 ? Math.round(d.volume_acumulado_mes_hl / d.meta_mensal_hl * 100) : 0} />
                </div>
                <div style={S.cardPct}>{d.dias_uteis_passados} de {d.dias_uteis_mes} dias úteis</div>
              </Card>
            )}
          </div>

          {/* ── Volume por Categoria ── */}
          {d.categorias?.length > 0 && (
            <div style={S.section}>
              <h3 style={S.sectionTitle}>📊 Volume por Categoria <span style={S.sectionHint}>· toque pra ver os SKUs</span></h3>
              <div style={S.catGrid}>
                {d.categorias.map((c) => c.unidade === "R$" ? (
                  // Marketplace (faturamento R$) — só mês, sem drill de SKU
                  <div key={c.categoria} style={S.catCard}>
                    <div style={S.catNome}>{c.categoria}</div>
                    <div style={S.catBlock}>
                      <div style={S.catBlockLabel}>Faturamento do mês</div>
                      <div style={S.catBlockValue}>{fmtRS(c.realizado_mes_rs)}</div>
                      <div style={{ margin: "5px 0 2px" }}>
                        <ProgressBar pct={c.pct_mes} thin />
                      </div>
                      <div style={S.catPct}>{c.pct_mes}% da meta mensal</div>
                    </div>
                    <div style={S.catMeta}>
                      Meta mensal: <strong style={{ color: "#fff" }}>{fmtRS(c.meta_mensal_rs)}</strong>
                    </div>
                  </div>
                ) : (
                  <div key={c.categoria} style={{ ...S.catCard, cursor: "pointer" }} onClick={() => setCatSel(c)}>
                    <div style={S.catNome}>{c.categoria} <span style={S.catSeta}>›</span></div>
                    <div style={S.catRow}>
                      {!verMes && (
                        <div style={S.catBlock}>
                          <div style={S.catBlockLabel}>Hoje</div>
                          <div style={S.catBlockValue}>{fmtHL(c.volume_hoje_hl)} <span style={S.catUnit}>HL</span></div>
                          <div style={{ margin: "5px 0 2px" }}>
                            <ProgressBar pct={c.pct_dia} thin />
                          </div>
                          <div style={S.catPct}>{c.pct_dia}% da meta dia</div>
                        </div>
                      )}
                      {!verMes && <div style={S.catDivider} />}
                      <div style={S.catBlock}>
                        <div style={S.catBlockLabel}>Mês</div>
                        <div style={S.catBlockValue}>{fmtHL(c.volume_mes_hl)} <span style={S.catUnit}>HL</span></div>
                        <div style={{ margin: "5px 0 2px" }}>
                          <ProgressBar pct={c.pct_mes} thin />
                        </div>
                        <div style={S.catPct}>{c.pct_mes}% da meta mensal</div>
                      </div>
                    </div>
                    <div style={S.catMeta}>
                      Meta mensal: <strong style={{ color: "#fff" }}>{fmtHL(c.meta_mensal_hl)} HL</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Top SKUs ── */}
          {(() => { const lista = verMes ? (d.top_skus_mes || []) : (d.top_skus || []); return lista.length > 0 && (
            <div style={S.section}>
              <h3 style={S.sectionTitle}>🏆 Top SKUs — {verMes ? `mês ${d.mes_referencia}` : d.data}</h3>
              <div>
                {lista.map((s, i) => (
                  <div key={s.cod_produto} style={{ ...S.skuRow, borderBottom: i < lista.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                    <span style={{ ...S.skuPos, color: i < 3 ? "#7DBA3D" : "rgba(255,255,255,0.3)" }}>{i + 1}</span>
                    <div style={S.skuInfo}>
                      <div style={S.skuNome}>{s.nome_produto}</div>
                      <div style={S.skuCod}>cod: {s.cod_produto}</div>
                    </div>
                    <span style={S.skuVol}>{fmtHL(s.volume_hl)} HL</span>
                  </div>
                ))}
              </div>
            </div>
          ); })()}

          {/* ── SKU Foco ── */}
          {d.sku_foco?.length > 0 && (
            <div style={S.section}>
              <h3 style={S.sectionTitle}>🎯 SKU Foco</h3>
              {d.sku_foco.map((sf) => (
                <div key={`${sf.setor}-${sf.cod_produto}`} style={S.focoCard}>
                  <div style={S.focoHeader}>
                    <div style={{ flex: 1 }}>
                      <div style={S.focoNome}>{sf.nome_produto}</div>
                      <div style={S.focoCod}>cod {sf.cod_produto} · Setor {sf.setor}</div>
                      {sf.motivo && (
                        <div style={S.focoMotivo}>💡 {sf.motivo}</div>
                      )}
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ ...S.focoPct, color: sf.pct_mes >= 100 ? "#4ade80" : sf.pct_mes >= 70 ? "#7DBA3D" : "#f87171" }}>
                        {sf.pct_mes}%
                      </div>
                      <div style={S.focoSub}>do mês</div>
                    </div>
                  </div>
                  <div style={{ margin: "8px 0 6px" }}>
                    <ProgressBar pct={sf.pct_mes} />
                  </div>
                  <div style={S.focoStats}>
                    <span>Realizado: <strong style={{ color: "#fff" }}>{fmtHL(sf.realizado_mes_hl)} HL</strong></span>
                    <span>Meta: <strong style={{ color: "#fff" }}>{fmtHL(sf.meta_mensal_hl)} HL</strong></span>
                  </div>
                  <div style={S.focoDia}>
                    <span>Hoje:{" "}
                      <strong style={{ color: sf.pct_hoje >= 100 ? "#4ade80" : sf.pct_hoje > 0 ? "#7DBA3D" : "rgba(255,255,255,0.3)" }}>
                        {fmtHL(sf.realizado_hoje_hl)} HL
                      </strong>
                    </span>
                    <span>Meta dia: <strong style={{ color: "#fff" }}>{fmtHL(sf.meta_diaria_hl)} HL</strong></span>
                    <span style={{ marginLeft: "auto", ...(sf.pct_hoje >= 100 ? { color: "#4ade80" } : sf.pct_hoje >= 70 ? { color: "#7DBA3D" } : { color: "#f87171" }) }}>
                      {sf.pct_hoje}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {d.top_skus?.length === 0 && d.sku_foco?.length === 0 && d.categorias?.length === 0 && (
            <div style={S.empty}>
              Nenhuma venda registrada para {d.data}.<br />
              <span style={{ fontSize: "0.78rem" }}>Importe o arquivo de pedidos para gerar os dados.</span>
            </div>
          )}
        </>
      )}

      {/* Modal: Top SKUs da categoria selecionada */}
      {catSel && (
        <div style={S.modalScrim} onClick={() => setCatSel(null)}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <div style={S.modalHead}>
              <div>
                <div style={S.modalTit}>{catSel.categoria}</div>
                <div style={S.modalSub}>Top SKUs · Hoje {fmtHL(catSel.volume_hoje_hl)} HL · Mês {fmtHL(catSel.volume_mes_hl)} HL</div>
              </div>
              <button style={S.modalX} onClick={() => setCatSel(null)}>✕</button>
            </div>
            {(!catSel.top_skus || catSel.top_skus.length === 0) ? (
              <div style={S.modalVazio}>Sem SKUs com volume nessa categoria no mês.</div>
            ) : (
              <div>
                {catSel.top_skus.map((s, i) => (
                  <div key={s.cod_produto} style={{ ...S.skuRow, borderBottom: i < catSel.top_skus.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                    <span style={{ ...S.skuPos, color: i < 3 ? "#7DBA3D" : "rgba(255,255,255,0.3)" }}>{i + 1}</span>
                    <div style={S.skuInfo}>
                      <div style={S.skuNome}>{s.nome_produto}</div>
                      <div style={S.skuCod}>cod: {s.cod_produto} · hoje {fmtHL(s.volume_hoje_hl)} HL</div>
                    </div>
                    <span style={S.skuVol}>{fmtHL(s.volume_mes_hl)} HL</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── styles ────────────────────────────────────────────────────────────────── */
const S = {
  root:          { minHeight: "100vh", background: "#0c1410", fontFamily: "'Poppins', 'Segoe UI', system-ui, sans-serif", padding: "clamp(16px,4vw,28px)", maxWidth: "1600px", margin: "0 auto", color: "#fff" },
  header:        { display: "flex", alignItems: "flex-start", gap: "14px", marginBottom: "22px" },
  backBtn:       { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", padding: "10px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem", fontFamily: "inherit", flexShrink: 0, minHeight: "44px" },
  title:         { color: "#fff", margin: "0 0 4px", fontSize: "clamp(1.1rem,5vw,1.4rem)", fontWeight: "700" },
  subtitle:      { color: "rgba(255,255,255,0.4)", margin: 0, fontSize: "0.82rem" },
  atualizado:    { color: "rgba(255,255,255,0.35)", fontSize: "0.7rem", margin: "-8px 0 16px 2px", fontStyle: "italic" },
  filters:       { display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" },
  filterGroup:   { display: "flex", flexDirection: "column", gap: "4px" },
  filterLabel:   { color: "rgba(255,255,255,0.45)", fontSize: "0.68rem", fontWeight: "700", letterSpacing: "0.06em", textTransform: "uppercase" },
  filterInput:   { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "#fff", padding: "8px 12px", fontSize: "0.85rem", fontFamily: "inherit", minHeight: "40px", colorScheme: "dark" },
  mesToggle:     { display: "flex", alignItems: "center", gap: "8px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "rgba(255,255,255,0.75)", padding: "8px 14px", fontSize: "0.85rem", fontFamily: "inherit", minHeight: "40px", cursor: "pointer", whiteSpace: "nowrap" },
  mesToggleOn:   { background: "rgba(125,186,61,0.15)", border: "1px solid rgba(125,186,61,0.5)", color: "#7DBA3D", fontWeight: "600" },
  loadingWrap:   { display: "flex", justifyContent: "center", padding: "48px 0" },
  erro:          { background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#f87171", borderRadius: "10px", padding: "12px 16px", marginBottom: "16px", fontSize: "0.85rem" },
  card:          { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "16px" },
  cardLabel:     { color: "rgba(255,255,255,0.4)", fontSize: "0.68rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" },
  cardValue:     { color: "#fff", fontSize: "clamp(1.1rem,4vw,1.55rem)", fontWeight: "700" },
  cardUnit:      { fontSize: "0.78rem", color: "rgba(255,255,255,0.4)", fontWeight: "400" },
  cardDelta:     { fontSize: "0.76rem", marginTop: "6px", fontWeight: "500" },
  cardPct:       { color: "rgba(255,255,255,0.35)", fontSize: "0.68rem", marginTop: "4px" },
  section:       { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "16px 20px", marginBottom: "16px" },
  sectionTitle:  { color: "#fff", margin: "0 0 14px", fontSize: "0.9rem", fontWeight: "700" },
  sectionHint:   { color: "rgba(255,255,255,0.3)", fontSize: "0.7rem", fontWeight: "400", fontStyle: "italic" },
  // Categorias
  catGrid:       { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "10px" },
  catCard:       { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "10px", padding: "12px 14px" },
  catNome:       { color: "#7DBA3D", fontSize: "0.72rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" },
  catSeta:       { color: "rgba(125,186,61,0.6)", fontSize: "1.1rem", fontWeight: "700" },
  catRow:        { display: "flex", gap: "12px", alignItems: "flex-start" },
  catBlock:      { flex: 1 },
  catBlockLabel: { color: "rgba(255,255,255,0.35)", fontSize: "0.62rem", fontWeight: "700", textTransform: "uppercase", marginBottom: "2px" },
  catBlockValue: { color: "#fff", fontSize: "1rem", fontWeight: "700" },
  catUnit:       { fontSize: "0.65rem", color: "rgba(255,255,255,0.4)", fontWeight: "400" },
  catPct:        { color: "rgba(255,255,255,0.3)", fontSize: "0.62rem", marginTop: "2px" },
  catDivider:    { width: "1px", background: "rgba(255,255,255,0.08)", alignSelf: "stretch", flexShrink: 0 },
  catMeta:       { color: "rgba(255,255,255,0.35)", fontSize: "0.68rem", marginTop: "10px", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "8px" },
  // Top SKUs
  skuRow:        { display: "flex", alignItems: "center", gap: "10px", padding: "8px 0" },
  skuPos:        { fontWeight: "700", fontSize: "0.82rem", width: "22px", textAlign: "center", flexShrink: 0 },
  skuInfo:       { flex: 1, minWidth: 0 },
  skuNome:       { color: "#fff", fontSize: "0.85rem", fontWeight: "600", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  skuCod:        { color: "rgba(255,255,255,0.3)", fontSize: "0.68rem" },
  skuVol:        { color: "#7DBA3D", fontWeight: "700", fontSize: "0.88rem", flexShrink: 0 },
  // SKU Foco
  focoCard:      { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "10px", padding: "14px", marginBottom: "10px" },
  focoHeader:    { display: "flex", alignItems: "flex-start", gap: "10px" },
  focoNome:      { color: "#fff", fontWeight: "600", fontSize: "0.9rem" },
  focoCod:       { color: "rgba(255,255,255,0.3)", fontSize: "0.68rem", marginTop: "2px" },
  focoMotivo:    { color: "rgba(255,255,255,0.5)", fontSize: "0.75rem", marginTop: "6px", lineHeight: 1.45, fontStyle: "italic" },
  focoPct:       { fontSize: "1.4rem", fontWeight: "700", lineHeight: 1 },
  focoSub:       { color: "rgba(255,255,255,0.35)", fontSize: "0.62rem" },
  focoStats:     { display: "flex", gap: "16px", fontSize: "0.76rem", color: "rgba(255,255,255,0.45)", marginTop: "4px", flexWrap: "wrap" },
  focoDia:       { display: "flex", gap: "16px", fontSize: "0.76rem", color: "rgba(255,255,255,0.45)", marginTop: "4px", flexWrap: "wrap" },
  empty:         { textAlign: "center", color: "rgba(255,255,255,0.3)", padding: "48px 0", fontSize: "0.9rem", lineHeight: 1.6 },
  // Modal top SKUs
  modalScrim:    { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)", zIndex: 1600, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" },
  modal:         { background: "linear-gradient(180deg,#14241a,#0c1410)", border: "1px solid rgba(125,186,61,0.3)", borderRadius: "16px", padding: "18px", width: "min(560px,100%)", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 24px 70px rgba(0,0,0,0.6)" },
  modalHead:     { display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "12px" },
  modalTit:      { fontSize: "1rem", fontWeight: "800", color: "#7DBA3D" },
  modalSub:      { color: "rgba(255,255,255,0.5)", fontSize: "0.74rem", marginTop: "2px" },
  modalX:        { marginLeft: "auto", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.14)", color: "#fff", borderRadius: "50%", width: "32px", height: "32px", cursor: "pointer", flexShrink: 0 },
  modalVazio:    { color: "rgba(255,255,255,0.5)", fontSize: "0.85rem", padding: "16px 4px" },
};

const CSS = `
.vd-spinner {
  width: 32px; height: 32px;
  border: 3px solid rgba(125,186,61,0.15);
  border-top-color: #7DBA3D;
  border-radius: 50%;
  animation: vd-spin 0.8s linear infinite;
}
@keyframes vd-spin { to { transform: rotate(360deg); } }

.vd-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

@media (max-width: 680px) {
  .vd-cards {
    grid-template-columns: 1fr !important;
  }
}
`;
