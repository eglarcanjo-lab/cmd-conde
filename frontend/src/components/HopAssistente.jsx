// Hop — assistente flutuante. Botão (balão) em todas as telas; ao abrir,
// mostra insights automáticos dos dados do RN. Campo de chat já preparado
// (desabilitado) para ligar a IA quando houver chave de API.
import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api";

const COR = {
  alerta:   { bg: "rgba(239,68,68,0.12)",  br: "rgba(239,68,68,0.35)" },
  destaque: { bg: "rgba(125,186,61,0.12)", br: "rgba(125,186,61,0.4)" },
  info:     { bg: "rgba(255,255,255,0.05)", br: "rgba(255,255,255,0.1)" },
};

export default function HopAssistente() {
  const { usuario } = useAuth();
  const [aberto, setAberto] = useState(false);
  const [carregado, setCarregado] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dados, setDados] = useState({ saudacao: "", insights: [] });
  const [avatarOk, setAvatarOk] = useState(true);

  if (!usuario) return null;

  async function abrir() {
    setAberto(true);
    if (carregado) return;
    setLoading(true);
    try {
      const r = await api.get("/api/hop/insights");
      setDados(r.data || { saudacao: "", insights: [] });
    } catch {
      setDados({ saudacao: "Tive um probleminha pra puxar seus dados agora. Tenta de novo daqui a pouco! 💚", insights: [] });
    } finally {
      setLoading(false);
      setCarregado(true);
    }
  }

  const Avatar = ({ size }) => (
    avatarOk ? (
      <img src="/brand/hop-welcome.png" alt="Hop" onError={() => setAvatarOk(false)}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", objectPosition: "center top" }} />
    ) : (
      <div style={{ width: size, height: size, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, #8FCF4A, #2E7D32 75%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.5 }}>🌿</div>
    )
  );

  return (
    <>
      <style>{CSS}</style>

      {/* Balão flutuante */}
      {!aberto && (
        <button className="hop-fab" style={S.fab} onClick={abrir} aria-label="Falar com a Hop">
          <Avatar size={52} />
          <span style={S.fabPing} />
        </button>
      )}

      {/* Painel */}
      {aberto && (
        <>
          <div style={S.scrim} onClick={() => setAberto(false)} />
          <div className="hop-panel" style={S.panel}>
            {/* Header */}
            <div style={S.header}>
              <Avatar size={42} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={S.nome}>Hop <span style={S.online}>● online</span></div>
                <div style={S.cargo}>Sua assistente de resultados</div>
              </div>
              <button style={S.fechar} onClick={() => setAberto(false)} aria-label="Fechar">✕</button>
            </div>

            {/* Conversa */}
            <div style={S.body}>
              {loading ? (
                <div style={S.loading}><div className="hop-spin" /> Analisando seus dados…</div>
              ) : (
                <>
                  <div style={S.bolha}>{dados.saudacao}</div>
                  {dados.insights.map((ins, i) => {
                    const c = COR[ins.tipo] || COR.info;
                    return (
                      <div key={i} style={{ ...S.insight, background: c.bg, borderColor: c.br }}>
                        <span style={S.insIcone}>{ins.icone}</span>
                        <div>
                          <div style={S.insTitulo}>{ins.titulo}</div>
                          <div style={S.insTexto}>{ins.texto}</div>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>

            {/* Campo de chat — preparado para a IA (desabilitado por enquanto) */}
            <div style={S.footer}>
              <input style={S.input} placeholder="Em breve: pergunte qualquer coisa à Hop…" disabled />
              <button style={S.enviar} disabled title="Chat com IA em breve">▶</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

const S = {
  fab: { position: "fixed", bottom: "18px", right: "18px", width: "60px", height: "60px", borderRadius: "50%", border: "2px solid rgba(125,186,61,0.6)", background: "#0c1410", cursor: "pointer", padding: 0, zIndex: 1500, boxShadow: "0 8px 28px rgba(0,0,0,0.5), 0 0 0 4px rgba(125,186,61,0.12)", overflow: "visible", display: "flex", alignItems: "center", justifyContent: "center" },
  fabPing: { position: "absolute", top: "2px", right: "2px", width: "12px", height: "12px", borderRadius: "50%", background: "#7DBA3D", border: "2px solid #0c1410", boxShadow: "0 0 0 0 rgba(125,186,61,0.6)", animation: "hop-ping 1.8s infinite" },

  scrim: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1490, backdropFilter: "blur(2px)" },
  panel: { position: "fixed", bottom: "18px", right: "18px", width: "min(380px, calc(100vw - 24px))", maxHeight: "min(76vh, 640px)", background: "linear-gradient(180deg, #14241a, #0c1410)", border: "1px solid rgba(125,186,61,0.3)", borderRadius: "18px", zIndex: 1500, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 70px rgba(0,0,0,0.6)", fontFamily: "'Poppins', sans-serif" },

  header: { display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(125,186,61,0.06)" },
  nome: { color: "#fff", fontWeight: "800", fontSize: "1.05rem" },
  online: { color: "#7DBA3D", fontSize: "0.62rem", fontWeight: "600", marginLeft: "4px", verticalAlign: "middle" },
  cargo: { color: "rgba(255,255,255,0.5)", fontSize: "0.72rem" },
  fechar: { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.14)", color: "#fff", borderRadius: "50%", width: "30px", height: "30px", cursor: "pointer", flexShrink: 0 },

  body: { flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "10px" },
  loading: { color: "rgba(255,255,255,0.5)", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "10px", padding: "20px 4px" },
  bolha: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px 14px 14px 4px", padding: "12px 14px", color: "rgba(255,255,255,0.9)", fontSize: "0.88rem", lineHeight: 1.5 },
  insight: { display: "flex", gap: "10px", alignItems: "flex-start", border: "1px solid", borderRadius: "12px", padding: "11px 13px" },
  insIcone: { fontSize: "1.2rem", flexShrink: 0, lineHeight: 1.2 },
  insTitulo: { color: "#fff", fontWeight: "700", fontSize: "0.85rem", marginBottom: "2px" },
  insTexto: { color: "rgba(255,255,255,0.7)", fontSize: "0.82rem", lineHeight: 1.45 },

  footer: { display: "flex", gap: "8px", padding: "12px", borderTop: "1px solid rgba(255,255,255,0.08)" },
  input: { flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px", color: "#fff", padding: "10px 12px", fontSize: "0.82rem", fontFamily: "inherit", outline: "none", opacity: 0.6 },
  enviar: { background: "rgba(125,186,61,0.2)", border: "1px solid rgba(125,186,61,0.4)", color: "#7DBA3D", borderRadius: "10px", width: "42px", cursor: "not-allowed", fontSize: "0.9rem" },
};

const CSS = `
.hop-fab { transition: transform 0.15s; animation: hop-float 3s ease-in-out infinite; }
.hop-fab:hover { transform: scale(1.08); }
.hop-panel { animation: hop-up 0.28s cubic-bezier(0.2,0.9,0.3,1.2); }
.hop-spin { width: 16px; height: 16px; border: 2px solid rgba(125,186,61,0.2); border-top-color: #7DBA3D; border-radius: 50%; animation: hop-rot 0.8s linear infinite; }
@keyframes hop-rot { to { transform: rotate(360deg); } }
@keyframes hop-up { from { transform: translateY(24px) scale(0.96); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
@keyframes hop-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
@keyframes hop-ping { 0% { box-shadow: 0 0 0 0 rgba(125,186,61,0.5); } 70% { box-shadow: 0 0 0 8px rgba(125,186,61,0); } 100% { box-shadow: 0 0 0 0 rgba(125,186,61,0); } }
@media (max-width: 520px) {
  .hop-panel { left: 12px !important; right: 12px !important; bottom: 12px !important; width: auto !important; max-height: 80vh !important; }
}
`;
