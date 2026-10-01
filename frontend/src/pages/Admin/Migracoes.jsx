// Admin › Solicitações › Migrações de PDV — aprova/recusa por linha e baixa Excel
// (a mudança é feita à mão no Promax; o app só registra).
import { useState, useEffect } from "react";
import * as XLSX from "xlsx-js-style";
import api from "../../services/api";
import { Seta } from "../Incidentes/Migracao";

const COR = {
  "Em aprovação": "#f5c451", Aprovado: "#4ade80", Recusado: "#f87171", Parcial: "#60a5fa", Pendente: "#f5c451",
};
const dataBR = (v) => (v ? new Date(v).toLocaleDateString("pt-BR") : "");
const fmt = (n) => (Number(n) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function exportar(sols, nomeArq, soAprovados) {
  const cab = ["Solicitação", "Data pedido", "RN solicitante", "Cód PDV", "PDV", "Média tri (HL/mês)",
    "Setor atual", "Novo setor", "Dia atual", "Novo dia", "Status", "Decidido em", "Motivo"];
  const linhas = [];
  sols.forEach((s) => s.itens.forEach((it) => {
    if (soAprovados && it.status !== "Aprovado") return;
    linhas.push([s.id, dataBR(s.criado_em), `${s.setor} · ${s.nome_rn || ""}`, it.cod_pdv, it.nome_pdv, it.media_tri_hl,
      it.setor_atual, it.setor_novo || it.setor_atual, it.dia_atual, it.dia_novo || it.dia_atual,
      it.status === "Pendente" ? "Em aprovação" : it.status, dataBR(s.decidido_em), s.motivo || ""]);
  }));
  if (!linhas.length) { alert("Nenhuma linha para exportar."); return; }
  const ws = XLSX.utils.aoa_to_sheet([cab, ...linhas]);
  const head = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "2E7D32" } }, alignment: { horizontal: "center", vertical: "center", wrapText: true } };
  const muda = { font: { bold: true, color: { rgb: "8A6D00" } }, fill: { fgColor: { rgb: "FFF3CD" } } };
  cab.forEach((_, c) => { const r = XLSX.utils.encode_cell({ r: 0, c }); ws[r].s = head; });
  linhas.forEach((l, i) => {
    if (l[7] !== l[6]) ws[XLSX.utils.encode_cell({ r: i + 1, c: 7 })].s = muda;  // novo setor ≠ atual
    if (l[9] !== l[8]) ws[XLSX.utils.encode_cell({ r: i + 1, c: 9 })].s = muda;  // novo dia ≠ atual
  });
  ws["!cols"] = [10, 11, 22, 10, 30, 10, 9, 9, 8, 8, 12, 11, 30].map((wch) => ({ wch }));
  ws["!rows"] = [{ hpt: 30 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Migrações");
  XLSX.writeFile(wb, nomeArq);
}

export default function Migracoes() {
  const [sols, setSols] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("Em aprovação");
  const [sel, setSel] = useState(null);       // solicitação aberta
  const [marcados, setMarcados] = useState(new Set());
  const [resposta, setResposta] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const carregar = async () => {
    setLoading(true);
    try { const r = await api.get("/api/solicitacoes", { timeout: 60000 }); setSols((r.data || []).filter((s) => s.tipo === "migracao_pdv")); }
    catch { setSols([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { carregar(); }, []);

  const abrir = (s) => {
    setSel(s); setResposta(""); setErro("");
    setMarcados(new Set(s.itens.filter((it) => it.status !== "Recusado").map((it) => it.id)));
  };
  const toggle = (id) => setMarcados((m) => { const n = new Set(m); n.has(id) ? n.delete(id) : n.add(id); return n; });

  async function decidir(aprovados) {
    setSalvando(true); setErro("");
    try {
      await api.post(`/api/solicitacoes/${sel.id}/decidir`, { aprovados: [...aprovados], resposta });
      setSel(null); await carregar();
    } catch (e) { setErro(e.response?.data?.error || "Erro ao salvar a decisão."); }
    finally { setSalvando(false); }
  }

  const lista = sols.filter((s) => !filtro || s.status === filtro);
  const pend = sols.filter((s) => s.status === "Em aprovação").length;
  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <div style={S.toolbar}>
        <h3 style={S.tit}>Migrações de PDV {pend > 0 && <span style={S.badge}>{pend} p/ aprovar</span>}</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select style={S.select} value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="">Todas</option>
            {["Em aprovação", "Aprovado", "Parcial", "Recusado"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button style={S.xls} onClick={() => exportar(lista, `Migracoes_aprovadas_${hoje}.xlsx`, true)} title="Linhas APROVADAS das solicitações listadas">📥 Excel aprovados</button>
        </div>
      </div>

      {loading ? <p style={S.msg}>Carregando…</p> : !lista.length ? <p style={S.msg}>Nenhuma migração {filtro ? `"${filtro}"` : ""}.</p> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {lista.map((s) => {
            const nDia = s.itens.filter((it) => it.dia_novo).length, nRn = s.itens.filter((it) => it.setor_novo).length;
            return (
              <div key={s.id} style={S.card} onClick={() => abrir(s)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ ...S.tag, color: COR[s.status], background: `${COR[s.status]}22` }}>{s.status}</span>
                    <span style={S.rn}>Setor {s.setor} — {s.nome_rn}</span>
                  </div>
                  <span style={S.data}>{dataBR(s.criado_em)} · #{s.id}</span>
                </div>
                <div style={S.resumo}>
                  🔀 {s.itens.length} PDV{s.itens.length > 1 ? "s" : ""}
                  {nDia > 0 && ` · ${nDia} troca${nDia > 1 ? "s" : ""} de dia`}
                  {nRn > 0 && ` · ${nRn} troca${nRn > 1 ? "s" : ""} de RN`}
                  {s.motivo && <span style={{ color: "rgba(255,255,255,0.45)" }}> — {s.motivo}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {sel && (
        <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && setSel(null)}>
          <div style={S.modal}>
            <div style={S.mHead}>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: "1rem" }}>Migração #{sel.id}</h3>
                <span style={S.rn}>Setor {sel.setor} — {sel.nome_rn} · {dataBR(sel.criado_em)}</span>
                {sel.motivo && <p style={{ margin: "6px 0 0", color: "rgba(255,255,255,0.6)", fontSize: "0.82rem" }}>💬 {sel.motivo}</p>}
              </div>
              <button style={S.fechar} onClick={() => setSel(null)}>✕</button>
            </div>
            <div style={{ padding: "14px 20px" }}>
              <div style={{ overflowX: "auto", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                  <thead><tr>
                    {sel.status === "Em aprovação" && <th style={S.th}>✔</th>}
                    {["PDV", "Média tri", "Alteração", "Status"].map((h) => <th key={h} style={{ ...S.th, textAlign: h === "PDV" ? "left" : "center" }}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {sel.itens.map((it) => (
                      <tr key={it.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)", opacity: sel.status === "Em aprovação" && !marcados.has(it.id) ? 0.45 : 1 }}>
                        {sel.status === "Em aprovação" && <td style={S.td}><input type="checkbox" checked={marcados.has(it.id)} onChange={() => toggle(it.id)} /></td>}
                        <td style={{ ...S.td, textAlign: "left" }}>{it.cod_pdv} · {it.nome_pdv}</td>
                        <td style={S.td}>{fmt(it.media_tri_hl)} HL</td>
                        <td style={S.td}><span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
                          {it.dia_novo && <Seta de={it.dia_atual} para={it.dia_novo} tipo="dia" />}
                          {it.setor_novo && <Seta de={it.setor_atual} para={it.setor_novo} tipo="rn" />}
                        </span></td>
                        <td style={{ ...S.td, color: COR[it.status], fontWeight: 700 }}>{it.status === "Pendente" ? (marcados.has(it.id) ? "Aprovar" : "Recusar") : it.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {sel.status === "Em aprovação" ? (
                <>
                  <textarea style={S.txt} rows={2} placeholder="Comentário para o RN (opcional)" value={resposta} onChange={(e) => setResposta(e.target.value)} />
                  {erro && <p style={{ color: "#f87171", fontSize: "0.82rem", margin: "6px 0 0" }}>{erro}</p>}
                  <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    <button style={S.ok} disabled={salvando} onClick={() => decidir(marcados)}>
                      {salvando ? "Salvando…" : marcados.size === sel.itens.length ? `✅ Aprovar tudo (${marcados.size})` : `✅ Aprovar ${marcados.size} · recusar ${sel.itens.length - marcados.size}`}
                    </button>
                    <button style={S.nok} disabled={salvando} onClick={() => decidir(new Set())}>✖ Recusar tudo</button>
                  </div>
                </>
              ) : (
                <div style={{ marginTop: 10, color: "rgba(255,255,255,0.55)", fontSize: "0.8rem" }}>
                  Decidido em {dataBR(sel.decidido_em)}{sel.decidido_por ? ` por ${sel.decidido_por}` : ""}.
                  {sel.resposta && <> Comentário: <i>{sel.resposta}</i></>}
                </div>
              )}
              <button style={{ ...S.xls, marginTop: 12 }} onClick={() => exportar([sel], `Migracao_${sel.id}.xlsx`, false)}>📥 Excel desta solicitação</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  toolbar: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 10, flexWrap: "wrap" },
  tit: { margin: 0, fontSize: "1rem", fontWeight: 600, display: "flex", alignItems: "center", gap: 10 },
  badge: { background: "rgba(245,196,81,0.18)", color: "#f5c451", padding: "2px 10px", borderRadius: 20, fontSize: "0.75rem", fontWeight: 700 },
  select: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", padding: "8px 12px", fontSize: "0.85rem", fontFamily: "inherit", colorScheme: "dark" },
  xls: { background: "linear-gradient(135deg,#7DBA3D,#2E7D32)", color: "#0c1410", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  msg: { color: "rgba(255,255,255,0.35)", textAlign: "center", padding: 40 },
  card: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 14, cursor: "pointer", display: "flex", flexDirection: "column", gap: 8 },
  tag: { padding: "2px 10px", borderRadius: 20, fontSize: "0.72rem", fontWeight: 700 },
  rn: { color: "rgba(255,255,255,0.65)", fontSize: "0.82rem" },
  data: { color: "rgba(255,255,255,0.35)", fontSize: "0.75rem" },
  resumo: { color: "rgba(255,255,255,0.75)", fontSize: "0.84rem" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 },
  modal: { background: "#111827", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, width: "100%", maxWidth: 760, maxHeight: "90vh", overflow: "auto" },
  mHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "18px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)" },
  fechar: { background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", fontSize: "1.2rem", cursor: "pointer" },
  th: { padding: "8px 10px", color: "rgba(255,255,255,0.45)", fontSize: "0.7rem", textAlign: "center", whiteSpace: "nowrap" },
  td: { padding: "8px 10px", textAlign: "center", color: "rgba(255,255,255,0.8)" },
  txt: { width: "100%", boxSizing: "border-box", marginTop: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", padding: 10, fontSize: "0.85rem", fontFamily: "inherit", outline: "none", resize: "vertical" },
  ok: { background: "linear-gradient(135deg,#7DBA3D,#2E7D32)", color: "#0c1410", border: "none", borderRadius: 10, padding: "11px 18px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  nok: { background: "rgba(248,113,113,0.12)", color: "#f87171", border: "1px solid rgba(248,113,113,0.4)", borderRadius: 10, padding: "11px 18px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
};
