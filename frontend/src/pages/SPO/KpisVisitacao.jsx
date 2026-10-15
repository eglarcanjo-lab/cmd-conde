// SPO — blocos de KPI: Visitação GV, Coaching, Dias em rota, Desafios, Rotina +, DTO GC (KPIs 1–4, 6, 25).
// Recebe o estado/funções da tela via `ctx` (montado em index.jsx). Só desenha; não guarda estado.
import * as SH from "./shared";

export default function KpisVisitacao({ ctx }) {
  const {
    BarraProgresso, rmBig, rmCard, rmLbl, rmTd, rmTh, styles
  } = SH;
  const {
    aba, coaching, coachingDet, desafios, diasRota, dto, dtoView, fmtMes, kpiAtivo, pctOp,
    periodoCoaching, periodoDiasRota, rotinaMais, rotinaMaisDet, semCoaching, setDtoView,
    setPeriodoCoaching, setPeriodoDiasRota, totalMeta, totalVisitados
  } = ctx;
  return (
    <>
            {/* OPERAÇÃO */}
            {aba === "operacao" && (kpiAtivo === null || kpiAtivo === 1) && (
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>Item 1 — Visitação GV na Base Foco</h3>
                <div style={styles.opGrid}>
                  {[
                    { label: "Meta Total", val: totalMeta, color: "#fff" },
                    { label: "Visitados", val: totalVisitados, color: "#4ade80" },
                    { label: "Gap", val: totalMeta - totalVisitados > 0 ? totalMeta - totalVisitados : 0, color: totalMeta - totalVisitados > 0 ? "#f87171" : "#4ade80" },
                    { label: "Atingimento", val: `${pctOp}%`, color: pctOp >= 100 ? "#4ade80" : pctOp >= 70 ? "#7DBA3D" : "#f87171" },
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

            {/* COACHING — resumo por GV (só no panorama geral) */}
            {kpiAtivo === null && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 2 — Rota Coaching</h3>
              <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                {["mensal", "trimestral"].map((p) => (
                  <button key={p} onClick={() => setPeriodoCoaching(p)}
                    style={{ ...styles.abaBtn, ...(periodoCoaching === p ? styles.abaBtnAtivo : {}), padding: "6px 14px", fontSize: "0.82rem", borderBottom: "none", borderRadius: "6px", background: periodoCoaching === p ? "rgba(125,186,61,0.12)" : "rgba(255,255,255,0.04)" }}>
                    {p === "mensal" ? "📅 Mensal" : "📊 Trimestral"}
                  </button>
                ))}
              </div>
              <div style={styles.gvGrid}>
                {coaching.filter(c => c.periodo === periodoCoaching).map((c) => {
                  const pct = parseFloat(c.pct || 0);
                  const cor = pct >= 100 ? "#4ade80" : pct >= 70 ? "#7DBA3D" : "#f87171";
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

            {/* COACHING — DETALHADO POR RN (KPI 2) */}
            {kpiAtivo === 2 && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 2 — Rota Coaching · Detalhado por RN</h3>
              <p style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.45)", margin: "0 0 14px" }}>
                Premissa do trimestre: cada RN deve ter <b>ao menos 1 coaching válido</b>. O coaching é contado <b>por dia</b> — o mesmo RN em dias diferentes conta como coachings distintos.
              </p>
              {(() => {
                // Coachings válidos por RN = dias distintos com coaching_ok = SIM.
                const porRN = {};
                coachingDet.forEach((d) => {
                  const setor = String(d.setor || "").trim();
                  if (!setor) return;
                  if (!porRN[setor]) porRN[setor] = { gv: d.gv, setor, validos: new Set() };
                  const dia = d.data_visita || "";
                  if (dia && String(d.coaching_ok).toUpperCase() === "SIM") porRN[setor].validos.add(dia);
                });
                // Inclui os RNs sem nenhum coaching válido (universo de zeros).
                semCoaching.forEach((s) => {
                  const setor = String(s.setor || "").trim();
                  if (setor && !porRN[setor]) porRN[setor] = { gv: s.gv, setor, validos: new Set() };
                });
                const linhas = Object.values(porRN)
                  .map((r) => ({ gv: r.gv, setor: r.setor, validos: r.validos.size }))
                  .sort((a, b) => String(a.gv).localeCompare(String(b.gv)) || String(a.setor).localeCompare(String(b.setor)));
                if (linhas.length === 0) return <p style={styles.msg}>Importe os 3 meses do relatório em Admin → Arquivos → SPO Rota Coaching.</p>;
                const comCoaching = linhas.filter((l) => l.validos >= 1).length;
                const semCount = linhas.filter((l) => l.validos === 0).length;
                return (
                  <>
                    <div style={{ display: "flex", gap: "10px", marginBottom: "14px", flexWrap: "wrap" }}>
                      <div style={rmCard}><div style={rmBig("#4ade80")}>{comCoaching}</div><div style={rmLbl}>RNs com coaching</div></div>
                      <div style={rmCard}><div style={rmBig(semCount > 0 ? "#f87171" : "#4ade80")}>{semCount}</div><div style={rmLbl}>RNs sem coaching</div></div>
                      <div style={rmCard}><div style={rmBig("#fff")}>{linhas.length}</div><div style={rmLbl}>RNs na base</div></div>
                    </div>
                    <div style={styles.tableWrap}>
                      <table style={styles.table}>
                        <thead>
                          <tr>{["GV", "RN (Setor)", "Coachings válidos", "Status"].map((h) => <th key={h} style={styles.th}>{h}</th>)}</tr>
                        </thead>
                        <tbody>
                          {linhas.map((l) => {
                            const ok = l.validos >= 1;
                            return (
                              <tr key={l.setor} style={styles.tr}>
                                <td style={styles.td}>{l.gv}</td>
                                <td style={styles.td}><span style={styles.codBadge}>{l.setor}</span></td>
                                <td style={{ ...styles.td, fontWeight: "700", color: ok ? "#4ade80" : "#f87171" }}>{l.validos}</td>
                                <td style={styles.td}>
                                  <span style={{ ...styles.statusTag, background: ok ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: ok ? "#4ade80" : "#f87171" }}>
                                    {ok ? "✅ OK" : "❌ Sem coaching"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                );
              })()}
            </div>
            )}

            {/* DIAS EM ROTA TT */}
            {(kpiAtivo === null || kpiAtivo === 3) && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 3 — TT Dias com Rotas</h3>
              <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                {["mensal", "trimestral"].map((p) => (
                  <button key={p} onClick={() => setPeriodoDiasRota(p)}
                    style={{ ...styles.abaBtn, ...(periodoDiasRota === p ? styles.abaBtnAtivo : {}), padding: "6px 14px", fontSize: "0.82rem", borderBottom: "none", borderRadius: "6px", background: periodoDiasRota === p ? "rgba(125,186,61,0.12)" : "rgba(255,255,255,0.04)" }}>
                    {p === "mensal" ? "📅 Mensal" : "📊 Trimestral"}
                  </button>
                ))}
              </div>
              <div style={styles.gvGrid}>
                {diasRota.filter(d => d.periodo === periodoDiasRota).map((d) => {
                  const pct = parseFloat(d.pct || 0);
                  const cor = pct >= 100 ? "#4ade80" : pct >= 70 ? "#7DBA3D" : "#f87171";
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
                  const corOp = pctOp >= 100 ? "#4ade80" : pctOp >= 70 ? "#7DBA3D" : "#f87171";
                  const okOp = realOp >= metaOp && metaOp > 0;
                  if (tot1 === 0 && tot3 === 0) return null;
                  return (
                    <div style={{ ...styles.gvCard, borderColor: "rgba(125,186,61,0.25)", background: "rgba(125,186,61,0.04)" }}>
                      <div style={styles.gvHeader}>
                        <span style={{ ...styles.gvLabel, color: "#7DBA3D" }}>Operação</span>
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
                  const cor = pct >= 90 ? "#4ade80" : pct >= 70 ? "#7DBA3D" : "#f87171";
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

            {/* ROTINA + */}
            {(kpiAtivo === null || kpiAtivo === 25) && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 5 — Rotina + · % Visitas Medianas ou Excelentes</h3>
              {rotinaMais.length === 0 ? (
                <p style={styles.msg}>Importe o relatório <b>Rotina +</b> (aba Arquivos) para calcular.</p>
              ) : (() => {
                const op = rotinaMais.find((r) => r.setor === "OPERACAO") || {};
                const setores = rotinaMais.filter((r) => r.setor !== "OPERACAO").sort((a, b) => String(a.setor).localeCompare(String(b.setor)));
                const nf = (v) => (Number(v) || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
                const meta = 49;
                const kpi = Number(op.pct_med_exc) || 0;
                return (
                  <>
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "16px" }}>
                      <div style={rmCard}><div style={rmBig(kpi >= meta ? "#4ade80" : "#f87171")}>{nf(kpi)}%</div><div style={rmLbl}>% Med+Exc · meta {meta}%</div></div>
                      <div style={rmCard}><div style={rmBig("#fff")}>{nf(op.visitas)}</div><div style={rmLbl}>Visitas (GPS OK)</div></div>
                      <div style={rmCard}><div style={rmBig("#f87171")}>{nf(op.pct_critica)}%</div><div style={rmLbl}>Críticas</div></div>
                      <div style={rmCard}><div style={rmBig("#f5c451")}>{nf(op.pct_mediana)}%</div><div style={rmLbl}>Medianas</div></div>
                      <div style={rmCard}><div style={rmBig("#4ade80")}>{nf(op.pct_excelente)}%</div><div style={rmLbl}>Excelentes</div></div>
                    </div>
                    <div style={{ overflowX: "auto", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                        <thead>
                          <tr>{["Setor", "Visitas", "%Crít", "%Med", "%Exc", "%Med+Exc", "P2 Gelad.", "P3 Nível", "P4 BEES", "P5 Alav.", "P6 Exec."].map((h) => <th key={h} style={rmTh}>{h}</th>)}</tr>
                        </thead>
                        <tbody>
                          {setores.map((r) => (
                            <tr key={r.setor} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                              <td style={{ ...rmTd, fontWeight: "700", color: "#fff" }}>{r.setor}</td>
                              <td style={rmTd}>{nf(r.visitas)}</td>
                              <td style={{ ...rmTd, color: "#f87171" }}>{nf(r.pct_critica)}%</td>
                              <td style={{ ...rmTd, color: "#f5c451" }}>{nf(r.pct_mediana)}%</td>
                              <td style={{ ...rmTd, color: "#4ade80" }}>{nf(r.pct_excelente)}%</td>
                              <td style={{ ...rmTd, fontWeight: "700", color: (Number(r.pct_med_exc) || 0) >= meta ? "#4ade80" : "#f87171" }}>{nf(r.pct_med_exc)}%</td>
                              <td style={rmTd}>{nf(r.passo2)}%</td>
                              <td style={rmTd}>{nf(r.passo3)}%</td>
                              <td style={rmTd}>{nf(r.passo4)}%</td>
                              <td style={rmTd}>{nf(r.passo5)}%</td>
                              <td style={rmTd}>{nf(r.passo6)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.35)", marginTop: "8px" }}>
                      Crítica ≤2 passos · Mediana 3 · Excelente ≥4. Apuradas = visitas com GPS OK. {rotinaMaisDet.length > 0 ? `${rotinaMaisDet.length} visitas no detalhe.` : ""}
                    </p>
                  </>
                );
              })()}
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
                            style={{ background: dtoView === v ? "rgba(125,186,61,0.2)" : "transparent", border: "none", color: dtoView === v ? "#7DBA3D" : "rgba(255,255,255,0.4)", padding: "4px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "0.78rem", fontFamily: "inherit", fontWeight: dtoView === v ? "600" : "400" }}>
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
                        const cor = pct >= 100 ? "#4ade80" : pct >= 70 ? "#7DBA3D" : "#f87171";
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

    </>
  );
}
