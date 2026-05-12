import { useState, useEffect } from "react";
import api from "../../services/api";

const CATEGORIAS = [
  "",
  "GIRO RGB",
  "CERVEJA",
  "CERVEJA ZERO",
  "CERVEJA MULTIPACK",
  "HE",
  "HE RGB",
  "TRIMARCA RGB HE (Original)",
  "TRIMARCA RGB HE (Stella)",
  "TRIMARCA RGB HE (Spaten)",
  "NAB",
  "NAB ZERO",
  "MATCH",
  "LITRINHO",
  "MKTP",
];

export default function Produtos() {
  const [produtos, setProdutos] = useState([]);
  const [semCat, setSemCat] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [editando, setEditando] = useState(null);
  const [catEdit, setCatEdit] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState("");
  const [aba, setAba] = useState("base");

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setLoading(true);
    try {
      const [resBase, resSem] = await Promise.all([
        api.get("/api/admin/produtos"),
        api.get("/api/admin/produtos/sem-categoria"),
      ]);
      setProdutos(resBase.data || []);
      setSemCat(resSem.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function salvarCategoria(cod, categoria) {
    setSalvando(true);
    try {
      await api.put(`/api/admin/produtos/${cod}`, { categoria });
      setSucesso(`Produto ${cod} atualizado.`);
      setEditando(null);
      await carregar();
      setTimeout(() => setSucesso(""), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setSalvando(false);
    }
  }

  const lista = aba === "base" ? produtos : semCat;

  const filtrados = lista.filter((p) => {
    const buscaOk = !busca ||
      p.cod?.toString().includes(busca) ||
      p.nome?.toLowerCase().includes(busca.toLowerCase()) ||
      p.descricao?.toLowerCase().includes(busca.toLowerCase());

    const filtroOk = filtro === "todos" ||
      (filtro === "sem_cat" && !p.categoria) ||
      (filtro === "com_cat" && p.categoria);

    return buscaOk && filtroOk;
  });

  return (
    <div>
      {/* Abas */}
      <div style={styles.abas}>
        <button
          style={{ ...styles.abaBtn, ...(aba === "base" ? styles.abaBtnAtivo : {}) }}
          onClick={() => setAba("base")}
        >
          📦 Base de Produtos
        </button>
        <button
          style={{ ...styles.abaBtn, ...(aba === "sem_cat" ? styles.abaBtnAtivo : {}) }}
          onClick={() => setAba("sem_cat")}
        >
          ⚠️ Sem Categoria
          {semCat.length > 0 && <span style={styles.badge}>{semCat.length}</span>}
        </button>
      </div>

      {sucesso && <p style={styles.sucesso}>{sucesso}</p>}

      {/* Filtros */}
      <div style={styles.filtrosRow}>
        <input
          style={styles.inputFiltro}
          placeholder="Buscar por código ou nome..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        {aba === "base" && (
          <select style={styles.inputFiltro} value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="todos">Todos</option>
            <option value="com_cat">Com categoria</option>
            <option value="sem_cat">Sem categoria</option>
          </select>
        )}
        <span style={styles.countLabel}>{filtrados.length} produtos</span>
      </div>

      {/* Tabela */}
      {loading ? (
        <p style={styles.msg}>Carregando...</p>
      ) : filtrados.length === 0 ? (
        <p style={styles.msg}>Nenhum produto encontrado.</p>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                {["Cód", "Nome / Descrição", "Categoria", "Ação"].map((h) => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p) => (
                <tr key={p.cod} style={styles.tr}>
                  <td style={styles.td}>
                    <span style={styles.codBadge}>{p.cod}</span>
                  </td>
                  <td style={{ ...styles.td, textAlign: "left", fontSize: "0.82rem" }}>
                    {p.nome || p.descricao || "—"}
                  </td>
                  <td style={styles.td}>
                    {editando === p.cod ? (
                      <select
                        style={styles.selectInline}
                        value={catEdit}
                        onChange={(e) => setCatEdit(e.target.value)}
                        autoFocus
                      >
                        {CATEGORIAS.map((c) => (
                          <option key={c} value={c}>{c || "— sem categoria —"}</option>
                        ))}
                      </select>
                    ) : p.categoria ? (
                      <span style={styles.catTag}>{p.categoria}</span>
                    ) : (
                      <span style={styles.semCat}>⚠️ sem categoria</span>
                    )}
                  </td>
                  <td style={styles.td}>
                    {editando === p.cod ? (
                      <div style={styles.acoes}>
                        <button
                          style={styles.btnSalvar}
                          onClick={() => salvarCategoria(p.cod, catEdit)}
                          disabled={salvando}
                        >
                          {salvando ? "..." : "✓"}
                        </button>
                        <button style={styles.btnCancelar} onClick={() => setEditando(null)}>✕</button>
                      </div>
                    ) : (
                      <button
                        style={styles.btnEditar}
                        onClick={() => { setEditando(p.cod); setCatEdit(p.categoria || ""); }}
                      >
                        ✏️
                      </button>
                    )}
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

const styles = {
  abas: { display: "flex", gap: "4px", marginBottom: "20px", borderBottom: "1px solid rgba(255,255,255,0.08)" },
  abaBtn: { background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", padding: "10px 20px", cursor: "pointer", fontSize: "0.9rem", fontFamily: "inherit", borderBottom: "2px solid transparent", marginBottom: "-1px", display: "flex", alignItems: "center", gap: "6px" },
  abaBtnAtivo: { color: "#fbb900", borderBottom: "2px solid #fbb900" },
  badge: { background: "rgba(239,68,68,0.2)", color: "#f87171", padding: "1px 6px", borderRadius: "10px", fontSize: "0.72rem", fontWeight: "700" },
  sucesso: { color: "#4ade80", fontSize: "0.85rem", marginBottom: "12px", textAlign: "center" },
  filtrosRow: { display: "flex", gap: "10px", marginBottom: "16px", alignItems: "center", flexWrap: "wrap" },
  inputFiltro: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff", padding: "8px 12px", fontSize: "0.85rem", fontFamily: "inherit", outline: "none" },
  countLabel: { color: "rgba(255,255,255,0.35)", fontSize: "0.82rem", marginLeft: "auto" },
  msg: { color: "rgba(255,255,255,0.35)", textAlign: "center", padding: "40px" },
  tableWrap: { overflowX: "auto", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.08)" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)", fontSize: "0.75rem", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", padding: "10px 12px", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap" },
  tr: { borderBottom: "1px solid rgba(255,255,255,0.04)" },
  td: { padding: "9px 12px", color: "rgba(255,255,255,0.8)", fontSize: "0.85rem", textAlign: "center" },
  codBadge: { background: "rgba(251,185,0,0.12)", color: "#fbb900", padding: "2px 8px", borderRadius: "6px", fontSize: "0.78rem", fontWeight: "700" },
  catTag: { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", padding: "2px 8px", borderRadius: "6px", fontSize: "0.78rem" },
  semCat: { color: "#f87171", fontSize: "0.78rem" },
  selectInline: { background: "#1a2235", border: "1px solid rgba(251,185,0,0.4)", borderRadius: "6px", color: "#fff", padding: "4px 8px", fontSize: "0.82rem", fontFamily: "inherit", outline: "none", cursor: "pointer" },
  acoes: { display: "flex", gap: "4px", justifyContent: "center" },
  btnEditar: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", padding: "4px 8px", cursor: "pointer", fontSize: "0.82rem" },
  btnSalvar: { background: "rgba(34,197,94,0.2)", border: "1px solid rgba(34,197,94,0.3)", color: "#4ade80", borderRadius: "6px", padding: "4px 10px", cursor: "pointer", fontWeight: "700", fontFamily: "inherit" },
  btnCancelar: { background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", borderRadius: "6px", padding: "4px 10px", cursor: "pointer", fontFamily: "inherit" },
};
