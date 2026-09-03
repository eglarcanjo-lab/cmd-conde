import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Sininho from "../components/Sininho";
import HopBoasVindas from "../components/HopBoasVindas";
import ResumoVolumes from "../components/ResumoVolumes";
import ResumoFocoNE from "../components/ResumoFocoNE";
import ResumoVerdes from "../components/ResumoVerdes";
import ResumoRankings from "../components/ResumoRankings";
import { HOP_ATIVA } from "../theme";

// Sub-abas do Admin (deep-link /admin?tab=id) — espelha as TABS de pages/Admin/index.jsx
const ADMIN_TABS = [
  { id: "usuarios",      icon: "👥", label: "Usuários" },
  { id: "metas",         icon: "🎯", label: "Metas" },
  { id: "sku_foco",      icon: "📈", label: "SKU Foco" },
  { id: "arquivos",      icon: "📁", label: "Arquivos" },
  { id: "produtos",      icon: "📦", label: "Produtos" },
  { id: "ap",            icon: "🎯", label: "AT. Produtivo" },
  { id: "rv_simulador",  icon: "💰", label: "RV Simulador" },
  { id: "spo_desafios",  icon: "📋", label: "SPO Desafios" },
  { id: "spo_metas",     icon: "📊", label: "SPO Metas" },
  { id: "incentivos",    icon: "🏆", label: "Incentivos" },
  { id: "popups",        icon: "🖼️", label: "Popups" },
  { id: "avisos",        icon: "❔", label: "Avisos" },
  { id: "engajamento",   icon: "📊", label: "Engajamento" },
  { id: "incidentes",    icon: "🚨", label: "Solicitações" },
  { id: "alertas",       icon: "📧", label: "Alertas" },
  { id: "configuracoes", icon: "⚙️", label: "Configurações" },
];

