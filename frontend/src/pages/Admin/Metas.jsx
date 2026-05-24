// v2.2 - fix arredondamento meta
import { useState, useEffect, useRef } from "react";
import api from "../../services/api";
import * as XLSX from "xlsx";

const CATEGORIAS = [
  "CERVEJA (VOLUME)",
  "CERVEJA ZERO (VOLUME)",
  "NAB (VOLUME)",
  "NAB ZERO (VOLUME)",
  "MATCH (VOLUME)",
  "MARKETPLACE (FATURAMENTO)",
  "BALANCED CHOICE (VOLUME)",
  "PONTOS FORCE",
];

const SETORES = ["101","102","103","104","105","106","301","302","303","304","305"];

const EMPTY_FORM = { setor: "101", categoria: CATEGORIAS[0], meta_volume: "", mes_referencia: "", peso: "" };

function getMesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function Metas() {
  const [metas, setMetas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM, mes_referencia: getMesAtual() });
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [filtroMes, setFiltroMes] = useState(getMesAtual());
  const [filtroSetor, setFiltroSetor] = useState("");
  const [importando, setImportando] = useState(false);
  const fileRef = useRef();

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setLoading(true);
    try {
      const res = await api.get("/api/admin/metas");
      setMetas(res.data);
    } catch {
      setErro("Erro ao carregar metas.");
    } finally {
      setLoading(false);
    }
  }

  function setField(f, v) { setForm((prev) => ({ ...prev, [f]: v })); }

  async function salvar() {
    setErro(""); setSucesso("");
    if (!form.meta_volume || !form.mes_referencia) {
      setErro("Preencha todos os campos obrigatórios.");
      return;
    }
    setSalvando(true);
    try {
      await api.post("/api/admin/metas", form);
      setSucesso("Meta cadastrada com sucesso.");
      await carregar();
      setTimeout(() => { setShowModal(false); setSucesso(""); }, 1200);
    } catch (err) {
      setErro(err.response?.data?.error || "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function importarPlanilha(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImportando(true);
    setErro(""); setSucesso("");
    try {
      const data = await file.arrayBuffer();
      // cellFormula: false força leitura dos valores calculados, não das fórmulas
      const wb = XLSX.read(data, { cellFormula: false, cellNF: false, raw: false });

      // Tenta ler a aba "Metas para Importar" primeiro, senão usa a primeira aba
      const nomeAba = wb.SheetNames.includes("Metas para Importar")
        ? "Metas para Importar"
        : wb.SheetNames[0];
      const ws = wb.Sheets[nomeAba];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });

      const metas = rows
        .filter(r => r.setor && r.categoria && r.mes_referencia)
        .map((r) => {
          // Converte peso: pode vir como "25.59%" ou "0.2559" — normaliza para decimal
          let peso = String(r.peso || "").trim().replace(",", ".");
          if (peso.includes("%")) {
            peso = String(parseFloat(peso) / 100);
          } else if (parseFloat(peso) > 1) {
            peso = String(parseFloat(peso) / 100);
          }

          // meta_aplicada tem prioridade sobre meta_volume
          // Suporta formato brasileiro: "1.111" (ponto = milhar) → 1111
          //                              "1.111,50" (ponto milhar + vírgula decimal) → 1111.50
          const parseBrNum = (v) => {
            const s = String(v ?? "").trim();
            if (!s) return NaN;
            if (typeof v === "number") return v; // já é número (raw: true no XLSX)
            if (s.includes(",") && s.includes(".")) {
              // "1.234,56" → remove pontos de milhar → "1234,56" → troca vírgula → "1234.56"
              return parseFloat(s.replace(/\./g, "").replace(",", "."));
            }
            if (s.includes(",")) {
              // "1234,56" → decimal com vírgula
              return parseFloat(s.replace(",", "."));
            }
            if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
              // "1.111" ou "1.234.567" → só milhar com ponto, sem decimal → remove pontos
              return parseFloat(s.replace(/\./g, ""));
            }
            return parseFloat(s); // "1111" ou "3.35" (decimal inglês)
          };

          const metaNum = parseBrNum(r.meta_aplicada ?? r.meta_volume ?? "");
          const meta = isNaN(metaNum) ? "" : String(Math.round(metaNum * 100) / 100);

          const volNum = parseBrNum(r.volume_tri ?? "");
          const vol = isNaN(volNum) ? "" : String(Math.round(volNum * 100) / 100);

          return {
            setor:          String(r.setor || "").trim(),
            categoria:      String(r.categoria || "").trim(),
            meta_volume:    meta,
            mes_referencia: String(r.mes_referencia || "").trim(),
            peso:           peso,
            volume_tri:     vol,
            meta_aplicada:  meta,
          };
        });

      if (metas.length === 0) {
        setErro("Nenhuma linha válida encontrada. Verifique se a aba 'Metas para Importar' está preenchida.");
        return;
      }

      const res = await api.post("/api/admin/metas/import", { metas });
      setSucesso(`✅ ${res.data.importadas} metas importadas da aba "${nomeAba}".`);
      if (res.data.erros?.length) setErro(`Atenção: ${res.data.erros.slice(0, 3).join(" | ")}`);
      await carregar();
    } catch (err) {
      setErro("Erro ao importar planilha. Verifique o arquivo.");
      console.error(err);
    } finally {
      setImportando(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function baixarModelo() {
    const modelo = [
      { setor: "101", categoria: "CERVEJA (VOLUME)", meta_volume: "3200", mes_referencia: getMesAtual(), peso: "0.25", volume_tri: "2500", meta_aplicada: "3200" },
      { setor: "101", categoria: "NAB (VOLUME)", meta_volume: "280", mes_referencia: getMesAtual(), peso: "0.24", volume_tri: "556", meta_aplicada: "280" },
      { setor: "101", categoria: "MATCH (VOLUME)", meta_volume: "3.35", mes_referencia: getMesAtual(), peso: "0.14", volume_tri: "5.02", meta_aplicada: "3.35" },
      { setor: "101", categoria: "PONTOS FORCE", meta_volume: "100000", mes_referencia: getMesAtual(), peso: "0.5", volume_tri: "100000", meta_aplicada: "100000" },
    ];
    const ws = XLSX.utils.json_to_sheet(modelo);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Metas para Importar");
    XLSX.writeFile(wb, "modelo_metas.xlsx");
  }

  const filtradas = metas.filter((m) => {
    const mesOk = !filtroMes || m.mes_referencia === filtroMes;
    const setorOk = !filtroSetor || m.setor === filtroSetor;
    return mesOk && setorOk;
  });

  return (
    <div>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <input
          type="month"
          style={styles.inputFiltro}
          value={filtroMes}
          onChange={(e) => setFiltroMes(e.target.value)}
        />
        <select style={styles.inputFiltro} value={filtroSetor} onChange={(e) => setFiltroSetor(e.target.value)}>
          <option value="">Todos os setores</option>
          {SETORES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button style={styles.btnSecondary} onClick={baixarModelo}>⬇ Modelo</button>
        <button style={{ ...styles.btnSecondary, position: "relative" }} onClick={() => fileRef.current.click()} disabled={importando}>
          {importando ? "Importando..." : "📂 Importar"}
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={importarPlanilha} />
        </button>
        <button style={styles.btnPrimary} onClick={() => { setForm({ ...EMPTY_FORM, mes_referencia: getMesAtual() }); setErro(""); setSucesso(""); setShowModal(true); }}>
          + Nova Meta
        </button>
      </div>

      {sucesso && <p style={{ ...styles.sucesso, marginBottom: "12px" }}>{sucesso}</p>}
      {erro && <p style={{ ...styles.erro, marginBottom: "12px" }}>{erro}</p>}

      {/* Tabela */}
      {loading ? (
        <p style={styles.msg}>Carregando...</p>
      ) : filtradas.length === 0 ? (
        <p style={styles.msg}>Nenhuma meta encontrada para os filtros selecionados.</p>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                {["Setor", "Categoria", "Meta / Volume", "Mês", "Peso"].map((h) => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtradas.map((m, i) => (
                <tr key={i} style={styles.tr}>
                  <td style={styles.td}><span style={styles.codBadge}>{m.setor}</span></td>
                  <td style={styles.td}>{m.categoria}</td>
                  <td style={styles.td}>
                    {m.categoria === "PONTOS FORCE" ? "100.000 pts" :
                     m.categoria.includes("FATURAMENTO") ? `R$ ${Number(m.meta_volume).toLocaleString("pt-BR")}` :
                     `${Number(m.meta_volume).toLocaleString("pt-BR")} HL`}
                  </td>
                  <td style={styles.td}>{m.mes_referencia}</td>
                  <td style={styles.td}>{m.peso ? `${m.peso}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Nova Meta</h2>
              <button style={styles.closeBtn} onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.row}>
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Setor *</label>
                  <select style={styles.select} value={form.setor} onChange={(e) => setField("setor", e.target.value)}>
                    {SETORES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Mês referência *</label>
                  <input type="month" style={styles.input} value={form.mes_referencia} onChange={(e) => setField("mes_referencia", e.target.value)} />
                </div>
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Categoria *</label>
                <select style={styles.select} value={form.categoria} onChange={(e) => setField("categoria", e.target.value)}>
                  {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div style={styles.row}>
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>
                    {form.categoria === "PONTOS FORCE" ? "Pontos (fixo 100.000)" :
                     form.categoria.includes("FATURAMENTO") ? "Meta (R$) *" : "Meta (HL) *"}
                  </label>
                  <input
                    style={styles.input}
                    type="number"
                    value={form.categoria === "PONTOS FORCE" ? "100000" : form.meta_volume}
                    onChange={(e) => setField("meta_volume", e.target.value)}
                    disabled={form.categoria === "PONTOS FORCE"}
                    placeholder="0"
                  />
                </div>
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Peso (%)</label>
                  <input style={styles.input} type="number" value={form.peso} onChange={(e) => setField("peso", e.target.value)} placeholder="Ex: 35" min="0" max="100" />
                </div>
              </div>

              {erro && <p style={styles.erro}>{erro}</p>}
              {sucesso && <p style={styles.sucesso}>{sucesso}</p>}
            </div>
            <div style={styles.modalFooter}>
              <button style={styles.btnSecondary} onClick={() => setShowModal(false)}>Cancelar</button>
              <button style={{ ...styles.btnPrimary, opacity: salvando ? 0.7 : 1 }} onClick={salvar} disabled={salvando}>
                {salvando ? "Salvando..." : "Cadastrar Meta"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  toolbar: { display: "flex", gap: "10px", marginBottom: "20px", alignItems: "center", flexWrap: "wrap" },
  inputFiltro: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "8px",
    color: "#fff",
    padding: "8px 12px",
    fontSize: "0.88rem",
    fontFamily: "inherit",
    outline: "none",
    cursor: "pointer",
  },
  btnPrimary: {
    background: "linear-gradient(135deg, #fbb900, #e6a200)",
    color: "#0a0f1e",
    border: "none",
    borderRadius: "10px",
    padding: "10px 18px",
    fontWeight: "700",
    cursor: "pointer",
    fontSize: "0.88rem",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
  },
  btnSecondary: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "rgba(255,255,255,0.7)",
    borderRadius: "10px",
    padding: "10px 16px",
    cursor: "pointer",
    fontSize: "0.88rem",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
  },
  msg: { color: "rgba(255,255,255,0.4)", textAlign: "center", padding: "40px" },
  tableWrap: { overflowX: "auto", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.5)",
    fontSize: "0.75rem",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    padding: "12px 16px",
    textAlign: "left",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },
  tr: { borderBottom: "1px solid rgba(255,255,255,0.05)" },
  td: { padding: "12px 16px", color: "rgba(255,255,255,0.8)", fontSize: "0.88rem" },
  codBadge: { background: "rgba(251,185,0,0.12)", color: "#fbb900", padding: "2px 8px", borderRadius: "6px", fontSize: "0.8rem", fontWeight: "700" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" },
  modal: { background: "#111827", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", width: "100%", maxWidth: "520px", maxHeight: "90vh", overflow: "auto" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.08)" },
  modalTitle: { margin: 0, fontSize: "1.1rem", fontWeight: "700" },
  closeBtn: { background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", fontSize: "1.1rem", cursor: "pointer" },
  modalBody: { padding: "24px", display: "flex", flexDirection: "column", gap: "16px" },
  modalFooter: { display: "flex", justifyContent: "flex-end", gap: "10px", padding: "16px 24px", borderTop: "1px solid rgba(255,255,255,0.08)" },
  row: { display: "flex", gap: "12px" },
  fieldGroup: { display: "flex", flexDirection: "column", gap: "6px", flex: 1 },
  label: { color: "rgba(255,255,255,0.5)", fontSize: "0.78rem", fontWeight: "500", textTransform: "uppercase", letterSpacing: "0.06em" },
  input: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff", padding: "10px 12px", fontSize: "0.9rem", fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" },
  select: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff", padding: "10px 12px", fontSize: "0.9rem", fontFamily: "inherit", outline: "none", width: "100%", cursor: "pointer" },
  erro: { color: "#f87171", fontSize: "0.85rem", margin: 0, textAlign: "center" },
  sucesso: { color: "#4ade80", fontSize: "0.85rem", margin: 0, textAlign: "center" },
};
