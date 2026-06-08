import { useState, useEffect } from "react";
import api from "../../services/api";

const TELAS = [
  { v: "geral", l: "🌐 Geral (todas as telas)" },
  { v: "/", l: "🏠 Início" },
  { v: "/volume-diario", l: "📈 Volume Diário" },
  { v: "/cobertura", l: "📊 Cobertura" },
  { v: "/cobertura-sku", l: "📈 Cobertura & Distribuição" },
  { v: "/pdvs", l: "🗺️ PDVs" },
  { v: "/tasks", l: "✅ Tasks" },
  { v: "/spo", l: "📊 SPO" },
  { v: "/rv", l: "💰 Remuneração" },
  { v: "/incidentes", l: "🚨 Incidentes" },
  { v: "/incentivos", l: "🏆 Incentivos" },
  { v: "/produtos", l: "📦 Produtos" },
  { v: "/detalhamento", l: "🌿 Detalhamento HOP" },
];
const TIPOS = [
  { v: "info", l: "ℹ️ Informação" },
  { v: "destaque", l: "💡 Destaque" },
  { v: "alerta", l: "⚠️ Alerta" },
];
const ALVOS = [
  { v: "todos", l: "Todos" },
  { v: "off", l: "OFF (101/102/103)" },
  { v: "on", l: "ON (demais)" },
];
const telaLabel = (v) => TELAS.find((t) => t.v === v)?.l || v;
const EMPTY = { tela: "geral", titulo: "", mensagem: "", tipo: "info", publico_alvo: "todos", ativo: "true", ordem: "1" };

