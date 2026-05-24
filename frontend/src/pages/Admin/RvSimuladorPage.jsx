import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import RvSimulador from "./RvSimulador";

export default function RvSimuladorPage() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <button style={styles.backBtn} onClick={() => navigate("/")}>← Voltar</button>
          <div>
            <h1 style={styles.title}>💰 RV Simulador</h1>
            <p style={styles.subtitle}>CMD Ambev · Conde</p>
          </div>
        </div>
        <div style={styles.headerRight}>
          <span style={styles.badge}>{usuario?.nome}</span>
          <button style={styles.logoutBtn} onClick={logout}>Sair</button>
        </div>
      </div>
      <div style={styles.content}>
        <RvSimulador />
      </div>
    </div>
  );
}

const styles = {
  root: { minHeight: "100vh", background: "#0a0f1e", fontFamily: "'Segoe UI', system-ui, sans-serif", color: "#fff" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 32px", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", flexWrap: "wrap", gap: "12px" },
  headerLeft: { display: "flex", alignItems: "center", gap: "16px" },
  headerRight: { display: "flex", alignItems: "center", gap: "12px" },
  backBtn: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", padding: "8px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem", fontFamily: "inherit" },
  title: { margin: 0, fontSize: "1.3rem", fontWeight: "700" },
  subtitle: { margin: 0, fontSize: "0.8rem", color: "rgba(255,255,255,0.4)" },
  badge: { background: "rgba(251,185,0,0.15)", color: "#fbb900", padding: "4px 12px", borderRadius: "20px", fontSize: "0.8rem", fontWeight: "600" },
  logoutBtn: { background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)", padding: "6px 12px", borderRadius: "8px", cursor: "pointer", fontSize: "0.82rem", fontFamily: "inherit" },
  content: { padding: "32px", maxWidth: "1100px", margin: "0 auto" },
};
