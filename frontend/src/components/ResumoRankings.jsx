// Home (desktop): Top PDVs e Top produtos por volume no trimestre, com variação vs o
// mês anterior. Dado: GET /api/resumo/rankings.
import { useState, useEffect } from "react";
import api from "../services/api";

const MESES_ABR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const rotMes = (m) => { const [, mo] = String(m || "").split("-"); return MESES_ABR[(Number(mo) || 1) - 1] || m; };
const fmt = (v) => (Number(v) || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 });

function Delta({ d }) {
  if (d === null) return <span style={{ color: "#7DBA3D", fontSize: "0.82rem" }}>novo</span>;
  if (d === 0) return <span style={{ color: "rgba(255,255,255,0.35)" }}>–</span>;
  const up = d > 0;
  return <span style={{ color: up ? "#4ade80" : "#f0997b", fontWeight: 600, fontSize: "0.9rem" }}>{up ? "▲" : "▼"} {fmt(Math.abs(d))}%</span>;
}

function Gap({ g }) {
  if (!g) return <span style={{ color: "rgba(255,255,255,0.3)" }}>–</span>;
  const up = g > 0;
  return <span style={{ color: up ? "#4ade80" : "#f0997b", fontWeight: 600, fontSize: "0.88rem" }}>{up ? "+" : "−"}{fmt(Math.abs(g))}</span>;
}

function Tabela({ titulo, colNome, linhas, periodo, mAtual, mAnt }) {
  return (
    <div style={S.card}>
      <div style={S.head}>
        <span style={S.titulo}>{titulo}</span>
        <span style={S.sub}>dia {periodo} · {rotMes(mAtual)} vs {rotMes(mAnt)}</span>
      </div>
      <table style={S.table}>
        <thead>
          <tr>
            <th style={{ ...S.th, width: 24 }}>#</th>
            <th style={S.th}>{colNome}</th>
            <th style={{ ...S.th, textAlign: "right" }}>Vol tri (HL)</th>
            <th style={{ ...S.th, textAlign: "right", width: 92 }}>GAP (HL)</th>
            <th style={{ ...S.th, textAlign: "right", width: 78 }}>Δ</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((r, i) => (
            <tr key={r.cod} style={i % 2 ? S.trOdd : undefined}>
              <td style={S.tdNum}>{i + 1}</td>
              <td style={S.tdNome} title={`${r.nome} (cod ${r.cod})`}>{r.nome || r.cod}</td>
              <td style={S.tdVol}>{fmt(r.tri)}</td>
              <td style={{ ...S.td, textAlign: "right" }}><Gap g={r.gap} /></td>
              <td style={{ ...S.td, textAlign: "right" }}><Delta d={r.delta} /></td>
            </tr>
          ))}
          {!linhas.length && <tr><td colSpan={5} style={S.vazio}>Sem dados.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export default function ResumoRankings() {
  const [data, setData] = useState(null);
  const [erro, setErro] = useState("");
  const [esperando, setEsperando] = useState(false);

  useEffect(() => {
    let cancel = false, tent = 0;
    const buscar = () => {
      api.get("/api/resumo/rankings", { timeout: 18000 })
        .then((r) => { if (!cancel) { setData(r.data); setEsperando(false); } })
        .catch((e) => {
          if (cancel) return;
          const st = e?.response?.status;
          const cold = st === 503 || st === 502 || e?.code === "ECONNABORTED" || !st;
          if (cold && tent < 6) { tent += 1; setEsperando(true); setTimeout(buscar, 8000); }
          else setErro(st ? `HTTP ${st}` : (e?.message || "falha"));
        });
    };
    buscar();
    return () => { cancel = true; };
  }, []);

  if (erro) return null;
  if (!data) return <div style={S.skel}>{esperando ? "Acordando o servidor…" : "Carregando rankings…"}</div>;

  return (
    <div>
      {!data.temDiario && <div style={S.aviso}>⚠️ Comparação D-1 ainda vazia — reimporte os <b>Pedidos</b> pra gerar o volume diário (vd_pdv/vd_produto).</div>}
      <div style={S.grid}>
        <Tabela titulo="🏪 Top 20 PDVs — volume (tri)" colNome="PDV" linhas={data.pdvs} periodo={data.periodo} mAtual={data.mesAtual} mAnt={data.mesAnterior} />
        <Tabela titulo="📦 Top 20 produtos — volume (tri)" colNome="Produto" linhas={data.produtos} periodo={data.periodo} mAtual={data.mesAtual} mAnt={data.mesAnterior} />
      </div>
    </div>
  );
}

const S = {
  grid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "16px", marginBottom: "16px", alignItems: "start" },
  card: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "14px 16px" },
  head: { display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "10px", gap: "8px" },
  titulo: { color: "#fff", fontWeight: 600, fontSize: "1.05rem" },
  sub: { color: "rgba(255,255,255,0.45)", fontSize: "0.82rem", whiteSpace: "nowrap" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "0.95rem" },
  th: { textAlign: "left", color: "rgba(255,255,255,0.45)", fontWeight: 500, fontSize: "0.8rem", padding: "6px 8px", borderBottom: "1px solid rgba(255,255,255,0.08)" },
  td: { padding: "7px 8px", color: "rgba(255,255,255,0.75)" },
  tdNum: { padding: "7px 8px", color: "rgba(255,255,255,0.35)", fontSize: "0.85rem" },
  tdNome: { padding: "7px 8px", color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 260 },
  tdVol: { padding: "7px 8px", color: "rgba(255,255,255,0.85)", textAlign: "right", fontVariantNumeric: "tabular-nums" },
  trOdd: { background: "rgba(255,255,255,0.02)" },
  vazio: { padding: "12px", textAlign: "center", color: "rgba(255,255,255,0.35)" },
  skel: { color: "rgba(255,255,255,0.35)", fontSize: "0.9rem", padding: "10px 2px", marginBottom: "16px" },
  aviso: { background: "rgba(240,153,123,0.1)", border: "1px solid rgba(240,153,123,0.3)", color: "#f0b37e", borderRadius: "10px", padding: "8px 12px", fontSize: "0.82rem", marginBottom: "12px" },
};
