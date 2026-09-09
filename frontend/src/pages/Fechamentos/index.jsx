// Fechamentos — geração de relatórios. 1º: Super Matinal (Fechamento Comercial).
// Deck .pptx limpo (identidade HOP), tudo em gráficos/tabelas p/ o GV curar.
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PptxGenJS from "pptxgenjs";
import api from "../../services/api";

const VERDE = "7DBA3D";      // sem # (pptxgenjs)
const ESCURO = "1F3A24";
const CINZA = "6B7280";
const fmt = (v, d = 0) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const HL_KEYS = ["cerveja_tt", "rgb", "high_end", "cerveja_zero", "match", "nab", "nab_zero"];

async function logoDataUrl() {
  try {
    const res = await fetch("/brand/logo.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = () => ok(null); fr.readAsDataURL(blob); });
  } catch { return null; }
}

export default function Fechamentos() {
  const navigate = useNavigate();
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => { carregar(); }, []);
  async function carregar() {
    setLoading(true); setErro("");
    try { const r = await api.get("/api/fechamentos/super-matinal", { timeout: 60000 }); setD(r.data); }
    catch (e) { setErro(e?.response?.data?.error || "Erro ao carregar."); }
    finally { setLoading(false); }
  }

  const bkt = (k) => (d?.buckets || []).find((b) => b.chave === k);

  async function gerarPptx() {
    if (!d) return;
    setGerando(true);
    try {
      const logo = await logoDataUrl();
      const pptx = new PptxGenJS();
      pptx.layout = "LAYOUT_WIDE"; // 13.3 x 7.5"
      pptx.defineSlideMaster({
        title: "HOP",
        background: { color: "FFFFFF" },
        objects: [{ rect: { x: 0, y: 0, w: "100%", h: 0.18, fill: { color: VERDE } } }],
      });
      const capaLogo = (s, x, y, w) => { if (logo) s.addImage({ data: logo, x, y, w, h: w }); };
      const titulo = (s, txt, sub) => {
        s.addText(txt, { x: 0.5, y: 0.28, w: 12.3, h: 0.6, fontSize: 24, bold: true, color: ESCURO, fontFace: "Arial" });
        if (sub) s.addText(sub, { x: 0.5, y: 0.85, w: 12.3, h: 0.35, fontSize: 13, color: CINZA, fontFace: "Arial" });
      };

      // ── Capa ──
      const capa = pptx.addSlide({ masterName: "HOP" });
      capaLogo(capa, 6.0, 1.7, 1.3);
      capa.addText(d.titulo, { x: 0.5, y: 3.3, w: 12.3, h: 0.8, align: "center", fontSize: 30, bold: true, color: ESCURO, fontFace: "Arial" });
      capa.addText(`Ano ${d.ano} · fechamento de ${d.mes_anterior_label}`, { x: 0.5, y: 4.15, w: 12.3, h: 0.5, align: "center", fontSize: 15, color: VERDE, bold: true, fontFace: "Arial" });
      capa.addText(`Gerado em ${d.gerado_em}`, { x: 0.5, y: 6.9, w: 12.3, h: 0.3, align: "center", fontSize: 9, color: CINZA, fontFace: "Arial" });

      // ── Resultado do ano (YTD) — barras por categoria (HL) ──
      const s1 = pptx.addSlide({ masterName: "HOP" });
      titulo(s1, "Resultado do Ano (YTD)", `Volume acumulado ${d.ano} · HL`);
      s1.addChart(pptx.ChartType.bar, [{
        name: "YTD (HL)",
        labels: HL_KEYS.map((k) => bkt(k)?.label || k),
        values: HL_KEYS.map((k) => bkt(k)?.ytd || 0),
      }], { x: 0.5, y: 1.35, w: 8.2, h: 5.6, barDir: "col", chartColors: [VERDE], showValue: true, dataLabelFontSize: 9, catAxisLabelFontSize: 9, valAxisHidden: true, showLegend: false });
      // Tabela lateral (inclui Marketplace em R$)
      const rowsYtd = [[{ text: "Categoria", options: hCell() }, { text: "YTD", options: hCell() }]];
      (d.buckets || []).forEach((b) => rowsYtd.push([{ text: b.label, options: cell() }, { text: b.unidade === "R$" ? `R$ ${fmt(b.ytd)}` : `${fmt(b.ytd, 1)} HL`, options: cell(true) }]));
      s1.addTable(rowsYtd, { x: 9.0, y: 1.35, w: 3.8, colW: [2.3, 1.5], fontSize: 10, fontFace: "Arial", border: { type: "solid", color: "E5E7EB", pt: 0.5 }, valign: "middle" });

      // ── Evolução mensal — Cerveja TT e NAB ──
      const s2 = pptx.addSlide({ masterName: "HOP" });
      titulo(s2, "Evolução Mensal", `${d.meses_label[0]} → ${d.meses_label[d.meses_label.length - 1]} · HL`);
      s2.addChart(pptx.ChartType.line, [
        { name: "Cerveja TT", labels: d.meses_label, values: bkt("cerveja_tt")?.serie || [] },
        { name: "NAB", labels: d.meses_label, values: bkt("nab")?.serie || [] },
      ], { x: 0.5, y: 1.35, w: 12.3, h: 5.6, chartColors: [VERDE, "F5C451"], showLegend: true, legendPos: "b", lineDataSymbol: "circle", lineSize: 2, catAxisLabelFontSize: 9 });

      // ── Mês anterior (fechado) — barras por categoria ──
      const s3 = pptx.addSlide({ masterName: "HOP" });
      titulo(s3, `Resultado de ${d.mes_anterior_label}`, "Volume do mês fechado");
      s3.addChart(pptx.ChartType.bar, [{
        name: d.mes_anterior_label,
        labels: HL_KEYS.map((k) => bkt(k)?.label || k),
        values: HL_KEYS.map((k) => bkt(k)?.mes_anterior || 0),
      }], { x: 0.5, y: 1.35, w: 8.2, h: 5.6, barDir: "col", chartColors: [ESCURO], showValue: true, dataLabelFontSize: 9, catAxisLabelFontSize: 9, valAxisHidden: true, showLegend: false });
      const rowsMes = [[{ text: "Categoria", options: hCell() }, { text: d.mes_anterior_label, options: hCell() }]];
      (d.buckets || []).forEach((b) => rowsMes.push([{ text: b.label, options: cell() }, { text: b.unidade === "R$" ? `R$ ${fmt(b.mes_anterior)}` : `${fmt(b.mes_anterior, 1)} HL`, options: cell(true) }]));
      s3.addTable(rowsMes, { x: 9.0, y: 1.35, w: 3.8, colW: [2.3, 1.5], fontSize: 10, fontFace: "Arial", border: { type: "solid", color: "E5E7EB", pt: 0.5 }, valign: "middle" });

      // ── Reconhecimento — melhores do Atendimento Produtivo (mês anterior) ──
      const s4 = pptx.addSlide({ masterName: "HOP" });
      titulo(s4, "Reconhecimento", `Melhores no Atendimento Produtivo · ${d.mes_anterior_label}`);
      const rowsRec = [[
        { text: "#", options: hCell() }, { text: "RN", options: hCell() }, { text: "Setor", options: hCell() },
        { text: "KPIs OK", options: hCell() }, { text: "AP", options: hCell() },
      ]];
      (d.reconhecimento || []).forEach((r, i) => rowsRec.push([
        { text: `${i + 1}º`, options: cell(true) }, { text: r.nome || "—", options: cell() }, { text: r.setor, options: cell(true) },
        { text: `${r.kpis_ok}/4`, options: cell(true) }, { text: r.ap_ok ? "OK" : "—", options: { ...cell(true), color: r.ap_ok ? VERDE : CINZA, bold: true } },
      ]));
      if ((d.reconhecimento || []).length === 0) rowsRec.push([{ text: "Sem dados de Atendimento Produtivo do mês anterior.", options: { ...cell(), colspan: 5 } }]);
      s4.addTable(rowsRec, { x: 1.5, y: 1.6, w: 10.3, colW: [0.9, 4.6, 1.6, 1.6, 1.6], fontSize: 12, fontFace: "Arial", border: { type: "solid", color: "E5E7EB", pt: 0.5 }, valign: "middle", rowH: 0.5 });

      await pptx.writeFile({ fileName: `super_matinal_${d.mes_anterior}.pptx` });
    } catch (e) {
      console.error(e);
      setErro("Erro ao gerar o PowerPoint.");
    } finally { setGerando(false); }
  }

  return (
    <div style={S.root}>
      <div style={S.header}>
        <button style={S.back} onClick={() => navigate("/")}>← Início</button>
        <div>
          <h1 style={S.title}>📑 Fechamentos</h1>
          <p style={S.sub}>Geração de relatórios</p>
        </div>
      </div>

      <div style={S.content}>
        <div style={S.card}>
          <div style={S.cardHead}>
            <div>
              <div style={S.cardTit}>🌅 Super Matinal — Fechamento Comercial</div>
              <div style={S.cardSub}>{d ? `Ano ${d.ano} · fechamento de ${d.mes_anterior_label}` : "…"}</div>
            </div>
            <button style={S.gerar} onClick={gerarPptx} disabled={!d || gerando || loading}>
              {gerando ? "⏳ Gerando…" : "⬇️ Gerar PowerPoint"}
            </button>
          </div>

          {loading && <div style={S.msg}>Carregando dados…</div>}
          {erro && <div style={S.erro}>{erro}</div>}

          {d && !loading && (
            <>
              <p style={S.hint}>Prévia dos números. O .pptx traz capa, resultado do ano, evolução mensal, mês fechado e reconhecimento — o GV escolhe o que apresentar.</p>
              <div style={S.tableWrap}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={S.th}>Categoria</th>
                      <th style={S.thR}>YTD ({d.ano})</th>
                      <th style={S.thR}>{d.mes_anterior_label}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(d.buckets || []).map((b) => (
                      <tr key={b.chave} style={S.tr}>
                        <td style={S.td}>{b.label} <span style={S.un}>{b.unidade}</span></td>
                        <td style={S.tdR}>{b.unidade === "R$" ? `R$ ${fmt(b.ytd)}` : fmt(b.ytd, 1)}</td>
                        <td style={S.tdR}>{b.unidade === "R$" ? `R$ ${fmt(b.mes_anterior)}` : fmt(b.mes_anterior, 1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={S.recTit}>🏅 Reconhecimento — Atendimento Produtivo ({d.mes_anterior_label})</div>
              {(d.reconhecimento || []).length === 0 ? (
                <div style={S.msg}>Sem dados de Atendimento Produtivo do mês anterior.</div>
              ) : (
                <div style={S.tableWrap}>
                  <table style={S.table}>
                    <thead><tr><th style={S.th}>#</th><th style={S.th}>RN</th><th style={S.th}>Setor</th><th style={S.thR}>KPIs OK</th><th style={S.thR}>AP</th></tr></thead>
                    <tbody>
                      {d.reconhecimento.map((r, i) => (
                        <tr key={r.setor} style={S.tr}>
                          <td style={S.td}>{i + 1}º</td>
                          <td style={S.td}>{r.nome || "—"}</td>
                          <td style={S.td}>{r.setor}</td>
                          <td style={S.tdR}>{r.kpis_ok}/4</td>
                          <td style={{ ...S.tdR, color: r.ap_ok ? "#7DBA3D" : "rgba(255,255,255,0.4)", fontWeight: 700 }}>{r.ap_ok ? "OK" : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// células da tabela pptx
function hCell() { return { bold: true, color: "FFFFFF", fill: { color: VERDE }, align: "center", valign: "middle" }; }
function cell(center) { return { color: "1F2937", align: center ? "center" : "left", valign: "middle" }; }

const S = {
  root: { minHeight: "100vh", background: "#0c1410", fontFamily: "'Poppins','Segoe UI',system-ui,sans-serif", color: "#fff" },
  header: { display: "flex", alignItems: "flex-start", gap: 14, padding: "clamp(12px,3vw,20px) clamp(16px,4vw,32px)", borderBottom: "1px solid rgba(255,255,255,0.08)" },
  back: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", padding: "9px 14px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: "0.85rem", flexShrink: 0 },
  title: { margin: 0, fontSize: "1.3rem", fontWeight: 700 },
  sub: { margin: "3px 0 0", fontSize: "0.8rem", color: "rgba(255,255,255,0.4)" },
  content: { padding: "clamp(16px,4vw,28px)", maxWidth: 1000, margin: "0 auto" },
  card: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 18 },
  cardHead: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 8 },
  cardTit: { fontWeight: 700, fontSize: "1rem" },
  cardSub: { fontSize: "0.8rem", color: "rgba(255,255,255,0.45)", marginTop: 2 },
  gerar: { background: "rgba(125,186,61,0.2)", border: "1px solid rgba(125,186,61,0.5)", color: "#7DBA3D", padding: "9px 18px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: "0.9rem", fontWeight: 700 },
  hint: { fontSize: "0.78rem", color: "rgba(255,255,255,0.4)", margin: "6px 0 14px" },
  tableWrap: { overflowX: "auto", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", marginBottom: 12 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" },
  th: { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)", fontSize: "0.72rem", fontWeight: 600, textTransform: "uppercase", padding: "9px 12px", textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.08)" },
  thR: { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)", fontSize: "0.72rem", fontWeight: 600, textTransform: "uppercase", padding: "9px 12px", textAlign: "right", borderBottom: "1px solid rgba(255,255,255,0.08)" },
  tr: { borderBottom: "1px solid rgba(255,255,255,0.05)" },
  td: { padding: "8px 12px", color: "rgba(255,255,255,0.85)" },
  tdR: { padding: "8px 12px", color: "rgba(255,255,255,0.85)", textAlign: "right", fontVariantNumeric: "tabular-nums" },
  un: { color: "rgba(255,255,255,0.3)", fontSize: "0.68rem" },
  recTit: { fontWeight: 700, fontSize: "0.9rem", margin: "16px 0 8px" },
  msg: { color: "rgba(255,255,255,0.4)", fontSize: "0.85rem", padding: "10px 0" },
  erro: { background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", borderRadius: 8, padding: "10px 14px", fontSize: "0.85rem", marginTop: 8 },
};
