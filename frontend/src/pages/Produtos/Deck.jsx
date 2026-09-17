// Deck de Estoque — visão por categoria × produtos (estilo do deck em PDF).
// Colunas = produtos (foto + nome + código); linhas = métricas.
import { useState, useEffect, useMemo } from "react";
import api from "../../services/api";

const VERDE = "#7DBA3D";
const fmtN = (v) => Number(v || 0).toLocaleString("pt-BR");

// linhas do deck (rótulo + como pega o valor + cor da célula)
const LINHAS = [
  { k: "grade", rot: "Grade de Estoque", val: (p) => fmtN(p.grade),
    cor: (p) => (p.grade <= 0 ? "vazio" : "") },
  { k: "agendados", rot: "Agendados D+7", val: (p) => (p.agendados ? fmtN(p.agendados) : "0"),
    cor: (p) => (p.agendados > 0 ? "ok" : "") },
  { k: "venc", rot: "1º Vencimento", val: (p) => p.venc || "—",
    cor: (p) => (p.vencDias == null ? "" : p.vencDias < 15 ? "vazio" : p.vencDias < 30 ? "alerta" : "") },
  { k: "transito", rot: "Trânsito", val: () => "—", cor: () => "" },
  { k: "previsao", rot: "Previsão", val: () => "—", cor: () => "" },
];

export default function Deck() {
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [catSel, setCatSel] = useState(0);
  const [print, setPrint] = useState(false);

  useEffect(() => {
    let vivo = true;
    setLoading(true); setErro("");
    api.get("/api/deck")
      .then((r) => vivo && setD(r.data))
      .catch(() => vivo && setErro("Não consegui carregar o Deck."))
      .finally(() => vivo && setLoading(false));
    return () => { vivo = false; };
  }, []);

  const secoes = d?.secoes || [];
  const exportarPDF = () => {
    setPrint(true);
    setTimeout(() => { window.print(); setPrint(false); }, 120);
  };

  if (loading && !d) return <div style={S.info}><span className="pr-spin" /> Carregando…</div>;
  if (erro) return <div style={S.erro}>{erro}</div>;
  if (!d) return null;
  if (!secoes.length)
    return <div style={S.vazio}>Sem dados do Deck ainda. Importe o <b>CORA</b> (agendados D+7), a <b>Grade de Estoque</b> e a <b>Coleta</b> (1º vencimento) em Admin › Arquivos, e cadastre a <b>categoria</b> dos produtos.</div>;

  const sec = secoes[Math.min(catSel, secoes.length - 1)];

  return (
    <>
      {d.atualizado_em && <div style={S.atualizado}>🔄 grade atualizada em {d.atualizado_em} · {d.total_produtos} produtos</div>}

      <div style={S.barra}>
        <div style={S.chips}>
          {secoes.map((s, i) => (
            <button key={s.categoria} onClick={() => setCatSel(i)}
              style={{ ...S.chip, ...(i === catSel ? S.chipOn : {}) }}>
              {s.categoria} <span style={S.chipN}>{s.produtos.length}</span>
            </button>
          ))}
        </div>
        <button style={S.btnPdf} onClick={exportarPDF}>🖨️ Exportar PDF</button>
      </div>

      {/* Tela: só a categoria selecionada */}
      {!print && <DeckTabela sec={sec} />}

      {/* Impressão: todas as categorias, uma por página */}
      {print && (
        <div className="deck-print">
          {secoes.map((s) => (
            <div key={s.categoria} className="deck-page">
              <DeckTabela sec={s} />
            </div>
          ))}
        </div>
      )}

      <style>{CSS}</style>
    </>
  );
}

