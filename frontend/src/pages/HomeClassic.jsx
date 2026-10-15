import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Sininho from "../components/Sininho";
import { modulosDoPerfil } from "../menu";

export default function HomeClassic() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  const perfil = usuario?.perfil;
  const modulos = modulosDoPerfil(perfil); // menu único (src/menu.js)

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <div>
          <p style={styles.greeting}>Bem-vindo,</p>
          <h2 style={styles.nome}>{usuario?.nome}</h2>
          <span style={styles.badge}>{usuario?.perfil?.toUpperCase()} · Setor {usuario?.cod}</span>
        </div>
        <div style={styles.headerRight}>
          <Sininho />
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
            style={{ ...styles.card, ...styles.cardAtivo }}
            onClick={() => navigate(item.route)}
          >
            <span style={styles.cardIcon}>{item.icon}</span>
            <span style={styles.cardLabel}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const isMobile = () => window.innerWidth <= 600;

const styles = {
  root: { minHeight: "100vh", background: "#0c1410", fontFamily: "'Poppins', 'Segoe UI', system-ui, sans-serif", padding: "clamp(16px,4vw,32px) clamp(16px,4vw,24px)", maxWidth: "900px", margin: "0 auto" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "clamp(20px,5vw,32px)", flexWrap: "wrap", gap: "12px" },
  headerRight: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" },
  greeting: { color: "rgba(255,255,255,0.4)", margin: "0 0 2px", fontSize: "0.85rem" },
  nome: { color: "#fff", margin: "0 0 6px", fontSize: "clamp(1.1rem,5vw,1.4rem)", fontWeight: "700" },
  badge: { background: "rgba(125,186,61,0.15)", color: "#7DBA3D", padding: "3px 10px", borderRadius: "20px", fontSize: "0.75rem", fontWeight: "600" },
  adminBtn: { background: "rgba(125,186,61,0.12)", border: "1px solid rgba(125,186,61,0.3)", color: "#7DBA3D", padding: "10px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem", fontFamily: "inherit", fontWeight: "600", minHeight: "44px" },
  logout: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", padding: "10px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem", fontFamily: "inherit", minHeight: "44px" },
  grid: { display: "flex", flexDirection: "column", gap: "10px" },
  card: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "16px 20px", display: "flex", flexDirection: "row", alignItems: "center", gap: "16px", transition: "all 0.2s", minHeight: "64px" },
  cardAtivo: { cursor: "pointer", borderColor: "rgba(125,186,61,0.3)" },
  cardInativo: { opacity: 0.5, cursor: "default" },
  cardIcon: { fontSize: "1.6rem", flexShrink: 0 },
  cardLabel: { color: "#fff", fontWeight: "600", fontSize: "1rem", flex: 1 },
  cardTag: { color: "rgba(255,255,255,0.3)", fontSize: "0.72rem", marginLeft: "auto" },
};
