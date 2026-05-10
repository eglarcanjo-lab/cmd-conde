import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Home() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  const modulos = [
    { icon: "📊", label: "Cobertura", route: "/cobertura", ativo: true },
    { icon: "🗺️", label: "PDVs", route: "/pdvs", ativo: true },
    { icon: "📦", label: "Produtos", route: "/produtos", ativo: false },
    { icon: "✅", label: "Tasks", route: "/tasks", ativo: false },
    { icon: "💰", label: "Remuneração", route: "/rv", ativo: false },
    { icon: "🚨", label: "Incidentes", route: "/incidentes", ativo: false },
  ];

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <div>
          <p style={styles.greeting}>Bem-vindo,</p>
          <h2 style={styles.nome}>{usuario?.nome}</h2>
          <span style={styles.badge}>{usuario?.perfil?.toUpperCase()} · Setor {usuario?.cod}</span>
        </div>
        <div style={styles.headerRight}>
          {usuario?.perfil === "admin" && (
            <button style={styles.adminBtn} onClick={() => navigate("/admin")}>⚙️ Admin</button>
          )}
          <button style={styles.logout} onClick={logout}>Sair</button>
        </div>
      </div>

      <div style={styles.grid}>
        {modulos.map((item) => (
          <div
            key={item.label}
            style={{ ...styles.card, ...(item.ativo ? styles.cardAtivo : styles.cardInativo) }}
            onClick={() => item.ativo && navigate(item.route)}
          >
            <span style={styles.cardIcon}>{item.icon}</span>
            <span style={styles.cardLabel}>{item.label}</span>
            {!item.ativo && <span style={styles.cardTag}>Em breve</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  root: { minHeight: "100vh", background: "#0a0f1e", fontFamily: "'Segoe UI', system-ui, sans-serif", padding: "32px 24px", maxWidth: "900px", margin: "0 auto" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "32px" },
  headerRight: { display: "flex", gap: "10px", alignItems: "center" },
  greeting: { color: "rgba(255,255,255,0.4)", margin: "0 0 2px", fontSize: "0.85rem" },
  nome: { color: "#fff", margin: "0 0 6px", fontSize: "1.4rem", fontWeight: "700" },
  badge: { background: "rgba(251,185,0,0.15)", color: "#fbb900", padding: "3px 10px", borderRadius: "20px", fontSize: "0.75rem", fontWeight: "600" },
  adminBtn: { background: "rgba(251,185,0,0.12)", border: "1px solid rgba(251,185,0,0.3)", color: "#fbb900", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem", fontFamily: "inherit", fontWeight: "600" },
  logout: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem", fontFamily: "inherit" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "16px" },
  card: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "24px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", transition: "all 0.2s" },
  cardAtivo: { cursor: "pointer", borderColor: "rgba(251,185,0,0.3)" },
  cardInativo: { opacity: 0.5, cursor: "default" },
  cardIcon: { fontSize: "1.8rem" },
  cardLabel: { color: "#fff", fontWeight: "600", fontSize: "0.9rem" },
  cardTag: { color: "rgba(255,255,255,0.3)", fontSize: "0.72rem" },
};
