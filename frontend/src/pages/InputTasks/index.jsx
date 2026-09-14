// Input de Tasks (grupo Ações de Preço, admin) — gerador de tarefas.
// Fluxo: monta uma definição (tipo · base · produtos · texto) → "Lançar task" salva.
// A tabela de saída (1 linha por PDV × task) é gerada de todas as tasks lançadas.
// UNB_PDV = 1035185_{cod_pdv} · cod_produto (vírgula) · texto · tipo.
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx-js-style";
import api from "../../services/api";

const VERDE = "#7DBA3D";
const TIPOS = ["SKU/PDV", "NAB", "Cerveja Zero", "Match", "Mktp", "Volume", "Cobertura"];

export default function InputTasks() {
  const navigate = useNavigate();
  // formulário
  const [tipo, setTipo] = useState("SKU/PDV");
  const [base, setBase] = useState("total"); // total | nao_compradora
  const [produtos, setProdutos] = useState([]); // [{cod, nome}]
  const [texto, setTexto] = useState("");
  const [editId, setEditId] = useState(null);
  // busca de produto
  const [busca, setBusca] = useState("");
  const [sugestoes, setSugestoes] = useState([]);
  const [textoFoco, setTextoFoco] = useState(false);
  const timer = useRef(null);
  // dados
  const [defs, setDefs] = useState([]);
  const [saida, setSaida] = useState(null); // {linhas, resumo, janela, total_base}
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    try {
      const [l, g] = await Promise.all([api.get("/api/input-tasks"), api.get("/api/input-tasks/gerar")]);
      setDefs(l.data || []);
      setSaida(g.data || null);
    } catch (e) { setErro(e?.response?.data?.error || "Falha ao carregar."); }
  };
  useEffect(() => { carregar(); }, []);

  useEffect(() => {
    if (busca.trim().length < 2) { setSugestoes([]); return; }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      api.get(`/api/input-tasks/produtos?q=${encodeURIComponent(busca.trim())}`).then((r) => setSugestoes(r.data || [])).catch(() => {});
    }, 300);
    return () => clearTimeout(timer.current);
  }, [busca]);

  const addProduto = (p) => {
    setProdutos((cur) => cur.some((x) => x.cod === p.cod) ? cur : [...cur, p]);
    setBusca(""); setSugestoes([]);
  };
  const removeProduto = (cod) => setProdutos((cur) => cur.filter((x) => x.cod !== cod));

  const limpar = () => { setEditId(null); setTipo("SKU/PDV"); setBase("total"); setProdutos([]); setTexto(""); setBusca(""); setSugestoes([]); };

  const lancar = async () => {
    setErro("");
    if (!tipo.trim()) return setErro("Informe o tipo da task.");
    if (!produtos.length) return setErro("Liste ao menos um produto.");
    if (!texto.trim()) return setErro("Escreva o texto da tarefa.");
    setSalvando(true);
    const body = { tipo: tipo.trim(), base, produtos: produtos.map((p) => p.cod), texto };
    try {
      if (editId) await api.put(`/api/input-tasks/${editId}`, body);
      else await api.post("/api/input-tasks", body);
      limpar();
      await carregar();
    } catch (e) { setErro(e?.response?.data?.error || "Falha ao lançar."); }
    finally { setSalvando(false); }
  };

  const editar = (d) => {
    setEditId(d.id); setTipo(d.tipo); setBase(d.base);
    setProdutos((d.produtos_nomes || []).map((p) => ({ cod: p.cod, nome: p.nome })));
    setTexto(d.texto); setErro("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const remover = async (id) => {
    if (!window.confirm("Remover esta task?")) return;
    try { await api.delete(`/api/input-tasks/${id}`); if (editId === id) limpar(); await carregar(); }
    catch (e) { setErro(e?.response?.data?.error || "Falha ao remover."); }
  };

  const baseLabel = (b) => (b === "nao_compradora" ? "Não compradora" : "Base total");

  const exportar = () => {
    const linhas = saida?.linhas || [];
    if (!linhas.length) return;
    const aoa = [["UNB_PDV", "cod_produto", "texto_tarefa", "tipo_task"],
      ...linhas.map((l) => [l.unb_pdv, l.cod_produto, l.texto, l.tipo])];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 20 }, { wch: 24 }, { wch: 60 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tasks");
    XLSX.writeFile(wb, `input_tasks_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };
  const copiar = () => {
    const linhas = saida?.linhas || [];
    const tsv = [["UNB_PDV", "cod_produto", "texto_tarefa", "tipo_task"].join("\t"),
      ...linhas.map((l) => [l.unb_pdv, l.cod_produto, l.texto, l.tipo].join("\t"))].join("\n");
    navigator.clipboard?.writeText(tsv).then(() => setErro("✓ Copiado (cole no Excel/Sheets).")).catch(() => {});
  };

  const linhas = saida?.linhas || [];
  const MOSTRAR = 200;

  // Sugestões de texto: os textos já lançados (distintos), filtrados pelo que se digita.
  // Casa sem acento e sem diferenciar maiúsc./minúsc. (ex.: "florestal" acha "Florestal").
  const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const textosUnicos = [...new Set(defs.map((d) => (d.texto || "").trim()).filter(Boolean))];
  const alvo = norm(texto.trim());
  const sugTexto = textosUnicos.filter((t) => t.trim() !== texto.trim() && (!alvo || norm(t).includes(alvo)));

  return (
    <div style={S.root}>
      <div style={S.header}>
        <button style={S.back} onClick={() => navigate("/")}>← Início</button>
        <h1 style={S.h1}>📋 Imput de Tasks</h1>
        <span style={S.badge}>Ações de Preço · Admin</span>
      </div>

      {/* Formulário */}
      <div style={S.card}>
        <div style={S.cardTit}>{editId ? "✏️ Editando task" : "➕ Nova task"}</div>
        <div style={S.formGrid}>
          <div>
            <label style={S.lbl}>Tipo da task</label>
            <input list="tipos-task" style={S.input} value={tipo} onChange={(e) => setTipo(e.target.value)} placeholder="SKU/PDV, NAB, Cerveja Zero…" />
            <datalist id="tipos-task">{TIPOS.map((t) => <option key={t} value={t} />)}</datalist>
          </div>
          <div>
            <label style={S.lbl}>Base</label>
            <div style={S.radioRow}>
              <label style={S.radio}><input type="radio" checked={base === "total"} onChange={() => setBase("total")} /> Base total</label>
              <label style={S.radio}><input type="radio" checked={base === "nao_compradora"} onChange={() => setBase("nao_compradora")} /> Não compradora</label>
            </div>
            {base === "nao_compradora" && <div style={S.hint}>Quem NÃO comprou nenhum dos SKUs listados{saida?.janela ? ` no tri (${saida.janela})` : ""}.</div>}
          </div>
        </div>

        <label style={S.lbl}>Produtos (SKUs da task)</label>
        <div style={S.buscaWrap}>
          <input style={S.input} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por código ou nome…" />
          {sugestoes.length > 0 && (
            <div style={S.dropdown}>
              {sugestoes.map((p) => (
                <div key={p.cod} style={S.opt} onClick={() => addProduto(p)}>
                  <b style={{ color: VERDE }}>{p.cod}</b> · {p.nome}
                  {p.saldo != null && <span style={S.optSaldo}>saldo {Number(p.saldo).toLocaleString("pt-BR")}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
        {produtos.length > 0 && (
          <div style={S.chips}>
            {produtos.map((p) => (
              <span key={p.cod} style={S.chip} title={p.nome}>
                {p.cod} · {p.nome.length > 28 ? p.nome.slice(0, 28) + "…" : p.nome}
                <span style={S.chipX} onClick={() => removeProduto(p.cod)}>×</span>
              </span>
            ))}
          </div>
        )}

        <label style={{ ...S.lbl, marginTop: 12 }}>Texto da tarefa (replica para todos os PDVs)</label>
        <div style={S.buscaWrap}>
          <input style={S.input} value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onFocus={() => setTextoFoco(true)}
            onBlur={() => setTimeout(() => setTextoFoco(false), 150)}
            placeholder="Ex.: Ofertar o portfólio de NAB e garantir gôndola…" />
          {textoFoco && sugTexto.length > 0 && (
            <div style={S.dropdown}>
              <div style={S.dropHead}>💡 Reaproveitar texto já lançado</div>
              {sugTexto.map((t, i) => (
                <div key={i} style={S.optTxt} onMouseDown={() => { setTexto(t); setTextoFoco(false); }}>{t}</div>
              ))}
            </div>
          )}
        </div>

        {erro && <div style={S.erro}>{erro}</div>}
        <div style={S.actions}>
          <button style={S.btnPrim} onClick={lancar} disabled={salvando}>{salvando ? "…" : (editId ? "💾 Salvar edição" : "🚀 Lançar task")}</button>
          {editId && <button style={S.btnGhost} onClick={limpar}>Cancelar</button>}
        </div>
      </div>

      {/* Lista de tasks lançadas */}
      <div style={S.card}>
        <div style={S.cardTit}>Tasks lançadas ({defs.length}) <span style={S.tit2}>· clique para editar</span></div>
        {defs.length === 0 ? (
          <div style={S.vazio}>Nenhuma task lançada ainda.</div>
        ) : defs.map((d) => {
          const qtd = saida?.resumo?.find((r) => r.id === d.id)?.qtd_pdvs;
          return (
            <div key={d.id} style={S.defRow}>
              <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => editar(d)}>
                <div style={S.defTop}>
                  <span style={S.defTipo}>{d.tipo}</span>
                  <span style={{ ...S.defBase, background: d.base === "nao_compradora" ? "rgba(240,153,123,0.15)" : "rgba(125,186,61,0.15)", color: d.base === "nao_compradora" ? "#f0997b" : VERDE }}>{baseLabel(d.base)}</span>
                  {qtd != null && <span style={S.defQtd}>{qtd.toLocaleString("pt-BR")} PDVs</span>}
                </div>
                <div style={S.defProd}>{d.produtos.join(", ")}</div>
                <div style={S.defTxt}>{d.texto}</div>
              </div>
              <button style={S.btnDel} onClick={() => remover(d.id)}>🗑</button>
            </div>
          );
        })}
      </div>

      {/* Tabela de saída */}
      <div style={S.card}>
        <div style={S.saidaTop}>
          <div style={S.cardTit}>Tabela de saída ({linhas.length.toLocaleString("pt-BR")} linhas)</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={S.btnGhost} onClick={copiar} disabled={!linhas.length}>Copiar</button>
            <button style={S.btnPrim} onClick={exportar} disabled={!linhas.length}>⬇ Excel</button>
          </div>
        </div>
        {!linhas.length ? (
          <div style={S.vazio}>Lance ao menos uma task para gerar a tabela.</div>
        ) : (
          <div style={S.tableWrap}>
            <table style={S.table}>
              <thead><tr>{["UNB_PDV", "cod_produto", "texto_tarefa", "tipo_task"].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {linhas.slice(0, MOSTRAR).map((l, i) => (
                  <tr key={i}>
                    <td style={S.td}>{l.unb_pdv}</td>
                    <td style={S.td}>{l.cod_produto}</td>
                    <td style={{ ...S.td, whiteSpace: "normal", maxWidth: 360 }}>{l.texto}</td>
                    <td style={S.td}>{l.tipo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {linhas.length > MOSTRAR && <div style={S.maisNota}>Mostrando {MOSTRAR} de {linhas.length.toLocaleString("pt-BR")} — o Excel/Copiar levam tudo.</div>}
          </div>
        )}
      </div>
    </div>
  );
}

const S = {
  root: { minHeight: "100vh", background: "#0c1410", color: "#fff", fontFamily: "'Poppins','Segoe UI',system-ui,sans-serif", padding: "18px clamp(12px,3vw,28px) 60px", maxWidth: 1100, margin: "0 auto" },
  header: { display: "flex", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" },
  back: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.85rem" },
  h1: { fontSize: "1.3rem", fontWeight: 700, margin: 0 },
  badge: { background: "rgba(125,186,61,0.15)", color: VERDE, padding: "3px 10px", borderRadius: 20, fontSize: "0.75rem", fontWeight: 600 },
  card: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "16px 18px", marginBottom: 16 },
  cardTit: { fontSize: "1rem", fontWeight: 600, marginBottom: 12 },
  tit2: { color: "rgba(255,255,255,0.4)", fontWeight: 400, fontSize: "0.82rem" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 16, marginBottom: 12 },
  lbl: { display: "block", color: "rgba(255,255,255,0.55)", fontSize: "0.82rem", marginBottom: 6 },
  input: { width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "9px 11px", color: "#fff", fontFamily: "inherit", fontSize: "0.9rem", boxSizing: "border-box" },
  textarea: { width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "9px 11px", color: "#fff", fontFamily: "inherit", fontSize: "0.9rem", boxSizing: "border-box", resize: "vertical" },
  radioRow: { display: "flex", gap: 16, paddingTop: 6 },
  radio: { display: "flex", alignItems: "center", gap: 6, fontSize: "0.88rem", color: "rgba(255,255,255,0.8)", cursor: "pointer" },
  hint: { color: "rgba(255,255,255,0.4)", fontSize: "0.78rem", marginTop: 6 },
  buscaWrap: { position: "relative" },
  dropdown: { position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10, background: "#16211a", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 8, marginTop: 4, maxHeight: 260, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" },
  opt: { padding: "8px 11px", cursor: "pointer", fontSize: "0.86rem", borderBottom: "1px solid rgba(255,255,255,0.05)" },
  optSaldo: { float: "right", color: "rgba(255,255,255,0.4)", fontSize: "0.76rem" },
  optTxt: { padding: "8px 11px", cursor: "pointer", fontSize: "0.84rem", borderBottom: "1px solid rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.85)", whiteSpace: "normal", lineHeight: 1.4 },
  dropHead: { padding: "7px 11px", fontSize: "0.75rem", color: "rgba(255,255,255,0.45)", borderBottom: "1px solid rgba(255,255,255,0.08)", position: "sticky", top: 0, background: "#16211a" },
  chips: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 },
  chip: { display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(125,186,61,0.12)", border: "1px solid rgba(125,186,61,0.3)", color: "#cfe8b0", borderRadius: 20, padding: "4px 10px", fontSize: "0.8rem" },
  chipX: { cursor: "pointer", color: "#f0997b", fontWeight: 700 },
  erro: { color: "#f0997b", fontSize: "0.85rem", marginTop: 10 },
  actions: { display: "flex", gap: 10, marginTop: 14 },
  btnPrim: { background: VERDE, border: "none", color: "#0c1410", borderRadius: 8, padding: "10px 18px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.9rem", fontWeight: 700 },
  btnGhost: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)", borderRadius: 8, padding: "10px 16px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.9rem" },
  vazio: { color: "rgba(255,255,255,0.4)", fontSize: "0.88rem", padding: "8px 0" },
  defRow: { display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0", borderTop: "1px solid rgba(255,255,255,0.06)" },
  defTop: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  defTipo: { fontWeight: 700, color: "#fff", fontSize: "0.92rem" },
  defBase: { fontSize: "0.72rem", borderRadius: 20, padding: "1px 8px", fontWeight: 600 },
  defQtd: { fontSize: "0.75rem", color: "rgba(255,255,255,0.5)" },
  defProd: { color: VERDE, fontSize: "0.82rem", margin: "3px 0" },
  defTxt: { color: "rgba(255,255,255,0.6)", fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  btnDel: { background: "transparent", border: "none", cursor: "pointer", fontSize: "1rem", flexShrink: 0 },
  saidaTop: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" },
  th: { textAlign: "left", padding: "8px 10px", background: "rgba(255,255,255,0.05)", color: VERDE, whiteSpace: "nowrap", position: "sticky", top: 0 },
  td: { padding: "6px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.85)", whiteSpace: "nowrap" },
  maisNota: { color: "rgba(255,255,255,0.4)", fontSize: "0.8rem", padding: "8px 2px" },
};
