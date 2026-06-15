// Relatório imprimível (PDF) de Devoluções — abre com os filtros via query params.
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";

const VERDE = "#2E7D32";
const VERM = "#C0392B";
const fmt = (n, d = 1) => (Number(n) || 0).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtRS = (n) => (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const rotMes = (m) => { if (!m || !m.includes("-")) return m || ""; const [a, mm] = m.split("-"); return `${mm}/${a}`; };

export default function EntregaRelatorio() {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const f = {
    mes: params.get("mes") || "", dia: params.get("dia") || "", setor: params.get("setor") || "",
    motivo: params.get("motivo") || "", pdv: params.get("pdv") || "",
  };
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    api.get("/api/detalhamento/entrega", { params: f })
      .then((r) => setD(r.data))
      .catch(() => setErro("Erro ao carregar o relatório."));
  }, []); // eslint-disable-line

  const escopo = [
    f.dia ? `dia ${f.dia}` : f.mes ? `mês ${rotMes(f.mes)}` : "quadrimestre",
    f.setor && `setor ${f.setor}`, f.motivo && `motivo ${f.motivo}`, f.pdv && `PDV "${f.pdv}"`,
  ].filter(Boolean).join(" · ");

  if (erro) return <div style={{ padding: 40, color: VERM }}>{erro}</div>;
  if (!d) return <div style={{ padding: 40 }}>Carregando…</div>;

  return (
    <div style={S.page}>
      <style>{CSS}</style>
      <div className="no-print" style={S.toolbar}>
        <button style={S.btnBack} onClick={() => navigate(-1)}>← Voltar</button>
        <button style={S.btnPrint} onClick={() => window.print()}>📄 Imprimir / Salvar PDF</button>
      </div>

      <div style={S.head}>
        <h1 style={S.h1}>Relatório de Devoluções (Entregas Frustradas)</h1>
        <p style={S.sub}>Escopo: <b>{escopo}</b> · gerado em {new Date().toLocaleString("pt-BR")}</p>
      </div>

      <div style={S.kpis}>
        <Kpi l="Volume frustrado" v={`${fmt(d.volume_frustrado_hl)} HL`} c={VERM} />
        <Kpi l="Valor frustrado" v={fmtRS(d.valor_frustrado)} c={VERM} />
        <Kpi l="Notas frustradas" v={d.qtd_frustradas} c="#333" />
        <Kpi l="Taxa de frustração" v={d.taxa_frustracao_pct == null ? "—" : `${fmt(d.taxa_frustracao_pct)}%`} c="#B8860B" />
      </div>

      <Secao titulo="🚚 Caminhões com mais devoluções" linhas={d.por_caminhao} rotulo={(x) => x.placa || "—"} />
      <Secao titulo="🏪 PDVs com mais devoluções" linhas={d.por_pdv} rotulo={(x) => `${x.nome_pdv || x.cod_pdv} (${x.setor})`} max={12} />
      <Secao titulo="📦 Produtos com mais devoluções" linhas={d.por_produto} rotulo={(x) => x.nome_produto || x.cod_produto} max={12} semValor />
      <Secao titulo="🗂️ Setores com mais devoluções" linhas={d.por_setor} rotulo={(x) => `Setor ${x.setor}`} />
      <Secao titulo="⚠️ Motivos das devoluções" linhas={d.por_motivo} rotulo={(x) => x.desc_motivo} />
      {(!f.dia) && <Secao titulo="📅 Devoluções por dia" linhas={d.por_dia} rotulo={(x) => x.data} ordemTabela />}
      {(!f.dia) && d.por_dia_semana?.length > 0 && <Secao titulo="📆 Por dia da semana" linhas={d.por_dia_semana} rotulo={(x) => x.dia_semana} ordemTabela />}

      <p style={S.foot}>Hop Follow-up · Detalhamento HOP — Entrega · {escopo}</p>
    </div>
  );
}

const Kpi = ({ l, v, c }) => (
  <div style={S.kpi}><div style={{ ...S.kpiV, color: c }}>{v}</div><div style={S.kpiL}>{l}</div></div>
);

