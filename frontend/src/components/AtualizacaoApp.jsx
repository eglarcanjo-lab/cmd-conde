// Atualização do app sem fechar/reabrir:
// verifica nova versão a cada 60s (e ao voltar ao foco) e mostra um banner de 1 toque.
import { useEffect, useRef, useState } from "react";
import { registerSW } from "virtual:pwa-register";

const INTERVALO_CHECK = 60 * 1000; // 60s

export default function AtualizacaoApp() {
  const [precisaAtualizar, setPrecisaAtualizar] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const updateRef = useRef(null);   // função updateSW(reload)
  const regRef = useRef(null);      // ServiceWorkerRegistration

  useEffect(() => {
    let intervalo;
    try {
      const updateSW = registerSW({
        immediate: true,
        onNeedRefresh() { setPrecisaAtualizar(true); },
        onRegisteredSW(_swUrl, r) {
          regRef.current = r || null;
          if (r) {
            // checa periodicamente se há versão nova no servidor
            intervalo = setInterval(() => { r.update().catch(() => {}); }, INTERVALO_CHECK);
          }
        },
        onRegisterError() { /* silencioso */ },
      });
      updateRef.current = updateSW;
    } catch { /* PWA indisponível (ex: dev) */ }

    // ao voltar para o app (troca de aba/abrir do background), checa na hora
    const onVisibilidade = () => {
      if (document.visibilityState === "visible" && regRef.current) {
        regRef.current.update().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisibilidade);
    return () => {
      if (intervalo) clearInterval(intervalo);
      document.removeEventListener("visibilitychange", onVisibilidade);
    };
  }, []);

  function atualizar() {
    setAtualizando(true);
    if (updateRef.current) updateRef.current(true); // skipWaiting + reload
    else window.location.reload();
  }

  if (!precisaAtualizar) return null;

  return (
    <div style={S.banner} role="alert">
      <span style={S.txt}>
        <span style={S.dot} /> Nova versão disponível
      </span>
      <button style={S.btn} onClick={atualizar} disabled={atualizando}>
        {atualizando ? "Atualizando…" : "Atualizar agora"}
      </button>
    </div>
  );
}

const S = {
  banner: {
    position: "fixed", top: 0, left: 0, right: 0, zIndex: 5000,
    background: "linear-gradient(135deg,#7DBA3D,#2E7D32)", color: "#0c1410",
    display: "flex", alignItems: "center", justifyContent: "center", gap: "14px",
    padding: "10px 16px", fontFamily: "'Poppins', 'Segoe UI', system-ui, sans-serif",
    fontSize: "0.88rem", fontWeight: "700", boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
    animation: "att-slide 0.3s ease",
  },
  txt:  { display: "flex", alignItems: "center", gap: "8px" },
  dot:  { width: "8px", height: "8px", borderRadius: "50%", background: "#0c1410", display: "inline-block", animation: "att-pulse 1.2s infinite" },
  btn:  { background: "#0c1410", color: "#7DBA3D", border: "none", borderRadius: "8px", padding: "7px 16px", fontWeight: "700", fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit" },
};

// injeta as animações uma vez
if (typeof document !== "undefined" && !document.getElementById("att-anim")) {
  const st = document.createElement("style");
  st.id = "att-anim";
  st.textContent = `
    @keyframes att-slide { from { transform: translateY(-100%); } to { transform: translateY(0); } }
    @keyframes att-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
  `;
  document.head.appendChild(st);
}