function DeckTabela({ sec }) {
  const prods = sec.produtos;
  return (
    <div className="deck-wrap">
      <div className="deck-titulo">{sec.categoria}</div>
      <div style={{ overflowX: "auto" }}>
        <table className="deck-tbl">
          <thead>
            <tr>
              <th className="deck-lbl deck-corner"></th>
              {prods.map((p) => (
                <th key={p.cod} className="deck-prodcol">
                  <div className="deck-foto">
                    <img src={p.foto} alt="" loading="lazy"
                      onError={(e) => { e.target.style.visibility = "hidden"; }} />
                  </div>
                  <div className="deck-nome" title={p.nome}>{p.nome}</div>
                  <div className="deck-cod">{p.cod}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {LINHAS.map((ln) => (
              <tr key={ln.k}>
                <td className="deck-lbl">{ln.rot}</td>
                {prods.map((p) => {
                  const cor = ln.cor(p);
                  return <td key={p.cod} className={`deck-cel ${cor}`}>{ln.val(p)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const S = {
  info: { color: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", gap: "10px", padding: "20px 0" },
  erro: { color: "#ef6f6f", padding: "16px", background: "rgba(239,68,68,0.1)", borderRadius: "10px" },
  vazio: { color: "rgba(255,255,255,0.55)", padding: "20px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", lineHeight: 1.6 },
  atualizado: { color: "rgba(255,255,255,0.35)", fontSize: "0.7rem", margin: "0 0 12px 2px", fontStyle: "italic" },
  barra: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "14px" },
  chips: { display: "flex", gap: "6px", flexWrap: "wrap" },
  chip: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", padding: "6px 12px", borderRadius: "20px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.78rem", fontWeight: "600" },
  chipOn: { background: "rgba(125,186,61,0.15)", borderColor: "rgba(125,186,61,0.5)", color: VERDE },
  chipN: { fontSize: "0.66rem", opacity: 0.6, marginLeft: "3px" },
  btnPdf: { background: "linear-gradient(135deg,#7DBA3D,#2E7D32)", color: "#0c1410", border: "none", borderRadius: "9px", padding: "9px 18px", fontSize: "0.82rem", fontWeight: "700", cursor: "pointer", fontFamily: "inherit" },
};

const CSS = `
.pr-spin { width:16px;height:16px;border:2px solid rgba(125,186,61,0.2);border-top-color:${VERDE};border-radius:50%;display:inline-block;animation:pr-rot .8s linear infinite; }
@keyframes pr-rot { to { transform: rotate(360deg); } }

.deck-wrap { border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:10px 12px 14px; background:rgba(255,255,255,0.02); }
.deck-titulo { color:${VERDE}; font-weight:800; font-size:1rem; margin:2px 0 10px; text-transform:uppercase; letter-spacing:.5px; }
.deck-tbl { border-collapse:collapse; }
.deck-corner { background:transparent !important; border:none !important; }
.deck-prodcol { width:92px; min-width:92px; max-width:92px; padding:4px 3px; vertical-align:bottom; border-bottom:2px solid rgba(255,255,255,0.1); }
.deck-foto { height:66px; display:flex; align-items:flex-end; justify-content:center; }
.deck-foto img { max-height:66px; max-width:70px; object-fit:contain; }
.deck-nome { font-size:0.6rem; color:rgba(255,255,255,0.85); text-align:center; line-height:1.15; margin-top:3px; height:2.3em; overflow:hidden; }
.deck-cod { font-size:0.62rem; font-weight:700; color:${VERDE}; text-align:center; margin-top:2px; }
.deck-lbl { font-size:0.72rem; font-weight:700; color:rgba(255,255,255,0.75); text-align:right; padding:6px 10px; white-space:nowrap; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); position:sticky; left:0; }
.deck-cel { font-size:0.74rem; text-align:center; padding:6px 4px; color:#fff; border:1px solid rgba(255,255,255,0.06); font-variant-numeric:tabular-nums; white-space:nowrap; }
.deck-cel.ok { background:rgba(74,222,128,0.16); color:#7ee6a0; font-weight:700; }
.deck-cel.vazio { background:rgba(239,68,68,0.18); color:#ff9d9d; font-weight:700; }
.deck-cel.alerta { background:rgba(245,196,81,0.18); color:#f5c451; font-weight:700; }

@media print {
  @page { size: A4 landscape; margin: 8mm; }
  body * { visibility: hidden; }
  .deck-print, .deck-print * { visibility: visible; }
  .deck-print { position:absolute; left:0; top:0; width:100%; }
  .deck-page { page-break-after: always; }
  .deck-wrap { border:none; background:#fff; }
  .deck-titulo { color:#1f3a1a; }
  .deck-nome, .deck-lbl { color:#111 !important; background:#fff !important; }
  .deck-cel { color:#111; }
  .deck-cod { color:#2E7D32; }
}
`;
