// Acompanhamento TEMPORÁRIO — Conversão Stella Pure Gold (dentro de Incentivos).
// Fácil de remover: apagar este arquivo + o <ConversaoPG/> no Incentivos/index.jsx
// + a rota /api/conversao-pg no backend.
import { useState } from "react";
import * as XLSX from "xlsx-js-style";
import api from "../../services/api";

const VERDE = "#7DBA3D";
const check = (v) => (v ? "✔" : "✘");

export default function ConversaoPG() {
  const [aberto, setAberto] = useState(false);
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [tab, setTab] = useState("pg600");
  const [rn, setRn] = useState("");
  const [msgs, setMsgs] = useState(null);
  const [msgOpen, setMsgOpen] = useState(false);
  const [msgLoading, setMsgLoading] = useState(false);
  const [copiado, setCopiado] = useState("");

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

  async function abrir() {
    if (aberto) { setAberto(false); return; }
    setAberto(true);
    if (d) return;
    setLoading(true); setErro("");
    try {
      const r = await api.get("/api/conversao-pg", { timeout: 60000 });
      setD(r.data);
    } catch (e) { setErro(e?.response?.data?.error || "Erro ao carregar."); }
    finally { setLoading(false); }
  }

  const lista = tab === "pg600" ? (d?.pg600?.pdvs || []) : (d?.pgln?.pdvs || []);
  const setores = [...new Set(lista.map((p) => p.setor).filter(Boolean))].sort();
  const filtrada = rn ? lista.filter((p) => String(p.setor) === String(rn)) : lista;

  function exportar() {
    let rows;
    if (tab === "pg600") {
      rows = filtrada.map((p) => ({ "Cod PDV": p.cod_pdv, "PDV": p.nome_pdv, "Setor": p.setor, "Dia visita": p.dia_visita, "Última compra": p.ultima_compra, "Original 600": p.original ? "V" : "X", "Stella 600": p.stella ? "V" : "X", "Spaten 600": p.spaten ? "V" : "X", "Pure Gold 600": "X" }));
    } else {
      rows = filtrada.map((p) => ({ "Cod PDV": p.cod_pdv, "PDV": p.nome_pdv, "Setor": p.setor, "Dia visita": p.dia_visita, "Última compra": p.ultima_compra, "Outras LN (SKUs)": p.qtd_ln, "Pure Gold LN": "X" }));
    }
    if (!rows.length) { alert("Sem linhas para exportar."); return; }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, tab === "pg600" ? "PG600" : "PGLN");
    XLSX.writeFile(wb, `conversao_${tab}_${d?.trimestre || ""}.xlsx`);
  }

  return (
    <div style={S.wrap}>
      <button style={S.head} onClick={abrir}>
        <span style={S.headTit}>🎯 Conversão Stella Pure Gold {d ? `· ${d.trimestre}` : ""}</span>
        <span style={S.headSub}>
          {d && !loading ? `${d.pg600.total} p/ PG600 · ${d.pgln.total} p/ PG LN` : "clique para carregar"}
          <span style={{ marginLeft: 8 }}>{aberto ? "▲" : "▼"}</span>
        </span>
      </button>

      {aberto && (
        <div style={S.body}>
          {loading && <div style={S.msg}>Carregando… (pode levar ~50s no plano grátis)</div>}
          {erro && <div style={S.erro}>{erro}</div>}
          {d && !loading && (
            <>
              <div style={S.tabRow}>
                <button style={tab === "pg600" ? S.tabOn : S.tab} onClick={() => setTab("pg600")}>Pure Gold 600 ({d.pg600.total})</button>
                <button style={tab === "pgln" ? S.tabOn : S.tab} onClick={() => setTab("pgln")}>Pure Gold LN ({d.pgln.total})</button>
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

              <p style={S.hint}>
                {tab === "pg600"
                  ? "PDVs que compram ≥1 das 600ml (Original/Stella/Spaten) e ainda NÃO compraram a Pure Gold 600 no trimestre."
                  : "PDVs que compram alguma Long Neck e ainda NÃO compraram a Pure Gold LN no trimestre."}
              </p>

              <div style={S.tableWrap}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      {["Cod", "PDV", "Setor", "Dia visita", "Última compra"].map((h) => <th key={h} style={S.th}>{h}</th>)}
                      {tab === "pg600"
                        ? ["Original", "Stella", "Spaten"].map((h) => <th key={h} style={S.thC}>{h} 600</th>)
                        : <th style={S.thC}>Outras LN</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filtrada.map((p) => (
                      <tr key={p.cod_pdv} style={S.tr}>
                        <td style={S.tdPlain}>{p.cod_pdv}</td>
                        <td style={S.tdNome} title={p.nome_pdv}>{p.nome_pdv}</td>
                        <td style={S.tdPlain}>{p.setor}</td>
                        <td style={S.tdPlain}>{p.dia_visita || "—"}</td>
                        <td style={S.tdPlain}>{p.ultima_compra || "—"}</td>
                        {tab === "pg600" ? (
                          <>
                            <td style={{ ...S.tdC, color: p.original ? VERDE : "#f87171" }}>{check(p.original)}</td>
                            <td style={{ ...S.tdC, color: p.stella ? VERDE : "#f87171" }}>{check(p.stella)}</td>
                            <td style={{ ...S.tdC, color: p.spaten ? VERDE : "#f87171" }}>{check(p.spaten)}</td>
                          </>
                        ) : (
                          <td style={S.tdC}>{p.qtd_ln}</td>
                        )}
                      </tr>
                    ))}
                    {!filtrada.length && <tr><td colSpan={tab === "pg600" ? 8 : 6} style={S.vazio}>Ninguém nesse recorte. 🎉</td></tr>}
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
  tabRow: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 },
  tab: { background: "transparent", border: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.6)", borderRadius: 18, padding: "6px 14px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.82rem" },
  tabOn: { background: "rgba(125,186,61,0.16)", border: "1px solid #7DBA3D", color: "#7DBA3D", borderRadius: 18, padding: "6px 14px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.82rem", fontWeight: 700 },
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
  hint: { margin: "2px 0 12px", fontSize: "0.76rem", color: "rgba(255,255,255,0.4)" },
  tableWrap: { overflowX: "auto", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" },
  th: { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)", fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", padding: "8px 10px", textAlign: "left", whiteSpace: "nowrap", borderBottom: "1px solid rgba(255,255,255,0.08)" },
  thC: { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)", fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", padding: "8px 10px", textAlign: "center", whiteSpace: "nowrap", borderBottom: "1px solid rgba(255,255,255,0.08)" },
  tr: { borderBottom: "1px solid rgba(255,255,255,0.05)" },
  tdPlain: { padding: "7px 10px", color: "rgba(255,255,255,0.55)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" },
  tdNome: { padding: "7px 10px", color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 240 },
  tdRn: { padding: "7px 10px", color: "rgba(255,255,255,0.6)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 140 },
  tdC: { padding: "7px 10px", textAlign: "center", fontWeight: 700 },
  vazio: { padding: 16, textAlign: "center", color: "rgba(255,255,255,0.35)" },
  msg: { color: "rgba(255,255,255,0.45)", fontSize: "0.85rem", padding: "8px 0" },
  erro: { background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", borderRadius: 8, padding: "10px 14px", fontSize: "0.85rem" },
};
