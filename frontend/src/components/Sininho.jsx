import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api";

// Anomalia de Volume: avisa os PDVs (102/995/997 com venda) que o gestor AINDA NÃO VIU.
// "Visto" = chave setor|pdv|nº pedidos guardada ao abrir a aba (localStorage, por navegador);
// pedido novo do mesmo PDV muda a chave e o aviso volta.
export const ANOMALIA_VISTAS = "hop_anomalia_vistas";
export function anomaliasVistas() {
  try { return new Set(JSON.parse(localStorage.getItem(ANOMALIA_VISTAS) || "[]")); } catch { return new Set(); }
}

export default function Sininho() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [semCat, setSemCat] = useState(0);
  const [migracoes, setMigracoes] = useState(0);
  const [anomalias, setAnomalias] = useState(0);
  const [showTooltip, setShowTooltip] = useState(false);

  const isGestor = ["admin", "director", "gv1", "gv3"].includes(usuario?.perfil);

  useEffect(() => {
    if (!isGestor) return;
    buscar();
    const interval = setInterval(buscar, 60000);
    window.addEventListener("anomalia-vista", buscar); // abriu a aba → recalcula na hora
    return () => { clearInterval(interval); window.removeEventListener("anomalia-vista", buscar); };
  }, []);

  async function buscar() {
    try {
      const [resSem, resMig, resAn] = await Promise.all([
        api.get("/api/admin/produtos/sem-categoria", { params: { contagem: 1 } }).catch(() => ({ data: { pendentes: 0 } })),
        api.get("/api/solicitacoes/pendentes").catch(() => ({ data: { pendentes: 0 } })),
        api.get("/api/anomalia-volume/sininho").catch(() => ({ data: { chaves: [] } })),
      ]);
      const vistas = anomaliasVistas();
      setAnomalias((resAn.data?.chaves || []).filter((k) => !vistas.has(k)).length);
      setMigracoes(resMig.data.pendentes || 0);
      setSemCat(resSem.data?.pendentes || 0);
    } catch { }
  }

  if (!isGestor) return null;

  const total = semCat + migracoes + anomalias;

  return (
    <div style={{ position: "relative" }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <button
        style={styles.btn}
        onClick={() => navigate(anomalias > 0 && !semCat && !migracoes ? "/incentivos?aba=anomalia" : "/admin?tab=incidentes")}
      >
        🔔
        {total > 0 && (
          <span style={styles.badge}>{total > 9 ? "9+" : total}</span>
        )}
      </button>

      {/* Tooltip */}
      {showTooltip && total > 0 && (
        <div style={styles.tooltip}>
          {anomalias > 0 && (
            <div style={{ ...styles.tooltipItem, cursor: "pointer", color: "#f87171", fontWeight: 600 }} onClick={() => navigate("/incentivos?aba=anomalia")}>
              <span>🚨 {anomalias} PDV{anomalias > 1 ? "s" : ""} com anomalia de volume (102/995/997) →</span>
            </div>
          )}
          {migracoes > 0 && (
            <div style={styles.tooltipItem}>
              <span>🔀 {migracoes} migraç{migracoes > 1 ? "ões" : "ão"} de PDV p/ aprovar</span>
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
    fontFamily: "'Poppins', 'Segoe UI', system-ui, sans-serif",
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
