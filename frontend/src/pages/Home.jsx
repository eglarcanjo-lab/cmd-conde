import { useAuth } from "../contexts/AuthContext";

export default function Home() {
  const { usuario, logout } = useAuth();

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <div>
          <p style={styles.greeting}>Bem-vindo,</p>
          <h2 style={styles.nome}>{usuario?.nome}</h2>
          <span style={styles.badge}>{usuario?.perfil?.toUpperCase()} · Setor {usuario?.cod}</span>
        </div>
        <button style={styles.logout} onClick={logout}>Sair</button>
      </div>

      <div style={styles.grid}>
        {[
          { icon: "📊", label: "Cobertura", route: "/cobertura" },
          { icon: "🗺️", label: "PDVs", route: "/pdvs" },
          { icon: "📦", label: "Produtos", route: "/produtos" },
          { icon: "✅", label: "Tasks", route: "/tasks" },
          { icon: "💰", label: "Remuneração", route: "/rv" },
          { icon: "🚨", label: "Incidentes", route: "/incidentes" },
        ].map((item) => (
          <div key={item.label} style={styles.card}>
            <span style={styles.cardIcon}>{item.icon}</span>
            <span style={styles.cardLabel}>{item.label}</span>
            <span style={styles.cardTag}>Em breve</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  root: {
    minHeight: "100vh",
    background: "#0a0f1e",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    padding: "32px 24px",
    maxWidth: "900px",
    margin: "0 auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "32px",
  },
  greeting: { color: "rgba(255,255,255,0.4)", margin: "0 0 2px", fontSize: "0.85rem" },
  nome: { color: "#fff", margin: "0 0 6px", fontSize: "1.4rem", fontWeight: "700" },
  badge: {
    background: "rgba(251,185,0,0.15)",
    color: "#fbb900",
    padding: "3px 10px",
    borderRadius: "20px",
    fontSize: "0.75rem",
    fontWeight: "600",
  },
  logout: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "rgba(255,255,255,0.5)",
    padding: "8px 16px",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "0.85rem",
    fontFamily: "inherit",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
    gap: "16px",
  },
  card: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "14px",
    padding: "24px 16px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    cursor: "pointer",
    transition: "background 0.2s",
  },
  cardIcon: { fontSize: "1.8rem" },
  cardLabel: { color: "#fff", fontWeight: "600", fontSize: "0.9rem" },
  cardTag: { color: "rgba(255,255,255,0.3)", fontSize: "0.72rem" },
};
