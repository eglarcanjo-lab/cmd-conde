// Admin — gestão de Incentivos (campanhas data-driven) + editor de ranking manual
import { useState, useEffect } from "react";
import api from "../../services/api";

const SETORES = ["101","102","103","104","105","106","301","302","303","304","305"];
const TIPOS = [
  { v: "volume_sku", label: "Volume de SKU (automático)" },
  { v: "manual",     label: "Manual / Importado" },
];
const ALVOS = [
  { v: "todos", label: "Todos" },
  { v: "off",   label: "OFF (101-103)" },
  { v: "on",    label: "ON (demais)" },
];

const emptyForm = () => ({
  titulo: "", descricao: "", tipo: "volume_sku", sku_codigo: "", premio: "",
  unidade: "HL", data_inicio: "", data_fim: "", ativo: true,
  publico_alvo: "todos", ordem: "1", cor: "#7DBA3D",
});

export default function IncentivosAdmin() {
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm());
  const [editId, setEditId] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState("");
  const [produtos, setProdutos] = useState([]);

  // editor de ranking manual
  const [rankId, setRankId] = useState(null);
  const [rankRows, setRankRows] = useState([]);
  const [rankMsg, setRankMsg] = useState("");

  useEffect(() => {
    carregar();
    api.get("/api/admin/produtos").then((r) => setProdutos(r.data || [])).catch(() => {});
  }, []);

  async function carregar() {
    setLoading(true);
    try {
      const r = await api.get("/api/incentivos/admin/all");
      setLista(r.data || []);
    } catch { setMsg("❌ Erro ao carregar."); }
    finally { setLoading(false); }
  }

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  function editar(inc) {
    setEditId(inc.id);
    setForm({
      titulo: inc.titulo || "", descricao: inc.descricao || "", tipo: inc.tipo || "volume_sku",
      sku_codigo: inc.sku_codigo || "", premio: inc.premio || "", unidade: inc.unidade || "",
      data_inicio: (inc.data_inicio || "").slice(0, 10), data_fim: (inc.data_fim || "").slice(0, 10),
      ativo: String(inc.ativo) !== "false", publico_alvo: inc.publico_alvo || "todos",
      ordem: inc.ordem || "1", cor: inc.cor || "#7DBA3D",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelar() { setEditId(null); setForm(emptyForm()); }

  async function salvar(e) {
    e.preventDefault();
    if (form.tipo === "volume_sku" && !form.sku_codigo.trim()) {
      setMsg("❌ Informe o código do SKU."); setTimeout(() => setMsg(""), 3000); return;
    }
    setSalvando(true); setMsg("");
    try {
      if (editId) await api.put(`/api/incentivos/admin/${editId}`, form);
      else        await api.post("/api/incentivos/admin", form);
      setMsg("✅ Salvo!");
      cancelar();
      await carregar();
    } catch (err) {
      setMsg(err.response?.data?.error || "❌ Erro ao salvar.");
    } finally {
      setSalvando(false);
      setTimeout(() => setMsg(""), 4000);
    }
  }

  async function remover(id) {
    if (!window.confirm("Remover este incentivo? (apaga também o ranking manual dele)")) return;
    try { await api.delete(`/api/incentivos/admin/${id}`); await carregar(); }
    catch { setMsg("❌ Erro ao remover."); }
  }

  // ── ranking manual ──
  async function abrirRanking(inc) {
    setRankId(inc.id);
    setRankMsg("");
    try {
      const r = await api.get(`/api/incentivos/admin/${inc.id}/resultados`);
      const map = {};
      (r.data || []).forEach((x) => { map[String(x.setor).trim()] = x.valor; });
      setRankRows(SETORES.map((s) => ({ setor: s, valor: map[s] ?? "" })));
    } catch { setRankRows(SETORES.map((s) => ({ setor: s, valor: "" }))); }
  }
  function setRankVal(setor, valor) {
    setRankRows((rows) => rows.map((r) => r.setor === setor ? { ...r, valor } : r));
  }
  async function salvarRanking() {
    setRankMsg("");
    try {
      const linhas = rankRows.filter((r) => r.valor !== "" && r.valor != null);
      await api.post(`/api/incentivos/admin/${rankId}/resultados`, { linhas });
      setRankMsg("✅ Ranking salvo!");
      setTimeout(() => { setRankMsg(""); setRankId(null); }, 1500);
    } catch { setRankMsg("❌ Erro ao salvar ranking."); }
  }

  const incEdit = lista.find((i) => i.id === rankId);

  return (
    <div>
      <h2 style={ST.titulo}>🏆 Incentivos</h2>
      <p style={ST.desc}>
        Cadastre campanhas e ações. Tipo <strong>Volume de SKU</strong> calcula o ranking automático;
        tipo <strong>Manual</strong> você preenche os números. Tudo aparece na aba Incentivos do app.
      </p>

      {/* ── Formulário ── */}
      <form onSubmit={salvar} style={ST.form}>
        <div style={ST.grid}>
          <div style={{ ...ST.fg, gridColumn: "span 2" }}>
            <label style={ST.label}>Título</label>
            <input style={ST.input} value={form.titulo} onChange={(e) => set("titulo", e.target.value)} required placeholder="Ex: Desafio Brahma Duplo Malte" />
          </div>
          <div style={{ ...ST.fg, gridColumn: "span 2" }}>
            <label style={ST.label}>Descrição</label>
            <textarea style={{ ...ST.input, minHeight: "54px", resize: "vertical" }} value={form.descricao} onChange={(e) => set("descricao", e.target.value)} placeholder="Regras / detalhes mostrados ao RN" />
          </div>

          <div style={ST.fg}>
            <label style={ST.label}>Tipo</label>
            <select style={ST.input} value={form.tipo} onChange={(e) => set("tipo", e.target.value)}>
              {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
            </select>
          </div>
          <div style={ST.fg}>
            <label style={ST.label}>Cód. SKU {form.tipo === "volume_sku" ? "(obrigatório)" : "(opcional)"}</label>
            <input style={ST.input} value={form.sku_codigo} onChange={(e) => set("sku_codigo", e.target.value)} placeholder="Ex: 12345"
              list="prods-inc" disabled={form.tipo !== "volume_sku"} />
            <datalist id="prods-inc">
              {produtos.slice(0, 300).map((p) => <option key={p.cod} value={p.cod}>{p.nome}</option>)}
            </datalist>
          </div>

          <div style={ST.fg}>
            <label style={ST.label}>Prêmio</label>
            <input style={ST.input} value={form.premio} onChange={(e) => set("premio", e.target.value)} placeholder="Ex: R$ 500 + folga" />
          </div>
          <div style={ST.fg}>
            <label style={ST.label}>Unidade do valor</label>
            <input style={ST.input} value={form.unidade} onChange={(e) => set("unidade", e.target.value)} placeholder="HL, pts, cx..." />
          </div>

          <div style={ST.fg}>
            <label style={ST.label}>Início</label>
            <input style={ST.input} type="date" value={form.data_inicio} onChange={(e) => set("data_inicio", e.target.value)} />
          </div>
          <div style={ST.fg}>
            <label style={ST.label}>Fim</label>
            <input style={ST.input} type="date" value={form.data_fim} onChange={(e) => set("data_fim", e.target.value)} />
          </div>

          <div style={ST.fg}>
            <label style={ST.label}>Público-alvo</label>
            <select style={ST.input} value={ALVOS.some(a => a.v === form.publico_alvo) ? form.publico_alvo : "custom"}
              onChange={(e) => set("publico_alvo", e.target.value === "custom" ? "" : e.target.value)}>
              {ALVOS.map((a) => <option key={a.v} value={a.v}>{a.label}</option>)}
              <option value="custom">Setores específicos…</option>
            </select>
            {!ALVOS.some(a => a.v === form.publico_alvo) && (
              <input style={{ ...ST.input, marginTop: "6px" }} value={form.publico_alvo} onChange={(e) => set("publico_alvo", e.target.value)} placeholder="Ex: 101,102,305" />
            )}
          </div>
          <div style={ST.fg}>
            <label style={ST.label}>Ordem / Cor / Ativo</label>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input style={{ ...ST.input, width: "60px" }} type="number" value={form.ordem} onChange={(e) => set("ordem", e.target.value)} />
              <input style={{ width: "44px", height: "40px", border: "none", borderRadius: "8px", background: "transparent", cursor: "pointer" }} type="color" value={form.cor} onChange={(e) => set("cor", e.target.value)} />
              <label style={{ display: "flex", alignItems: "center", gap: "6px", color: "rgba(255,255,255,0.6)", fontSize: "0.8rem", cursor: "pointer" }}>
                <input type="checkbox" checked={form.ativo} onChange={(e) => set("ativo", e.target.checked)} /> Ativo
              </label>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <button type="submit" style={ST.btnAdd} disabled={salvando}>
            {salvando ? "Salvando..." : editId ? "💾 Salvar alterações" : "✚ Criar incentivo"}
          </button>
          {editId && <button type="button" style={ST.btnCancel} onClick={cancelar}>Cancelar edição</button>}
          {msg && <span style={{ fontSize: "0.82rem", color: msg.startsWith("✅") ? "#4ade80" : "#f87171" }}>{msg}</span>}
        </div>
      </form>

      {/* ── Lista ── */}
      {loading ? (
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.85rem" }}>Carregando...</p>
      ) : lista.length === 0 ? (
        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.85rem" }}>Nenhum incentivo cadastrado.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {lista.map((inc) => (
            <div key={inc.id} style={ST.row}>
              <div style={{ ...ST.rowBar, background: inc.cor || "#7DBA3D" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span style={ST.rowTitle}>{inc.titulo}</span>
                  <span style={{ ...ST.tag, background: String(inc.ativo) !== "false" ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.08)", color: String(inc.ativo) !== "false" ? "#4ade80" : "rgba(255,255,255,0.4)" }}>
                    {String(inc.ativo) !== "false" ? "ativo" : "inativo"}
                  </span>
                  <span style={ST.tagTipo}>{inc.tipo === "volume_sku" ? `SKU ${inc.sku_codigo}` : "manual"}</span>
                </div>
                <div style={ST.rowSub}>
                  {inc.premio && `🎁 ${inc.premio} · `}alvo: {inc.publico_alvo || "todos"}
                </div>
              </div>
              <div style={{ display: "flex", gap: "6px", flexShrink: 0, flexWrap: "wrap" }}>
                {inc.tipo === "manual" && (
                  <button style={ST.btnRank} onClick={() => abrirRanking(inc)}>📊 Ranking</button>
                )}
                <button style={ST.btnEdit} onClick={() => editar(inc)}>✏️</button>
                <button style={ST.btnDel} onClick={() => remover(inc.id)}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal ranking manual ── */}
      {rankId && (
        <div style={ST.overlay} onClick={() => setRankId(null)}>
          <div style={ST.modal} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: "700" }}>📊 Ranking — {incEdit?.titulo}</h3>
              <button style={ST.closeBtn} onClick={() => setRankId(null)}>✕</button>
            </div>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.78rem", margin: "0 0 12px" }}>
              Informe o valor de cada setor (em {incEdit?.unidade || "pontos"}). Deixe em branco para não exibir.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "16px" }}>
              {rankRows.map((r) => (
                <div key={r.setor} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.82rem", width: "46px" }}>{r.setor}</span>
                  <input style={ST.input} type="number" step="0.01" value={r.valor} onChange={(e) => setRankVal(r.setor, e.target.value)} placeholder="—" />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <button style={ST.btnAdd} onClick={salvarRanking}>💾 Salvar ranking</button>
              {rankMsg && <span style={{ fontSize: "0.82rem", color: rankMsg.startsWith("✅") ? "#4ade80" : "#f87171" }}>{rankMsg}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const ST = {
  titulo:    { color: "#fff", margin: "0 0 6px", fontSize: "1.1rem", fontWeight: "700" },
  desc:      { color: "rgba(255,255,255,0.4)", margin: "0 0 20px", fontSize: "0.82rem", lineHeight: 1.5 },
  form:      { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "20px", marginBottom: "24px" },
  grid:      { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "16px" },
  fg:        { display: "flex", flexDirection: "column", gap: "5px" },
  label:     { color: "rgba(255,255,255,0.45)", fontSize: "0.68rem", fontWeight: "700", letterSpacing: "0.05em", textTransform: "uppercase" },
  input:     { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "#fff", padding: "9px 12px", fontSize: "0.85rem", fontFamily: "inherit", minHeight: "40px", colorScheme: "dark", width: "100%", boxSizing: "border-box" },
  btnAdd:    { background: "rgba(125,186,61,0.14)", border: "1px solid rgba(125,186,61,0.4)", color: "#7DBA3D", padding: "10px 20px", borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem", fontFamily: "inherit", fontWeight: "600" },
  btnCancel: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)", padding: "10px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "0.82rem", fontFamily: "inherit" },
  row:       { display: "flex", alignItems: "center", gap: "12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "10px", overflow: "hidden", paddingRight: "12px" },
  rowBar:    { width: "5px", alignSelf: "stretch", flexShrink: 0 },
  rowTitle:  { color: "#fff", fontWeight: "600", fontSize: "0.9rem", padding: "10px 0 10px 0" },
  rowSub:    { color: "rgba(255,255,255,0.4)", fontSize: "0.74rem", paddingBottom: "10px" },
  tag:       { fontSize: "0.66rem", fontWeight: "700", padding: "2px 8px", borderRadius: "10px" },
  tagTipo:   { fontSize: "0.66rem", color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.06)", padding: "2px 8px", borderRadius: "10px" },
  btnRank:   { background: "rgba(46,125,50,0.14)", border: "1px solid rgba(46,125,50,0.4)", color: "#7DBA3D", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontSize: "0.76rem", fontFamily: "inherit", whiteSpace: "nowrap" },
  btnEdit:   { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.14)", color: "#fff", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontSize: "0.8rem", fontFamily: "inherit" },
  btnDel:    { background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontSize: "0.8rem", fontFamily: "inherit" },
  overlay:   { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", zIndex: 1000 },
  modal:     { background: "#0e1712", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "14px", width: "100%", maxWidth: "440px", maxHeight: "85vh", overflowY: "auto", padding: "20px" },
  closeBtn:  { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.14)", color: "#fff", borderRadius: "8px", width: "30px", height: "30px", cursor: "pointer" },
};
