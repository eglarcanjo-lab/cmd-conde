// Popup diário — exibe artes cadastradas no admin, 1x por dia por popup
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api";

function hojeStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function jaVisto(id) {
  try { return localStorage.getItem(`popup_seen_${id}_${hojeStr()}`) === "1"; }
  catch { return false; }
}
function marcarVisto(id) {
  try { localStorage.setItem(`popup_seen_${id}_${hojeStr()}`, "1"); } catch { /* ignore */ }
}

export default function PopupDiario() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [fila, setFila] = useState([]);   // popups não vistos hoje
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!usuario) return;
    let cancelado = false;
    // pequeno atraso pra não competir com o carregamento inicial da home
    const t = setTimeout(() => {
      api.get("/api/popups/ativos")
        .then((r) => {
          if (cancelado) return;
          const naoVistos = (r.data || []).filter((p) => !jaVisto(p.id));
          setFila(naoVistos);
          setIdx(0);
        })
        .catch(() => {});
    }, 800);
    return () => { cancelado = true; clearTimeout(t); };
  }, [usuario]);

  const popup = fila[idx];
  if (!popup) return null;

  function fechar() {
    marcarVisto(popup.id);
    if (idx + 1 < fila.length) setIdx(idx + 1);
    else setFila([]);
  }

  function aoClicar() {
    const tipo = popup.acao_tipo;
    const valor = popup.acao_valor;
    marcarVisto(popup.id);
    if (tipo === "rota" && valor) {
      setFila([]);
      navigate(valor);
    } else if (tipo === "link" && valor) {
      window.open(valor, "_blank", "noopener");
      fechar();
    } else {
      fechar();
    }
  }

  const clicavel = (popup.acao_tipo === "rota" || popup.acao_tipo === "link") && popup.acao_valor;

  return (
    <div style={S.overlay} onClick={fechar}>
      <div style={S.box} onClick={(e) => e.stopPropagation()}>
        <button style={S.close} onClick={fechar} aria-label="Fechar">✕</button>
        <img
          src={popup.imagem_url}
          alt={popup.titulo || "Aviso"}
          style={{ ...S.img, cursor: clicavel ? "pointer" : "default" }}
          onClick={clicavel ? aoClicar : undefined}
        />
        {clicavel && (
          <button style={S.cta} onClick={aoClicar}>
            {popup.acao_tipo === "link" ? "Acessar →" : "Ver mais →"}
          </button>
        )}
      </div>
    </div>
  );
}

const S = {
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", zIndex: 2000, backdropFilter: "blur(4px)" },
  box:     { position: "relative", maxWidth: "440px", width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" },
  close:   { position: "absolute", top: "-14px", right: "-14px", background: "#0c1410", border: "2px solid rgba(255,255,255,0.2)", color: "#fff", borderRadius: "50%", width: "34px", height: "34px", cursor: "pointer", fontSize: "1rem", zIndex: 2, display: "flex", alignItems: "center", justifyContent: "center" },
  img:     { width: "100%", maxHeight: "78vh", objectFit: "contain", borderRadius: "14px", boxShadow: "0 16px 50px rgba(0,0,0,0.6)" },
  cta:     { background: "linear-gradient(135deg,#7DBA3D,#2E7D32)", color: "#0c1410", border: "none", borderRadius: "10px", padding: "12px 28px", fontWeight: "700", fontSize: "0.95rem", cursor: "pointer", fontFamily: "inherit" },
};