function Secao({ titulo, linhas, rotulo, max = 10, semValor, ordemTabela }) {
  if (!linhas || linhas.length === 0) return null;
  const top = [...linhas].slice(0, max);
  const maxVol = Math.max(1, ...linhas.map((x) => Number(x.volume_hl) || 0));
  return (
    <div style={S.secao}>
      <h2 style={S.h2}>{titulo}</h2>
      {!ordemTabela && (
        <div style={S.bars}>
          {top.map((x, i) => (
            <div key={i} style={S.barRow}>
              <div style={S.barLbl}>{rotulo(x)}</div>
              <div style={S.barTrack}><div style={{ ...S.barFill, width: `${((Number(x.volume_hl) || 0) / maxVol) * 100}%` }} /></div>
              <div style={S.barVal}>{fmt(x.volume_hl)} HL</div>
            </div>
          ))}
        </div>
      )}
      <table style={S.tab}>
        <thead><tr>
          <th style={S.th}>{titulo.replace(/^[^ ]+ /, "")}</th>
          <th style={S.thR}>Notas</th><th style={S.thR}>Volume (HL)</th>{!semValor && <th style={S.thR}>Valor</th>}
        </tr></thead>
        <tbody>
          {linhas.map((x, i) => (
            <tr key={i}>
              <td style={S.td}>{rotulo(x)}</td>
              <td style={S.tdR}>{x.qtd ?? x.notas ?? "—"}</td>
              <td style={S.tdR}>{fmt(x.volume_hl)}</td>
              {!semValor && <td style={S.tdR}>{x.valor != null ? fmtRS(x.valor) : "—"}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const S = {
  page: { background: "#fff", color: "#1a1a1a", fontFamily: "'Poppins','Segoe UI',system-ui,sans-serif", maxWidth: "900px", margin: "0 auto", padding: "24px 28px" },
  toolbar: { display: "flex", justifyContent: "space-between", marginBottom: "16px" },
  btnBack: { background: "#eee", border: "1px solid #ccc", color: "#333", padding: "8px 14px", borderRadius: "8px", cursor: "pointer", fontFamily: "inherit" },
  btnPrint: { background: "linear-gradient(135deg,#7DBA3D,#2E7D32)", color: "#fff", border: "none", padding: "8px 18px", borderRadius: "8px", cursor: "pointer", fontWeight: "700", fontFamily: "inherit" },
  head: { borderBottom: "3px solid #7DBA3D", paddingBottom: "10px", marginBottom: "16px" },
  h1: { margin: 0, fontSize: "1.4rem", color: "#0E3B1D" },
  sub: { margin: "4px 0 0", color: "#666", fontSize: "0.82rem" },
  kpis: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "10px", marginBottom: "18px" },
  kpi: { border: "1px solid #ddd", borderRadius: "10px", padding: "12px" },
  kpiV: { fontSize: "1.3rem", fontWeight: "800" },
  kpiL: { color: "#666", fontSize: "0.72rem", marginTop: "2px" },
  secao: { marginBottom: "22px", breakInside: "avoid" },
  h2: { fontSize: "1rem", color: "#0E3B1D", margin: "0 0 8px", borderBottom: "1px solid #eee", paddingBottom: "4px" },
  bars: { display: "flex", flexDirection: "column", gap: "5px", marginBottom: "10px" },
  barRow: { display: "flex", alignItems: "center", gap: "8px" },
  barLbl: { width: "200px", flexShrink: 0, fontSize: "0.78rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  barTrack: { flex: 1, height: "12px", background: "#eef3ea", borderRadius: "6px", overflow: "hidden" },
  barFill: { height: "100%", background: "linear-gradient(90deg,#7DBA3D,#2E7D32)", borderRadius: "6px" },
  barVal: { width: "90px", textAlign: "right", fontSize: "0.78rem", fontWeight: "700", color: "#2E7D32", flexShrink: 0 },
  tab: { width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" },
  th: { textAlign: "left", padding: "5px 8px", borderBottom: "2px solid #ddd", color: "#555" },
  thR: { textAlign: "right", padding: "5px 8px", borderBottom: "2px solid #ddd", color: "#555", whiteSpace: "nowrap" },
  td: { padding: "4px 8px", borderBottom: "1px solid #f0f0f0" },
  tdR: { padding: "4px 8px", borderBottom: "1px solid #f0f0f0", textAlign: "right", whiteSpace: "nowrap" },
  foot: { marginTop: "20px", color: "#999", fontSize: "0.72rem", textAlign: "center" },
};

const CSS = `
@media print {
  .no-print { display: none !important; }
  body { background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @page { margin: 12mm; }
}
@media (max-width: 640px) { .kpis { grid-template-columns: repeat(2,1fr) !important; } }
`;
