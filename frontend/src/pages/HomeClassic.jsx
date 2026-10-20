import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Sininho from "../components/Sininho";
import PopupMktp from "../components/PopupMktp"; // incentivo Desafio Marketplace (abre quando o CORA atualiza)
import { modulosDoPerfil } from "../menu";
import { useMobile } from "../utils/mobile";
import { SeletorVerComo } from "../components/VerComo";

export default function HomeClassic() {
  const { usuario, logout, adminReal, verComo } = useAuth();
  const navigate = useNavigate();
  const mobile = useMobile();

  const perfil = usuario?.perfil;
  // No CELULAR o admin (fora da visão de setor) só usa Solicitações + "Ver como setor";
  // o resto do menu de admin é de computador. Vendo como setor, o menu é o do RN.
  const soAdminMobile = mobile && adminReal && !verComo;
  const modulos = soAdminMobile
    ? [{ icon: "🚨", label: "Solicitações", route: "/admin?tab=incidentes" }]
    : modulosDoPerfil(perfil); // menu único (src/menu.js)

  return (
    <div style={styles.root}>
      <PopupMktp />
      <div style={styles.header}>
        <div>
          <p style={styles.greeting}>Bem-vindo,</p>
          <h2 style={styles.nome}>{usuario?.nome}</h2>
          <span style={styles.badge}>{usuario?.perfil?.toUpperCase()} · Setor {usuario?.cod}</span>
        </div>
        <div style={styles.headerRight}>
          <Sininho />
          {usuario?.perfil === "admin" && !mobile && (
            <button style={styles.adminBtn} onClick={() => navigate("/admin")}>⚙️ Admin</button>
          )}
          <button style={styles.logout} onClick={logout}>Sair</button>
        </div>
      </div>

      {adminReal && <div style={{ marginBottom: 14 }}><SeletorVerComo /></div>}
      {soAdminMobile && <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.75rem", margin: "0 0 12px" }}>No celular: Solicitações e a visão de um setor. O restante do Admin fica no computador.</p>}

      <div style={mobile ? styles.gridMobile : styles.grid}>
        {modulos.map((item) => (
          <div
            key={item.label}
            style={mobile ? styles.cardMobile : { ...styles.card, ...styles.cardAtivo }}
            onClick={() => navigate(item.route)}
          >
            <span style={mobile ? styles.cardIconMobile : styles.cardIcon}>{item.icon}</span>
            <span style={mobile ? styles.cardLabelMobile : styles.cardLabel}>{item.label}</span>
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
  // Celular: cards das abas em grade de 2 colunas (ícone em cima, nome embaixo)
  gridMobile: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px" },
  cardMobile: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(125,186,61,0.25)", borderRadius: "14px", padding: "14px 12px", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "8px", cursor: "pointer", minHeight: "84px" },
  cardIconMobile: { fontSize: "1.4rem" },
  cardLabelMobile: { color: "#fff", fontWeight: "600", fontSize: "0.86rem", lineHeight: 1.25 },
  card: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "16px 20px", display: "flex", flexDirection: "row", alignItems: "center", gap: "16px", transition: "all 0.2s", minHeight: "64px" },
  cardAtivo: { cursor: "pointer", borderColor: "rgba(125,186,61,0.3)" },
  cardInativo: { opacity: 0.5, cursor: "default" },
  cardIcon: { fontSize: "1.6rem", flexShrink: 0 },
  cardLabel: { color: "#fff", fontWeight: "600", fontSize: "1rem", flex: 1 },
  cardTag: { color: "rgba(255,255,255,0.3)", fontSize: "0.72rem", marginLeft: "auto" },
};
