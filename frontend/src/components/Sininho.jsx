import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api";

export default function Sininho() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [incidentes, setIncidentes] = useState(0);
  const [semCat, setSemCat] = useState(0);
  const [showTooltip, setShowTooltip] = useState(false);

  const isGestor = ["admin", "director", "gv1", "gv3"].includes(usuario?.perfil);

  useEffect(() => {
    if (!isGestor) return;
    buscar();
    const interval = setInterval(buscar, 60000);
    return () => clearInterval(interval);
  }, []);

  async function buscar() {
    try {
      const [resInc, resSem] = await Promise.all([
        api.get("/api/incidentes/pendentes"),
        api.get("/api/admin/produtos/sem-categoria"),
      ]);
      setIncidentes(resInc.data.pendentes || 0);
      setSemCat(Array.isArray(resSem.data) ? resSem.data.filter(p => !p.categoria).length : 0);
    } catch { }
  }

  if (!isGestor) return null;

  const total = incidentes + semCat;

  return (
    <div style={{ position: "relative" }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <button
        style={styles.btn}
        onClick={() => navigate("/admin?tab=incidentes")}
      >
        🔔
        {total > 0 && (
          <span style={styles.badge}>{total > 9 ? "9+" : total}</span>
        )}
      </button>

      {/* Tooltip */}
      {showTooltip && total > 0 && (
        <div style={styles.tooltip}>
          {incidentes > 0 && (
            <div style={styles.tooltipItem}>
              <span>🚨 {incidentes} incidente{incidentes > 1 ? "s" : ""} pendente{incidentes > 1 ? "s" : ""}</span>
            </div>
          )}
          {semCat > 0 && (
            <div style={styles.tooltipItem}>
              <span>⚠️ {semCat} produto{semCat > 1 ? "s" : ""} sem categoria</span>
            </div>
          )}
        </div>
      )}
    </div>
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
  tooltip: {
    position: "absolute",
    top: "calc(100% + 8px)",
    right: 0,
    background: "#1a2235",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "8px",
    padding: "8px 12px",
    minWidth: "220px",
    zIndex: 100,
    boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
  },
  tooltipItem: {
    color: "rgba(255,255,255,0.75)",
    fontSize: "0.82rem",
    padding: "3px 0",
  },
};
