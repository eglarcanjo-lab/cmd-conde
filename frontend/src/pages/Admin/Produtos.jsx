import { useState, useEffect, useRef } from "react";
import api from "../../services/api";
import * as XLSX from "xlsx";

const CATEGORIAS = [
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
  "BALANCED CHOICE",
];

const CAT_COLORS = {
  "GIRO RGB":                    { bg: "rgba(125,186,61,0.15)",  color: "#7DBA3D" },
  "CERVEJA":                     { bg: "rgba(96,165,250,0.15)", color: "#60a5fa" },
  "CERVEJA ZERO":                { bg: "rgba(96,165,250,0.1)",  color: "#93c5fd" },
  "CERVEJA MULTIPACK":           { bg: "rgba(96,165,250,0.1)",  color: "#bfdbfe" },
  "HE":                          { bg: "rgba(167,139,250,0.15)",color: "#a78bfa" },
  "HE RGB":                      { bg: "rgba(167,139,250,0.12)",color: "#c4b5fd" },
  "TRIMARCA RGB HE (Original)":  { bg: "rgba(125,186,61,0.12)", color: "#fcd34d" },
  "TRIMARCA RGB HE (Stella)":    { bg: "rgba(125,186,61,0.10)", color: "#fde68a" },
  "TRIMARCA RGB HE (Spaten)":    { bg: "rgba(125,186,61,0.08)", color: "#fef3c7" },
  "NAB":                         { bg: "rgba(34,197,94,0.15)",  color: "#4ade80" },
  "NAB ZERO":                    { bg: "rgba(34,197,94,0.1)",   color: "#86efac" },
  "MATCH":                       { bg: "rgba(239,68,68,0.15)",  color: "#f87171" },
  "LITRINHO":                    { bg: "rgba(125,186,61,0.15)",  color: "#fbbf24" },
  "MKTP":                        { bg: "rgba(255,255,255,0.08)",color: "rgba(255,255,255,0.6)" },
  "BALANCED CHOICE":             { bg: "rgba(20,184,166,0.15)",  color: "#2dd4bf" },
};

