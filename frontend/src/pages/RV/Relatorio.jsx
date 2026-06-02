// Relatório de RV — PDF timbrado para diretoria
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";

const META_PONTOS = 100_000;

// ── helpers ──────────────────────────────────────────────────────────────────
const n = (v) => parseFloat(v || 0);
const brl = (v) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (real, meta) => meta > 0 ? Math.min((real / meta) * 100, 150) : 0;
const normPeso = (val, fallback) => { const v = n(val); return (v > 0 && v <= 100) ? v : fallback; };

function calcRv(real, meta, peso, po, apOk, minPct = 70) {
  if (!apOk || !meta) return 0;
  const p = pct(real, meta);
  if (p < minPct) return 0;
  return (po * peso / 100) * (p / 100);
}
function calcPot(real, meta, peso, po, minPct = 70) {
  if (!meta) return 0;
  const p = pct(real, meta);
  if (p < minPct) return 0;
  return (po * peso / 100) * (p / 100);
}

function rvRN(r) {
  const apOk = r.ap_ok === "OK";
  const po   = n(r.po_total);
  const seg  = r.segmento || "OFF";

  const pesoPt  = normPeso(r.peso_pontos, 50);
  const pctPt   = pct(n(r.pontos_real), META_PONTOS);
  const rvPt    = apOk && pctPt >= 70 ? (po * pesoPt / 100) * (pctPt / 100) : 0;

  const pesoCv  = normPeso(r.peso_cerveja, 25);
  const pesoNb  = normPeso(r.peso_nab, 15);
  const rvCv    = calcRv(n(r.real_cerveja), n(r.meta_cerveja), pesoCv, po, apOk);
  const rvNb    = calcRv(n(r.real_nab), n(r.meta_nab), pesoNb, po, apOk);

  const isOff   = seg === "OFF";
  const pesoVar = normPeso(isOff ? r.peso_match : r.peso_marketplace, 10);
  const realVar = n(isOff ? r.real_match : r.real_marketplace);
  const metaVar = n(isOff ? r.meta_match : r.meta_marketplace);
  const rvVar   = calcRv(realVar, metaVar, pesoVar, po, apOk);

  const total   = rvPt + rvCv + rvNb + rvVar;
  const potPt   = pctPt >= 70 ? (po * pesoPt / 100) * (pctPt / 100) : 0;
  const pot     = potPt + calcPot(n(r.real_cerveja), n(r.meta_cerveja), pesoCv, po) +
                  calcPot(n(r.real_nab), n(r.meta_nab), pesoNb, po) +
                  calcPot(realVar, metaVar, pesoVar, po);

  return {
    apOk, po, seg, pesoPt, pctPt, rvPt,
    pesoCv, rvCv, pesoNb, rvNb,
    pesoVar, realVar, metaVar, rvVar,
    total, pot,
    varLabel: isOff ? "Match" : "Marketplace",
  };
}

