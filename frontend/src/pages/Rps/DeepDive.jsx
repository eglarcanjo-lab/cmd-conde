// Aba "Deep Dive" da RPS — o que se repete nos materiais de reunião (MPR, Fast Start, Deep Dive
// Q1 Supercom): YTD × YTD LY, build-up por marca / embalagem / segmento, Core × High End,
// top/bottom SKU, oportunidades de distribuição HE (cruzamentos), cobertura RGB 300 × Cerveja,
// multipack e NAB por embalagem. Dado: d.deepDive (GET /api/rps). Externos ficam listados.
import { useState } from "react";
import * as XLSX from "xlsx-js-style";

const VERDE = "#7DBA3D", VERM = "#f87171", OK = "#4ade80";
const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const fmt = (v, d = 0) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }));
const fmtP = (v) => (v == null ? "—" : `${v > 0 ? "+" : ""}${fmt(v, 1)}%`);
const corP = (v) => (v == null ? "rgba(255,255,255,0.4)" : v >= 0 ? OK : VERM);

const SUB = [
  { id: "ytd", label: "📅 YTD × LY" },
  { id: "buildup", label: "🧱 Marcas · Embalagens · Segmentos" },
  { id: "sku", label: "📈 Top / Bottom SKU" },
  { id: "he", label: "🍾 Oportunidades HE" },
  { id: "rgb300", label: "🍺 RGB 300 × Cerveja" },
  { id: "mp", label: "📦 Multipack" },
  { id: "ext", label: "🌐 Dados externos" },
];

// Barras agrupadas ano × ano anterior (estilo MPR: YTD 25 × YTD 26 mês a mês)
function BarrasAno({ ano, ly, rotAno }) {
  const W = 900, H = 170, n = 12, max = Math.max(1, ...ano.filter((v) => v != null), ...ly);
  const bw = (W - 40) / n;
  return (
    <svg viewBox={`0 0 ${W} ${H + 40}`} style={{ width: "100%", height: "auto" }}>
      {ly.map((v, i) => {
        const x = 20 + i * bw, w = bw * 0.36, h1 = (v / max) * H, a = ano[i], h2 = a == null ? 0 : (a / max) * H;
        return (
          <g key={i}>
            <rect x={x + bw * 0.1} y={H - h1 + 14} width={w} height={h1} fill="rgba(255,255,255,0.28)" rx="2" />
            {a != null && <rect x={x + bw * 0.1 + w + 2} y={H - h2 + 14} width={w} height={h2} fill={VERDE} rx="2" />}
            {a != null && <text x={x + bw * 0.1 + w + 2 + w / 2} y={H - h2 + 10} fill="#fff" fontSize="10" textAnchor="middle">{fmt(a)}</text>}
            <text x={x + bw / 2} y={H + 32} fill="rgba(255,255,255,0.55)" fontSize="11" textAnchor="middle">{MES[i]}</text>
          </g>
        );
      })}
      <text x="20" y="10" fill="rgba(255,255,255,0.5)" fontSize="11">■ cinza = {rotAno - 1} · ■ verde = {rotAno}</text>
    </svg>
  );
}

