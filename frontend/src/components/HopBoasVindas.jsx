// Boas-vindas da Hop — janela na Home, SÓ no celular e SÓ para RN, 1x por dia.
// A imagem da Hop vai em frontend/public/brand/hop-welcome.png
import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";

function hojeKey() {
  const d = new Date();
  return `hop_welcome_${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export default function HopBoasVindas() {
  const { usuario } = useAuth();
  const [show, setShow] = useState(false);
  const [temImg, setTemImg] = useState(true);

  useEffect(() => {
    if (!usuario) return;
    const ehRn = String(usuario.perfil || "").toLowerCase() === "rn";
    const ehMobile = window.innerWidth <= 768;
    let visto = false;
    try { visto = localStorage.getItem(hojeKey()) === "1"; } catch { /* ignore */ }
    if (ehRn && ehMobile && !visto) {
      const t = setTimeout(() => setShow(true), 600);
      return () => clearTimeout(t);
    }
  }, [usuario]);

  function fechar() {
    try { localStorage.setItem(hojeKey(), "1"); } catch { /* ignore */ }
    setShow(false);
  }

  if (!show) return null;
  const primeiroNome = (usuario?.nome || "").trim().split(" ")[0];

  return (
    <div style={S.overlay} onClick={fechar}>
      <style>{CSS}</style>
      <div className="hop-card" style={S.card} onClick={(e) => e.stopPropagation()}>
        <button style={S.close} onClick={fechar} aria-label="Fechar">✕</button>

        {temImg && (
          <div style={S.imgWrap}>
            <img
              src="/brand/hop-welcome.png"
              alt="Hop — sua assistente"
              style={S.img}
              onError={() => setTemImg(false)}
            />
            <div style={S.imgFade} />
          </div>
        )}

        <div style={S.body}>
          <p style={S.ola}>Olá, {primeiroNome}! 👋</p>
          <h2 style={S.titulo}>
            Eu sou a <span style={{ color: "#7DBA3D" }}>Hop</span>
          </h2>
          <p style={S.txt}>
            Sua assistente de resultados. Vou te ajudar a acompanhar suas vendas,
            metas e performance aqui no <strong>Hop Follow-up</strong>. <span style={{ color: "#7DBA3D" }}>💚</span>
          </p>
          <button style={S.cta} onClick={fechar}>Vamos lá! →</button>
        </div>
      </div>
    </div>
  );
}

const S = {
  overlay: { position: "fixed", inset: 0, background: "rgba(4,10,6,0.82)", display: "flex", alignItems: "center", justifyContent: "center", padding: "18px", zIndex: 3000, backdropFilter: "blur(4px)" },
  card: { position: "relative", width: "100%", maxWidth: "360px", background: "linear-gradient(180deg, #14241a, #0c1410)", border: "1px solid rgba(125,186,61,0.35)", borderRadius: "20px", overflow: "hidden", boxShadow: "0 24px 70px rgba(0,0,0,0.6)" },
  close: { position: "absolute", top: "10px", right: "10px", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", borderRadius: "50%", width: "32px", height: "32px", cursor: "pointer", fontSize: "0.9rem", zIndex: 2 },
  imgWrap: { position: "relative", width: "100%", height: "230px", background: "radial-gradient(circle at 50% 30%, rgba(125,186,61,0.18), transparent 70%)" },
  img: { width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" },
  imgFade: { position: "absolute", left: 0, right: 0, bottom: 0, height: "70px", background: "linear-gradient(to bottom, transparent, #0c1410)" },
  body: { padding: "8px 24px 26px", textAlign: "center" },
  ola: { color: "rgba(255,255,255,0.6)", fontSize: "0.92rem", margin: "0 0 2px", fontWeight: "500" },
  titulo: { color: "#fff", fontSize: "1.5rem", fontWeight: "800", margin: "0 0 10px" },
  txt: { color: "rgba(255,255,255,0.7)", fontSize: "0.9rem", lineHeight: 1.55, margin: "0 0 20px" },
  cta: { background: "linear-gradient(135deg, #7DBA3D, #2E7D32)", color: "#0c1410", border: "none", borderRadius: "12px", padding: "13px 30px", fontWeight: "800", fontSize: "0.95rem", cursor: "pointer", fontFamily: "inherit", boxShadow: "0 8px 22px rgba(125,186,61,0.3)" },
};

const CSS = `
.hop-card { animation: hop-pop 0.35s cubic-bezier(0.2,0.9,0.3,1.3); }
@keyframes hop-pop { from { transform: scale(0.85) translateY(20px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
`;