export default function Avisos() {
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [msg, setMsg] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { carregar(); }, []);
  async function carregar() {
    setLoading(true);
    try { const r = await api.get("/api/avisos/admin/all"); setLista(r.data || []); }
    catch { setMsg("Erro ao carregar."); }
    finally { setLoading(false); }
  }
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  function novo() { setForm(EMPTY); setEditId(null); setMsg(""); }
  function editar(a) { setForm({ tela: a.tela || "geral", titulo: a.titulo || "", mensagem: a.mensagem || "", tipo: a.tipo || "info", publico_alvo: a.publico_alvo || "todos", ativo: a.ativo || "true", ordem: a.ordem || "1" }); setEditId(a.id); setMsg(""); }

  async function salvar() {
    if (!form.mensagem.trim()) { setMsg("Escreva a mensagem."); return; }
    setSalvando(true); setMsg("");
    try {
      if (editId) await api.put(`/api/avisos/admin/${editId}`, form);
      else await api.post("/api/avisos/admin", form);
      await carregar(); novo(); setMsg("✅ Salvo.");
      setTimeout(() => setMsg(""), 2500);
    } catch (e) { setMsg(e.response?.data?.error || "Erro ao salvar."); }
    finally { setSalvando(false); }
  }
  async function remover(a) {
    if (!confirm("Remover este aviso?")) return;
    try { await api.delete(`/api/avisos/admin/${a.id}`); await carregar(); if (editId === a.id) novo(); }
    catch { alert("Erro ao remover."); }
  }
  async function toggle(a) {
    try { await api.put(`/api/avisos/admin/${a.id}`, { ativo: a.ativo === "true" ? "false" : "true" }); await carregar(); }
    catch { alert("Erro."); }
  }

  return (
    <div>
      <div style={S.intro}>Cadastre avisos que aparecem no botão <b>"?"</b> das telas. Escolha <b>Geral</b> (todas) ou uma tela específica.</div>

      {/* Formulário */}
      <div style={S.form}>
        <div style={S.titForm}>{editId ? "✏️ Editar aviso" : "➕ Novo aviso"}</div>
        <div style={S.row}>
          <Campo label="Tela">
            <select style={S.input} value={form.tela} onChange={(e) => set("tela", e.target.value)}>
              {TELAS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </Campo>
          <Campo label="Tipo">
            <select style={S.input} value={form.tipo} onChange={(e) => set("tipo", e.target.value)}>
              {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </Campo>
        </div>
        <Campo label="Título (opcional)">
          <input style={S.input} value={form.titulo} onChange={(e) => set("titulo", e.target.value)} placeholder="Ex: Nova função!" />
        </Campo>
        <Campo label="Mensagem *">
          <textarea style={{ ...S.input, minHeight: "80px", resize: "vertical" }} value={form.mensagem} onChange={(e) => set("mensagem", e.target.value)} placeholder="Texto do aviso..." />
        </Campo>
        <div style={S.row}>
          <Campo label="Público">
            <select style={S.input} value={form.publico_alvo} onChange={(e) => set("publico_alvo", e.target.value)}>
              {ALVOS.map((a) => <option key={a.v} value={a.v}>{a.l}</option>)}
            </select>
          </Campo>
          <Campo label="Ordem">
            <input style={S.input} type="number" value={form.ordem} onChange={(e) => set("ordem", e.target.value)} />
          </Campo>
          <Campo label="Ativo">
            <select style={S.input} value={form.ativo} onChange={(e) => set("ativo", e.target.value)}>
              <option value="true">Sim</option><option value="false">Não</option>
            </select>
          </Campo>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "8px" }}>
          <button style={S.btn} onClick={salvar} disabled={salvando}>{salvando ? "Salvando..." : editId ? "Salvar alterações" : "Cadastrar"}</button>
          {editId && <button style={S.btnSec} onClick={novo}>Cancelar</button>}
          {msg && <span style={S.msg}>{msg}</span>}
        </div>
      </div>

      {/* Lista */}
      <h3 style={S.h3}>Avisos cadastrados</h3>
      {loading ? <p style={S.dim}>Carregando...</p> : lista.length === 0 ? <p style={S.dim}>Nenhum aviso ainda.</p> : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {lista.map((a) => (
            <div key={a.id} style={{ ...S.item, opacity: a.ativo === "true" ? 1 : 0.5 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={S.itemTop}>
                  <span style={S.tag}>{telaLabel(a.tela)}</span>
                  <span style={S.tagTipo}>{TIPOS.find((t) => t.v === a.tipo)?.l || a.tipo}</span>
                </div>
                {a.titulo && <div style={S.itemTit}>{a.titulo}</div>}
                <div style={S.itemMsg}>{a.mensagem}</div>
              </div>
              <div style={S.acoes}>
                <button style={S.bA} onClick={() => editar(a)} title="Editar">✏️</button>
                <button style={S.bA} onClick={() => toggle(a)} title={a.ativo === "true" ? "Desativar" : "Ativar"}>{a.ativo === "true" ? "🔴" : "🟢"}</button>
                <button style={S.bA} onClick={() => remover(a)} title="Remover">🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const Campo = ({ label, children }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: "5px", flex: 1 }}>
    <label style={S.label}>{label}</label>{children}
  </div>
);

const S = {
  intro: { color: "rgba(255,255,255,0.6)", fontSize: "0.88rem", marginBottom: "16px", lineHeight: 1.5 },
  form: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "16px", display: "flex", flexDirection: "column", gap: "12px", marginBottom: "22px" },
  titForm: { color: "#7DBA3D", fontWeight: "700", fontSize: "0.95rem" },
  row: { display: "flex", gap: "12px", flexWrap: "wrap" },
  label: { color: "rgba(255,255,255,0.5)", fontSize: "0.74rem", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" },
  input: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "#fff", padding: "10px 12px", fontSize: "0.9rem", fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" },
  btn: { background: "linear-gradient(135deg,#7DBA3D,#2E7D32)", color: "#0c1410", border: "none", borderRadius: "8px", padding: "10px 20px", fontWeight: "700", cursor: "pointer", fontFamily: "inherit", fontSize: "0.9rem" },
  btnSec: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", borderRadius: "8px", padding: "10px 16px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.9rem" },
  msg: { fontSize: "0.82rem", color: "rgba(255,255,255,0.7)" },
  h3: { color: "#fff", fontSize: "1rem", fontWeight: "700", margin: "0 0 12px" },
  dim: { color: "rgba(255,255,255,0.4)", padding: "12px 0" },
  item: { display: "flex", gap: "10px", alignItems: "flex-start", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", padding: "12px 14px" },
  itemTop: { display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "4px" },
  tag: { background: "rgba(125,186,61,0.15)", color: "#7DBA3D", padding: "2px 8px", borderRadius: "6px", fontSize: "0.72rem", fontWeight: "600" },
  tagTipo: { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)", padding: "2px 8px", borderRadius: "6px", fontSize: "0.72rem" },
  itemTit: { color: "#fff", fontWeight: "600", fontSize: "0.88rem" },
  itemMsg: { color: "rgba(255,255,255,0.65)", fontSize: "0.84rem", lineHeight: 1.45, whiteSpace: "pre-wrap" },
  acoes: { display: "flex", gap: "4px", flexShrink: 0 },
  bA: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "6px", padding: "4px 8px", cursor: "pointer", fontSize: "0.85rem" },
};
