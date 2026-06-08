// Botão "?" sutil em todas as telas — abre os avisos gerais + os daquela tela.
import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import api from "../services/api";

const COR = {
  info:     { bg: "rgba(255,255,255,0.05)", br: "rgba(255,255,255,0.12)", ic: "ℹ️" },
  alerta:   { bg: "rgba(239,68,68,0.12)",   br: "rgba(239,68,68,0.35)",   ic: "⚠️" },
  destaque: { bg: "rgba(125,186,61,0.12)",  br: "rgba(125,186,61,0.4)",   ic: "💡" },
};

export default function BotaoAjuda() {
  const location = useLocation();
  const [avisos, setAvisos] = useState([]);
  const [aberto, setAberto] = useState(false);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    let vivo = true;
    setCarregado(false);
    api.get("/api/avisos", { params: { tela: location.pathname } })
      .then((r) => { if (vivo) { setAvisos(r.data || []); setCarregado(true); } })
      .catch(() => { if (vivo) { setAvisos([]); setCarregado(true); } });
    return () => { vivo = false; };
  }, [location.pathname]);

  const temAviso = avisos.length > 0;

  return (
    <>
      <style>{CSS}</style>
      {!aberto && (
        <button className="aj-fab" style={S.fab} onClick={() => setAberto(true)} aria-label="Ajuda e avisos" title="Ajuda e avisos">
          ?
          {temAviso && <span style={S.dot} />}
        </button>
      )}

      {aberto && (
        <>
          <div style={S.scrim} onClick={() => setAberto(false)} />
          <div className="aj-panel" style={S.panel}>
            <div style={S.header}>
              <div style={S.titulo}>❔ Ajuda & Avisos</div>
              <button style={S.fechar} onClick={() => setAberto(false)} aria-label="Fechar">✕</button>
            </div>
            <div style={S.body}>
              {!carregado ? (
                <div style={S.vazio}>Carregando…</div>
              ) : avisos.length === 0 ? (
                <div style={S.vazio}>Nenhum aviso para esta tela no momento. 💚<br /><span style={S.vazioSub}>Quando houver novidades ou orientações, elas aparecem aqui.</span></div>
              ) : (
                avisos.map((a) => {
                  const c = COR[a.tipo] || COR.info;
                  return (
                    <div key={a.id} style={{ ...S.aviso, background: c.bg, borderColor: c.br }}>
                      <span style={S.avIcone}>{c.ic}</span>
                      <div style={{ minWidth: 0 }}>
                        {a.titulo && <div style={S.avTitulo}>{a.titulo}</div>}
                        <div style={S.avMsg}>{a.mensagem}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

const S = {
  fab: { position: "fixed", bottom: "18px", right: "18px", width: "38px", height: "38px", borderRadius: "50%", border: "1px solid rgba(255,255,255,0.15)", background: "rgba(12,20,16,0.7)", color: "rgba(255,255,255,0.55)", cursor: "pointer", padding: 0, zIndex: 1400, fontSize: "1.05rem", fontWeight: "700", backdropFilter: "blur(6px)", boxShadow: "0 4px 14px rgba(0,0,0,0.3)" },
  dot: { position: "absolute", top: "-2px", right: "-2px", width: "10px", height: "10px", borderRadius: "50%", background: "#7DBA3D", border: "2px solid #0c1410" },

  scrim: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1490, backdropFilter: "blur(2px)" },
  panel: { position: "fixed", bottom: "18px", right: "18px", width: "min(360px, calc(100vw - 24px))", maxHeight: "min(70vh, 560px)", background: "linear-gradient(180deg,#14241a,#0c1410)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "16px", zIndex: 1500, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 70px rgba(0,0,0,0.6)", fontFamily: "'Poppins', sans-serif" },
  header: { display: "flex", alignItems: "center", padding: "13px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)" },
  titulo: { color: "#fff", fontWeight: "700", fontSize: "0.95rem", flex: 1 },
  fechar: { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.14)", color: "#fff", borderRadius: "50%", width: "28px", height: "28px", cursor: "pointer", flexShrink: 0 },
  body: { flex: 1, overflowY: "auto", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" },
  vazio: { color: "rgba(255,255,255,0.6)", fontSize: "0.86rem", padding: "16px 6px", lineHeight: 1.5, textAlign: "center" },
  vazioSub: { color: "rgba(255,255,255,0.35)", fontSize: "0.76rem" },
  aviso: { display: "flex", gap: "10px", alignItems: "flex-start", border: "1px solid", borderRadius: "12px", padding: "11px 13px" },
  avIcone: { fontSize: "1.05rem", flexShrink: 0, lineHeight: 1.3 },
  avTitulo: { color: "#fff", fontWeight: "700", fontSize: "0.86rem", marginBottom: "2px" },
  avMsg: { color: "rgba(255,255,255,0.78)", fontSize: "0.84rem", lineHeight: 1.5, whiteSpace: "pre-wrap" },
};

const CSS = `
.aj-fab { transition: all 0.15s; opacity: 0.65; }
.aj-fab:hover { opacity: 1; color: #fff; border-color: rgba(125,186,61,0.5); }
.aj-panel { animation: aj-up 0.25s ease; }
@keyframes aj-up { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
`;
