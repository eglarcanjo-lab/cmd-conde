import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api";

export default function Sininho() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [pendentes, setPendentes] = useState(0);

  const isGestor = ["admin", "director", "gv1", "gv3"].includes(usuario?.perfil);

  useEffect(() => {
    if (!isGestor) return;
    buscarPendentes();
    const interval = setInterval(buscarPendentes, 60000); // atualiza a cada 1 min
    return () => clearInterval(interval);
  }, []);

  async function buscarPendentes() {
    try {
      const res = await api.get("/api/incidentes/pendentes");
      setPendentes(res.data.pendentes || 0);
    } catch { }
  }

  if (!isGestor) return null;

  return (
    <button
      style={styles.btn}
      onClick={() => navigate("/admin?tab=incidentes")}
      title={`${pendentes} incidente(s) pendente(s)`}
    >
      🔔
      {pendentes > 0 && (
        <span style={styles.badge}>{pendentes > 9 ? "9+" : pendentes}</span>
      )}
    </button>
  );
}

const styles = {
  btn: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "8px",
    padding: "6px 10px",
    cursor: "pointer",
    fontSize: "1rem",
    position: "relative",
    lineHeight: 1,
  },
  badge: {
    position: "absolute",
    top: "-6px",
    right: "-6px",
    background: "#f87171",
    color: "#fff",
    fontSize: "0.65rem",
    fontWeight: "700",
    borderRadius: "10px",
    padding: "1px 5px",
    minWidth: "16px",
    textAlign: "center",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },
};
