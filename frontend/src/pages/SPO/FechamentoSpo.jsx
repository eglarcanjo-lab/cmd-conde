// Fechamento do trimestre do SPO: guarda a FOTO (PNG) do Painel SPO Consolidado, porque os
// KPIs mudam todo trimestre. "🔒 Fechar tri" (admin) tira a foto do painel como está e salva;
// "📸 Fechamentos" lista os trimestres fechados (ver / baixar a imagem / excluir).
// A captura usa html2canvas carregado do cdnjs só na hora de fechar (nada instalado no app).
import { useState } from "react";
import api from "../../services/api";
import { MESES_TRI } from "./shared";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
// Trimestre vigente do painel (MESES_TRI) → "2026-T3" + rótulo "3º tri 2026 (jul–set)"
export function triDoPainel() {
  const [y, m] = String(MESES_TRI[0] || "").split("-").map(Number);
  const q = Math.floor((m - 1) / 3) + 1;
  const fim = Number(String(MESES_TRI[MESES_TRI.length - 1]).slice(5, 7));
  return { id: `${y}-T${q}`, rotulo: `${q}º tri ${y} (${MESES[m - 1]}–${MESES[fim - 1]})` };
}

let _h2c = null;
function carregarHtml2canvas() {
  if (window.html2canvas) return Promise.resolve(window.html2canvas);
  if (_h2c) return _h2c;
  _h2c = new Promise((ok, erro) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
    s.onload = () => (window.html2canvas ? ok(window.html2canvas) : erro(new Error("html2canvas não carregou")));
    s.onerror = () => { _h2c = null; erro(new Error("Sem internet para carregar o gerador de imagem.")); };
    document.head.appendChild(s);
  });
  return _h2c;
}