function TagsEditor({ categoriaStr, onSave, onCancel }) {
  const [selecionadas, setSelecionadas] = useState(
    categoriaStr ? categoriaStr.split("|").map(c => c.trim()).filter(Boolean) : []
  );

  function toggle(cat) {
    setSelecionadas(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  }

  return (
    <div style={styles.tagsEditor}>
      <div style={styles.tagsGrid}>
        {CATEGORIAS.map(cat => {
          const ativo = selecionadas.includes(cat);
          const clr = CAT_COLORS[cat] || { bg: "rgba(255,255,255,0.08)", color: "#fff" };
          return (
            <button
              key={cat}
              style={{
                ...styles.tagToggle,
                background: ativo ? clr.bg : "rgba(255,255,255,0.04)",
                color: ativo ? clr.color : "rgba(255,255,255,0.3)",
                border: ativo ? `1px solid ${clr.color}40` : "1px solid rgba(255,255,255,0.08)",
                fontWeight: ativo ? "700" : "400",
              }}
              onClick={() => toggle(cat)}
            >
              {ativo ? "✓ " : ""}{cat}
            </button>
          );
        })}
      </div>
      <div style={styles.tagsActions}>
        <button style={styles.btnCancelar} onClick={onCancel}>Cancelar</button>
        <button style={styles.btnSalvar} onClick={() => onSave(selecionadas.join("|"))}>
          Salvar ({selecionadas.length} categorias)
        </button>
      </div>
    </div>
  );
}

function CategoriasTags({ categoriaStr }) {
  if (!categoriaStr) return <span style={styles.semCat}>⚠️ sem categoria</span>;
  const cats = categoriaStr.split("|").map(c => c.trim()).filter(Boolean);
  return (
    <div style={styles.tagsRow}>
      {cats.map(cat => {
        const clr = CAT_COLORS[cat] || { bg: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" };
        return (
          <span key={cat} style={{ ...styles.catTag, background: clr.bg, color: clr.color }}>
            {cat}
          </span>
        );
      })}
    </div>
  );
}

export default function Produtos() {
  const [produtos, setProdutos] = useState([]);
  const [semCat, setSemCat] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [filtroCat, setFiltroCat] = useState("");
  const [editando, setEditando] = useState(null);
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

  async function salvarCategoria(cod, categorias) {
    setSalvando(true);
    try {
      await api.put(`/api/admin/produtos/${cod}`, { categoria: categorias });
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

  const lista = aba === "base" ? produtos : semCat.map(s => ({
    cod: s.cod_prod, nome: s.nome_prod, categorias: s.categoria || ""
  }));

  function exportar() {
    const linhas = filtrados.map((p) => {
      const catField = p.categorias || p.categoria || "";
      const cats = catField.split("|").map(c => c.trim()).filter(Boolean);
      return {
        "Código":     p.cod ?? "",
        "Nome":       p.nome ?? "",
        "Categorias": cats.join(" | ") || "Sem categoria",
        "Qtd. Categorias": cats.length,
      };
    });

    const ws = XLSX.utils.json_to_sheet(linhas);

    // Largura das colunas
    ws["!cols"] = [{ wch: 12 }, { wch: 40 }, { wch: 50 }, { wch: 16 }];

    const wb = XLSX.utils.book_new();
    const abaLabel = aba === "base" ? "Produtos" : "Sem Categoria";
    XLSX.utils.book_append_sheet(wb, ws, abaLabel);

    // Nome do arquivo reflete os filtros ativos
    const partes = ["produtos"];
    if (filtroCat) partes.push(filtroCat.replace(/[\s/()]/g, "_"));
    else if (filtro !== "todos") partes.push(filtro);
    if (busca) partes.push(`busca_${busca}`);
    const hoje = new Date().toISOString().slice(0, 10);
    partes.push(hoje);

    XLSX.writeFile(wb, `${partes.join("_")}.xlsx`);
  }

  // Contagem por categoria (para badges nos chips)
  const contagemPorCat = {};
  lista.forEach((p) => {
    const catField = p.categorias || p.categoria || "";
    if (catField) {
      catField.split("|").map(c => c.trim()).filter(Boolean).forEach(c => {
        contagemPorCat[c] = (contagemPorCat[c] || 0) + 1;
      });
    }
  });

  const filtrados = lista.filter((p) => {
    const catField = p.categorias || p.categoria || "";
    const buscaOk = !busca ||
      p.cod?.toString().includes(busca) ||
      p.nome?.toLowerCase().includes(busca.toLowerCase());
    const filtroOk = filtro === "todos" ||
      (filtro === "sem_cat" && !catField) ||
      (filtro === "com_cat" && catField);
    const catOk = !filtroCat ||
      catField.split("|").map(c => c.trim()).includes(filtroCat);
    return buscaOk && filtroOk && catOk;
  });

  return (
    <div>
      <div style={styles.abas}>
        <button style={{ ...styles.abaBtn, ...(aba === "base" ? styles.abaBtnAtivo : {}) }} onClick={() => setAba("base")}>
          📦 Base de Produtos
        </button>
        <button style={{ ...styles.abaBtn, ...(aba === "sem_cat" ? styles.abaBtnAtivo : {}) }} onClick={() => setAba("sem_cat")}>
          ⚠️ Sem Categoria
          {semCat.length > 0 && <span style={styles.badge}>{semCat.length}</span>}
        </button>
      </div>

      {sucesso && <p style={styles.sucesso}>{sucesso}</p>}

      <div style={styles.filtrosRow}>
        <input
          style={styles.inputFiltro}
          placeholder="Buscar por código ou nome..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        {aba === "base" && (
          <select style={styles.inputFiltro} value={filtro} onChange={(e) => { setFiltro(e.target.value); setFiltroCat(""); }}>
            <option value="todos">Todos</option>
            <option value="com_cat">Com categoria</option>
            <option value="sem_cat">Sem categoria</option>
          </select>
        )}
        <span style={styles.countLabel}>{filtrados.length} produtos</span>
        <button
          style={styles.btnExportar}
          onClick={exportar}
          disabled={filtrados.length === 0}
          title="Exportar lista filtrada para Excel"
        >
          ⬇️ Exportar xlsx
        </button>
      </div>

      {/* Filtro por categoria */}
      <div style={styles.catFiltroWrap}>
        <button
          style={{
            ...styles.catChip,
            background: !filtroCat ? "rgba(125,186,61,0.18)" : "rgba(255,255,255,0.05)",
            color: !filtroCat ? "#7DBA3D" : "rgba(255,255,255,0.35)",
            border: !filtroCat ? "1px solid rgba(125,186,61,0.4)" : "1px solid rgba(255,255,255,0.08)",
            fontWeight: !filtroCat ? "700" : "400",
          }}
          onClick={() => { setFiltroCat(""); setFiltro("todos"); }}
        >
          Todas
        </button>
        {CATEGORIAS.map(cat => {
          const clr = CAT_COLORS[cat] || { bg: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" };
          const ativo = filtroCat === cat;
          const qtd = contagemPorCat[cat] || 0;
          return (
            <button
              key={cat}
              style={{
                ...styles.catChip,
                background: ativo ? clr.bg : "rgba(255,255,255,0.03)",
                color: ativo ? clr.color : "rgba(255,255,255,0.35)",
                border: ativo ? `1px solid ${clr.color}50` : "1px solid rgba(255,255,255,0.07)",
                fontWeight: ativo ? "700" : "400",
              }}
              onClick={() => { setFiltroCat(ativo ? "" : cat); setFiltro("todos"); }}
            >
              {cat}
              {qtd > 0 && (
                <span style={{
                  marginLeft: "5px",
                  background: ativo ? `${clr.color}25` : "rgba(255,255,255,0.08)",
                  color: ativo ? clr.color : "rgba(255,255,255,0.3)",
                  padding: "0px 5px",
                  borderRadius: "8px",
                  fontSize: "0.68rem",
                  fontWeight: "700",
                }}>
                  {qtd}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <p style={styles.msg}>Carregando...</p>
      ) : filtrados.length === 0 ? (
        <p style={styles.msg}>Nenhum produto encontrado.</p>
      ) : (
        <div style={styles.lista}>
          {filtrados.map((p) => {
            const catField = p.categorias || p.categoria || "";
            const isEditando = editando === p.cod;
            return (
              <div key={p.cod} style={{ ...styles.prodRow, ...(isEditando ? styles.prodRowAtivo : {}) }}>
                <div style={styles.prodInfo}>
                  <span style={styles.codBadge}>{p.cod}</span>
                  <span style={styles.prodNome}>{p.nome || "—"}</span>
                </div>
                <div style={styles.prodCats}>
                  {isEditando ? (
                    <TagsEditor
                      categoriaStr={catField}
                      onSave={(cats) => salvarCategoria(p.cod, cats)}
                      onCancel={() => setEditando(null)}
                    />
                  ) : (
                    <div style={styles.prodCatsRow}>
                      <CategoriasTags categoriaStr={catField} />
                      <button style={styles.btnEditar} onClick={() => setEditando(p.cod)}>✏️</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles = {
  abas: { display: "flex", gap: "4px", marginBottom: "20px", borderBottom: "1px solid rgba(255,255,255,0.08)" },
  abaBtn: { background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", padding: "10px 20px", cursor: "pointer", fontSize: "0.9rem", fontFamily: "inherit", borderBottom: "2px solid transparent", marginBottom: "-1px", display: "flex", alignItems: "center", gap: "6px" },
  abaBtnAtivo: { color: "#7DBA3D", borderBottom: "2px solid #7DBA3D" },
  badge: { background: "rgba(239,68,68,0.2)", color: "#f87171", padding: "1px 6px", borderRadius: "10px", fontSize: "0.72rem", fontWeight: "700" },
  sucesso: { color: "#4ade80", fontSize: "0.85rem", marginBottom: "12px", textAlign: "center" },
  filtrosRow: { display: "flex", gap: "10px", marginBottom: "10px", alignItems: "center", flexWrap: "wrap" },
  inputFiltro: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff", padding: "8px 12px", fontSize: "0.85rem", fontFamily: "inherit", outline: "none" },
  countLabel: { color: "rgba(255,255,255,0.35)", fontSize: "0.82rem", marginLeft: "auto" },
  btnExportar: { background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)", color: "#4ade80", borderRadius: "8px", padding: "7px 14px", cursor: "pointer", fontSize: "0.82rem", fontFamily: "inherit", fontWeight: "600", whiteSpace: "nowrap" },
  catFiltroWrap: { display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "16px", padding: "10px 12px", background: "rgba(255,255,255,0.02)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.06)" },
  catChip: { border: "none", borderRadius: "6px", padding: "4px 10px", cursor: "pointer", fontSize: "0.75rem", fontFamily: "inherit", transition: "all 0.15s", display: "flex", alignItems: "center" },
  msg: { color: "rgba(255,255,255,0.35)", textAlign: "center", padding: "40px" },
  lista: { display: "flex", flexDirection: "column", gap: "6px" },
  prodRow: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "10px", padding: "12px 16px", display: "flex", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" },
  prodRowAtivo: { border: "1px solid rgba(125,186,61,0.3)", background: "rgba(125,186,61,0.03)" },
  prodInfo: { display: "flex", alignItems: "center", gap: "10px", minWidth: "220px" },
  codBadge: { background: "rgba(125,186,61,0.12)", color: "#7DBA3D", padding: "2px 8px", borderRadius: "6px", fontSize: "0.78rem", fontWeight: "700", whiteSpace: "nowrap" },
  prodNome: { color: "rgba(255,255,255,0.75)", fontSize: "0.83rem" },
  prodCats: { flex: 1 },
  prodCatsRow: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" },
  tagsRow: { display: "flex", flexWrap: "wrap", gap: "4px" },
  catTag: { padding: "2px 8px", borderRadius: "6px", fontSize: "0.72rem", fontWeight: "600", whiteSpace: "nowrap" },
  semCat: { color: "#f87171", fontSize: "0.78rem" },
  btnEditar: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", padding: "3px 8px", cursor: "pointer", fontSize: "0.8rem", whiteSpace: "nowrap" },
  tagsEditor: { display: "flex", flexDirection: "column", gap: "12px", width: "100%" },
  tagsGrid: { display: "flex", flexWrap: "wrap", gap: "6px" },
  tagToggle: { border: "none", borderRadius: "6px", padding: "4px 10px", cursor: "pointer", fontSize: "0.78rem", fontFamily: "inherit", transition: "all 0.15s" },
  tagsActions: { display: "flex", gap: "8px", justifyContent: "flex-end" },
  btnSalvar: { background: "linear-gradient(135deg, #7DBA3D, #2E7D32)", color: "#0c1410", border: "none", borderRadius: "8px", padding: "7px 16px", fontWeight: "700", cursor: "pointer", fontSize: "0.85rem", fontFamily: "inherit" },
  btnCancelar: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", borderRadius: "8px", padding: "7px 14px", cursor: "pointer", fontSize: "0.85rem", fontFamily: "inherit" },
};
