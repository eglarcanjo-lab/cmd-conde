// Admin — gestão de Popups (caixas de imagem exibidas 1x/dia no app)
import { useState, useEffect, useRef } from "react";
import api from "../../services/api";

const ALVOS = [
  { v: "todos", label: "Todos" },
  { v: "off",   label: "OFF (101-103)" },
  { v: "on",    label: "ON (demais)" },
];
const ROTAS = [
  { v: "/incentivos",    label: "🏆 Incentivos" },
  { v: "/volume-diario", label: "📈 Volume Diário" },
  { v: "/rv",            label: "💰 Remuneração" },
  { v: "/spo",           label: "📊 SPO" },
  { v: "/pdvs",          label: "🗺️ PDVs" },
  { v: "/tasks",         label: "✅ Tasks" },
  { v: "/cobertura",     label: "📊 Cobertura" },
  { v: "/incidentes",    label: "🚨 Incidentes" },
];

const emptyForm = () => ({
  titulo: "", ativo: true, data_inicio: "", data_fim: "",
  acao_tipo: "nenhuma", acao_valor: "", publico_alvo: "todos", ordem: "1",
});

export default function PopupsAdmin() {
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm());
  const [editId, setEditId] = useState(null);
  const [arquivo, setArquivo] = useState(null);
  const [preview, setPreview] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState("");
  const [testPopup, setTestPopup] = useState(null); // pré-visualização
  const fileRef = useRef(null);

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setLoading(true);
    try { const r = await api.get("/api/popups/admin/all"); setLista(r.data || []); }
    catch { setMsg("❌ Erro ao carregar."); }
    finally { setLoading(false); }
  }

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  function escolherArquivo(file) {
    setArquivo(file);
    if (file) setPreview(URL.createObjectURL(file));
  }

  function editar(p) {
    setEditId(p.id);
    setForm({
      titulo: p.titulo || "", ativo: String(p.ativo) !== "false",
      data_inicio: (p.data_inicio || "").slice(0, 10), data_fim: (p.data_fim || "").slice(0, 10),
      acao_tipo: p.acao_tipo || "nenhuma", acao_valor: p.acao_valor || "",
      publico_alvo: p.publico_alvo || "todos", ordem: p.ordem || "1",
    });
    setArquivo(null);
    setPreview(p.imagem_url || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelar() { setEditId(null); setForm(emptyForm()); setArquivo(null); setPreview(""); if (fileRef.current) fileRef.current.value = ""; }

  async function salvar(e) {
    e.preventDefault();
    if (!editId && !arquivo) { setMsg("❌ Selecione a imagem."); setTimeout(() => setMsg(""), 3000); return; }
    setSalvando(true); setMsg("");
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (arquivo) fd.append("imagem", arquivo);
      // timeout maior: upload de imagem + cold-start do backend pode passar de 15s
      const cfg = { headers: { "Content-Type": "multipart/form-data" }, timeout: 120000 };
      if (editId) await api.put(`/api/popups/admin/${editId}`, fd, cfg);
      else        await api.post("/api/popups/admin", fd, cfg);
      setMsg("✅ Salvo!");
      cancelar();
      await carregar();
    } catch (err) {
      const status = err.response?.status;
      const detalhe = err.response?.data?.error || (err.code === "ECONNABORTED" ? "tempo esgotado (upload demorou demais)" : err.message);
      setMsg(`❌ Erro ao salvar${status ? ` [${status}]` : ""}: ${detalhe}`);
    } finally {
      setSalvando(false);
      setTimeout(() => setMsg(""), 4000);
    }
  }

  async function remover(id) {
    if (!window.confirm("Remover este popup?")) return;
    try { await api.delete(`/api/popups/admin/${id}`); await carregar(); }
    catch { setMsg("❌ Erro ao remover."); }
  }

  return (
    <div>
      <h2 style={ST.titulo}>🖼️ Popups</h2>
      <p style={ST.desc}>
        Caixas de imagem exibidas <strong>1x por dia</strong> quando o usuário abre o app.
        Defina uma ação ao clicar (abrir aba do app ou link externo).
      </p>

      <form onSubmit={salvar} style={ST.form}>
        <div style={ST.grid}>
          {/* Upload + preview */}
          <div style={{ ...ST.fg, gridColumn: "span 2" }}>
            <label style={ST.label}>Arte do popup</label>
            <div style={{ display: "flex", gap: "14px", alignItems: "flex-start", flexWrap: "wrap" }}>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => escolherArquivo(e.target.files[0])} />
              <button type="button" style={ST.btnUpload} onClick={() => fileRef.current?.click()}>
                📁 {arquivo ? "Trocar imagem" : "Selecionar imagem"}
              </button>
              {preview && <img src={preview} alt="preview" style={ST.preview} />}
            </div>
          </div>

          <div style={{ ...ST.fg, gridColumn: "span 2" }}>
            <label style={ST.label}>Título (interno)</label>
            <input style={ST.input} value={form.titulo} onChange={(e) => set("titulo", e.target.value)} placeholder="Ex: Campanha Setembro" />
          </div>

          <div style={ST.fg}>
            <label style={ST.label}>Ação ao clicar</label>
            <select style={ST.input} value={form.acao_tipo} onChange={(e) => set("acao_tipo", e.target.value)}>
              <option value="nenhuma">Nenhuma</option>
              <option value="rota">Abrir aba do app</option>
              <option value="link">Link externo</option>
            </select>
          </div>
          <div style={ST.fg}>
            <label style={ST.label}>Destino</label>
            {form.acao_tipo === "rota" ? (
              <select style={ST.input} value={form.acao_valor} onChange={(e) => set("acao_valor", e.target.value)}>
                <option value="">Selecione…</option>
                {ROTAS.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
              </select>
            ) : form.acao_tipo === "link" ? (
              <input style={ST.input} value={form.acao_valor} onChange={(e) => set("acao_valor", e.target.value)} placeholder="https://..." />
            ) : (
              <input style={{ ...ST.input, opacity: 0.4 }} disabled placeholder="—" />
            )}
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
              <input style={{ ...ST.input, marginTop: "6px" }} value={form.publico_alvo} onChange={(e) => set("publico_alvo", e.target.value)} placeholder="Ex: 101,102" />
            )}
          </div>
          <div style={ST.fg}>
            <label style={ST.label}>Ordem / Ativo</label>
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <input style={{ ...ST.input, width: "70px" }} type="number" value={form.ordem} onChange={(e) => set("ordem", e.target.value)} />
              <label style={{ display: "flex", alignItems: "center", gap: "6px", color: "rgba(255,255,255,0.6)", fontSize: "0.8rem", cursor: "pointer" }}>
                <input type="checkbox" checked={form.ativo} onChange={(e) => set("ativo", e.target.checked)} /> Ativo
              </label>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <button type="submit" style={ST.btnAdd} disabled={salvando}>
            {salvando ? "Salvando..." : editId ? "💾 Salvar alterações" : "✚ Criar popup"}
          </button>
          {editId && <button type="button" style={ST.btnCancel} onClick={cancelar}>Cancelar</button>}
          {msg && <span style={{ fontSize: "0.82rem", color: msg.startsWith("✅") ? "#4ade80" : "#f87171" }}>{msg}</span>}
        </div>
      </form>

      {/* Lista */}
      {loading ? (
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.85rem" }}>Carregando...</p>
      ) : lista.length === 0 ? (
        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.85rem" }}>Nenhum popup cadastrado.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {lista.map((p) => (
            <div key={p.id} style={ST.row}>
              <img src={p.imagem_url} alt="" style={ST.thumb} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span style={ST.rowTitle}>{p.titulo || "(sem título)"}</span>
                  <span style={{ ...ST.tag, background: String(p.ativo) !== "false" ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.08)", color: String(p.ativo) !== "false" ? "#4ade80" : "rgba(255,255,255,0.4)" }}>
                    {String(p.ativo) !== "false" ? "ativo" : "inativo"}
                  </span>
                </div>
                <div style={ST.rowSub}>
                  {p.acao_tipo === "rota" ? `→ ${p.acao_valor}` : p.acao_tipo === "link" ? `🔗 ${p.acao_valor}` : "sem ação"}
                  {" · "}alvo: {p.publico_alvo || "todos"}
                </div>
              </div>
              <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                <button style={ST.btnTest} onClick={() => setTestPopup(p)} title="Pré-visualizar">👁️</button>
                <button style={ST.btnEdit} onClick={() => editar(p)}>✏️</button>
                <button style={ST.btnDel} onClick={() => remover(p.id)}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pré-visualização (como aparece no app) */}
      {testPopup && (
        <div style={ST.testOverlay} onClick={() => setTestPopup(null)}>
          <div style={{ position: "relative", maxWidth: "440px", width: "100%" }} onClick={(e) => e.stopPropagation()}>
            <button style={ST.testClose} onClick={() => setTestPopup(null)}>✕</button>
            <img src={testPopup.imagem_url} alt="" style={ST.testImg} />
            {(testPopup.acao_tipo === "rota" || testPopup.acao_tipo === "link") && testPopup.acao_valor && (
              <div style={{ textAlign: "center", marginTop: "12px" }}>
                <span style={ST.testCta}>{testPopup.acao_tipo === "link" ? "Acessar →" : "Ver mais →"}</span>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.72rem", marginTop: "6px" }}>
                  ação: {testPopup.acao_valor}
                </div>
              </div>
            )}
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
  btnUpload: { background: "rgba(46,125,50,0.14)", border: "1px solid rgba(46,125,50,0.4)", color: "#7DBA3D", padding: "10px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "0.82rem", fontFamily: "inherit", fontWeight: "600" },
  preview:   { maxWidth: "120px", maxHeight: "80px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.12)", objectFit: "cover" },
  btnAdd:    { background: "rgba(125,186,61,0.14)", border: "1px solid rgba(125,186,61,0.4)", color: "#7DBA3D", padding: "10px 20px", borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem", fontFamily: "inherit", fontWeight: "600" },
  btnCancel: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)", padding: "10px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "0.82rem", fontFamily: "inherit" },
  row:       { display: "flex", alignItems: "center", gap: "12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "10px", padding: "10px 12px" },
  thumb:     { width: "54px", height: "40px", borderRadius: "6px", objectFit: "cover", border: "1px solid rgba(255,255,255,0.1)", flexShrink: 0, background: "#000" },
  rowTitle:  { color: "#fff", fontWeight: "600", fontSize: "0.9rem" },
  rowSub:    { color: "rgba(255,255,255,0.4)", fontSize: "0.74rem", marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  tag:       { fontSize: "0.66rem", fontWeight: "700", padding: "2px 8px", borderRadius: "10px" },
  btnTest:   { background: "rgba(46,125,50,0.12)", border: "1px solid rgba(46,125,50,0.35)", color: "#7DBA3D", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontSize: "0.8rem", fontFamily: "inherit" },
  btnEdit:   { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.14)", color: "#fff", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontSize: "0.8rem", fontFamily: "inherit" },
  btnDel:    { background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontSize: "0.8rem", fontFamily: "inherit" },
  testOverlay:{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", zIndex: 2000 },
  testClose: { position: "absolute", top: "-14px", right: "-14px", background: "#0c1410", border: "2px solid rgba(255,255,255,0.2)", color: "#fff", borderRadius: "50%", width: "34px", height: "34px", cursor: "pointer", zIndex: 2 },
  testImg:   { width: "100%", maxHeight: "78vh", objectFit: "contain", borderRadius: "14px", boxShadow: "0 16px 50px rgba(0,0,0,0.6)" },
  testCta:   { background: "linear-gradient(135deg,#7DBA3D,#2E7D32)", color: "#0c1410", borderRadius: "10px", padding: "10px 24px", fontWeight: "700", fontSize: "0.9rem", display: "inline-block" },
};
