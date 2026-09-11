// Cobertura & Distribuição — Analítico COMPARATIVO entre SKUs (visão gestor).
// Escolha até 3 SKUs; a tabela lista todos os PDVs que compraram ≥1 deles no
// trimestre atual. Cada célula de SKU:
//   ✔ verde   = comprou ESTE mês
//   ✔ amarelo = comprou no tri (meses anteriores) mas não este mês
//   ✘ vermelho = não comprou no tri
import { useState, useEffect } from "react";
import * as XLSX from "xlsx-js-style";
import api from "../../services/api";

const VERDE = "#7DBA3D", AMARELO = "#f5c451", VERMELHO = "#f87171", BG = "#0c1410";
const COR = { atual: VERDE, anterior: AMARELO, nao: VERMELHO };
const MARK = { atual: "✔", anterior: "✔", nao: "✘" };
const XTXT = { atual: "V (este mês)", anterior: "V (tri)", nao: "X" };
const MAX = 3;

const DIAS = [
  { key: "SEG", label: "Seg" }, { key: "TER", label: "Ter" }, { key: "QUA", label: "Qua" },
  { key: "QUI", label: "Qui" }, { key: "SEX", label: "Sex" }, { key: "SAB", label: "Sáb" },
];
const DIA_MAP = {
  SEG: "SEG", SEGUNDA: "SEG", "SEGUNDA-FEIRA": "SEG", "2": "SEG",
  TER: "TER", TERCA: "TER", "TERÇA": "TER", "TERCA-FEIRA": "TER", "TERÇA-FEIRA": "TER", "3": "TER",
  QUA: "QUA", QUARTA: "QUA", "QUARTA-FEIRA": "QUA", "4": "QUA",
  QUI: "QUI", QUINTA: "QUI", "QUINTA-FEIRA": "QUI", "5": "QUI",
  SEX: "SEX", SEXTA: "SEX", "SEXTA-FEIRA": "SEX", "6": "SEX",
  SAB: "SAB", SABADO: "SAB", "SÁBADO": "SAB", "7": "SAB",
};
const normalizeDia = (raw) => { const s = String(raw || "").trim().toUpperCase().split(/[\/,; \-]/)[0].trim(); return DIA_MAP[s] || s; };

