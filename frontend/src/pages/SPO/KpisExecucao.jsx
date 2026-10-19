// SPO — blocos de KPI: Aba Promoção, Política comercial, Menu de cerveja, Tasks Portfólio / Score 5 / NAB (KPIs 7–9, 11–13).
// Recebe o estado/funções da tela via `ctx` (montado em index.jsx). Só desenha; não guarda estado.
import * as SH from "./shared";

export default function KpisExecucao({ ctx }) {
  const {
    BarraProgresso, styles
  } = SH;
  const {
    fmtMes, kpi11FiltroDia, kpi11FiltroRN, kpi12FiltroRN, kpi12SoFalha, kpiAtivo, menu, mesAtual,
    politica, promo, promoBusca, promoDetalhe, promoFiltroDia, promoFiltroSetor, renderTabelaTasks,
    score5, score5Det, setKpi11FiltroDia, setKpi11FiltroRN, setKpi12FiltroRN, setKpi12SoFalha,
    setPromoBusca, setPromoFiltroDia, setPromoFiltroSetor, spoMetaTotal, spoMetas, tasksCerveja,
    tasksCervejaDetalhe, tasksNab
  } = ctx;
  return (
    <>
            {/* ABA PROMOÇÃO */}
            {SH.mostra(kpiAtivo, 7) && (
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
                        const cor = pct >= meta7 ? "#4ade80" : pct >= meta7 * 0.7 ? "#7DBA3D" : "#f87171";
                        const isOp = r.setor === "OPERACAO";
                        const barPct = meta7 > 0 ? Math.min(pct / meta7 * 100, 150) : 0;
                        return (
                          <div key={r.setor} style={{ ...styles.gvCard, ...(isOp ? { border: "1px solid rgba(125,186,61,0.3)", gridColumn: "1/-1" } : {}) }}>
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
                                  const cor = pct >= 10 ? "#4ade80" : pct >= 5 ? "#7DBA3D" : "#f87171";
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
            {SH.mostra(kpiAtivo, 8) && (
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
                    const cor = pct >= 100 ? "#4ade80" : pct >= 70 ? "#7DBA3D" : "#f87171";
                    const okBadge = metaRef !== null ? real >= metaRef : r.ok === "OK";
                    return (
                      <div key={r.setor} style={{ ...styles.gvCard, ...(isOp ? { border: "1px solid rgba(125,186,61,0.3)", gridColumn: "1/-1" } : {}) }}>
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
            {SH.mostra(kpiAtivo, 9) && (
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
                    const cor = pct >= 100 ? "#4ade80" : pct >= 70 ? "#7DBA3D" : "#f87171";
                    const okBadge = metaRef !== null ? real >= metaRef : r.ok === "OK";
                    return (
                      <div key={r.setor} style={{ ...styles.gvCard, ...(isOp ? { border: "1px solid rgba(125,186,61,0.3)", gridColumn: "1/-1" } : {}) }}>
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
            {SH.mostra(kpiAtivo, 11) && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 11 — Tasks de Portfólio Cerveja</h3>
              {tasksCerveja.length === 0 ? (
                <p style={styles.msg}>Importe o arquivo de tasks para calcular automaticamente.</p>
              ) : (
                <>
                  {renderTabelaTasks(tasksCerveja, 11)}
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
                                  <span style={{ color: r.status_task === "OPEN" ? "#7DBA3D" : "#f87171", fontWeight: "600", fontSize: "0.75rem" }}>{r.status_task}</span>
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
            {SH.mostra(kpiAtivo, 12) && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 12 — Task de Faturamento Score 5</h3>
              {renderTabelaTasks(score5, 12, { realField: "pdvs_ok", totalField: "pdvs_total", uplift: 1.0, unidade: "PDVs", semDados: "Importe o relatório de Task de Faturamento (task fat) para calcular automaticamente." })}

              {/* Detalhe por PDV — quem possui task de fat e se bateu */}
              {score5Det.length > 0 && (() => {
                const rns = [...new Set(score5Det.map((d) => d.setor))].sort();
                let linhas = score5Det;
                if (kpi12FiltroRN !== "TODOS") linhas = linhas.filter((d) => d.setor === kpi12FiltroRN);
                if (kpi12SoFalha) linhas = linhas.filter((d) => d.bateu === "Não");
                const totFalha = (kpi12FiltroRN === "TODOS" ? score5Det : score5Det.filter((d) => d.setor === kpi12FiltroRN)).filter((d) => d.bateu === "Não").length;
                const cab = { textAlign: "left", padding: "6px 8px", color: "rgba(255,255,255,0.5)", fontSize: "0.72rem", borderBottom: "1px solid rgba(255,255,255,0.1)", whiteSpace: "nowrap" };
                const cel = { padding: "5px 8px", fontSize: "0.78rem", borderBottom: "1px solid rgba(255,255,255,0.05)" };
                return (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "rgba(255,255,255,0.8)" }}>📋 Detalhe por PDV</span>
                      <select value={kpi12FiltroRN} onChange={(e) => setKpi12FiltroRN(e.target.value)}
                        style={{ background: "#13231a", color: "#fff", border: "1px solid rgba(125,186,61,0.3)", borderRadius: 6, padding: "4px 8px", fontSize: "0.78rem" }}>
                        <option value="TODOS">Todos os RNs</option>
                        {rns.map((s) => <option key={s} value={s}>Setor {s}</option>)}
                      </select>
                      <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.78rem", color: "rgba(255,255,255,0.6)", cursor: "pointer" }}>
                        <input type="checkbox" checked={kpi12SoFalha} onChange={(e) => setKpi12SoFalha(e.target.checked)} />
                        Só não bateram ({totFalha})
                      </label>
                      <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.4)", fontSize: "0.74rem" }}>{linhas.length} PDVs</span>
                    </div>
                    <div style={{ overflowX: "auto", maxHeight: 420, overflowY: "auto", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8 }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead style={{ position: "sticky", top: 0, background: "#0e1a13" }}>
                          <tr>
                            <th style={cab}>Setor</th><th style={cab}>Cód PDV</th><th style={cab}>PDV</th>
                            <th style={{ ...cab, textAlign: "center" }}>Bateu</th>
                            <th style={{ ...cab, textAlign: "right" }}>Meta</th>
                            <th style={{ ...cab, textAlign: "right" }}>Realizado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {linhas.slice(0, 400).map((d, i) => {
                            const ok = d.bateu === "Sim";
                            return (
                              <tr key={i}>
                                <td style={cel}>{d.setor}</td>
                                <td style={{ ...cel, color: "rgba(255,255,255,0.5)" }}>{d.cod_pdv}</td>
                                <td style={cel}>{d.nome_pdv || "—"}</td>
                                <td style={{ ...cel, textAlign: "center" }}>
                                  <span style={{ padding: "2px 8px", borderRadius: 10, fontSize: "0.7rem", fontWeight: 700, background: ok ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: ok ? "#4ade80" : "#f87171" }}>{d.bateu}</span>
                                </td>
                                <td style={{ ...cel, textAlign: "right", color: "rgba(255,255,255,0.5)" }}>{d.meta_task || "—"}</td>
                                <td style={{ ...cel, textAlign: "right", color: "rgba(255,255,255,0.5)" }}>{d.real_task || "—"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {linhas.length > 400 && <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.72rem", marginTop: 6 }}>Mostrando 400 de {linhas.length}. Use os filtros para refinar.</p>}
                  </div>
                );
              })()}
            </div>
            )}


            {/* TASKS NAB */}
            {SH.mostra(kpiAtivo, 13) && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 13 — Tasks de Portfólio NAB</h3>
              {renderTabelaTasks(tasksNab, 13)}
            </div>
            )}


    </>
  );
}
