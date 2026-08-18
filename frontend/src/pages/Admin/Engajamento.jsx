import { useState, useEffect } from "react";
import api from "../../services/api";

function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const TELA_LABEL = {
  "/": "🏠 Início", "/volume-diario": "📈 Volume Diário", "/cobertura": "📊 Cobertura & Distribuição",
  "/pdvs": "🗺️ PDVs", "/tasks": "✅ Tasks", "/spo": "📊 SPO", "/rv": "💰 Remuneração",
  "/incidentes": "🚨 Incidentes", "/incentivos": "🏆 Incentivos", "/produtos": "📦 Produtos",
  "/detalhamento": "🌿 Devolução × Ruptura", "/admin": "⚙️ Admin", "/rv-relatorio": "📄 Relatório RV",
  "/rv-admin": "💰 RV Simulador",
};
const telaLabel = (t) => TELA_LABEL[t] || t;

export default function Engajamento() {
  const [mes, setMes] = useState(mesAtual());
  const [perfil, setPerfil] = useState("rn");
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let vivo = true;
    setLoading(true); setErro("");
    api.get("/api/uso/relatorio", { params: { mes, perfil } })
      .then((r) => vivo && setD(r.data))
      .catch(() => vivo && setErro("Erro ao carregar o relatório."))
      .finally(() => vivo && setLoading(false));
    return () => { vivo = false; };
  }, [mes, perfil]);

  return (
    <div>
      <div style={S.intro}>Quantas vezes cada usuário <b>abriu o app</b> no mês — para acompanhar usabilidade e engajamento. (Conta 1 por abertura/refresh; navegação interna não duplica.)</div>

      <div style={S.filtros}>
        <label style={S.fg}><span style={S.lbl}>Mês</span>
          <input type="month" style={S.input} value={mes} onChange={(e) => setMes(e.target.value)} />
        </label>
        <label style={S.fg}><span style={S.lbl}>Perfil</span>
          <select style={S.input} value={perfil} onChange={(e) => setPerfil(e.target.value)}>
            <option value="rn">Só RN</option>
            <option value="todos">Todos</option>
          </select>
        </label>
      </div>

      {loading && !d ? <p style={S.dim}>Carregando…</p> : erro ? <p style={S.erro}>{erro}</p> : d && (
        <>
          <div style={S.kpis}>
            <Kpi v={d.acessaram} l="Acessaram" cor="#7DBA3D" />
            <Kpi v={d.nao_acessaram} l="Não acessaram" cor="#ef6f6f" />
            <Kpi v={d.total_aberturas} l="Aberturas (total)" cor="#fff" />
            <Kpi v={d.media_por_usuario} l="Média por usuário" cor="#f5c451" />
          </div>

          {/* Telas mais usadas */}
          {d.por_tela && d.por_tela.length > 0 && (() => {
            const max = Math.max(1, ...d.por_tela.map((t) => t.visitas));
            return (
              <div style={{ marginBottom: "22px" }}>
                <h3 style={S.h3}>📍 Telas mais acessadas <span style={S.h3sub}>(onde focar a visibilidade)</span></h3>
                <div style={S.telaList}>
                  {d.por_tela.map((t) => (
                    <div key={t.tela} style={S.telaRow}>
                      <div style={S.telaNome}>{telaLabel(t.tela)}</div>
                      <div style={S.telaBarWrap}>
                        <div style={{ ...S.telaBar, width: `${(t.visitas / max) * 100}%` }} />
                      </div>
                      <div style={S.telaNum}>{t.visitas} <span style={S.telaUsers}>· {t.usuarios} usuários</span></div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          <h3 style={S.h3}>Por usuário</h3>
          <div style={S.tabelaWrap}>
            <table style={S.tabela}>
              <thead>
                <tr>{["Cód", "Nome", "Perfil", "Aberturas", "Dias ativos", "Último acesso"].map((h, i) => (
                  <th key={h} style={{ ...S.th, textAlign: i >= 3 && i <= 4 ? "right" : "left" }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {d.linhas.map((l, i) => (
                  <tr key={l.cod} style={{ ...(i % 2 ? S.trAlt : {}), ...(l.aberturas === 0 ? S.trZero : {}) }}>
                    <td style={S.td}>{l.cod}</td>
                    <td style={S.td}>{l.nome}</td>
                    <td style={S.td}>{l.perfil}</td>
                    <td style={{ ...S.td, textAlign: "right", fontWeight: "700", color: l.aberturas === 0 ? "#ef6f6f" : "#7DBA3D" }}>{l.aberturas}</td>
                    <td style={{ ...S.td, textAlign: "right" }}>{l.dias_ativos}</td>
                    <td style={{ ...S.td, color: "rgba(255,255,255,0.6)" }}>{l.ultimo_acesso || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {d.nao_acessaram > 0 && <p style={S.dim}>🔴 {d.nao_acessaram} usuário(s) não abriram o app neste mês.</p>}
        </>
      )}
    </div>
  );
}

const Kpi = ({ v, l, cor }) => (
  <div style={S.kpi}><div style={{ ...S.kpiV, color: cor }}>{v}</div><div style={S.kpiL}>{l}</div></div>
);

const S = {
  intro: { color: "rgba(255,255,255,0.6)", fontSize: "0.88rem", marginBottom: "16px", lineHeight: 1.5 },
  filtros: { display: "flex", gap: "12px", marginBottom: "18px", flexWrap: "wrap" },
  fg: { display: "flex", flexDirection: "column", gap: "5px" },
  lbl: { color: "rgba(255,255,255,0.5)", fontSize: "0.74rem", fontWeight: "600", textTransform: "uppercase" },
  input: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(125,186,61,0.3)", borderRadius: "8px", color: "#fff", padding: "9px 12px", fontSize: "0.88rem", fontFamily: "inherit", colorScheme: "dark", minWidth: "150px" },
  dim: { color: "rgba(255,255,255,0.45)", padding: "10px 0", fontSize: "0.85rem" },
  erro: { color: "#ef6f6f", padding: "12px" },
  kpis: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: "12px", marginBottom: "16px" },
  kpi: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "14px" },
  kpiV: { fontSize: "1.6rem", fontWeight: "800", lineHeight: 1.1 },
  kpiL: { color: "rgba(255,255,255,0.6)", fontSize: "0.76rem", marginTop: "4px" },
  tabelaWrap: { overflowX: "auto", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px" },
  tabela: { width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" },
  th: { padding: "10px 12px", color: "rgba(255,255,255,0.5)", fontWeight: "600", borderBottom: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)", whiteSpace: "nowrap" },
  td: { padding: "9px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.85)", whiteSpace: "nowrap" },
  trAlt: { background: "rgba(255,255,255,0.02)" },
  trZero: { background: "rgba(239,68,68,0.05)" },
  h3: { color: "#fff", fontSize: "0.95rem", fontWeight: "700", margin: "0 0 10px" },
  h3sub: { color: "rgba(255,255,255,0.4)", fontWeight: "400", fontSize: "0.78rem" },
  telaList: { display: "flex", flexDirection: "column", gap: "6px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "14px" },
  telaRow: { display: "flex", alignItems: "center", gap: "10px" },
  telaNome: { width: "190px", flexShrink: 0, color: "rgba(255,255,255,0.85)", fontSize: "0.84rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  telaBarWrap: { flex: 1, height: "10px", background: "rgba(255,255,255,0.06)", borderRadius: "5px", overflow: "hidden" },
  telaBar: { height: "100%", background: "linear-gradient(90deg,#7DBA3D,#2E7D32)", borderRadius: "5px", minWidth: "2px" },
  telaNum: { width: "130px", flexShrink: 0, textAlign: "right", color: "#7DBA3D", fontWeight: "700", fontSize: "0.84rem" },
  telaUsers: { color: "rgba(255,255,255,0.4)", fontWeight: "400", fontSize: "0.74rem" },
};
