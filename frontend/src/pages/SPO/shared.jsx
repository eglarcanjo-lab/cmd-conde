// SPO — constantes, helpers visuais e estilos compartilhados entre a tela e os blocos de KPI.
import { SPO_KPIS } from "../../config/spoKpis";

export const META_GV = 36;

// Trimestre vigente do SPO. TROCA DE TRI: atualizar MESES_TRI (+ KPIs em config/spoKpis.js)
// DEPOIS de fechar o tri anterior em "🔒 Fechar" (a foto usa o painel do tri vigente).
export const MESES_TRI = ["2026-10","2026-11","2026-12"]; // 4º tri/2026
// Início da avaliação por KPI: por padrão o 1º mês do tri (dá p/ ajustar por KPI em
// Admin › Metas SPO, coluna "Início apont.", que vale só para o tri vigente).
export const INICIO_AVAL_KPI = Object.fromEntries(SPO_KPIS.map((k) => [k.n, MESES_TRI[0]]));

// Lista de KPIs vem do registro único (config/spoKpis.js) — fonte de verdade
// compartilhada com o Painel SPO e o admin de Metas.
export const SPO_ITEMS = SPO_KPIS.filter((k) => k.ativo).sort((a, b) => (a.ord ?? 999) - (b.ord ?? 999)); // ativos, na ordem oficial (ord)

export const TOTAL_PTS = SPO_ITEMS.reduce((s, i) => s + i.pts, 0); // 180

// Bloco de KPI na tela: KPI selecionado → mostra; panorama geral (nenhum selecionado) → só
// os KPIs ATIVOS do tri (antes os inativos também apareciam no panorama).
const _ATIVOS = new Set(SPO_ITEMS.map((k) => k.n));
export const mostra = (kpiAtivo, n) => kpiAtivo === n || (kpiAtivo === null && _ATIVOS.has(n));

// Estilos da seção Rotina+ (detalhada)
export const rmCard = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "12px 16px", textAlign: "center", minWidth: "108px" };
export const rmBig = (c) => ({ fontSize: "1.5rem", fontWeight: "800", color: c });
export const rmLbl = { fontSize: "0.68rem", color: "rgba(255,255,255,0.45)", marginTop: "2px" };
export const rmTh = { padding: "7px 8px", color: "rgba(255,255,255,0.45)", fontSize: "0.68rem", fontWeight: "600", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.1)", whiteSpace: "nowrap" };
export const rmTd = { padding: "6px 8px", color: "rgba(255,255,255,0.8)", fontSize: "0.78rem", textAlign: "center", whiteSpace: "nowrap" };

export function BarraProgresso({ pct, cor }) {
  const w = Math.min(pct, 100);
  const c = pct >= 100 ? "#4ade80" : pct >= 70 ? "#7DBA3D" : "#f87171";

  return (
    <div style={{ height: "8px", background: "rgba(255,255,255,0.08)", borderRadius: "4px", overflow: "hidden", marginTop: "6px" }}>
      <div style={{ height: "100%", width: `${w}%`, background: cor || c, borderRadius: "4px", transition: "width 0.4s" }} />
    </div>
  );
}

