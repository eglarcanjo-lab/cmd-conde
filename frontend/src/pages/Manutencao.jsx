export default function Manutencao({ start, end }) {
  return (
    <div style={styles.root}>
      <div style={styles.card}>
        <div style={styles.icon}>⚙️</div>
        <h2 style={styles.title}>Atualizando dados</h2>
        <p style={styles.text}>
          O sistema está processando as informações do dia.<br />
          Retorne após as <strong>{end || "06:00"}</strong>.
        </p>
        <div style={styles.bar}>
          <div style={styles.barFill} />
        </div>
        <p style={styles.sub}>Janela de manutenção: {start || "05:00"} – {end || "06:00"}</p>
      </div>
    </div>
  );
}

const styles = {
  root: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#0c1410",
    fontFamily: "'Poppins', 'Segoe UI', system-ui, sans-serif",
  },
  card: {
    textAlign: "center",
    padding: "48px 36px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "20px",
    maxWidth: "380px",
  },
  icon: { fontSize: "2.5rem", marginBottom: "16px" },
  title: { color: "#fff", margin: "0 0 12px", fontSize: "1.4rem" },
  text: { color: "rgba(255,255,255,0.55)", lineHeight: "1.7", margin: "0 0 24px" },
  bar: {
    height: "4px",
    background: "rgba(255,255,255,0.1)",
    borderRadius: "2px",
    overflow: "hidden",
    marginBottom: "12px",
  },
  barFill: {
    height: "100%",
    width: "60%",
    background: "linear-gradient(90deg, #7DBA3D, #2E7D32)",
    borderRadius: "2px",
    animation: "pulse 2s ease-in-out infinite",
  },
  sub: { color: "rgba(255,255,255,0.25)", fontSize: "0.8rem", margin: 0 },
};
