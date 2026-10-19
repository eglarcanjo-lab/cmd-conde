// SPO — blocos de KPI: Cupons digitais, Loja Ideal, Scanntech, Portfólio Ideal Score 5, Atendimento Produtivo (KPIs 5, 21–24).
// Recebe o estado/funções da tela via `ctx` (montado em index.jsx). Só desenha; não guarda estado.
import * as SH from "./shared";

export default function KpisProgramas({ ctx }) {
  const {
    BarraProgresso, rmBig, rmCard, rmLbl, styles
  } = SH;
  const {
    ap, apDet, apFiltroGV, apFiltroStatus, apMes, cupons, cuponsDet, cuponsDia, cuponsGV, cuponsMarca,
    cuponsRN, fmtMes, kpiAtivo, lojaFiltroDia, lojaFiltroRN, lojaFiltroStatus, lojaIdeal, lojaIdealDet,
    portFiltroDia, portFiltroGV, portFiltroRN, portFiltroStatus, portIdeal, portIdealDet, scanFiltroDia,
    scanFiltroRN, scanFiltroStatus, scanntech, scanntechDet, setApFiltroGV, setApFiltroStatus, setApMes,
    setCuponsDia, setCuponsGV, setCuponsMarca, setCuponsRN, setLojaFiltroDia, setLojaFiltroRN,
    setLojaFiltroStatus, setPortFiltroDia, setPortFiltroGV, setPortFiltroRN, setPortFiltroStatus,
    setScanFiltroDia, setScanFiltroRN, setScanFiltroStatus, spoMetaTotal
  } = ctx;
  return (
    <>
            {/* CUPONS DIGITAIS */}
            {SH.mostra(kpiAtivo, 21) && (
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
                      const cor  = pct === null ? "#7DBA3D" : pct >= 100 ? "#4ade80" : pct >= 70 ? "#7DBA3D" : "#f87171";
                      return (
                        <div key={r.setor} style={{ ...styles.gvCard, ...(isOp ? { border: "1px solid rgba(125,186,61,0.3)", gridColumn: "1/-1" } : {}) }}>
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
                                <td style={{ padding: "7px 10px", color: "#7DBA3D" }}>{r.campanha}</td>
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
            {SH.mostra(kpiAtivo, 22) && (
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
                      const cor = pct >= 40 ? "#4ade80" : pct >= 25 ? "#7DBA3D" : "#f87171";
                      const isOp = r.setor === "OPERACAO";
                      return (
                        <div key={r.setor} style={{ ...styles.gvCard, ...(isOp ? { border: "1px solid rgba(125,186,61,0.3)", gridColumn: "1/-1" } : {}) }}>
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
                              const cor = pts >= 60 ? "#4ade80" : pts >= 40 ? "#7DBA3D" : "#f87171";
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
            {SH.mostra(kpiAtivo, 23) && (
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
                    const cor   = pct >= 100 ? "#4ade80" : pct >= 70 ? "#7DBA3D" : "#f87171";
                    const okBadge = mOp !== null ? real >= mOp : opRow?.ok === "OK";
                    return (
                      <div style={{ ...styles.gvCard, border: "1px solid rgba(125,186,61,0.3)", marginBottom: "14px" }}>
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
            {SH.mostra(kpiAtivo, 24) && (
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
                      const cor = pct >= 46 ? "#4ade80" : pct >= 30 ? "#7DBA3D" : "#f87171";
                      const isOp = r.setor === "OPERACAO";
                      return (
                        <div key={r.setor} style={{ ...styles.gvCard, ...(isOp ? { border: "1px solid rgba(125,186,61,0.3)", gridColumn: "1/-1" } : {}) }}>
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
                                <td style={{ padding: "7px 10px", color: "#7DBA3D", fontSize: "0.75rem" }}>{r.itens_faltantes}</td>
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
            {SH.mostra(kpiAtivo, 5) && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 5 — Atendimento Produtivo</h3>
              {ap.length === 0 && apDet.length === 0 ? (
                <p style={styles.msg}>Importe o relatório de Atendimento Produtivo para calcular automaticamente.</p>
              ) : (() => {
                // O detalhe/resumo do AP acumula por mês — cada mês do tri vira um card.
                const mesesAp = [...new Set([...apDet, ...ap].map((r) => r.mes_referencia).filter(Boolean))].sort();
                const mesAtivo = (apMes && mesesAp.includes(apMes)) ? apMes : (mesesAp[mesesAp.length - 1] || "");
                const opDoMes = (m) => ap.find((r) => r.setor === "OPERACAO" && r.mes_referencia === m) || {};
                const detMes = apDet
                  .filter((r) => (mesAtivo ? r.mes_referencia === mesAtivo : true))
                  .filter((r) => (apFiltroGV === "TODOS" || r.gv === apFiltroGV) && (apFiltroStatus === "TODOS" || r.ap_ok === apFiltroStatus))
                  .sort((a, b) => String(a.setor).localeCompare(String(b.setor), undefined, { numeric: true }));
                return (
                <>
                  {/* Cards por mês do tri — clique troca o mês da tabela */}
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "16px" }}>
                    {mesesAp.map((m) => {
                      const o = opDoMes(m);
                      const pct = parseFloat(o.pct || 0);
                      const cor = pct >= 90 ? "#4ade80" : pct >= 60 ? "#7DBA3D" : "#f87171";
                      const sel = m === mesAtivo;
                      return (
                        <div key={m} onClick={() => setApMes(m)}
                          style={{ ...rmCard, cursor: "pointer", minWidth: "116px", border: sel ? "2px solid #7DBA3D" : "1px solid rgba(255,255,255,0.08)", background: sel ? "rgba(125,186,61,0.08)" : "rgba(255,255,255,0.04)" }}>
                          <div style={rmLbl}>{fmtMes(m)}</div>
                          <div style={rmBig(cor)}>{pct}%</div>
                          <div style={rmLbl}>{o.rns_ap_ok ?? "—"}/{o.rns_total ?? "—"} RNs</div>
                        </div>
                      );
                    })}
                    {mesesAp.length === 0 && <p style={styles.msg}>Sem mês de referência no dado importado.</p>}
                  </div>
                  {/* Tabela por RN do mês selecionado — ordem crescente de setor */}
                  {apDet.length > 0 && (
                    <>
                      <div style={{ display: "flex", gap: "8px", marginBottom: "10px", flexWrap: "wrap", alignItems: "center" }}>
                        {[
                          { label: "GV",     val: apFiltroGV,     set: setApFiltroGV,     opts: ["TODOS", ...new Set(apDet.filter((r) => (mesAtivo ? r.mes_referencia === mesAtivo : true)).map((r) => r.gv).filter(Boolean))].sort() },
                          { label: "AP OK",  val: apFiltroStatus, set: setApFiltroStatus, opts: ["TODOS", "Sim", "Não"] },
                        ].map(({ label, val, set, opts }) => (
                          <select key={label} value={val} onChange={e => set(e.target.value)}
                            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "#fff", padding: "4px 10px", fontSize: "0.8rem", cursor: "pointer" }}>
                            {opts.map(o => <option key={o} value={o}>{label}: {o}</option>)}
                          </select>
                        ))}
                        <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.4)", fontSize: "0.78rem" }}>{fmtMes(mesAtivo)} · {detMes.length} RNs</span>
                      </div>
                      <div style={{ overflowX: "auto", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
                          <thead>
                            <tr>
                              {["GV","RN","Segmento","AP OK","KPIs OK","Positivação","Carteira","GPS %","Rota %"].map(h => (
                                <th key={h} style={{ padding: "8px 10px", color: "rgba(255,255,255,0.4)", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {detMes.map((r, i) => {
                              const corAP = r.ap_ok === "Sim" ? "#4ade80" : "#f87171";
                              const corKPI = parseInt(r.kpis_ok) === 4 ? "#4ade80" : parseInt(r.kpis_ok) >= 2 ? "#7DBA3D" : "#f87171";
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
                                  <td style={{ padding: "7px 10px", textAlign: "center", color: parseFloat(r.positiv_real) >= parseFloat(r.positiv_meta) ? "#4ade80" : "#f87171" }}>{r.positiv_real !== null && r.positiv_real !== "" ? r.positiv_real : "—"}</td>
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
                );
              })()}
            </div>
            )}

    </>
  );
}
