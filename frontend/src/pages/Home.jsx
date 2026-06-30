import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Sininho from "../components/Sininho";
import HopBoasVindas from "../components/HopBoasVindas";
import ResumoVolumes from "../components/ResumoVolumes";
import ResumoFocoNE from "../components/ResumoFocoNE";
import ResumoVerdes from "../components/ResumoVerdes";
import { HOP_ATIVA } from "../theme";

export default function Home() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);

  const perfil = usuario?.perfil;
  const isAdminOuDirector = perfil === "admin" || perfil === "director";

  const modulos = [
    { icon: "🏆", label: "Incentivos",    route: "/incentivos" },
    { icon: "📈", label: "Volume Diário", route: "/volume-diario" },
    { icon: "📊", label: "Cobertura & Distribuição", route: "/cobertura" },
    { icon: "🗺️", label: "PDVs",          route: "/pdvs" },
    { icon: "📦", label: "Produtos",      route: "/produtos" },
    { icon: "✅", label: "Tasks",         route: "/tasks" },
    { icon: "💰", label: "Remuneração",   route: "/rv", soRn: true },
    { icon: "📊", label: "SPO",           route: "/spo" },
    { icon: "🚨", label: "Incidentes",    route: "/incidentes" },
    { icon: "🌿", label: "Detalhamento HOP", route: "/detalhamento" },
  ].filter((m) => !(isAdminOuDirector && m.soRn));

  const W = aberto ? 198 : 56;

  return (
    <div style={styles.root}>
      {HOP_ATIVA && <HopBoasVindas />}

      <aside style={{ ...styles.side, width: W }}>
        <button style={styles.toggle} onClick={() => setAberto((a) => !a)} aria-label={aberto ? "Recolher menu" : "Expandir menu"}>
          {aberto ? "✕" : "☰"}
        </button>
        <nav style={styles.nav}>
          <Item icon="🏠" label="Início" aberto={aberto} ativo />
          {modulos.map((m) => (
            <Item key={m.label} icon={m.icon} label={m.label} aberto={aberto} onClick={() => navigate(m.route)} />
          ))}
        </nav>
      </aside>

      <main style={styles.main}>
        <div style={styles.header}>
          <div>
            <p style={styles.greeting}>Bem-vindo,</p>
            <h2 style={styles.nome}>{usuario?.nome}</h2>
            <span style={styles.badge}>{usuario?.perfil?.toUpperCase()} · Setor {usuario?.cod}</span>
          </div>
          <div style={styles.headerRight}>
            <Sininho />
            {perfil === "admin" && <button style={styles.adminBtn} onClick={() => navigate("/admin")}>⚙️ Admin</button>}
            {perfil === "director" && <button style={styles.adminBtn} onClick={() => navigate("/rv-admin")}>💰 RV Simulador</button>}
            <button style={styles.logout} onClick={logout}>Sair</button>
          </div>
        </div>

        <ResumoVolumes />
        <ResumoFocoNE />
        <ResumoVerdes />
      </main>
    </div>
  );
}

function Item({ icon, label, aberto, ativo, onClick }) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{ ...styles.item, ...(ativo ? styles.itemAtivo : {}), cursor: onClick ? "pointer" : "default", justifyContent: aberto ? "flex-start" : "center" }}
    >
      <span style={styles.itemIcon}>{icon}</span>
      {aberto && <span style={styles.itemLabel}>{label}</span>}
    </button>
  );
}

const styles = {
  root: { minHeight: "100vh", background: "#0c1410", fontFamily: "'Poppins', 'Segoe UI', system-ui, sans-serif", display: "flex", alignItems: "flex-start" },
  side: { flexShrink: 0, alignSelf: "stretch", background: "rgba(255,255,255,0.02)", borderRight: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", padding: "10px 6px", gap: "4px", transition: "width 0.22s", position: "sticky", top: 0, height: "100vh", overflowY: "auto" },
  toggle: { background: "rgba(125,186,61,0.12)", border: "1px solid rgba(125,186,61,0.3)", color: "#7DBA3D", borderRadius: "10px", height: "40px", cursor: "pointer", fontSize: "1.05rem", fontFamily: "inherit", marginBottom: "6px", flexShrink: 0 },
  nav: { display: "flex", flexDirection: "column", gap: "3px" },
  item: { display: "flex", alignItems: "center", gap: "11px", width: "100%", minHeight: "44px", padding: "0 10px", background: "transparent", border: "none", borderRadius: "10px", color: "rgba(255,255,255,0.7)", fontFamily: "inherit", fontSize: "0.86rem", textAlign: "left", whiteSpace: "nowrap", overflow: "hidden" },
  itemAtivo: { background: "rgba(125,186,61,0.12)", color: "#7DBA3D" },
  itemIcon: { fontSize: "1.25rem", flexShrink: 0, width: "24px", textAlign: "center" },
  itemLabel: { overflow: "hidden", textOverflow: "ellipsis" },
  main: { flex: 1, minWidth: 0, padding: "clamp(16px,4vw,28px) clamp(14px,4vw,24px)", maxWidth: "880px" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "clamp(16px,4vw,24px)", flexWrap: "wrap", gap: "12px" },
  headerRight: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" },
  greeting: { color: "rgba(255,255,255,0.4)", margin: "0 0 2px", fontSize: "0.85rem" },
  nome: { color: "#fff", margin: "0 0 6px", fontSize: "clamp(1.1rem,5vw,1.4rem)", fontWeight: "700" },
  badge: { background: "rgba(125,186,61,0.15)", color: "#7DBA3D", padding: "3px 10px", borderRadius: "20px", fontSize: "0.75rem", fontWeight: "600" },
  adminBtn: { background: "rgba(125,186,61,0.12)", border: "1px solid rgba(125,186,61,0.3)", color: "#7DBA3D", padding: "10px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem", fontFamily: "inherit", fontWeight: "600", minHeight: "44px" },
  logout: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", padding: "10px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem", fontFamily: "inherit", minHeight: "44px" },
};