export default function FechamentoSpo({ alvoRef, isAdmin }) {
  const [fechando, setFechando] = useState(false);
  const [lista, setLista] = useState(null);      // modal aberto quando != null
  const [vendo, setVendo] = useState(null);      // { trimestre, rotulo, imagem, ... }
  const tri = triDoPainel();

  async function fechar() {
    if (!alvoRef.current) return;
    if (!window.confirm(`Fechar o ${tri.rotulo}?\n\nSalva a FOTO do Painel SPO Consolidado como está agora. Se já existir, substitui.`)) return;
    setFechando(true);
    try {
      const html2canvas = await carregarHtml2canvas();
      const el = alvoRef.current;
      const canvas = await html2canvas(el, {
        backgroundColor: "#0c1410", scale: Math.min(2, window.devicePixelRatio || 1.5), useCORS: true, logging: false,
        width: el.scrollWidth, height: el.scrollHeight, windowWidth: Math.max(document.documentElement.clientWidth, el.scrollWidth + 80),
        // na cópia: sem rolagem/corte, p/ a tabela sair inteira; esconde os botões
        onclone: (doc) => {
          const c = doc.querySelector("[data-spo-painel]");
          if (c) { c.style.overflow = "visible"; c.style.width = `${el.scrollWidth}px`; c.style.maxHeight = "none"; }
          doc.querySelectorAll("[data-spo-painel] [data-sem-foto]").forEach((b) => { b.style.visibility = "hidden"; });
          doc.querySelectorAll("[data-spo-painel] *").forEach((n) => { if (n.style && n.style.overflowX === "auto") n.style.overflowX = "visible"; });
        },
      });
      const imagem = canvas.toDataURL("image/png");
      await api.post("/api/spo/fechamentos", { trimestre: tri.id, rotulo: tri.rotulo, imagem, largura: canvas.width, altura: canvas.height }, { timeout: 60000 });
      alert(`✅ ${tri.rotulo} fechado — a foto do painel foi salva em "📸 Fechamentos".`);
    } catch (e) {
      alert("Não foi possível fechar: " + (e?.response?.data?.error || e?.message || "erro"));
    } finally { setFechando(false); }
  }

  async function abrirLista() {
    setLista([]); setVendo(null);
    try { const r = await api.get("/api/spo/fechamentos"); setLista(r.data || []); } catch { setLista([]); }
  }
  async function ver(t) {
    try { const r = await api.get(`/api/spo/fechamentos/${t}`, { timeout: 60000 }); setVendo(r.data); }
    catch (e) { alert(e?.response?.data?.error || "Erro ao abrir."); }
  }
  async function excluir(t) {
    if (!window.confirm(`Excluir o fechamento ${t}? A foto será apagada.`)) return;
    try { await api.delete(`/api/spo/fechamentos/${t}`); setVendo(null); abrirLista(); } catch { alert("Erro ao excluir."); }
  }
  const quando = (d) => (d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "");

  return (
    <>
      <span data-sem-foto style={{ display: "inline-flex", gap: 6 }}>
        <button style={S.btn} onClick={abrirLista} title="Trimestres fechados (fotos do painel)">📸 Fechamentos</button>
        {isAdmin && (
          <button style={{ ...S.btn, ...S.btnFechar }} onClick={fechar} disabled={fechando} title={`Salvar a foto do painel do ${tri.rotulo}`}>
            {fechando ? "⏳ Salvando…" : `🔒 Fechar ${tri.id.replace("-", " ")}`}
          </button>
        )}
      </span>

      {lista !== null && (
        <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && setLista(null)}>
          <div style={S.modal}>
            <div style={S.mHead}>
              <b>{vendo ? `📸 ${vendo.rotulo}` : "📸 Fechamentos do SPO"}</b>
              <span style={{ display: "flex", gap: 6 }}>
                {vendo && <a href={vendo.imagem} download={`SPO_${vendo.trimestre}.png`} style={S.btn}>⤓ Baixar PNG</a>}
                {vendo && <button style={S.btn} onClick={() => setVendo(null)}>← Lista</button>}
                <button style={S.btn} onClick={() => setLista(null)}>✕</button>
              </span>
            </div>
            {vendo ? (
              <div style={{ overflow: "auto", maxHeight: "calc(90vh - 70px)" }}>
                <p style={S.sub}>Fechado em {quando(vendo.fechado_em)}{vendo.fechado_por ? ` por ${vendo.fechado_por}` : ""}</p>
                <img src={vendo.imagem} alt={`Painel SPO ${vendo.rotulo}`} style={{ maxWidth: "100%", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)" }} />
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {!lista.length && <p style={S.sub}>Nenhum trimestre fechado ainda.{isAdmin ? ` Use "🔒 Fechar" no painel para salvar o ${tri.rotulo}.` : ""}</p>}
                {lista.map((f) => (
                  <div key={f.trimestre} style={S.item}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700 }}>{f.rotulo}</div>
                      <div style={S.sub}>fechado em {quando(f.fechado_em)}{f.fechado_por ? ` · ${f.fechado_por}` : ""}</div>
                    </div>
                    <button style={S.btn} onClick={() => ver(f.trimestre)}>Ver</button>
                    {isAdmin && <button style={{ ...S.btn, color: "#f87171" }} onClick={() => excluir(f.trimestre)}>Excluir</button>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

const S = {
  btn: { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 8, color: "#fff", padding: "5px 10px", cursor: "pointer", fontSize: "0.8rem", fontFamily: "inherit", textDecoration: "none", whiteSpace: "nowrap" },
  btnFechar: { color: "#f5c451", borderColor: "rgba(245,196,81,0.4)" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 },
  modal: { background: "#0f1a14", border: "1px solid rgba(125,186,61,0.3)", borderRadius: 14, padding: 16, width: "min(1100px, 100%)", maxHeight: "90vh", overflow: "hidden", color: "#fff" },
  mHead: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" },
  sub: { color: "rgba(255,255,255,0.5)", fontSize: "0.78rem", margin: "2px 0 8px" },
  item: { display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, background: "rgba(255,255,255,0.03)" },
};