// Barra de progresso com uma LINHA marcando a meta. A escala é absoluta
// (máx = maior entre realizado e meta): o preenchimento é o realizado e a
// linha branca fica na posição da meta. Verde quando realizado ≥ meta.
export function BarraMeta({ real, meta }) {
  const r = Number(real) || 0;
  const m = Number(meta) || 0;
  const escala = Math.max(r, m, 1);
  const fill = Math.min((r / escala) * 100, 100);
  const metaPos = m > 0 ? Math.min((m / escala) * 100, 100) : null;
  const cor = m > 0 ? (r >= m ? "#4ade80" : r >= m * 0.7 ? "#7DBA3D" : "#f87171") : "#7DBA3D";
  return (
    <div style={{ position: "relative", height: "12px", minWidth: "80px" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.08)", borderRadius: "6px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${fill}%`, background: cor, transition: "width 0.4s" }} />
      </div>
      {metaPos !== null && (
        <div title={`Meta: ${m}`} style={{ position: "absolute", top: "-3px", bottom: "-3px", left: `calc(${metaPos}% - 1px)`, width: "2px", background: "#fff", borderRadius: "1px", boxShadow: "0 0 2px rgba(0,0,0,0.6)" }} />
      )}
    </div>
  );
}

export const styles = {
  root: { minHeight: "100vh", background: "#0c1410", fontFamily: "'Poppins', 'Segoe UI', system-ui, sans-serif", color: "#fff" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 32px", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", flexWrap: "wrap", gap: "12px" },
  headerLeft: { display: "flex", alignItems: "center", gap: "16px" },
  backBtn: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", padding: "8px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem", fontFamily: "inherit" },
  title: { margin: 0, fontSize: "1.3rem", fontWeight: "700" },
  subtitle: { margin: 0, fontSize: "0.8rem", color: "rgba(255,255,255,0.4)" },
  logoutBtn: { background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)", padding: "6px 12px", borderRadius: "8px", cursor: "pointer", fontSize: "0.82rem", fontFamily: "inherit" },
  content: { padding: "16px 0px", display: "flex", flexDirection: "column", gap: "16px" },
  msg: { color: "rgba(255,255,255,0.35)", textAlign: "center", padding: "40px" },
  scoreboard: { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "20px" },
  scoreboardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" },
  scoreboardTitle: { fontWeight: "700", fontSize: "1rem" },
  scoreboardSub: { color: "rgba(255,255,255,0.35)", fontSize: "0.8rem" },
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px" },
  kpiCard: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", padding: "10px 12px", display: "flex", flexDirection: "column", gap: "4px" },
  kpiCardAtivo: { border: "1px solid rgba(125,186,61,0.3)", background: "rgba(125,186,61,0.04)" },
  kpiN: { color: "rgba(255,255,255,0.3)", fontSize: "0.74rem" },
  kpiLabel: { color: "rgba(255,255,255,0.7)", fontSize: "0.84rem", lineHeight: "1.3" },
  kpiPts: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" },
  abas: { display: "flex", gap: "4px", borderBottom: "1px solid rgba(255,255,255,0.08)" },
  abaBtn: { background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", padding: "10px 20px", cursor: "pointer", fontSize: "0.9rem", fontFamily: "inherit", borderBottom: "2px solid transparent", marginBottom: "-1px" },
  abaBtnAtivo: { color: "#7DBA3D", borderBottom: "2px solid #7DBA3D" },
  section: { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "20px" },
  sectionTitle: { margin: "0 0 16px", fontSize: "1.02rem", fontWeight: "600" },
  opGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "12px", marginBottom: "12px" },
  opCard: { background: "rgba(255,255,255,0.04)", borderRadius: "10px", padding: "14px", display: "flex", flexDirection: "column", gap: "6px" },
  opLabel: { margin: 0, color: "rgba(255,255,255,0.45)", fontSize: "0.84rem" },
  opVal: { margin: 0, fontSize: "1.6rem", fontWeight: "800" },
  gvGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "14px" },
  gvCard: { background: "rgba(255,255,255,0.04)", borderRadius: "12px", padding: "18px", display: "flex", flexDirection: "column", gap: "8px" },
  gvHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  gvLabel: { fontWeight: "600", fontSize: "1rem" },
  gvFooter: { display: "flex", justifyContent: "space-between" },
  filtrosRow: { display: "flex", gap: "10px", marginBottom: "14px", flexWrap: "wrap", alignItems: "center" },
  inputFiltro: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff", padding: "7px 12px", fontSize: "0.85rem", fontFamily: "inherit", outline: "none" },
  countLabel: { color: "rgba(255,255,255,0.35)", fontSize: "0.82rem", marginLeft: "auto" },
  tableWrap: { overflowX: "auto", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.08)" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)", fontSize: "0.8rem", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.04em", padding: "9px 12px", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.08)" },
  tr: { borderBottom: "1px solid rgba(255,255,255,0.04)" },
  td: { padding: "8px 12px", color: "rgba(255,255,255,0.75)", fontSize: "0.9rem", textAlign: "center" },
  codBadge: { background: "rgba(125,186,61,0.12)", color: "#7DBA3D", padding: "2px 7px", borderRadius: "6px", fontSize: "0.75rem", fontWeight: "700" },
  statusTag: { padding: "2px 8px", borderRadius: "6px", fontSize: "0.75rem", fontWeight: "600", whiteSpace: "nowrap" },
};