// ── componente principal ──────────────────────────────────────────────────────
export default function RVRelatorio() {
  const navigate = useNavigate();
  const [dados, setDados]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro]     = useState("");
  const [mesRef, setMesRef] = useState(() => {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  useEffect(() => { carregar(); }, [mesRef]);

  async function carregar() {
    setLoading(true); setErro("");
    try {
      const res = await api.get("/api/rv/relatorio");
      setDados(res.data || []);
    } catch { setErro("Erro ao carregar dados de RV."); }
    finally { setLoading(false); }
  }

  const hoje = new Date().toLocaleDateString("pt-BR");
  const [anoRef, mesNum] = mesRef.split("-");
  const nomeMes = new Date(Number(anoRef), Number(mesNum) - 1, 1)
    .toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  // totais consolidados
  const totais = dados.reduce((acc, r) => {
    const c = rvRN(r);
    acc.po    += c.po;
    acc.total += c.total;
    acc.pot   += c.pot;
    return acc;
  }, { po: 0, total: 0, pot: 0 });

  return (
    <div style={{ fontFamily: "Arial, sans-serif", background: "#fff", color: "#111", minHeight: "100vh" }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { size: A4; margin: 12mm 15mm 15mm 15mm; }
          .page-break { page-break-before: always; }
          .avoid-break { page-break-inside: avoid; }
        }
        @media screen {
          .rv-relatorio-wrap { max-width: 900px; margin: 0 auto; padding: 24px 20px 60px; }
        }
      `}</style>

      {/* ── Toolbar (somente tela) ── */}
      <div className="no-print" style={{ background: "#0a0f1e", padding: "12px 20px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        <button onClick={() => navigate(-1)} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", padding: "7px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem", fontFamily: "inherit" }}>
          ← Voltar
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.75rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.06em" }}>Competência</label>
          <input type="month" value={mesRef} onChange={e => setMesRef(e.target.value)}
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px", color: "#fff", padding: "6px 10px", fontSize: "0.85rem", fontFamily: "inherit", colorScheme: "dark" }} />
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={() => window.print()}
          style={{ background: "linear-gradient(135deg,#fbb900,#e6a200)", color: "#0a0f1e", border: "none", borderRadius: "8px", padding: "8px 20px", fontWeight: "700", fontSize: "0.9rem", cursor: "pointer", fontFamily: "inherit" }}>
          📄 Imprimir / Salvar PDF
        </button>
      </div>

      <div className="rv-relatorio-wrap">
        {loading && <p style={{ textAlign: "center", color: "#888", padding: "60px 0" }}>Carregando dados...</p>}
        {erro   && <p style={{ textAlign: "center", color: "#c00", padding: "40px 0" }}>{erro}</p>}

        {!loading && !erro && (
          <>
            {/* ══════════════════════════════════════════════════════
                CABEÇALHO TIMBRADO
            ══════════════════════════════════════════════════════ */}
            <div className="avoid-break" style={{ borderBottom: "4px solid #e6a200", marginBottom: "24px", paddingBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
                {/* Identidade */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ width: "44px", height: "44px", background: "#fbb900", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "900", fontSize: "1.1rem", color: "#0a0f1e", flexShrink: 0 }}>
                      CMD
                    </div>
                    <div>
                      <div style={{ fontWeight: "900", fontSize: "1.05rem", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                        Ambev · Conde
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "#666", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                        Sistema de Gestão Comercial
                      </div>
                    </div>
                  </div>
                </div>
                {/* Título do relatório */}
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: "800", fontSize: "1rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Relatório de Remuneração Variável
                  </div>
                  <div style={{ fontSize: "0.82rem", color: "#444", marginTop: "2px", textTransform: "capitalize" }}>
                    Competência: {nomeMes}
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "#888", marginTop: "2px" }}>
                    Emitido em {hoje}
                  </div>
                </div>
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════
                TABELA RESUMO
            ══════════════════════════════════════════════════════ */}
            <div className="avoid-break" style={{ marginBottom: "28px" }}>
              <h2 style={{ fontSize: "0.82rem", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.06em", borderLeft: "4px solid #fbb900", paddingLeft: "8px", margin: "0 0 10px" }}>
                Resumo Consolidado
              </h2>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                <thead>
                  <tr style={{ background: "#111", color: "#fff" }}>
                    {["Setor","Representante","Seg.","AP","PO Total","Pontos Force","Cerveja","NAB","Variável","RV Total"].map(h => (
                      <th key={h} style={{ padding: "7px 8px", textAlign: h === "RV Total" || h === "PO Total" ? "right" : "left", fontWeight: "700", fontSize: "0.72rem", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dados.map((r, i) => {
                    const c = rvRN(r);
                    const pctCv = pct(n(r.real_cerveja), n(r.meta_cerveja));
                    const pctNb = pct(n(r.real_nab), n(r.meta_nab));
                    const pctVr = pct(c.realVar, c.metaVar);
                    return (
                      <tr key={r.setor} style={{ background: i % 2 === 0 ? "#f8f8f8" : "#fff", borderBottom: "1px solid #ddd" }}>
                        <td style={{ padding: "6px 8px", fontWeight: "700" }}>{r.setor}</td>
                        <td style={{ padding: "6px 8px", maxWidth: "130px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.nome_rn}</td>
                        <td style={{ padding: "6px 8px", textAlign: "center" }}>
                          <span style={{ background: c.seg === "OFF" ? "#e8f0fe" : "#fef3e8", color: c.seg === "OFF" ? "#1a56db" : "#b45309", padding: "1px 6px", borderRadius: "4px", fontWeight: "700", fontSize: "0.7rem" }}>{c.seg}</span>
                        </td>
                        <td style={{ padding: "6px 8px", textAlign: "center" }}>
                          <span style={{ color: c.apOk ? "#16a34a" : "#dc2626", fontWeight: "700" }}>{c.apOk ? "✓" : "✗"}</span>
                        </td>
                        <td style={{ padding: "6px 8px", textAlign: "right" }}>R$ {brl(c.po)}</td>
                        <td style={{ padding: "6px 8px", textAlign: "center", color: c.pctPt >= 100 ? "#16a34a" : c.pctPt >= 70 ? "#b45309" : "#dc2626", fontWeight: "600" }}>
                          {c.pctPt.toFixed(1)}%
                        </td>
                        <td style={{ padding: "6px 8px", textAlign: "center", color: pctCv >= 100 ? "#16a34a" : pctCv >= 70 ? "#b45309" : "#dc2626", fontWeight: "600" }}>
                          {pctCv.toFixed(1)}%
                        </td>
                        <td style={{ padding: "6px 8px", textAlign: "center", color: pctNb >= 100 ? "#16a34a" : pctNb >= 70 ? "#b45309" : "#dc2626", fontWeight: "600" }}>
                          {pctNb.toFixed(1)}%
                        </td>
                        <td style={{ padding: "6px 8px", textAlign: "center", color: pctVr >= 100 ? "#16a34a" : pctVr >= 70 ? "#b45309" : "#dc2626", fontWeight: "600" }}>
                          {pctVr.toFixed(1)}%
                        </td>
                        <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: "800", fontSize: "0.85rem", color: c.apOk ? "#0a0f1e" : "#dc2626" }}>
                          R$ {brl(c.total)}
                          {!c.apOk && <div style={{ fontSize: "0.65rem", color: "#dc2626", fontWeight: "400" }}>AP NOK</div>}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Totais */}
                  <tr style={{ background: "#111", color: "#fff", fontWeight: "700", borderTop: "2px solid #fbb900" }}>
                    <td colSpan={4} style={{ padding: "7px 8px", fontSize: "0.75rem", letterSpacing: "0.04em" }}>TOTAL OPERAÇÃO</td>
                    <td style={{ padding: "7px 8px", textAlign: "right" }}>R$ {brl(totais.po)}</td>
                    <td colSpan={4} style={{ padding: "7px 8px", textAlign: "center", fontSize: "0.72rem", color: "rgba(255,255,255,0.5)" }}>
                      Potencial: R$ {brl(totais.pot)}
                    </td>
                    <td style={{ padding: "7px 8px", textAlign: "right", color: "#fbb900", fontSize: "0.95rem" }}>
                      R$ {brl(totais.total)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ══════════════════════════════════════════════════════
                DETALHAMENTO POR RN
            ══════════════════════════════════════════════════════ */}
            <div className="page-break" />

            <h2 style={{ fontSize: "0.82rem", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.06em", borderLeft: "4px solid #fbb900", paddingLeft: "8px", margin: "0 0 16px" }}>
              Detalhamento por Representante
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px" }}>
              {dados.map((r) => {
                const c = rvRN(r);
                const ap = r.ap_detalhe;
                const rows = [
                  { label: "Pontos Force", peso: c.pesoPt, real: n(r.pontos_real).toLocaleString("pt-BR"), meta: META_PONTOS.toLocaleString("pt-BR"), pctVal: c.pctPt, rv: c.rvPt, unit: "pts", minPct: 70 },
                  { label: "Cerveja", peso: c.pesoCv, real: `${n(r.real_cerveja).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} HL`, meta: `${n(r.meta_cerveja).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} HL`, pctVal: pct(n(r.real_cerveja), n(r.meta_cerveja)), rv: c.rvCv, unit: "HL" },
                  { label: "NAB", peso: c.pesoNb, real: `${n(r.real_nab).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} HL`, meta: `${n(r.meta_nab).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} HL`, pctVal: pct(n(r.real_nab), n(r.meta_nab)), rv: c.rvNb, unit: "HL" },
                  { label: c.varLabel, peso: c.pesoVar, real: c.seg === "OFF" ? `${c.realVar.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} HL` : `R$ ${brl(c.realVar)}`, meta: c.seg === "OFF" ? `${c.metaVar.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} HL` : `R$ ${brl(c.metaVar)}`, pctVal: pct(c.realVar, c.metaVar), rv: c.rvVar, unit: c.seg === "OFF" ? "HL" : "R$" },
                ];
                return (
                  <div key={r.setor} className="avoid-break" style={{ border: `2px solid ${c.apOk ? "#e5e7eb" : "#fca5a5"}`, borderRadius: "8px", overflow: "hidden", fontSize: "0.75rem" }}>
                    {/* Card header */}
                    <div style={{ background: "#111", color: "#fff", padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <span style={{ fontWeight: "800", fontSize: "0.88rem" }}>Setor {r.setor}</span>
                        <span style={{ marginLeft: "8px", color: "rgba(255,255,255,0.6)", fontSize: "0.72rem" }}>{r.nome_rn}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ background: c.seg === "OFF" ? "#1d4ed8" : "#b45309", color: "#fff", padding: "1px 6px", borderRadius: "4px", fontWeight: "700", fontSize: "0.68rem" }}>{c.seg}</span>
                        <span style={{ background: c.apOk ? "#16a34a" : "#dc2626", color: "#fff", padding: "2px 8px", borderRadius: "4px", fontWeight: "700", fontSize: "0.72rem" }}>
                          AP {c.apOk ? "OK ✓" : "NOK ✗"}
                        </span>
                      </div>
                    </div>

                    {/* PO + AP details */}
                    <div style={{ background: "#f9fafb", padding: "6px 12px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: "600" }}>PO Total: <strong>R$ {brl(c.po)}</strong></span>
                      {ap && (
                        <div style={{ display: "flex", gap: "10px", fontSize: "0.68rem", color: "#555" }}>
                          {[
                            { l: "Compras", r: ap.tasks_compra_real, m: ap.tasks_compra_meta },
                            { l: "Compradores", r: ap.compradores_real, m: ap.compradores_meta },
                            { l: "Rota", r: ap.rota_efetiva_real, m: ap.rota_efetiva_meta },
                            { l: "GPS", r: ap.gps_real, m: ap.gps_meta },
                          ].map(({ l, r: rv, m }) => {
                            const ok = n(rv) >= n(m);
                            return (
                              <span key={l} style={{ color: ok ? "#16a34a" : "#dc2626" }}>
                                {l}: {n(rv).toFixed(0)}/{n(m).toFixed(0)} {ok ? "✓" : "✗"}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Indicadores */}
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: "#f3f4f6", borderBottom: "1px solid #ddd" }}>
                          <th style={{ padding: "5px 8px", textAlign: "left", fontWeight: "600", color: "#666", fontSize: "0.68rem" }}>Indicador</th>
                          <th style={{ padding: "5px 8px", textAlign: "center", fontWeight: "600", color: "#666", fontSize: "0.68rem" }}>Peso</th>
                          <th style={{ padding: "5px 8px", textAlign: "right", fontWeight: "600", color: "#666", fontSize: "0.68rem" }}>Meta</th>
                          <th style={{ padding: "5px 8px", textAlign: "right", fontWeight: "600", color: "#666", fontSize: "0.68rem" }}>Realizado</th>
                          <th style={{ padding: "5px 8px", textAlign: "center", fontWeight: "600", color: "#666", fontSize: "0.68rem" }}>%</th>
                          <th style={{ padding: "5px 8px", textAlign: "right", fontWeight: "600", color: "#666", fontSize: "0.68rem" }}>Parcela</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, i) => {
                          const cor = row.pctVal >= 100 ? "#16a34a" : row.pctVal >= 70 ? "#b45309" : "#dc2626";
                          return (
                            <tr key={row.label} style={{ borderBottom: "1px solid #eee", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                              <td style={{ padding: "5px 8px", fontWeight: "600" }}>{row.label}</td>
                              <td style={{ padding: "5px 8px", textAlign: "center", color: "#555" }}>{row.peso}%</td>
                              <td style={{ padding: "5px 8px", textAlign: "right", color: "#444" }}>{row.meta}</td>
                              <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: "600" }}>{row.real}</td>
                              <td style={{ padding: "5px 8px", textAlign: "center", color: cor, fontWeight: "700" }}>{row.pctVal.toFixed(1)}%</td>
                              <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: "700", color: row.rv > 0 ? "#0a0f1e" : "#dc2626" }}>
                                R$ {brl(row.rv)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: c.apOk ? "#fefce8" : "#fef2f2", borderTop: "2px solid #e5e7eb" }}>
                          <td colSpan={5} style={{ padding: "6px 8px", fontWeight: "800", textAlign: "right", fontSize: "0.78rem", color: "#444" }}>
                            {!c.apOk && <span style={{ color: "#dc2626", marginRight: "8px", fontSize: "0.7rem" }}>AP NOK — RV bloqueada</span>}
                            TOTAL RV:
                          </td>
                          <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: "900", fontSize: "0.88rem", color: c.apOk ? "#0a0f1e" : "#dc2626" }}>
                            R$ {brl(c.total)}
                          </td>
                        </tr>
                        {!c.apOk && (
                          <tr style={{ background: "#fff7ed" }}>
                            <td colSpan={5} style={{ padding: "4px 8px", textAlign: "right", fontSize: "0.68rem", color: "#92400e" }}>
                              Potencial caso AP fosse OK:
                            </td>
                            <td style={{ padding: "4px 8px", textAlign: "right", fontSize: "0.78rem", fontWeight: "700", color: "#92400e" }}>
                              R$ {brl(c.pot)}
                            </td>
                          </tr>
                        )}
                      </tfoot>
                    </table>
                  </div>
                );
              })}
            </div>

            {/* ══════════════════════════════════════════════════════
                RODAPÉ
            ══════════════════════════════════════════════════════ */}
            <div style={{ marginTop: "40px", borderTop: "2px solid #e5e7eb", paddingTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.68rem", color: "#888", flexWrap: "wrap", gap: "4px" }}>
              <div>
                <strong style={{ color: "#444" }}>CMD Ambev · Conde</strong>
                {" · "}Sistema de Gestão Comercial
                {" · "}Relatório gerado em {hoje}
              </div>
              <div style={{ textAlign: "right" }}>
                Desenvolvido por <strong style={{ color: "#444" }}>Eduardo Arcanjo</strong>
                {" · "}CMD Conde App
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
