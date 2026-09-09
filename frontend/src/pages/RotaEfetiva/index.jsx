// Rota Efetiva — produtividade de visitas + furos de cobertura (gestores).
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx-js-style";
import api from "../../services/api";

const VERDE = "#7DBA3D";
const fmt = (v, d = 0) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const CAT_LABEL = { sem_visita: "Sem visita", nao_validada: "Visita não validada" };

export default function RotaEfetiva() {
  const navigate = useNavigate();
  const [mesesDisp, setMesesDisp] = useState([]);
  const [mes, setMes] = useState("");
  const [resumo, setResumo] = useState(null);
  const [furos, setFuros] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [tab, setTab] = useState("resumo");
  const [fltCat, setFltCat] = useState("");
  const [fltRn, setFltRn] = useState("");

  useEffect(() => {
    api.get("/api/rota-efetiva/meses").then((r) => {
      const ms = r.data || [];
      setMesesDisp(ms);
      setMes(ms[0] || "");
    }).catch(() => {});
  }, []);

  useEffect(() => { if (mes) carregar(mes); }, [mes]);
  async function carregar(m) {
    setLoading(true); setErro("");
    try {
      const [rr, rf] = await Promise.all([
        api.get(`/api/rota-efetiva/resumo?mes=${m}`, { timeout: 60000 }),
        api.get(`/api/rota-efetiva/furos?mes=${m}`, { timeout: 60000 }),
      ]);
      setResumo(rr.data); setFuros(rf.data);
    } catch (e) { setErro(e?.response?.data?.error || "Erro ao carregar."); }
    finally { setLoading(false); }
  }

  const listaFuros = (furos?.furos || []).filter((f) =>
    (!fltCat || f.categoria === fltCat) && (!fltRn || String(f.setor) === String(fltRn)));
  const setoresFuro = [...new Set((furos?.furos || []).map((f) => f.setor).filter(Boolean))].sort();

  function exportarFuros() {
    const rows = listaFuros.map((f) => ({ "Cod PDV": f.cod_pdv, "PDV": f.nome_pdv, "Setor": f.setor, "RN": f.rn, "Dia visita": f.dia_visita, "Situação": CAT_LABEL[f.categoria], "Planejadas": f.planejadas }));
    if (!rows.length) { alert("Sem linhas."); return; }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Furos");
    XLSX.writeFile(wb, `furos_rota_efetiva_${mes}.xlsx`);
  }

  const Card = ({ label, valor, cor, sub }) => (
    <div style={S.kpi}><div style={{ ...S.kpiV, color: cor || "#fff" }}>{valor}</div><div style={S.kpiL}>{label}</div>{sub && <div style={S.kpiS}>{sub}</div>}</div>
  );

  return (
    <div style={S.root}>
      <div style={S.header}>
        <button style={S.back} onClick={() => navigate("/")}>← Início</button>
        <div>
          <h1 style={S.title}>🛣️ Rota Efetiva</h1>
          <p style={S.sub}>Produtividade de visitas e furos de cobertura</p>
        </div>
      </div>

      <div style={S.content}>
        <div style={S.topRow}>
          <div style={S.tabRow}>
            <button style={tab === "resumo" ? S.tabOn : S.tab} onClick={() => setTab("resumo")}>📊 Resumo</button>
            <button style={tab === "furos" ? S.tabOn : S.tab} onClick={() => setTab("furos")}>🎯 Furos {furos ? `(${furos.furos_total})` : ""}</button>
          </div>
          <select style={S.select} value={mes} onChange={(e) => setMes(e.target.value)}>
            {mesesDisp.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {loading && <div style={S.msg}>Carregando… (plano grátis pode levar ~50s)</div>}
        {erro && <div style={S.erro}>{erro}</div>}

        {!loading && tab === "resumo" && resumo && (
          <>
            <div style={S.kpis}>
              <Card label="Rota Efetiva (RE%)" valor={`${fmt(resumo.consolidado.re_pct, 1)}%`} cor={VERDE} sub={`${fmt(resumo.consolidado.efetivas)} de ${fmt(resumo.consolidado.planejadas)} planejadas`} />
              <Card label="GPS OK" valor={`${fmt(resumo.consolidado.gps_pct, 1)}%`} cor="#f5c451" sub="check-in com GPS OK" />
              <Card label="Supervisitas" valor={fmt(resumo.consolidado.supervisitas)} />
              <Card label="Setores < 30% GPS" valor={fmt(resumo.setores_baixo_gps)} cor={resumo.setores_baixo_gps ? "#f87171" : VERDE} sub={`${fmt(resumo.pct_setores_baixo_gps, 0)}% dos setores`} />
            </div>
            <div style={S.tableWrap}>
              <table style={S.table}>
                <thead><tr>{["Setor", "RN", "Planejadas", "Efetivas", "RE%", "GPS%", "Super"].map((h, i) => <th key={h} style={i < 2 ? S.th : S.thR}>{h}</th>)}</tr></thead>
                <tbody>
                  {resumo.setores.map((s) => (
                    <tr key={s.setor} style={S.tr}>
                      <td style={S.tdP}>{s.setor}</td>
                      <td style={S.tdNome} title={s.rn}>{s.rn || "—"}</td>
                      <td style={S.tdR}>{fmt(s.planejadas)}</td>
                      <td style={S.tdR}>{fmt(s.efetivas)}</td>
                      <td style={{ ...S.tdR, color: s.re_pct >= 80 ? VERDE : s.re_pct >= 60 ? "#f5c451" : "#f87171", fontWeight: 700 }}>{fmt(s.re_pct, 1)}%</td>
                      <td style={{ ...S.tdR, color: s.gps_pct < 30 ? "#f87171" : "rgba(255,255,255,0.85)" }}>{fmt(s.gps_pct, 1)}%</td>
                      <td style={S.tdR}>{fmt(s.supervisitas)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!loading && tab === "furos" && furos && (
          <>
            <div style={S.kpis}>
              <Card label="Cobertura" valor={`${fmt(furos.cobertura_pct, 1)}%`} cor={VERDE} sub={`${fmt(furos.visitados_ok)} de ${fmt(furos.total_ativos)} PDVs ativos`} />
              <Card label="Furos (total)" valor={fmt(furos.furos_total)} cor="#f87171" sub="ativos sem visita efetiva" />
              <Card label="Sem visita" valor={fmt(furos.sem_visita)} cor="#f0997b" sub="não apareceu na rota" />
              <Card label="Não validada" valor={fmt(furos.nao_validada)} cor="#f5c451" sub="planejada, não efetivada" />
            </div>
            <div style={S.fltRow}>
              <select style={S.select} value={fltCat} onChange={(e) => setFltCat(e.target.value)}>
                <option value="">Todas as situações</option>
                <option value="sem_visita">Sem visita</option>
                <option value="nao_validada">Visita não validada</option>
              </select>
              {setoresFuro.length > 1 && (
                <select style={S.select} value={fltRn} onChange={(e) => setFltRn(e.target.value)}>
                  <option value="">Todos os setores</option>
                  {setoresFuro.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
              <span style={S.count}>{listaFuros.length} PDVs</span>
              <button style={S.excel} onClick={exportarFuros}>⤓ Excel</button>
            </div>
            <div style={S.tableWrap}>
              <table style={S.table}>
                <thead><tr>{["Cod", "PDV", "Setor", "RN", "Dia visita", "Situação"].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {listaFuros.map((f) => (
                    <tr key={f.cod_pdv} style={S.tr}>
                      <td style={S.tdP}>{f.cod_pdv}</td>
                      <td style={S.tdNome} title={f.nome_pdv}>{f.nome_pdv}</td>
                      <td style={S.tdP}>{f.setor}</td>
                      <td style={S.tdNome} title={f.rn}>{f.rn || "—"}</td>
                      <td style={S.tdP}>{f.dia_visita || "—"}</td>
                      <td style={S.tdP}><span style={{ ...S.tag, background: f.categoria === "sem_visita" ? "rgba(240,153,123,0.15)" : "rgba(245,196,81,0.15)", color: f.categoria === "sem_visita" ? "#f0997b" : "#f5c451" }}>{CAT_LABEL[f.categoria]}</span></td>
                    </tr>
                  ))}
                  {!listaFuros.length && <tr><td colSpan={6} style={S.vazio}>Nenhum furo nesse recorte. 🎉</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const S = {
  root: { minHeight: "100vh", background: "#0c1410", fontFamily: "'Poppins','Segoe UI',system-ui,sans-serif", color: "#fff" },
  header: { display: "flex", alignItems: "flex-start", gap: 14, padding: "clamp(12px,3vw,20px) clamp(16px,4vw,32px)", borderBottom: "1px solid rgba(255,255,255,0.08)" },
  back: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", padding: "9px 14px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: "0.85rem", flexShrink: 0 },
  title: { margin: 0, fontSize: "1.3rem", fontWeight: 700 },
  sub: { margin: "3px 0 0", fontSize: "0.8rem", color: "rgba(255,255,255,0.4)" },
  content: { padding: "clamp(16px,4vw,28px)", maxWidth: 1300, margin: "0 auto" },
  topRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 },
  tabRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  tab: { background: "transparent", border: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.6)", borderRadius: 20, padding: "8px 16px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.85rem" },
  tabOn: { background: "rgba(125,186,61,0.16)", border: "1px solid #7DBA3D", color: "#7DBA3D", borderRadius: 20, padding: "8px 16px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.85rem", fontWeight: 700 },
  select: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff", padding: "8px 12px", fontSize: "0.85rem", fontFamily: "inherit", outline: "none" },
  kpis: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12, marginBottom: 16 },
  kpi: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 16 },
  kpiV: { fontSize: "1.7rem", fontWeight: 800, lineHeight: 1.1 },
  kpiL: { color: "rgba(255,255,255,0.6)", fontSize: "0.8rem", marginTop: 6 },
  kpiS: { color: "rgba(255,255,255,0.4)", fontSize: "0.72rem", marginTop: 2 },
  fltRow: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 },
  count: { color: "rgba(255,255,255,0.4)", fontSize: "0.82rem" },
  excel: { marginLeft: "auto", background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.4)", color: "#4ade80", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.82rem", fontWeight: 600 },
  tableWrap: { overflowX: "auto", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "0.83rem" },
  th: { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)", fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", padding: "9px 10px", textAlign: "left", whiteSpace: "nowrap", borderBottom: "1px solid rgba(255,255,255,0.08)" },
  thR: { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)", fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", padding: "9px 10px", textAlign: "right", whiteSpace: "nowrap", borderBottom: "1px solid rgba(255,255,255,0.08)" },
  tr: { borderBottom: "1px solid rgba(255,255,255,0.05)" },
  tdP: { padding: "7px 10px", color: "rgba(255,255,255,0.6)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" },
  tdR: { padding: "7px 10px", color: "rgba(255,255,255,0.85)", textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" },
  tdNome: { padding: "7px 10px", color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 240 },
  tag: { padding: "2px 8px", borderRadius: 6, fontSize: "0.72rem", fontWeight: 700, whiteSpace: "nowrap" },
  vazio: { padding: 16, textAlign: "center", color: "rgba(255,255,255,0.35)" },
  msg: { color: "rgba(255,255,255,0.4)", fontSize: "0.85rem", padding: "10px 0" },
  erro: { background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", borderRadius: 8, padding: "10px 14px", fontSize: "0.85rem" },
};
