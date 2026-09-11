// Acompanhamento TEMPORÁRIO — Conversão Stella Pure Gold (dentro de Incentivos).
// Fácil de remover: apagar este arquivo + o <ConversaoPG/> no Incentivos/index.jsx
// + a rota /api/conversao-pg no backend.
//
// Analítico = COMPARATIVO ENTRE SKUs: escolha até 3 SKUs; a tabela lista todos os
// PDVs que compraram ≥1 deles no trimestre atual. Cada célula de SKU:
//   ✔ verde   = comprou ESTE mês
//   ✔ amarelo = comprou no tri (meses anteriores) mas não este mês
//   ✘ vermelho = não comprou no tri
import { useState, useEffect } from "react";
import * as XLSX from "xlsx-js-style";
import api from "../../services/api";

const VERDE = "#7DBA3D", AMARELO = "#f5c451", VERMELHO = "#f87171";
const COR = { atual: VERDE, anterior: AMARELO, nao: VERMELHO };
const MARK = { atual: "✔", anterior: "✔", nao: "✘" };
const XTXT = { atual: "V (este mês)", anterior: "V (tri)", nao: "X" };
const MAX = 3;

export default function ConversaoPG() {
  const [aberto, setAberto] = useState(false);
  const [skusDisp, setSkusDisp] = useState([]);   // catálogo p/ o seletor
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState([]);              // cods selecionados (até 3)
  const [comp, setComp] = useState(null);          // resultado do comparativo
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [rn, setRn] = useState("");
  // Mensagens (motor de faróis PG600/LN — mantido)
  const [msgs, setMsgs] = useState(null);
  const [msgOpen, setMsgOpen] = useState(false);
  const [msgLoading, setMsgLoading] = useState(false);
  const [copiado, setCopiado] = useState("");

  async function abrir() {
    if (aberto) { setAberto(false); return; }
    setAberto(true);
    if (skusDisp.length) return;
    try { const r = await api.get("/api/conversao-pg/skus", { timeout: 60000 }); setSkusDisp(r.data || []); }
    catch { setSkusDisp([]); }
  }

  // Recarrega o comparativo sempre que a seleção muda (1 a 3 SKUs).
  useEffect(() => {
    if (!aberto) return;
    if (!sel.length) { setComp(null); setErro(""); return; }
    let cancel = false;
    setLoading(true); setErro("");
    api.get(`/api/conversao-pg/comparativo?skus=${sel.join(",")}`, { timeout: 60000 })
      .then((r) => { if (!cancel) setComp(r.data); })
      .catch((e) => { if (!cancel) setErro(e?.response?.data?.error || "Erro ao carregar."); })
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [sel, aberto]);

  const nomeSku = (cod) => skusDisp.find((s) => s.cod === cod)?.nome || comp?.skus?.find((s) => s.cod === cod)?.nome || `SKU ${cod}`;
  const addSku = (cod) => { if (sel.includes(cod) || sel.length >= MAX) return; setSel([...sel, cod]); setBusca(""); };
  const remSku = (cod) => setSel(sel.filter((c) => c !== cod));

  const resultadosBusca = busca.trim().length >= 2
    ? skusDisp.filter((s) => !sel.includes(s.cod) && (s.nome.toLowerCase().includes(busca.trim().toLowerCase()) || s.cod.includes(busca.trim()))).slice(0, 25)
    : [];

  const pdvs = comp?.pdvs || [];
  const setores = [...new Set(pdvs.map((p) => p.setor).filter(Boolean))].sort();
  const filtrada = rn ? pdvs.filter((p) => String(p.setor) === String(rn)) : pdvs;

  async function verMensagens() {
    setMsgOpen(true);
    if (msgs) return;
    setMsgLoading(true);
    try { const r = await api.get("/api/conversao-pg/mensagens", { timeout: 60000 }); setMsgs(r.data); }
    catch { setMsgs({ rn: [], gv: [], erro: true }); }
    finally { setMsgLoading(false); }
  }
  function copiar(id, texto) {
    navigator.clipboard?.writeText(texto).then(() => { setCopiado(id); setTimeout(() => setCopiado(""), 1500); }).catch(() => {});
  }

  function exportar() {
    if (!comp || !filtrada.length) { alert("Sem linhas para exportar."); return; }
    const rows = filtrada.map((p) => {
      const base = { "Cod PDV": p.cod_pdv, "PDV": p.nome_pdv, "Setor": p.setor, "Dia visita": p.dia_visita };
      comp.skus.forEach((s, i) => { base[`${s.nome} (${s.cod})`] = XTXT[p.skus[i]] || "X"; });
      return base;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Comparativo SKUs");
    XLSX.writeFile(wb, `conversao_comparativo_${comp.trimestre || ""}.xlsx`);
  }

  return (
    <div style={S.wrap}>
      <button style={S.head} onClick={abrir}>
        <span style={S.headTit}>🎯 Conversão Stella Pure Gold {comp ? `· ${comp.trimestre}` : ""}</span>
        <span style={S.headSub}>
          {sel.length ? `${sel.length} SKU(s) · ${comp?.total ?? 0} PDVs` : "comparativo entre SKUs"}
          <span style={{ marginLeft: 8 }}>{aberto ? "▲" : "▼"}</span>
        </span>
      </button>

      {aberto && (
        <div style={S.body}>
          {/* Seletor de SKUs */}
          <p style={S.hint}>Escolha até {MAX} SKUs para comparar. A tabela mostra todos os PDVs que compraram ≥1 deles no trimestre atual.</p>
          <div style={S.chips}>
            {sel.map((c) => (
              <span key={c} style={S.chip}>{nomeSku(c)} <b style={{ opacity: 0.6 }}>({c})</b>
                <button style={S.chipX} onClick={() => remSku(c)}>✕</button>
              </span>
            ))}
            {!sel.length && <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.8rem" }}>nenhum SKU selecionado</span>}
          </div>
          {sel.length < MAX && (
            <div style={{ position: "relative", marginBottom: 12 }}>
              <input style={S.search} placeholder="Buscar SKU por nome ou código…" value={busca} onChange={(e) => setBusca(e.target.value)} />
              {resultadosBusca.length > 0 && (
                <div style={S.results}>
                  {resultadosBusca.map((s) => (
                    <button key={s.cod} style={S.resItem} onClick={() => addSku(s.cod)}>
                      <span style={{ color: "rgba(255,255,255,0.45)", fontVariantNumeric: "tabular-nums", marginRight: 8 }}>{s.cod}</span>{s.nome}
                    </button>
                  ))}
                </div>
              )}
              {busca.trim().length >= 2 && resultadosBusca.length === 0 && <div style={S.results}><span style={{ ...S.resItem, color: "rgba(255,255,255,0.4)", cursor: "default" }}>Nenhum SKU encontrado.</span></div>}
            </div>
          )}

          {/* Legenda */}
          <div style={S.legend}>
            <span><b style={{ color: VERDE }}>✔</b> comprou este mês</span>
            <span><b style={{ color: AMARELO }}>✔</b> comprou no tri (meses anteriores)</span>
            <span><b style={{ color: VERMELHO }}>✘</b> não comprou no tri</span>
          </div>

          {loading && <div style={S.msg}>Carregando… (pode levar ~50s no plano grátis)</div>}
          {erro && <div style={S.erro}>{erro}</div>}

          {comp && !loading && (
            <>
              <div style={S.tabRow}>
                {setores.length > 1 && (
                  <select style={S.select} value={rn} onChange={(e) => setRn(e.target.value)}>
                    <option value="">Todos os setores</option>
                    {setores.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
                <span style={S.count}>{filtrada.length} PDVs</span>
                <button style={S.msgBtn} onClick={verMensagens}>📱 Mensagens (RN/GV)</button>
                <button style={S.excel} onClick={exportar}>⤓ Excel</button>
              </div>

              <div style={S.tableWrap}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      {["Cod", "PDV", "Setor", "Dia visita"].map((h) => <th key={h} style={S.th}>{h}</th>)}
                      {comp.skus.map((s) => <th key={s.cod} style={S.thC} title={`${s.cod} — ${s.nome}`}>{s.nome}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {filtrada.map((p) => (
                      <tr key={p.cod_pdv} style={S.tr}>
                        <td style={S.tdPlain}>{p.cod_pdv}</td>
                        <td style={S.tdNome} title={p.nome_pdv}>{p.nome_pdv}</td>
                        <td style={S.tdPlain}>{p.setor}</td>
                        <td style={S.tdPlain}>{p.dia_visita || "—"}</td>
                        {p.skus.map((st, i) => (
                          <td key={i} style={{ ...S.tdC, color: COR[st] || VERMELHO }}>{MARK[st] || "✘"}</td>
                        ))}
                      </tr>
                    ))}
                    {!filtrada.length && <tr><td colSpan={4 + (comp.skus.length || 1)} style={S.vazio}>Ninguém comprou esses SKUs no trimestre. 🎉</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {msgOpen && (
        <div style={S.ovl} onClick={(e) => e.target === e.currentTarget && setMsgOpen(false)}>
          <div style={S.modal}>
            <div style={S.modalHead}>
              <span style={{ fontWeight: 700 }}>📱 Mensagens prontas {msgs?.trimestre ? `· ${msgs.trimestre}` : ""}</span>
              <button style={S.x} onClick={() => setMsgOpen(false)}>✕</button>
            </div>
            <div style={S.modalBody}>
              {msgLoading && <div style={S.msg}>Gerando mensagens…</div>}
              {msgs?.erro && <div style={S.erro}>Erro ao gerar. Tente de novo.</div>}
              {msgs && !msgLoading && !msgs.erro && (
                <>
                  <div style={S.grpTit}>Consolidado por GV ({msgs.gv.length})</div>
                  {msgs.gv.map((g) => <MsgCard key={"gv" + g.grupo} id={"gv" + g.grupo} titulo={`GV ${g.grupo}${g.nome ? " · " + g.nome : ""}`} tel={g.telefone} texto={g.texto} copiado={copiado} onCopy={copiar} />)}
                  <div style={{ ...S.grpTit, marginTop: 14 }}>Por RN ({msgs.rn.length})</div>
                  {msgs.rn.map((r) => <MsgCard key={"rn" + r.setor} id={"rn" + r.setor} titulo={`Setor ${r.setor}${r.nome ? " · " + r.nome : ""}`} tel={r.telefone} texto={r.texto} copiado={copiado} onCopy={copiar} />)}
                  {!msgs.rn.length && !msgs.gv.length && <div style={S.msg}>Sem PDVs no recorte.</div>}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MsgCard({ id, titulo, tel, texto, copiado, onCopy }) {
  return (
    <div style={S.mcard}>
      <div style={S.mhead}>
        <span style={{ fontWeight: 600, fontSize: "0.84rem" }}>{titulo}</span>
        <span style={S.tel}>{tel ? `📞 ${tel}` : "sem telefone"}</span>
        <button style={S.copy} onClick={() => onCopy(id, texto)}>{copiado === id ? "✓ copiado" : "⧉ copiar"}</button>
      </div>
      <textarea readOnly style={S.ta} value={texto} rows={Math.min(14, texto.split("\n").length + 1)} />
    </div>
  );
}

const S = {
  wrap: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(125,186,61,0.3)", borderRadius: 14, marginBottom: 20, overflow: "hidden" },
  head: { width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", background: "rgba(125,186,61,0.08)", border: "none", color: "#fff", padding: "14px 18px", cursor: "pointer", fontFamily: "inherit", textAlign: "left" },
  headTit: { fontWeight: 700, fontSize: "0.95rem" },
  headSub: { fontSize: "0.78rem", color: "rgba(255,255,255,0.5)" },
  body: { padding: "14px 18px 18px" },
  chips: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10, minHeight: 30 },
  chip: { display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(125,186,61,0.16)", border: "1px solid #7DBA3D", color: "#dfeecb", borderRadius: 18, padding: "4px 8px 4px 12px", fontSize: "0.8rem" },
  chipX: { background: "transparent", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: "0.85rem", padding: 0, lineHeight: 1 },
  search: { width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff", padding: "8px 12px", fontSize: "0.85rem", fontFamily: "inherit", outline: "none" },
  results: { position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20, marginTop: 4, background: "#111c16", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 8, maxHeight: 260, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" },
  resItem: { display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", borderBottom: "1px solid rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.85)", padding: "8px 12px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.82rem" },
  legend: { display: "flex", gap: 16, flexWrap: "wrap", fontSize: "0.76rem", color: "rgba(255,255,255,0.55)", margin: "2px 0 12px", padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" },
  tabRow: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 },
  select: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff", padding: "6px 10px", fontSize: "0.82rem", fontFamily: "inherit", outline: "none" },
  count: { color: "rgba(255,255,255,0.4)", fontSize: "0.8rem" },
  msgBtn: { marginLeft: "auto", background: "rgba(37,211,102,0.12)", border: "1px solid rgba(37,211,102,0.4)", color: "#25d366", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.8rem", fontWeight: 600 },
  excel: { background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.4)", color: "#4ade80", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.8rem", fontWeight: 600 },
  ovl: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000, padding: 16 },
  modal: { background: "#111c16", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, width: "100%", maxWidth: 640, maxHeight: "88vh", display: "flex", flexDirection: "column", overflow: "hidden" },
  modalHead: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.08)", fontSize: "0.95rem" },
  x: { background: "transparent", border: "none", color: "rgba(255,255,255,0.5)", fontSize: "1.1rem", cursor: "pointer" },
  modalBody: { padding: "12px 18px 18px", overflowY: "auto" },
  grpTit: { color: VERDE, fontSize: "0.76rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", margin: "4px 0 8px" },
  mcard: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 10, marginBottom: 8 },
  mhead: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 },
  tel: { color: "rgba(255,255,255,0.45)", fontSize: "0.76rem" },
  copy: { marginLeft: "auto", background: "rgba(37,211,102,0.14)", border: "1px solid rgba(37,211,102,0.4)", color: "#25d366", borderRadius: 7, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.76rem", fontWeight: 600 },
  ta: { width: "100%", boxSizing: "border-box", background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "rgba(255,255,255,0.85)", padding: "8px 10px", fontSize: "0.78rem", fontFamily: "inherit", resize: "vertical", lineHeight: 1.4 },
  hint: { margin: "2px 0 10px", fontSize: "0.78rem", color: "rgba(255,255,255,0.45)" },
  tableWrap: { overflowX: "auto", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" },
  th: { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)", fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", padding: "8px 10px", textAlign: "left", whiteSpace: "nowrap", borderBottom: "1px solid rgba(255,255,255,0.08)" },
  thC: { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)", fontSize: "0.7rem", fontWeight: 600, padding: "8px 10px", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", minWidth: 90 },
  tr: { borderBottom: "1px solid rgba(255,255,255,0.05)" },
  tdPlain: { padding: "7px 10px", color: "rgba(255,255,255,0.55)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" },
  tdNome: { padding: "7px 10px", color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 240 },
  tdC: { padding: "7px 10px", textAlign: "center", fontWeight: 700, fontSize: "1rem" },
  vazio: { padding: 16, textAlign: "center", color: "rgba(255,255,255,0.35)" },
  msg: { color: "rgba(255,255,255,0.45)", fontSize: "0.85rem", padding: "8px 0" },
  erro: { background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", borderRadius: 8, padding: "10px 14px", fontSize: "0.85rem" },
};
