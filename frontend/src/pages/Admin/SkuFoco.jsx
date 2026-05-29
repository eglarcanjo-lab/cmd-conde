// v1.2 - auto-fill nome produto + campo motivo
import { useState, useEffect, useRef } from "react";
import api from "../../services/api";

function normalizeMesRef(v) {
  const s = String(v ?? "").trim();
  const n = parseFloat(s);
  if (!isNaN(n) && n > 40000 && n < 60000) {
    const d = new Date(Math.round((n - 25569) * 86400 * 1000));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  return s;
}

// Remove zeros à esquerda para comparação
function normCod(v) {
  const s = String(v || "").trim();
  return s.replace(/^0+/, "") || s;
}

const SETORES = ["101","102","103","104","105","106","301","302","303","304","305"];

function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const emptyForm = () => ({
  setor: "", cod_produto: "", nome_produto: "",
  meta_mensal_hl: "", mes_referencia: mesAtual(), motivo: "",
});

export default function SkuFoco() {
  const [lista,     setLista]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [form,      setForm]      = useState(emptyForm());
  const [salvando,  setSalvando]  = useState(false);
  const [msg,       setMsg]       = useState("");
  const [produtos,  setProdutos]  = useState([]); // produtos_base para auto-fill
  const [sugestoes, setSugestoes] = useState([]); // dropdown de sugestões
  const [lookupMsg, setLookupMsg] = useState(""); // "Produto não encontrado"
  const sugestaoRef = useRef(null);

  useEffect(() => {
    carregar();
    api.get("/api/admin/produtos").then((r) => setProdutos(r.data)).catch(() => {});
  }, []);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handler(e) {
      if (sugestaoRef.current && !sugestaoRef.current.contains(e.target)) {
        setSugestoes([]);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function carregar() {
    setLoading(true);
    try {
      const r = await api.get("/api/admin/sku-foco");
      setLista(r.data);
    } catch {
      setMsg("❌ Erro ao carregar.");
    } finally {
      setLoading(false);
    }
  }

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  // Quando o código muda: busca nome e mostra sugestões
  function onCodChange(v) {
    setForm((f) => ({ ...f, cod_produto: v, nome_produto: "" }));
    setLookupMsg("");

    if (!v.trim()) { setSugestoes([]); return; }

    const termo = normCod(v);
    const matches = produtos.filter((p) =>
      normCod(p.cod).startsWith(termo) || normCod(p.cod) === termo
    ).slice(0, 8);

    if (matches.length > 0) {
      setSugestoes(matches);
      const exato = matches.find((p) => normCod(p.cod) === termo);
      if (exato) {
        setForm((f) => ({ ...f, cod_produto: v, nome_produto: exato.nome }));
        setSugestoes([]);
        setLookupMsg("");
      }
    } else {
      setSugestoes([]);
      setLookupMsg("Produto não encontrado na base.");
    }
  }

  function selecionarSugestao(p) {
    setForm((f) => ({ ...f, cod_produto: p.cod, nome_produto: p.nome }));
    setSugestoes([]);
    setLookupMsg("");
  }

  async function salvar(e) {
    e.preventDefault();
    if (!form.nome_produto) {
      setMsg("❌ Produto não encontrado. Verifique o código.");
      setTimeout(() => setMsg(""), 4000);
      return;
    }
    setSalvando(true);
    setMsg("");
    try {
      await api.post("/api/admin/sku-foco", form);
      setMsg("✅ SKU Foco cadastrado!");
      setForm(emptyForm());
      await carregar();
    } catch (err) {
      setMsg(err.response?.data?.error || "❌ Erro ao salvar.");
    } finally {
      setSalvando(false);
      setTimeout(() => setMsg(""), 4000);
    }
  }

  async function remover(idx) {
    if (!window.confirm("Remover este SKU Foco?")) return;
    try {
      await api.delete(`/api/admin/sku-foco/${idx}`);
      await carregar();
    } catch {
      setMsg("❌ Erro ao remover.");
    }
  }

  return (
    <div>
      <h2 style={S.titulo}>🎯 SKU Foco</h2>
      <p style={S.desc}>
        Cadastre os SKUs de foco por setor. O nome é preenchido automaticamente pelo código.
        O campo "Motivo" é exibido ao RN no Volume Diário.
      </p>

      {/* ── Formulário ── */}
      <form onSubmit={salvar} style={S.form}>
        <div style={S.grid}>

          {/* Setor */}
          <div style={S.fg}>
            <label style={S.label}>Setor</label>
            <select style={S.input} value={form.setor} onChange={(e) => set("setor", e.target.value)} required>
              <option value="">Selecione...</option>
              {SETORES.map((s) => <option key={s} value={s}>Setor {s}</option>)}
            </select>
          </div>

          {/* Código do produto — com auto-fill */}
          <div style={{ ...S.fg, position: "relative" }} ref={sugestaoRef}>
            <label style={S.label}>Cód. Produto</label>
            <input
              style={S.input}
              value={form.cod_produto}
              onChange={(e) => onCodChange(e.target.value)}
              required
              placeholder="Ex: 12345"
              autoComplete="off"
            />
            {sugestoes.length > 0 && (
              <div style={S.dropdown}>
                {sugestoes.map((p) => (
                  <div
                    key={p.cod}
                    style={S.dropdownItem}
                    onMouseDown={() => selecionarSugestao(p)}
                  >
                    <span style={{ color: "#fbb900", fontSize: "0.72rem", marginRight: "8px", flexShrink: 0 }}>{p.cod}</span>
                    <span style={{ color: "#fff", fontSize: "0.82rem" }}>{p.nome}</span>
                  </div>
                ))}
              </div>
            )}
            {lookupMsg && (
              <span style={{ fontSize: "0.68rem", color: "#f87171", marginTop: "3px" }}>{lookupMsg}</span>
            )}
          </div>

          {/* Nome preenchido automaticamente */}
          <div style={{ ...S.fg, gridColumn: "span 2" }}>
            <label style={S.label}>Nome do Produto (auto)</label>
            <div style={{ ...S.input, ...S.inputReadonly }}>
              {form.nome_produto || <span style={{ color: "rgba(255,255,255,0.2)" }}>Preenchido ao digitar o código…</span>}
            </div>
          </div>

          {/* Meta Mensal */}
          <div style={S.fg}>
            <label style={S.label}>Meta Mensal (HL)</label>
            <input
              style={S.input}
              type="number"
              step="0.01"
              min="0"
              value={form.meta_mensal_hl}
              onChange={(e) => set("meta_mensal_hl", e.target.value)}
              required
              placeholder="Ex: 120.5"
            />
          </div>

          {/* Mês Referência */}
          <div style={S.fg}>
            <label style={S.label}>Mês Referência</label>
            <input
              style={S.input}
              type="month"
              value={form.mes_referencia}
              onChange={(e) => set("mes_referencia", e.target.value)}
              required
            />
          </div>

          {/* Motivo */}
          <div style={{ ...S.fg, gridColumn: "span 2" }}>
            <label style={S.label}>Motivo do Lançamento</label>
            <textarea
              style={{ ...S.input, minHeight: "70px", resize: "vertical" }}
              value={form.motivo}
              onChange={(e) => set("motivo", e.target.value)}
              placeholder="Ex: Produto com baixa penetração no setor. Foco para ganho de market share."
            />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
          <button type="submit" style={S.btnAdd} disabled={salvando}>
            {salvando ? "Salvando..." : "✚ Adicionar SKU Foco"}
          </button>
          {msg && (
            <span style={{ fontSize: "0.82rem", color: msg.startsWith("✅") ? "#4ade80" : "#f87171" }}>
              {msg}
            </span>
          )}
        </div>
      </form>

      {/* ── Lista ── */}
      {loading ? (
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.85rem" }}>Carregando...</p>
      ) : lista.length === 0 ? (
        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.85rem" }}>Nenhum SKU Foco cadastrado.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={S.table}>
            <thead>
              <tr>
                {["Setor", "Cód.", "Produto", "Meta (HL)", "Mês Ref.", "Motivo", ""].map((h) => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map((item, idx) => (
                <tr key={idx} style={S.tr}>
                  <td style={S.td}>{item.setor}</td>
                  <td style={S.td}>{item.cod_produto}</td>
                  <td style={S.td}>{item.nome_produto}</td>
                  <td style={S.td}>{item.meta_mensal_hl}</td>
                  <td style={S.td}>{normalizeMesRef(item.mes_referencia)}</td>
                  <td style={{ ...S.td, maxWidth: "200px", color: "rgba(255,255,255,0.55)", fontSize: "0.78rem" }}>
                    {item.motivo || <span style={{ color: "rgba(255,255,255,0.2)" }}>—</span>}
                  </td>
                  <td style={S.td}>
                    <button style={S.btnDel} onClick={() => remover(idx)}>✕ Remover</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const S = {
  titulo:       { color: "#fff", margin: "0 0 6px", fontSize: "1.1rem", fontWeight: "700" },
  desc:         { color: "rgba(255,255,255,0.4)", margin: "0 0 20px", fontSize: "0.82rem", lineHeight: 1.5 },
  form:         { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "20px", marginBottom: "28px" },
  grid:         { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "16px" },
  fg:           { display: "flex", flexDirection: "column", gap: "5px" },
  label:        { color: "rgba(255,255,255,0.45)", fontSize: "0.68rem", fontWeight: "700", letterSpacing: "0.06em", textTransform: "uppercase" },
  input:        { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "#fff", padding: "9px 12px", fontSize: "0.85rem", fontFamily: "inherit", minHeight: "40px", colorScheme: "dark" },
  inputReadonly:{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center" },
  dropdown:     { position: "absolute", top: "100%", left: 0, right: 0, background: "#1a2035", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px", zIndex: 100, marginTop: "2px", boxShadow: "0 8px 24px rgba(0,0,0,0.5)", maxHeight: "200px", overflowY: "auto" },
  dropdownItem: { padding: "9px 12px", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", flexWrap: "wrap", gap: "4px" },
  btnAdd:       { background: "rgba(251,185,0,0.14)", border: "1px solid rgba(251,185,0,0.4)", color: "#fbb900", padding: "10px 20px", borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem", fontFamily: "inherit", fontWeight: "600" },
  table:        { width: "100%", borderCollapse: "collapse", fontSize: "0.82rem", minWidth: "620px" },
  th:           { color: "rgba(255,255,255,0.4)", fontWeight: "700", textAlign: "left", padding: "9px 10px", borderBottom: "1px solid rgba(255,255,255,0.08)", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.05em" },
  tr:           { borderBottom: "1px solid rgba(255,255,255,0.05)" },
  td:           { color: "#fff", padding: "10px 10px", verticalAlign: "middle" },
  btnDel:       { background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171", borderRadius: "6px", cursor: "pointer", padding: "5px 10px", fontSize: "0.75rem", fontFamily: "inherit", whiteSpace: "nowrap" },
};
