// Acompanhamento Comercial — RPS (reunião semanal). Pré-escopo a partir da planilha e do deck
// do diretor comercial: Volumes · Compradores · Distribuição · Marketplace, 13 meses, por RN
// (mês × M-1 × L3M × LY, mês atual pela tendência). Exporta o deck em PowerPoint (pptxgenjs).
// Dado: GET /api/rps (gestores). Regras de cálculo vêm do backend (d.regras).
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import { useAbaUrl } from "../../utils/abaUrl";
import { useContarAba } from "../../utils/uso";

const VERDE = "#7DBA3D", VERM = "#f87171", OK = "#4ade80";
const MES_ROT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const rotMes = (m) => `${MES_ROT[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`;
const fmt = (v, d = 0) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }));
const fmtU = (v, u) => (u === "R$" ? `R$ ${fmt(v)}` : u === "SKU/PDV" ? fmt(v, 2) : u === "HL" ? fmt(v, 1) : fmt(v));
const fmtP = (v) => (v == null ? "—" : `${v > 0 ? "+" : ""}${fmt(v, 1)}%`);
const corP = (v) => (v == null ? "rgba(255,255,255,0.4)" : v >= 0 ? OK : VERM);

const ABAS = [
  { id: "volumes", label: "📦 Volumes" },
  { id: "compradores", label: "🛒 Compradores" },
  { id: "distribuicao", label: "🧩 Distribuição" },
  { id: "marketplace", label: "🏪 Marketplace" },
  { id: "regras", label: "ℹ️ Regras" },
];