// Home "dashboard" — só desktop + admin/director (ver Home.jsx). RN e mobile usam HomeClassic.
export default function HomeDashboard() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(true); // estilo Vercel: começa expandida
  const [grupos, setGrupos] = useState(() => new Set());

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
    { icon: "🧾", label: "Faturados × Buffer", route: "/faturados-buffer" },
    { icon: "🌿", label: "Devolução × Ruptura", route: "/detalhamento" },
    { icon: "🧊", label: "Equipamentos", route: "/refrigeradores" },
    { icon: "🏷️", label: "Ações de Preço", route: "/acoes-preco", soAdmin: true },
  ].filter((m) => !(isAdminOuDirector && m.soRn) && !(m.soAdmin && perfil !== "admin"));

  const toggleGrupo = (id) => {
    if (!aberto) { setAberto(true); setGrupos(new Set([id])); return; } // rail → expande e abre
    setGrupos((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const W = aberto ? 242 : 56;

  return (
    <div style={styles.root}>
      {/* hover só dá com CSS de verdade — classes locais da sidebar */}
      <style>{`
        .hd-item:hover { background: rgba(255,255,255,0.07) !important; color: #fff !important; }
        .hd-sub:hover  { background: rgba(255,255,255,0.07) !important; color: #fff !important; }
      `}</style>
      {HOP_ATIVA && <HopBoasVindas />}

      <aside style={{ ...styles.side, width: W }}>
        <button style={styles.toggle} onClick={() => setAberto((a) => !a)} aria-label={aberto ? "Recolher menu" : "Expandir menu"}>
          {aberto ? "◀" : "☰"}
        </button>

        <nav style={styles.nav}>
          <Item icon="🏠" label="Início" aberto={aberto} ativo />
          <div style={styles.sep} />

          {modulos.map((m) => (
            <Item key={m.label} icon={m.icon} label={m.label} aberto={aberto} onClick={() => navigate(m.route)} />
          ))}

          {isAdminOuDirector && <div style={styles.sep} />}

          {/* Grupo Admin (estilo Vercel: expande as sub-abas) */}
          {perfil === "admin" && (
            <Grupo
              icon="⚙️" label="Admin" aberto={aberto}
              expandido={grupos.has("admin")} onToggle={() => toggleGrupo("admin")}
            >
              {ADMIN_TABS.map((t) => (
                <SubItem key={t.id} icon={t.icon} label={t.label} onClick={() => navigate(`/admin?tab=${t.id}`)} />
              ))}
            </Grupo>
          )}
          {perfil === "director" && (
            <Item icon="💰" label="RV Simulador" aberto={aberto} onClick={() => navigate("/rv-admin")} />
          )}
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
        <ResumoRankings />
      </main>
    </div>
  );
}

function Item({ icon, label, aberto, ativo, onClick }) {
  return (
    <button
      className="hd-item"
      onClick={onClick}
      title={label}
      style={{ ...styles.item, ...(ativo ? styles.itemAtivo : {}), cursor: onClick ? "pointer" : "default", justifyContent: aberto ? "flex-start" : "center" }}
    >
      <span style={styles.itemIcon}>{icon}</span>
      {aberto && <span style={styles.itemLabel}>{label}</span>}
    </button>
  );
}

function Grupo({ icon, label, aberto, expandido, onToggle, children }) {
  return (
    <div>
      <button
        className="hd-item"
        onClick={onToggle}
        title={label}
        style={{ ...styles.item, cursor: "pointer", justifyContent: aberto ? "flex-start" : "center" }}
      >
        <span style={styles.itemIcon}>{icon}</span>
        {aberto && <span style={styles.itemLabel}>{label}</span>}
        {aberto && <span style={styles.chev}>{expandido ? "▾" : "▸"}</span>}
      </button>
      {aberto && expandido && <div style={styles.subWrap}>{children}</div>}
    </div>
  );
}

function SubItem({ icon, label, onClick }) {
  return (
    <button className="hd-sub" onClick={onClick} title={label} style={styles.subItem}>
      <span style={styles.subIcon}>{icon}</span>
      <span style={styles.itemLabel}>{label}</span>
    </button>
  );
}

const styles = {
  root: { minHeight: "100vh", background: "#0c1410", fontFamily: "'Poppins', 'Segoe UI', system-ui, sans-serif", display: "flex", alignItems: "flex-start" },
  side: { flexShrink: 0, alignSelf: "stretch", background: "rgba(255,255,255,0.02)", borderRight: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", padding: "10px 8px", gap: "4px", transition: "width 0.22s", position: "sticky", top: 0, height: "100vh", overflowY: "auto" },
  toggle: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.55)", borderRadius: "8px", height: "34px", cursor: "pointer", fontSize: "0.85rem", fontFamily: "inherit", marginBottom: "8px", flexShrink: 0 },
  nav: { display: "flex", flexDirection: "column", gap: "2px" },
  sep: { height: "1px", background: "rgba(255,255,255,0.08)", margin: "8px 4px" },
  item: { display: "flex", alignItems: "center", gap: "10px", width: "100%", minHeight: "38px", padding: "0 10px", background: "transparent", border: "none", borderRadius: "8px", color: "rgba(255,255,255,0.62)", fontFamily: "inherit", fontSize: "0.88rem", textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", transition: "background 0.12s, color 0.12s" },
  itemAtivo: { background: "rgba(125,186,61,0.12)", color: "#7DBA3D" },
  itemIcon: { fontSize: "1.05rem", flexShrink: 0, width: "22px", textAlign: "center" },
  itemLabel: { overflow: "hidden", textOverflow: "ellipsis" },
  chev: { marginLeft: "auto", color: "rgba(255,255,255,0.4)", fontSize: "0.75rem", flexShrink: 0 },
  subWrap: { display: "flex", flexDirection: "column", gap: "1px", margin: "2px 0 4px", borderLeft: "1px solid rgba(255,255,255,0.08)", marginLeft: "20px", paddingLeft: "6px" },
  subItem: { display: "flex", alignItems: "center", gap: "8px", width: "100%", minHeight: "32px", padding: "0 8px", background: "transparent", border: "none", borderRadius: "7px", color: "rgba(255,255,255,0.55)", fontFamily: "inherit", fontSize: "0.82rem", textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", cursor: "pointer", transition: "background 0.12s, color 0.12s" },
  subIcon: { fontSize: "0.85rem", flexShrink: 0, width: "18px", textAlign: "center" },
  main: { flex: 1, minWidth: 0, padding: "clamp(16px,3vw,26px) clamp(14px,3vw,28px)", maxWidth: "none" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "clamp(16px,4vw,24px)", flexWrap: "wrap", gap: "12px" },
  headerRight: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" },
  greeting: { color: "rgba(255,255,255,0.4)", margin: "0 0 2px", fontSize: "0.85rem" },
  nome: { color: "#fff", margin: "0 0 6px", fontSize: "clamp(1.1rem,5vw,1.4rem)", fontWeight: "700" },
  badge: { background: "rgba(125,186,61,0.15)", color: "#7DBA3D", padding: "3px 10px", borderRadius: "20px", fontSize: "0.75rem", fontWeight: "600" },
  adminBtn: { background: "rgba(125,186,61,0.12)", border: "1px solid rgba(125,186,61,0.3)", color: "#7DBA3D", padding: "10px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem", fontFamily: "inherit", fontWeight: "600", minHeight: "44px" },
  logout: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", padding: "10px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem", fontFamily: "inherit", minHeight: "44px" },
};
