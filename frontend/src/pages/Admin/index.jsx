import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import Usuarios from "./Usuarios";
import Metas from "./Metas";
import Arquivos from "./Arquivos";
import Configuracoes from "./Configuracoes";
import Incidentes from "./Incidentes";
// v2.8 - sku foco tab
import Produtos from "./Produtos";
import SkuFoco from "./SkuFoco";
import AtendimentoProdutivo from "./AtendimentoProdutivo";
import SpoDesafios from "./SpoDesafios";
import SpoMetas from "./SpoMetas";
import RvSimulador from "./RvSimulador";
import IncentivosAdmin from "./Incentivos";
import PopupsAdmin from "./Popups";

const TABS = [
  { id: "usuarios", label: "👥 Usuários" },
  { id: "metas", label: "🎯 Metas" },
  { id: "sku_foco", label: "📈 SKU Foco" },
  { id: "arquivos", label: "📁 Arquivos" },
  { id: "produtos", label: "📦 Produtos" },
  { id: "ap", label: "🎯 AT. Produtivo" },
  { id: "rv_simulador", label: "💰 RV Simulador" },
  { id: "spo_desafios", label: "📋 SPO Desafios" },
  { id: "spo_metas", label: "📊 SPO Metas" },
  { id: "incentivos", label: "🏆 Incentivos" },
  { id: "popups", label: "🖼️ Popups" },
  { id: "incidentes", label: "🚨 Solicitações" },
  { id: "configuracoes", label: "⚙️ Configurações" },
];

export default function Admin() {
  const searchParams = new URLSearchParams(window.location.search);
  const tabInicial = searchParams.get("tab") || "usuarios";
  const [tab, setTab] = useState(tabInicial);
  const [limpandoCache, setLimpandoCache] = useState(false);
  const [msgCache, setMsgCache] = useState("");
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  async function limparCache() {
    setLimpandoCache(true);
    setMsgCache("");
    try {
      await api.post("/api/admin/cache/limpar");
      setMsgCache("✅ Cache limpo! Dados frescos na próxima consulta.");
    } catch {
      setMsgCache("❌ Erro ao limpar cache.");
    } finally {
      setLimpandoCache(false);
      setTimeout(() => setMsgCache(""), 4000);
    }
  }

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <button style={styles.backBtn} onClick={() => navigate("/")}>← Voltar</button>
          <div>
            <h1 style={styles.title}>Painel Admin</h1>
            <p style={styles.subtitle}>CMD Ambev · Conde</p>
          </div>
        </div>
        <div style={styles.headerRight}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
            <button
              style={{ ...styles.cacheBtn, ...(limpandoCache ? styles.cacheBtnLoading : {}) }}
              onClick={limparCache}
              disabled={limpandoCache}
            >
              {limpandoCache ? "⏳ Limpando..." : "🔄 Forçar atualização"}
            </button>
            {msgCache && <span style={styles.msgCache}>{msgCache}</span>}
          </div>
          <span style={styles.badge}>{usuario?.nome}</span>
          <button style={styles.logoutBtn} onClick={logout}>Sair</button>
        </div>
      </div>

      <div style={styles.tabs}>
        {TABS.map((t) => (
          <button
            key={t.id}
            style={{ ...styles.tab, ...(tab === t.id ? styles.tabActive : {}) }}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={styles.content}>
        {tab === "usuarios" && <Usuarios />}
        {tab === "metas" && <Metas />}
        {tab === "arquivos" && <Arquivos />}
        {tab === "produtos" && <Produtos />}
        {tab === "ap" && <AtendimentoProdutivo />}
        {tab === "rv_simulador" && <RvSimulador />}
        {tab === "spo_desafios" && <SpoDesafios />}
        {tab === "spo_metas" && <SpoMetas />}
        {tab === "sku_foco" && <SkuFoco />}
        {tab === "incentivos" && <IncentivosAdmin />}
        {tab === "popups" && <PopupsAdmin />}
        {tab === "incidentes" && <Incidentes />}
        {tab === "configuracoes" && <Configuracoes />}
      </div>
    </div>
  );
}

const styles = {
  root: { minHeight: "100vh", background: "#0a0f1e", fontFamily: "'Segoe UI', system-ui, sans-serif", color: "#fff" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 32px", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" },
  headerLeft: { display: "flex", alignItems: "center", gap: "16px" },
  headerRight: { display: "flex", alignItems: "center", gap: "12px" },
  backBtn: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", padding: "8px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem", fontFamily: "inherit" },
  title: { margin: 0, fontSize: "1.3rem", fontWeight: "700" },
  subtitle: { margin: 0, fontSize: "0.8rem", color: "rgba(255,255,255,0.4)" },
  badge: { background: "rgba(251,185,0,0.15)", color: "#fbb900", padding: "4px 12px", borderRadius: "20px", fontSize: "0.8rem", fontWeight: "600" },
  logoutBtn: { background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)", padding: "6px 12px", borderRadius: "8px", cursor: "pointer", fontSize: "0.82rem", fontFamily: "inherit" },
  cacheBtn: { background: "rgba(251,185,0,0.12)", border: "1px solid rgba(251,185,0,0.3)", color: "#fbb900", padding: "7px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "0.82rem", fontFamily: "inherit", fontWeight: "600" },
  cacheBtnLoading: { opacity: 0.6, cursor: "not-allowed" },
  msgCache: { fontSize: "0.75rem", color: "rgba(255,255,255,0.6)" },
  tabs: { display: "flex", gap: "4px", padding: "16px 32px 0", borderBottom: "1px solid rgba(255,255,255,0.08)" },
  tab: { background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", padding: "10px 20px", cursor: "pointer", fontSize: "0.9rem", fontFamily: "inherit", borderBottom: "2px solid transparent", marginBottom: "-1px", transition: "all 0.2s" },
  tabActive: { color: "#fbb900", borderBottom: "2px solid #fbb900" },
  content: { padding: "32px", maxWidth: "1100px", margin: "0 auto" },
};