// ── Gráfico de barras (13 meses) em SVG ──────────────────────────────────────
function Barras({ meses, serie, unidade, tend }) {
  const W = 900, H = 200, pad = 26, n = serie.length;
  const vals = serie.map((v, i) => (i === n - 1 && tend != null ? Math.max(v, tend) : v));
  const max = Math.max(1, ...vals);
  const bw = (W - pad * 2) / n;
  return (
    <svg viewBox={`0 0 ${W} ${H + 34}`} style={{ width: "100%", height: "auto" }}>
      {serie.map((v, i) => {
        const x = pad + i * bw + bw * 0.18, w = bw * 0.64, h = (v / max) * H, y = H - h + 18;
        const ultimo = i === n - 1;
        const ht = ultimo && tend != null ? (tend / max) * H : 0;
        return (
          <g key={i}>
            {ultimo && tend != null && <rect x={x} y={H - ht + 18} width={w} height={ht} fill="none" stroke={VERDE} strokeDasharray="4 3" />}
            <rect x={x} y={y} width={w} height={h} fill={ultimo ? VERDE : "#6fa8ff"} rx="3" />
            <text x={x + w / 2} y={(ultimo && tend != null ? H - ht + 18 : y) - 4} fill="#fff" fontSize="11" textAnchor="middle">{fmtU(ultimo && tend != null ? tend : v, unidade)}</text>
            <text x={x + w / 2} y={H + 32} fill="rgba(255,255,255,0.55)" fontSize="11" textAnchor="middle">{rotMes(meses[i])}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Tabela por RN (mês × M-1 × L3M × LY) ─────────────────────────────────────
function TabelaRn({ ind }) {
  const u = ind.unidade;
  const tot = { setor: "", rn: "Operação", ...ind };
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={S.table}>
        <thead><tr>{["Setor", "RN", "Real (parcial)", "Tendência", "M-1", "L3M", "LY", "% vs M-1", "% vs L3M", "% vs LY"].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
        <tbody>
          {[...ind.porRn, tot].map((l, i) => (
            <tr key={l.setor || "op" + i} style={l.rn === "Operação" ? { background: "rgba(125,186,61,0.10)", fontWeight: 700 } : undefined}>
              <td style={S.td}>{l.setor}</td><td style={{ ...S.td, textAlign: "left" }}>{l.rn}</td>
              <td style={S.td}>{fmtU(l.real, u)}</td><td style={{ ...S.td, fontWeight: 700 }}>{fmtU(l.tend, u)}</td>
              <td style={S.td}>{fmtU(l.m1, u)}</td><td style={S.td}>{fmtU(l.l3m, u)}</td><td style={S.td}>{fmtU(l.ly, u)}</td>
              {["vs_m1", "vs_l3m", "vs_ly"].map((k) => <td key={k} style={{ ...S.td, color: corP(l[k]), fontWeight: 700 }}>{fmtP(l[k])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Indicador({ ind, meses, extra }) {
  return (
    <div style={S.card}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, alignItems: "baseline" }}>
        <b style={{ fontSize: "1.05rem" }}>{ind.label} <span style={{ color: "rgba(255,255,255,0.45)", fontWeight: 400, fontSize: "0.8rem" }}>({ind.unidade})</span></b>
        <span style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.6)" }}>
          Tendência {fmtU(ind.tend, ind.unidade)} · <span style={{ color: corP(ind.vs_m1) }}>{fmtP(ind.vs_m1)} vs M-1</span> · <span style={{ color: corP(ind.vs_l3m) }}>{fmtP(ind.vs_l3m)} vs L3M</span> · <span style={{ color: corP(ind.vs_ly) }}>{fmtP(ind.vs_ly)} vs LY</span>
        </span>
      </div>
      <Barras meses={meses} serie={ind.media || ind.serie} unidade={ind.unidade} tend={ind.media ? null : ind.tend} />
      {extra}
      <TabelaRn ind={ind} />
    </div>
  );
}

function LinhaMeses({ meses, linhas }) {
  return (
    <div style={{ overflowX: "auto", margin: "4px 0 12px" }}>
      <table style={S.table}>
        <thead><tr><th style={S.th}></th>{meses.map((m) => <th key={m} style={S.th}>{rotMes(m)}</th>)}</tr></thead>
        <tbody>{linhas.map(([rot, vals, cor]) => (
          <tr key={rot}><td style={{ ...S.td, textAlign: "left", color: cor }}>{rot}</td>{vals.map((v, i) => <td key={i} style={S.td}>{v}</td>)}</tr>
        ))}</tbody>
      </table>
    </div>
  );
}

// ── Export PowerPoint (pptxgenjs, carregado na hora) ─────────────────────────
let _pptx = null;
function carregarPptx() {
  if (window.PptxGenJS) return Promise.resolve(window.PptxGenJS);
  if (_pptx) return _pptx;
  _pptx = new Promise((ok, erro) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pptxgenjs/3.12.0/pptxgen.bundle.js";
    s.onload = () => (window.PptxGenJS ? ok(window.PptxGenJS) : erro(new Error("pptxgenjs não carregou")));
    s.onerror = () => { _pptx = null; erro(new Error("Sem internet para carregar o gerador de PowerPoint.")); };
    document.head.appendChild(s);
  });
  return _pptx;
}
async function exportarPptx(d) {
  const Pptx = await carregarPptx();
  const p = new Pptx();
  p.layout = "LAYOUT_WIDE"; // 13,33 × 7,5 in
  const VD = "2E7D32", CINZA = "444444";
  const rotulos = d.meses.map(rotMes);
  const capa = (t, sub) => { const s = p.addSlide(); s.background = { color: VD }; s.addText(t, { x: 0.6, y: 2.6, w: 12, h: 1.2, fontSize: 40, bold: true, color: "FFFFFF" }); if (sub) s.addText(sub, { x: 0.6, y: 3.8, w: 12, h: 0.6, fontSize: 18, color: "E8F5E9" }); };
  const cel = (v, o = {}) => ({ text: String(v ?? "—"), options: { fontSize: 9, align: "center", ...o } });
  const cab = (arr) => arr.map((h) => cel(h, { bold: true, color: "FFFFFF", fill: { color: "444444" } }));
  const pc = (v) => cel(fmtP(v), { color: v == null ? "888888" : v >= 0 ? "1A7A34" : "C0392B", bold: true });
  const slideInd = (secao, ind, linhasExtra) => {
    const s = p.addSlide();
    s.addText(`${secao} · ${ind.label}`, { x: 0.4, y: 0.2, w: 12.5, h: 0.6, fontSize: 24, bold: true, color: CINZA });
    const serie = ind.media || ind.serie;
    const vals = serie.map((v, i) => (i === serie.length - 1 && !ind.media ? ind.tend : v));
    s.addChart(p.ChartType.bar, [{ name: ind.label, labels: rotulos, values: vals }], {
      x: 0.4, y: 0.9, w: 8.2, h: 3.6, barDir: "col", chartColors: ["6FA8FF"], showValue: true, dataLabelFontSize: 8,
      dataLabelFormatCode: ind.unidade === "SKU/PDV" ? "0.00" : "#,##0", catAxisLabelFontSize: 9, valAxisHidden: true, valGridLine: { style: "none" },
    });
    s.addText(`Último mês = tendência (${d.diasUteis.feitos} de ${d.diasUteis.total} dias úteis)`, { x: 0.4, y: 4.45, w: 8.2, h: 0.3, fontSize: 9, color: "888888" });
    if (linhasExtra && linhasExtra.length) {
      s.addTable([[cel(""), ...cab(rotulos)], ...linhasExtra.map(([r, v]) => [cel(r, { bold: true, align: "left" }), ...v.map((x) => cel(x))])],
        { x: 0.4, y: 4.8, w: 8.2, colW: [1.0, ...rotulos.map(() => 7.2 / rotulos.length)], fontSize: 8, border: { type: "solid", color: "DDDDDD", pt: 0.5 } });
    }
    const u = ind.unidade;
    const rank = [...ind.porRn].sort((a, b) => (b.vs_m1 ?? -999) - (a.vs_m1 ?? -999));
    s.addTable([cab(["RNK", "Setor", "RN", "M-1", "Tend", "% M-1", "% AA"]),
      ...rank.map((l, i) => [cel(i + 1), cel(l.setor), cel(l.rn), cel(fmtU(l.m1, u)), cel(fmtU(l.tend, u)), pc(l.vs_m1), pc(l.vs_ly)]),
      [cel(""), cel(""), cel("Total", { bold: true }), cel(fmtU(ind.m1, u), { bold: true }), cel(fmtU(ind.tend, u), { bold: true }), pc(ind.vs_m1), pc(ind.vs_ly)]],
      { x: 8.8, y: 0.9, w: 4.2, colW: [0.4, 0.5, 0.9, 0.65, 0.65, 0.55, 0.55], border: { type: "solid", color: "DDDDDD", pt: 0.5 } });
  };
  capa("ACOMPANHAMENTO COMERCIAL", `RPS · ${rotMes(d.mesAtual)} · ${d.diasUteis.feitos} de ${d.diasUteis.total} dias úteis`);
  capa("VOLUMES");
  d.volumes.forEach((ind) => slideInd("Volume", ind));
  const sm = p.addSlide();
  sm.addText("Volume · Marcas (Cerveja) e Cidades", { x: 0.4, y: 0.2, w: 12.5, h: 0.6, fontSize: 24, bold: true, color: CINZA });
  sm.addTable([cab(["Marca", "M-1", "Tend", "% M-1", "% L3M", "% AA"]), ...d.marcas.map((m) => [cel(m.marca, { align: "left" }), cel(fmt(m.m1, 1)), cel(fmt(m.tend, 1)), pc(m.vs_m1), pc(m.vs_l3m), pc(m.vs_ly)])],
    { x: 0.4, y: 0.9, w: 6.1, border: { type: "solid", color: "DDDDDD", pt: 0.5 } });
  sm.addTable([cab(["Cidade", "M-1", "Tend", "% M-1", "% L3M", "% AA"]), ...d.cidades.slice(0, 18).map((m) => [cel(m.cidade, { align: "left" }), cel(fmt(m.m1, 1)), cel(fmt(m.tend, 1)), pc(m.vs_m1), pc(m.vs_l3m), pc(m.vs_ly)])],
    { x: 6.8, y: 0.9, w: 6.1, border: { type: "solid", color: "DDDDDD", pt: 0.5 } });
  capa("MARKETPLACE");
  slideInd("Marketplace", d.marketplace.faturamento);
  slideInd("Marketplace", { ...d.marketplace.compradores, label: "Compradores Marketplace" });
  slideInd("Marketplace", { ...d.marketplace.distribuicao, label: "Distribuição Marketplace" });
  capa("COMPRADORES");
  d.compradores.forEach((ind) => slideInd("Compradores", ind, [["Estáveis", ind.quebra.map((q) => fmt(q.est))], ["Instáveis", ind.quebra.map((q) => fmt(q.inst))], ["Novos", ind.quebra.map((q) => fmt(q.novo))]]));
  capa("DISTRIBUIÇÃO");
  d.distribuicao.forEach((ind) => slideInd("Distribuição", ind, [["Σ SKU/PDV", ind.serie.map((v) => fmt(v))], ["Média", ind.media.map((v) => fmt(v, 2))]]));
  await p.writeFile({ fileName: `Acompanhamento_Comercial_RPS_${d.mesAtual}.pptx` });
}

export default function Rps() {
  const navigate = useNavigate();
  const [aba, setAba] = useAbaUrl("aba", "volumes");
  useContarAba("/rps", aba);
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [sel, setSel] = useState({});
  const [gerando, setGerando] = useState(false);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    setErro("");
    api.get("/api/rps", { params: recarga ? { refresh: 1 } : {}, timeout: 180000 })
      .then((r) => setD(r.data)).catch((e) => setErro(e.response?.data?.error || "Erro ao carregar o acompanhamento."));
  }, [recarga]);

  async function exportar() {
    setGerando(true);
    try { await exportarPptx(d); } catch (e) { alert("Não foi possível gerar o PowerPoint: " + (e?.message || "falha")); }
    finally { setGerando(false); }
  }

  const lista = d ? (aba === "volumes" ? d.volumes : aba === "compradores" ? d.compradores : aba === "distribuicao" ? d.distribuicao : []) : [];
  const atual = lista.find((x) => x.id === sel[aba]) || lista[0];

  return (
    <div style={S.root}>
      <div style={S.header}>
        <button style={S.back} onClick={() => navigate("/")}>← Voltar</button>
        <div style={{ flex: 1 }}>
          <h1 style={S.h1}>📑 Acompanhamento Comercial · RPS</h1>
          {d && <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.5)" }}>{rotMes(d.mesAtual)} · {d.diasUteis.feitos} de {d.diasUteis.total} dias úteis · mês atual pela tendência</div>}
        </div>
        <button style={S.back} onClick={() => { setD(null); setRecarga((x) => x + 1); }} title="Recalcular agora (o cálculo fica guardado por 30 min)">🔄 Atualizar</button>
        <button style={{ ...S.back, background: VERDE, color: "#0c1410", fontWeight: 700 }} disabled={!d || gerando} onClick={exportar}>{gerando ? "Gerando…" : "📥 Exportar PowerPoint"}</button>
      </div>
      <div style={S.content}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {ABAS.map((a) => <button key={a.id} style={S.chip(aba === a.id)} onClick={() => setAba(a.id)}>{a.label}</button>)}
        </div>
        {erro && <p style={{ color: VERM }}>{erro}</p>}
        {!d && !erro && <p style={{ color: "rgba(255,255,255,0.5)" }}>Calculando 13 meses de vendas… (pode levar até 1 minuto)</p>}

        {d && ["volumes", "compradores", "distribuicao"].includes(aba) && atual && (
          <>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              {lista.map((x) => <button key={x.id} style={S.chipP(atual.id === x.id)} onClick={() => setSel((s) => ({ ...s, [aba]: x.id }))}>{x.label}</button>)}
            </div>
            <Indicador ind={atual} meses={d.meses} extra={
              aba === "compradores" ? <LinhaMeses meses={d.meses} linhas={[["Estáveis", atual.quebra.map((q) => fmt(q.est)), OK], ["Instáveis", atual.quebra.map((q) => fmt(q.inst)), "#f5c451"], ["Novos", atual.quebra.map((q) => fmt(q.novo)), "#c4b5fd"]]} />
              : aba === "distribuicao" ? <LinhaMeses meses={d.meses} linhas={[["Σ SKU/PDV", atual.serie.map((v) => fmt(v))], ["Média SKU/PDV", atual.media.map((v) => fmt(v, 2))]]} />
              : null} />
            {aba === "volumes" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 12, marginTop: 12 }}>
                {[["Por marca (Cerveja)", d.marcas, "marca"], ["Por cidade", d.cidades, "cidade"]].map(([t, rows, k]) => (
                  <div key={t} style={S.card}>
                    <b>{t}</b>
                    <table style={S.table}><thead><tr>{[k === "marca" ? "Marca" : "Cidade", "M-1", "Tend", "% M-1", "% L3M", "% LY"].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                      <tbody>{rows.map((r) => (
                        <tr key={r[k]}><td style={{ ...S.td, textAlign: "left" }}>{r[k]}</td><td style={S.td}>{fmt(r.m1, 1)}</td><td style={S.td}>{fmt(r.tend, 1)}</td>
                          {["vs_m1", "vs_l3m", "vs_ly"].map((c) => <td key={c} style={{ ...S.td, color: corP(r[c]) }}>{fmtP(r[c])}</td>)}</tr>
                      ))}</tbody></table>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {d && aba === "marketplace" && (
          <div style={{ display: "grid", gap: 12 }}>
            <Indicador ind={d.marketplace.faturamento} meses={d.meses} />
            <Indicador ind={{ ...d.marketplace.compradores, label: "Compradores (cobertura) Marketplace" }} meses={d.meses} />
            <Indicador ind={{ ...d.marketplace.distribuicao, label: "Distribuição Marketplace" }} meses={d.meses} />
            <p style={{ fontSize: "0.8rem", color: "#f5c451" }}>⏳ {d.marketplace.pendente}</p>
          </div>
        )}

        {d && aba === "regras" && (
          <div style={S.card}>
            {Object.entries(d.regras).map(([k, v]) => <p key={k} style={{ margin: "6px 0", fontSize: "0.85rem" }}><b style={{ color: VERDE }}>{k.replace("_", " ")}:</b> {v}</p>)}
            <p style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)" }}>Aberturas (300/600/1L, LN, 350, 473, Senses, Sabores, NAB Single) são pelo nome do produto + categoria da HOP — pré-escopo, a validar com o diretor.</p>
          </div>
        )}
      </div>
    </div>
  );
}

const S = {
  root: { minHeight: "100vh", background: "#0c1410", color: "#fff", fontFamily: "'Poppins', 'Segoe UI', system-ui, sans-serif" },
  header: { display: "flex", alignItems: "center", gap: 10, padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)", flexWrap: "wrap" },
  back: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.8)", padding: "7px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" },
  h1: { margin: 0, fontSize: "1.2rem" },
  content: { padding: "16px 20px", maxWidth: 1400, margin: "0 auto" },
  card: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: 16, display: "grid", gap: 8 },
  chip: (on) => ({ fontSize: "0.85rem", fontFamily: "inherit", color: on ? "#0c1410" : "rgba(255,255,255,0.7)", background: on ? VERDE : "transparent", border: `1px solid ${on ? VERDE : "rgba(255,255,255,0.15)"}`, borderRadius: 20, padding: "6px 14px", cursor: "pointer", fontWeight: on ? 700 : 500 }),
  chipP: (on) => ({ fontSize: "0.75rem", fontFamily: "inherit", color: on ? "#fff" : "rgba(255,255,255,0.6)", background: on ? "rgba(125,186,61,0.25)" : "transparent", border: `1px solid ${on ? VERDE : "rgba(255,255,255,0.12)"}`, borderRadius: 16, padding: "4px 11px", cursor: "pointer" }),
  table: { width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" },
  th: { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", padding: "6px 8px", textAlign: "center", whiteSpace: "nowrap", fontWeight: 600 },
  td: { padding: "5px 8px", textAlign: "right", borderBottom: "1px solid rgba(255,255,255,0.05)", whiteSpace: "nowrap" },
};