function Tabela({ cols, rows, destaque }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={S.table}>
        <thead><tr>{cols.map((c) => <th key={c.k} style={{ ...S.th, textAlign: c.esq ? "left" : "center" }}>{c.l}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => (
          <tr key={i} style={destaque && destaque(r) ? { background: "rgba(125,186,61,0.10)", fontWeight: 700 } : undefined}>
            {cols.map((c) => {
              const v = c.f ? c.f(r) : r[c.k];
              return <td key={c.k} style={{ ...S.td, textAlign: c.esq ? "left" : "right", ...(c.cor ? { color: corP(r[c.k]), fontWeight: 700 } : {}) }}>{v}</td>;
            })}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

const COL_BU = (rot) => [
  { k: "item", l: rot, esq: true }, { k: "ytd", l: "YTD", f: (r) => fmt(r.ytd, 1) }, { k: "ytd_ly", l: "YTD LY", f: (r) => fmt(r.ytd_ly, 1) },
  { k: "vs_ly", l: "vs LY", f: (r) => fmtP(r.vs_ly), cor: true }, { k: "wgt", l: "Peso (WGT)", f: (r) => `${fmt(r.wgt, 1)}%` },
];

function exportarPdvs(c) {
  const ws = XLSX.utils.json_to_sheet(c.pdvs.map((p) => ({ Setor: p.setor, "Cód PDV": p.cod_pdv, PDV: p.nome_pdv, Oportunidade: c.label, Ação: c.acao })));
  ws["!cols"] = [8, 10, 34, 50, 30].map((wch) => ({ wch }));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "PDVs");
  XLSX.writeFile(wb, `oportunidade_${c.id}.xlsx`);
}

export default function DeepDive({ dd, mesAtual }) {
  const [sub, setSub] = useState("ytd");
  const [ytdSel, setYtdSel] = useState("tt");
  const [cruz, setCruz] = useState(null);
  if (!dd) return <p style={{ color: "rgba(255,255,255,0.5)" }}>Sem dados do Deep Dive.</p>;
  const g = dd.ytdGrupos.find((x) => x.id === ytdSel) || dd.ytdGrupos[0];
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {SUB.map((x) => <button key={x.id} style={S.chipP(sub === x.id)} onClick={() => setSub(x.id)}>{x.label}</button>)}
      </div>

      {sub === "ytd" && (
        <div style={S.card}>
          <b>YTD {dd.ano} × YTD {dd.ano - 1} (HL) {!dd.temLy && <span style={{ color: "#f5c451", fontWeight: 400 }}>· sem histórico do ano anterior completo na HOP</span>}</b>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {dd.ytdGrupos.map((x) => <button key={x.id} style={S.chipP(g.id === x.id)} onClick={() => setYtdSel(x.id)}>{x.label}</button>)}
          </div>
          <div style={{ fontSize: "0.85rem" }}>{g.label}: <b>{fmt(g.ytd, 1)} HL</b> × {fmt(g.ytd_ly, 1)} HL · <b style={{ color: corP(g.vs_ly) }}>{fmtP(g.vs_ly)} vs LY</b></div>
          <BarrasAno ano={g.ano} ly={g.ano_ly} rotAno={dd.ano} />
          <Tabela cols={[{ k: "label", l: "Categoria", esq: true }, { k: "ytd", l: `YTD ${dd.ano}`, f: (r) => fmt(r.ytd, 1) }, { k: "ytd_ly", l: `YTD ${dd.ano - 1}`, f: (r) => fmt(r.ytd_ly, 1) }, { k: "vs_ly", l: "vs LY", f: (r) => fmtP(r.vs_ly), cor: true }]}
            rows={dd.ytdGrupos} destaque={(r) => r.id === g.id} />
          <p style={S.nota}>YTD = jan até hoje. No ano anterior, o mês corrente entra proporcional aos dias úteis já feitos (mesmo período).</p>
        </div>
      )}

      {sub === "buildup" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(440px, 1fr))", gap: 12 }}>
          <div style={S.card}><b>Cerveja · Core × High End</b><Tabela cols={COL_BU("Segmento")} rows={dd.coreHe} /></div>
          <div style={S.card}><b>Cerveja · por marca</b><Tabela cols={COL_BU("Marca")} rows={dd.marcasCerv} /></div>
          <div style={S.card}><b>Cerveja · por embalagem</b><Tabela cols={COL_BU("Embalagem")} rows={dd.embCerv} /></div>
          <div style={S.card}><b>NAB · por embalagem</b><Tabela cols={COL_BU("Embalagem")} rows={dd.embNab} /></div>
          <div style={S.card}><b>Cerveja · por segmento do PDV (mês atual pela tendência)</b>
            <Tabela cols={[{ k: "segmento", l: "Segmento", esq: true }, { k: "m1", l: "M-1", f: (r) => fmt(r.m1, 1) }, { k: "tend", l: "Tend", f: (r) => fmt(r.tend, 1) }, { k: "vs_m1", l: "vs M-1", f: (r) => fmtP(r.vs_m1), cor: true }, { k: "vs_l3m", l: "vs L3M", f: (r) => fmtP(r.vs_l3m), cor: true }, { k: "vs_ly", l: "vs LY", f: (r) => fmtP(r.vs_ly), cor: true }]} rows={dd.segmentos} />
          </div>
        </div>
      )}

      {sub === "sku" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(440px, 1fr))", gap: 12 }}>
          {[["🟢 Top 10 SKU · ganhos vs LY (YTD)", dd.topSku], ["🔴 Bottom 10 SKU · perdas vs LY (YTD)", dd.bottomSku]].map(([t, rows]) => (
            <div key={t} style={S.card}><b>{t}</b>
              <Tabela cols={[{ k: "nome", l: "SKU", esq: true }, { k: "ytd", l: "YTD", f: (r) => fmt(r.ytd, 1) }, { k: "ytd_ly", l: "YTD LY", f: (r) => fmt(r.ytd_ly, 1) }, { k: "delta", l: "Δ HL", f: (r) => `${r.delta > 0 ? "+" : ""}${fmt(r.delta, 1)}` }, { k: "vs_ly", l: "vs LY", f: (r) => fmtP(r.vs_ly), cor: true }]} rows={rows} />
            </div>
          ))}
        </div>
      )}

      {sub === "he" && (
        <div style={{ display: "grid", gap: 12 }}>
          <div style={S.card}>
            <b>Oportunidades de distribuição High End · compradores dos últimos 4 meses</b>
            <div style={{ fontSize: "0.85rem" }}>HE 600: <b>{fmt(dd.he600.so_uma_marca)}</b> de {fmt(dd.he600.compradores)} compradores ({fmt(dd.he600.pct, 1)}%) compram só 1 marca nossa (Stella, Spaten ou Original 600).</div>
            <Tabela cols={[{ k: "label", l: "Oportunidade", esq: true }, { k: "compradores", l: "Compradores", f: (r) => fmt(r.compradores) }, { k: "oportunidade", l: "PDVs alvo", f: (r) => fmt(r.oportunidade) }, { k: "pct", l: "%", f: (r) => `${fmt(r.pct, 1)}%` }, { k: "acao", l: "Ação", esq: true },
              { k: "ver", l: "", f: (r) => <button style={S.mini} onClick={() => setCruz(cruz === r.id ? null : r.id)}>{cruz === r.id ? "fechar" : "por RN / PDVs"}</button> }]} rows={dd.cruzamentos} />
          </div>
          {dd.cruzamentos.filter((c) => c.id === cruz).map((c) => (
            <div key={c.id} style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><b>{c.label}</b><button style={S.mini} onClick={() => exportarPdvs(c)}>📥 Excel dos {fmt(c.pdvs.length)} PDVs</button></div>
              <Tabela cols={[{ k: "setor", l: "Setor" }, { k: "rn", l: "RN", esq: true }, { k: "compradores", l: "Compradores" }, { k: "oportunidade", l: "PDVs alvo" }, { k: "pct", l: "%", f: (r) => `${fmt(r.pct, 1)}%` }]} rows={c.porRn} />
            </div>
          ))}
          <p style={S.nota}>Inspirado no Fast Start 2026 (p. 72, 170 e 171): reduzir o GAP de distribuição no High End aumentando o portfólio no PDV.</p>
        </div>
      )}

      {sub === "rgb300" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(440px, 1fr))", gap: 12 }}>
          {[["Mês atual", dd.cob300.atual], ["M-1", dd.cob300.m1]].map(([t, rows]) => (
            <div key={t} style={S.card}><b>Cobertura RGB 300 × Cerveja TT · {t}</b>
              <Tabela cols={[{ k: "setor", l: "Setor" }, { k: "rn", l: "RN", esq: true }, { k: "comp_cerv", l: "Comp. Cerveja", f: (r) => fmt(r.comp_cerv) }, { k: "comp_300", l: "Comp. 300", f: (r) => fmt(r.comp_300) }, { k: "pct", l: "% 300", f: (r) => `${fmt(r.pct, 1)}%` }]}
                rows={[...rows].sort((a, b) => (a.rn === "Operação") - (b.rn === "Operação") || (b.pct ?? 0) - (a.pct ?? 0))} destaque={(r) => r.rn === "Operação"} />
            </div>
          ))}
        </div>
      )}

      {sub === "mp" && (
        <div style={S.card}>
          <b>Multipack · peso no volume de lata e cobertura</b>
          <Tabela cols={[{ k: "rot", l: "", esq: true }, ...dd.multipack.meses.map((m, i) => ({ k: "c" + i, l: `${MES[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}` }))]}
            rows={[["Volume MP (HL)", dd.multipack.volume.map((v) => fmt(v, 1))], ["Peso MP na lata", dd.multipack.peso.map((v) => `${fmt(v, 1)}%`)], ["PDVs compradores MP", dd.multipack.compradores.map((v) => fmt(v))], ["% compradores de lata c/ MP", dd.multipack.cobertura_lata.map((v) => `${fmt(v, 1)}%`)]]
              .map(([rot, vals]) => ({ rot, ...Object.fromEntries(vals.map((v, i) => ["c" + i, v])) }))} />
          <b style={{ marginTop: 6 }}>SKUs multipack (YTD)</b>
          <Tabela cols={COL_BU("SKU")} rows={dd.multipack.skus} />
        </div>
      )}

      {sub === "ext" && (
        <div style={S.card}>
          <b>Presentes nos materiais de reunião, mas a HOP não entrega na RPS</b>
          <Tabela cols={[{ k: "secao", l: "Bloco", esq: true }, { k: "titulo", l: "Análise", esq: true }, { k: "fonte", l: "Fonte", esq: true },
            { k: "tipo", l: "Situação", esq: true, f: (r) => (r.tipo === "na_hop" ? "existe em outra tela da HOP" : "externo") }, { k: "onde", l: "Onde aparece nos materiais", esq: true }]}
            rows={dd.externos.map((x) => (typeof x === "string" ? { titulo: x } : x))} destaque={(r) => r.tipo === "na_hop"} />
          <p style={S.nota}>No PowerPoint, cada linha vira um slide vazio no mesmo tema (título, fonte e espaço tracejado) para colar o print. As linhas em verde já existem na HOP e podem entrar na RPS depois.</p>
        </div>
      )}
    </div>
  );
}

const S = {
  card: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: 16, display: "grid", gap: 8 },
  chipP: (on) => ({ fontSize: "0.75rem", fontFamily: "inherit", color: on ? "#fff" : "rgba(255,255,255,0.6)", background: on ? "rgba(125,186,61,0.25)" : "transparent", border: `1px solid ${on ? VERDE : "rgba(255,255,255,0.12)"}`, borderRadius: 16, padding: "4px 11px", cursor: "pointer" }),
  mini: { fontSize: "0.72rem", fontFamily: "inherit", color: "#fff", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "3px 9px", cursor: "pointer" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" },
  th: { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", padding: "6px 8px", whiteSpace: "nowrap", fontWeight: 600 },
  td: { padding: "5px 8px", borderBottom: "1px solid rgba(255,255,255,0.05)", whiteSpace: "nowrap" },
  nota: { fontSize: "0.75rem", color: "rgba(255,255,255,0.45)", margin: 0 },
};
