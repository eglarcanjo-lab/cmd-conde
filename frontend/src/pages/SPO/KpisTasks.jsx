// SPO — blocos de KPI: Tasks SKU/PDV TT, Volume, Marketplace, Match, Cerveja Zero, Digitalização, +LN, Compra independente, +RGB (KPIs 14–20, 26, 27).
// Recebe o estado/funções da tela via `ctx` (montado em index.jsx). Só desenha; não guarda estado.
import * as SH from "./shared";

export default function KpisTasks({ ctx }) {
  const {
    BarraProgresso, styles
  } = SH;
  const {
    alone, aloneDetalhe, aloneFiltroDia, aloneFiltroPDV, aloneFiltroRN, aloneView, kpiAtivo, lnRN,
    lnSoFalha, renderTabelaTasks, rgb, rgbInt, rgbLit, setAloneFiltroDia, setAloneFiltroPDV,
    setAloneFiltroRN, setAloneView, setLnRN, setLnSoFalha, setSkuCat, setSkuRN, setSkuSoAbertas, skuCat,
    skuRN, skuSoAbertas, soMesVivo, spoMetaTotal, tasksCervZero, tasksDigit, tasksLn, tasksLnDet,
    tasksMatch, tasksMktp, tasksSkuPdv, tasksSkuPdvDet, tasksVolume
  } = ctx;
  return (
    <>
            {/* TASKS SKU/PDV TT (KPI 26 / ord 13) */}
            {(kpiAtivo === null || kpiAtivo === 26) && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 13 — Tarefas de SKU/PDV TT</h3>
              <p style={{ fontSize: "0.76rem", color: "rgba(255,255,255,0.45)", margin: "0 0 10px" }}>
                Realizado = Σ tasks <b>validadas</b> com o texto “SKUs distintos de <b>CERVEJA / NAB / MATCH / MARKETPLACE</b>” (clusters Desenvolvimento de Portfólio e Marketplace). Cestas (600mL, Long Neck, RGB…) não contam. Tri = acumulado (soma meta e real dos 3 meses).
              </p>
              {renderTabelaTasks(soMesVivo(tasksSkuPdv), 26)}
              {(() => {
                const op = soMesVivo(tasksSkuPdv).find((r) => r.setor === "OPERACAO");
                if (!op) return null;
                const CATS = [["cerveja", "🍺 Cerveja"], ["nab", "🥤 NAB"], ["match", "🔗 Match"], ["marketplace", "🛒 Marketplace"]];
                return (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8, marginTop: 12 }}>
                    {CATS.map(([k, l]) => {
                      const v = parseInt(op[`${k}_validas`] || 0), t = parseInt(op[`${k}_total`] || 0);
                      return (
                        <div key={k} style={{ ...styles.gvCard, padding: "10px 12px" }}>
                          <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.6)" }}>{l}</div>
                          <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#7DBA3D" }}>{v}<span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.35)", fontWeight: 400 }}> / {t} validadas</span></div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
              {tasksSkuPdvDet.length > 0 && (() => {
                const rns = [...new Set(tasksSkuPdvDet.map((d) => d.setor))].sort();
                let linhas = tasksSkuPdvDet;
                if (skuRN !== "TODOS") linhas = linhas.filter((d) => d.setor === skuRN);
                if (skuCat !== "TODAS") linhas = linhas.filter((d) => d.categoria === skuCat);
                if (skuSoAbertas) linhas = linhas.filter((d) => String(d.status).toUpperCase() !== "VALID");
                const corStatus = (s) => s === "VALID" ? ["rgba(34,197,94,0.15)", "#4ade80"] : s === "INVALID" ? ["rgba(239,68,68,0.15)", "#f87171"] : ["rgba(245,196,81,0.15)", "#f5c451"];
                const th = { padding: "8px 10px", color: "rgba(255,255,255,0.45)", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap", fontSize: "0.7rem" };
                const td = { padding: "7px 10px", textAlign: "center", whiteSpace: "nowrap" };
                const sel = { background: "#13231a", color: "#fff", border: "1px solid rgba(125,186,61,0.3)", borderRadius: 6, padding: "4px 8px", fontSize: "0.78rem" };
                return (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "rgba(255,255,255,0.8)" }}>📋 Detalhe por task</span>
                      <select value={skuRN} onChange={(e) => setSkuRN(e.target.value)} style={sel}>
                        <option value="TODOS">Todos os setores</option>
                        {rns.map((s) => <option key={s} value={s}>Setor {s}</option>)}
                      </select>
                      <select value={skuCat} onChange={(e) => setSkuCat(e.target.value)} style={sel}>
                        <option value="TODAS">Todas as categorias</option>
                        {["CERVEJA", "NAB", "MATCH", "MARKETPLACE"].map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.78rem", color: "rgba(255,255,255,0.6)", cursor: "pointer" }}>
                        <input type="checkbox" checked={skuSoAbertas} onChange={(e) => setSkuSoAbertas(e.target.checked)} /> Só não validadas
                      </label>
                      <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.4)", fontSize: "0.74rem" }}>{linhas.length} tasks</span>
                    </div>
                    <div style={{ overflowX: "auto", maxHeight: 460, overflowY: "auto", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8 }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                        <thead style={{ position: "sticky", top: 0, background: "#0e1a13" }}>
                          <tr>{["Setor", "PDV", "Categoria", "Task", "Solic.", "Comprou", "Status"].map((h) => <th key={h} style={{ ...th, textAlign: h === "Task" ? "left" : "center" }}>{h}</th>)}</tr>
                        </thead>
                        <tbody>
                          {linhas.slice(0, 500).map((r, i) => {
                            const st = String(r.status || "").toUpperCase();
                            const [bg, c] = corStatus(st);
                            return (
                              <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                <td style={{ ...td, color: "rgba(255,255,255,0.7)" }}>{r.setor}</td>
                                <td style={{ ...td, color: "rgba(255,255,255,0.5)" }}>{r.cod_pdv}</td>
                                <td style={{ ...td, color: "rgba(255,255,255,0.7)" }}>{r.categoria}</td>
                                <td style={{ ...td, textAlign: "left", color: "rgba(255,255,255,0.6)", maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis" }} title={r.descricao}>{r.descricao}</td>
                                <td style={{ ...td, color: "rgba(255,255,255,0.6)" }}>{r.qtd_solicitada || "—"}</td>
                                <td style={{ ...td, fontWeight: 700 }}>{r.qtd_comprada || "—"}</td>
                                <td style={td}><span style={{ padding: "2px 8px", borderRadius: 10, fontSize: "0.7rem", fontWeight: 700, background: bg, color: c }}>{st || "—"}</span></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {linhas.length > 500 && <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.72rem", marginTop: 6 }}>Mostrando 500 de {linhas.length}. Use os filtros.</p>}
                  </div>
                );
              })()}
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


            {/* TASKS MARKETPLACE */}
            {(kpiAtivo === null || kpiAtivo === 15) && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 15 — Tasks de Marketplace</h3>
              {renderTabelaTasks(tasksMktp, 15)}
            </div>
            )}


            {/* TASKS MATCH */}
            {(kpiAtivo === null || kpiAtivo === 16) && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 16 — Tasks de Portfólio MATCH</h3>
              {renderTabelaTasks(tasksMatch, 16)}
            </div>
            )}


            {/* TASKS CERVEJA ZERO */}
            {(kpiAtivo === null || kpiAtivo === 17) && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 17 — Tasks de Portfólio Cerveja Zero</h3>
              {renderTabelaTasks(tasksCervZero, 17)}
            </div>
            )}


            {/* TASKS DIGITALIZAÇÃO */}
            {(kpiAtivo === null || kpiAtivo === 18) && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 18 — Tasks de Digitalização</h3>
              <p style={{ fontSize: "0.74rem", color: "rgba(255,255,255,0.4)", margin: "0 0 8px" }}>
                % de tarefas efetivadas = <b>validadas / total</b> (cluster Digitalização BEES). Meta em %. Tri = média ponderada dos meses.
              </p>
              {renderTabelaTasks(tasksDigit, 18, { pct: true })}
            </div>
            )}

            {/* +LN — TASK SKU/PDV LONG NECK HE (KPI 27 / ord 19) */}
            {kpiAtivo === 27 && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Item 19 — +LN · Task SKU/PDV de Long Neck HE</h3>
              <p style={{ fontSize: "0.76rem", color: "rgba(255,255,255,0.45)", margin: "0 0 10px" }}>
                Realizado = nº de PDVs que <b>bateram</b> a task (compraram a meta de SKUs distintos de Long Neck HE). Marcas: Stella (STE), Stella Pure Gold (STE PG), Corona (COR), Corona Cero (CORZ), Spaten (SPT), Michelob (MIC).
              </p>
              {renderTabelaTasks(soMesVivo(tasksLn), 27)}
              {tasksLnDet.length > 0 && (() => {
                const rns = [...new Set(tasksLnDet.map((d) => d.setor))].sort();
                let linhas = tasksLnDet;
                if (lnRN !== "TODOS") linhas = linhas.filter((d) => d.setor === lnRN);
                if (lnSoFalha) linhas = linhas.filter((d) => String(d.bateu).toUpperCase() !== "OK");
                const flag = (v) => {
                  const s = String(v ?? "").trim().toUpperCase();
                  if (s === "1") return { t: "✔", c: "#4ade80" };   // comprando
                  if (s === "EST") return { t: "EST", c: "#f5c451" }; // estável: comprou jul-ago, não set
                  if (s === "INS") return { t: "INS", c: "#fb923c" }; // instável: comprou jul, não ago
                  if (s === "" || s === "NAN") return { t: "—", c: "rgba(255,255,255,0.3)" };
                  return { t: s, c: "rgba(255,255,255,0.5)" };
                };
                const th = { padding: "8px 10px", color: "rgba(255,255,255,0.45)", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap", fontSize: "0.7rem" };
                const td = { padding: "7px 10px", textAlign: "center", whiteSpace: "nowrap" };
                const PRODS = [["ste","STE"],["ste_pg","STE PG"],["cor","COR"],["corz","CORZ"],["spt","SPT"],["mic","MIC"]];
                return (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "rgba(255,255,255,0.8)" }}>📋 Detalhe por PDV</span>
                      <select value={lnRN} onChange={(e) => setLnRN(e.target.value)} style={{ background: "#13231a", color: "#fff", border: "1px solid rgba(125,186,61,0.3)", borderRadius: 6, padding: "4px 8px", fontSize: "0.78rem" }}>
                        <option value="TODOS">Todos os setores</option>
                        {rns.map((s) => <option key={s} value={s}>Setor {s}</option>)}
                      </select>
                      <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.78rem", color: "rgba(255,255,255,0.6)", cursor: "pointer" }}>
                        <input type="checkbox" checked={lnSoFalha} onChange={(e) => setLnSoFalha(e.target.checked)} /> Só não bateram
                      </label>
                      <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.4)", fontSize: "0.74rem" }}>{linhas.length} PDVs · ✔ comprando · EST estável (parou set) · INS instável (parou antes)</span>
                    </div>
                    <div style={{ overflowX: "auto", maxHeight: 460, overflowY: "auto", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8 }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                        <thead style={{ position: "sticky", top: 0, background: "#0e1a13" }}>
                          <tr>
                            {["Setor","PDV","Nome","Dia","Bateu","Meta","Real","Gap"].map((h) => <th key={h} style={{ ...th, textAlign: h === "Nome" ? "left" : "center" }}>{h}</th>)}
                            {PRODS.map(([,l]) => <th key={l} style={th}>{l}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {linhas.slice(0, 500).map((r, i) => {
                            const ok = String(r.bateu).toUpperCase() === "OK";
                            const gap = parseInt(r.gap) || 0;
                            return (
                              <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                <td style={{ ...td, color: "rgba(255,255,255,0.7)" }}>{r.setor}</td>
                                <td style={{ ...td, color: "rgba(255,255,255,0.5)" }}>{r.cod_pdv}</td>
                                <td style={{ ...td, textAlign: "left", color: "rgba(255,255,255,0.75)", maxWidth: 170, overflow: "hidden", textOverflow: "ellipsis" }}>{r.nome_pdv}</td>
                                <td style={{ ...td, color: "#4ade80", fontSize: "0.72rem" }}>{r.dia_visita || "—"}</td>
                                <td style={td}><span style={{ padding: "2px 8px", borderRadius: 10, fontSize: "0.7rem", fontWeight: 700, background: ok ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: ok ? "#4ade80" : "#f87171" }}>{r.bateu}</span></td>
                                <td style={{ ...td, color: "rgba(255,255,255,0.6)" }}>{r.meta}</td>
                                <td style={{ ...td, fontWeight: 700 }}>{r.real}</td>
                                <td style={{ ...td, color: gap > 0 ? "#f5c451" : "rgba(255,255,255,0.35)", fontWeight: gap > 0 ? 700 : 400 }}>{gap > 0 ? gap : "—"}</td>
                                {PRODS.map(([k]) => { const f = flag(r[k]); return <td key={k} style={{ ...td, color: f.c, fontWeight: 700, fontSize: f.t.length > 1 ? "0.68rem" : "0.9rem" }}>{f.t}</td>; })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {linhas.length > 500 && <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.72rem", marginTop: 6 }}>Mostrando 500 de {linhas.length}. Use os filtros.</p>}
                  </div>
                );
              })()}
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
                          style={{ background: aloneView === v ? "rgba(125,186,61,0.2)" : "transparent", border: "none", color: aloneView === v ? "#7DBA3D" : "rgba(255,255,255,0.4)", padding: "4px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "0.78rem", fontFamily: "inherit", fontWeight: aloneView === v ? "600" : "400" }}>
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
                    const cor   = pct >= 100 ? "#4ade80" : pct >= 70 ? "#7DBA3D" : "#f87171";
                    const okBadge = mOp !== null ? val >= mOp : opRow?.ok === "OK";
                    return (
                      <div style={{ ...styles.gvCard, border: "1px solid rgba(125,186,61,0.3)", marginBottom: "12px" }}>
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
                      const cor     = pct >= 100 ? "#4ade80" : pct >= 70 ? "#7DBA3D" : "#f87171";
                      const tarjaBg     = okBadge ? "rgba(74,222,128,0.08)" : pct >= 70 ? "rgba(125,186,61,0.08)" : "rgba(248,113,113,0.08)";
                      const tarjaBorder = okBadge ? "rgba(74,222,128,0.25)" : pct >= 70 ? "rgba(125,186,61,0.25)" : "rgba(248,113,113,0.25)";
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
                                <td style={{ padding: "7px 10px", color: "#7DBA3D", textAlign: "right", fontWeight: "600" }}>{r.pedidos_alone}</td>
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
                            const cor = pct >= 60 ? "#4ade80" : pct >= 40 ? "#7DBA3D" : "#f87171";
                            const isOp = r.setor === "OPERACAO";
                            return (
                              <div key={r.setor} style={{ ...styles.gvCard, ...(isOp ? { border: "1px solid rgba(125,186,61,0.3)", gridColumn: "1/-1" } : {}) }}>
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


    </>
  );
}