export default function Comparativo({ embutido = false }) {
  const [q, setQ] = useState("");
  const [sug, setSug] = useState([]);
  const [mostraSug, setMostraSug] = useState(false);
  const [sel, setSel] = useState([]);            // [{cod, nome}] até 3
  const [comp, setComp] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [fltRn, setFltRn] = useState("");
  const [fltDia, setFltDia] = useState("");

  // Autocomplete de SKU (reusa /cobertura-sku/buscar).
  useEffect(() => {
    const termo = q.trim();
    if (termo.length < 2) { setSug([]); return; }
    const t = setTimeout(async () => {
      try { const r = await api.get("/api/cobertura-sku/buscar", { params: { q: termo } }); setSug(r.data || []); setMostraSug(true); }
      catch { /* silencioso */ }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  // Recarrega o comparativo quando a seleção muda (1 a 3 SKUs).
  const selCods = sel.map((s) => s.cod).join(",");
  useEffect(() => {
    if (!sel.length) { setComp(null); setErro(""); return; }
    let cancel = false;
    setLoading(true); setErro("");
    api.get("/api/cobertura-sku/comparativo", { params: { skus: selCods }, timeout: 60000 })
      .then((r) => { if (!cancel) setComp(r.data); })
      .catch((e) => { if (!cancel) setErro(e?.response?.data?.error || "Erro ao carregar."); })
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [selCods]);

  const addSku = (p) => { if (sel.some((s) => s.cod === p.cod) || sel.length >= MAX) return; setSel([...sel, { cod: p.cod, nome: p.nome }]); setQ(""); setSug([]); setMostraSug(false); };
  const remSku = (cod) => setSel(sel.filter((s) => s.cod !== cod));

  const pdvs = comp?.pdvs || [];
  const rnPorSetor = {};
  pdvs.forEach((p) => { if (p.setor && !rnPorSetor[p.setor]) rnPorSetor[p.setor] = p.rn || ""; });
  const setores = Object.keys(rnPorSetor).sort();
  const filtrada = pdvs.filter((p) =>
    (!fltRn || String(p.setor) === String(fltRn)) &&
    (!fltDia || normalizeDia(p.dia_visita) === fltDia)
  );

  function exportar() {
    if (!comp || !filtrada.length) { alert("Sem linhas para exportar."); return; }
    const rows = filtrada.map((p) => {
      const base = { "Cod PDV": p.cod_pdv, "Cliente": p.nome_pdv, "Setor": p.setor, "RN": p.rn, "Dia visita": normalizeDia(p.dia_visita) };
      comp.skus.forEach((s, i) => { base[`${s.nome} (${s.cod})`] = XTXT[p.skus[i]] || "X"; });
      return base;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Comparativo SKUs");
    XLSX.writeFile(wb, `comparativo_skus_${comp.trimestre || ""}.xlsx`);
  }

  return (
    <div style={embutido ? S.emb : S.root}>
      <p style={S.hint}>Escolha até {MAX} SKUs para comparar. A tabela mostra todos os PDVs que compraram ≥1 deles no trimestre atual{comp?.trimestre ? ` (${comp.trimestre})` : ""}.</p>

      {/* Chips + busca de SKU */}
      <div style={S.chips}>
        {sel.map((s) => (
          <span key={s.cod} style={S.chip}>{s.nome} <b style={{ opacity: 0.6 }}>({s.cod})</b>
            <button style={S.chipX} onClick={() => remSku(s.cod)}>✕</button>
          </span>
        ))}
        {!sel.length && <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.82rem" }}>nenhum SKU selecionado</span>}
      </div>
      {sel.length < MAX && (
        <div style={{ position: "relative", marginBottom: 12, maxWidth: 460 }}>
          <input style={S.input} value={q} onChange={(e) => setQ(e.target.value)}
            onFocus={() => sug.length > 0 && setMostraSug(true)}
            onBlur={() => setTimeout(() => setMostraSug(false), 150)}
            placeholder="🔎 Buscar SKU por nome ou código" autoComplete="off" />
          {mostraSug && sug.length > 0 && (
            <div style={S.dropdown}>
              {sug.map((p) => (
                <button key={p.cod} type="button" style={S.sugItem} onMouseDown={() => addSku(p)}>
                  <span style={S.sugNome}>{p.nome}</span><span style={S.sugCod}>cód {p.cod}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Legenda */}
      <div style={S.legend}>
        <span><b style={{ color: VERDE }}>✔</b> comprou este mês</span>
        <span><b style={{ color: AMARELO }}>✔</b> comprou no tri (meses anteriores)</span>
        <span><b style={{ color: VERMELHO }}>✘</b> não comprou no tri</span>
      </div>

      {erro && <div style={S.erro}>{erro}</div>}
      {loading && <div style={S.info}><span className="cs-spin" /> Buscando…</div>}

      {comp && !loading && (
        <>
          <div style={S.fltRow}>
            <select style={S.select} value={fltRn} onChange={(e) => setFltRn(e.target.value)}>
              <option value="">Todos os RNs / setores</option>
              {setores.map((s) => <option key={s} value={s}>{s}{rnPorSetor[s] ? ` · ${rnPorSetor[s]}` : ""}</option>)}
            </select>
            <div style={S.diaBtns}>
              {DIAS.map((dd) => (
                <button key={dd.key} type="button" onClick={() => setFltDia(fltDia === dd.key ? "" : dd.key)}
                  style={fltDia === dd.key ? S.diaOn : S.dia}>{dd.label}</button>
              ))}
            </div>
            <span style={S.count}>{filtrada.length} PDVs</span>
            <button style={S.excel} onClick={exportar}>⤓ Excel</button>
          </div>

          <div style={S.tableWrap}>
            <table style={S.table}>
              <thead>
                <tr>
                  {["Cód", "Cliente", "Setor", "RN", "Dia visita"].map((h) => <th key={h} style={S.th}>{h}</th>)}
                  {comp.skus.map((s) => <th key={s.cod} style={S.thC} title={`${s.cod} — ${s.nome}`}>{s.nome}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtrada.map((p) => (
                  <tr key={p.cod_pdv} style={S.tr}>
                    <td style={S.tdPlain}>{p.cod_pdv}</td>
                    <td style={S.tdNome} title={p.nome_pdv}>{p.nome_pdv}</td>
                    <td style={S.tdPlain}>{p.setor}</td>
                    <td style={S.tdRn} title={p.rn}>{p.rn || "—"}</td>
                    <td style={S.tdPlain}>{normalizeDia(p.dia_visita) || "—"}</td>
                    {p.skus.map((st, i) => <td key={i} style={{ ...S.tdC, color: COR[st] || VERMELHO }}>{MARK[st] || "✘"}</td>)}
                  </tr>
                ))}
                {!filtrada.length && <tr><td colSpan={5 + (comp.skus.length || 1)} style={S.vazio}>Ninguém comprou esses SKUs no trimestre. 🎉</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      <style>{CSS}</style>
    </div>
  );
}

const S = {
  root: { minHeight: "100vh", background: BG, fontFamily: "'Poppins','Segoe UI',system-ui,sans-serif", padding: "clamp(16px,4vw,28px)", maxWidth: "1600px", margin: "0 auto", color: "#fff" },
  emb: { color: "#fff", fontFamily: "'Poppins','Segoe UI',system-ui,sans-serif" },
  hint: { margin: "0 0 12px", fontSize: "0.82rem", color: "rgba(255,255,255,0.5)" },
  chips: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10, minHeight: 30 },
  chip: { display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(125,186,61,0.16)", border: "1px solid #7DBA3D", color: "#dfeecb", borderRadius: 18, padding: "4px 8px 4px 12px", fontSize: "0.82rem" },
  chipX: { background: "transparent", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: "0.85rem", padding: 0, lineHeight: 1 },
  input: { width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(125,186,61,0.3)", borderRadius: 10, color: "#fff", padding: "10px 14px", fontSize: "0.88rem", fontFamily: "inherit", outline: "none" },
  dropdown: { position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#14241a", border: "1px solid rgba(125,186,61,0.35)", borderRadius: 10, zIndex: 50, maxHeight: 300, overflowY: "auto", boxShadow: "0 16px 50px rgba(0,0,0,0.5)" },
  sugItem: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: "transparent", border: "none", borderBottom: "1px solid rgba(255,255,255,0.06)", color: "#fff", padding: "10px 12px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.84rem" },
  sugNome: { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  sugCod: { color: "rgba(125,186,61,0.8)", fontSize: "0.72rem", flexShrink: 0 },
  legend: { display: "flex", gap: 16, flexWrap: "wrap", fontSize: "0.76rem", color: "rgba(255,255,255,0.55)", margin: "2px 0 14px", padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" },
  info: { color: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", gap: 10, padding: "20px 0" },
  erro: { color: "#ef6f6f", padding: 16, background: "rgba(239,68,68,0.1)", borderRadius: 10 },
  fltRow: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", margin: "6px 0 12px" },
  select: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff", padding: "8px 12px", fontSize: "0.84rem", fontFamily: "inherit", outline: "none" },
  diaBtns: { display: "flex", gap: 5, flexWrap: "wrap" },
  dia: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.55)", borderRadius: 16, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.78rem" },
  diaOn: { background: "rgba(125,186,61,0.15)", border: "1px solid rgba(125,186,61,0.45)", color: "#7DBA3D", borderRadius: 16, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.78rem", fontWeight: 700 },
  count: { color: "rgba(255,255,255,0.4)", fontSize: "0.8rem" },
  excel: { background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.4)", color: "#4ade80", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.8rem", fontWeight: 600 },
  tableWrap: { overflowX: "auto", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "0.84rem" },
  th: { padding: "10px 12px", color: "rgba(255,255,255,0.5)", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.1)", whiteSpace: "nowrap", background: "rgba(255,255,255,0.03)", textAlign: "left" },
  thC: { padding: "10px 12px", color: "rgba(255,255,255,0.5)", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.1)", whiteSpace: "nowrap", background: "rgba(255,255,255,0.03)", textAlign: "center", minWidth: 92 },
  tr: { borderBottom: "1px solid rgba(255,255,255,0.05)" },
  tdPlain: { padding: "9px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.7)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" },
  tdNome: { padding: "9px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)", color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 240 },
  tdRn: { padding: "9px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 140 },
  tdC: { padding: "9px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)", textAlign: "center", fontWeight: 700, fontSize: "1rem" },
  vazio: { padding: 16, textAlign: "center", color: "rgba(255,255,255,0.35)" },
};

const CSS = `
.cs-spin { width:16px;height:16px;border:2px solid rgba(125,186,61,0.2);border-top-color:${VERDE};border-radius:50%;display:inline-block;animation:cs-rot .8s linear infinite; }
@keyframes cs-rot { to { transform: rotate(360deg); } }
`;
