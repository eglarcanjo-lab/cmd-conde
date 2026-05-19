import { useState, useEffect } from "react";
import api from "../../services/api";

const ARQUIVOS_CONFIG = [
  {
    id: "clientes",
    campo: "clientes",
    rotulo: "Base de Clientes",
    descricao: "0105070402 — PDVs ativos, visitas, crédito",
    extensoes: ".csv,.inf,.txt",
    periodicidade: "Diária",
    icon: "🏪",
  },
  {
    id: "pedidos",
    campo: "pedidos",
    rotulo: "Pedidos Faturados",
    descricao: "03014701 — Vendas, faltas, devoluções",
    extensoes: ".csv,.inf,.txt",
    periodicidade: "Diária",
    icon: "📦",
  },
  {
    id: "produtos_base",
    campo: "produtos_base",
    rotulo: "Base de Produtos",
    descricao: "0111 — Catálogo completo de produtos",
    extensoes: ".csv,.inf,.txt",
    periodicidade: "Semanal",
    icon: "🗂️",
  },
  {
    id: "tasks",
    campo: "tasks",
    rotulo: "Tasks (BI)",
    descricao: "Tasks do BI — VALID, INVALID, OPEN por PDV",
    extensoes: ".xlsx,.xls",
    periodicidade: "Diária",
    icon: "✅",
  },
{
    id: "spo_promo",
    campo: "spo_promo",
    rotulo: "SPO — Aba Promoção BEES",
    descricao: "Item 7 — % PDVs abrindo aba de Promoção no BEES",
    extensoes: ".xlsx,.xls",
    periodicidade: "2x semana",
    icon: "🏷️",
  },
  {
    id: "spo_dto",
    campo: "spo_dto",
    rotulo: "SPO — DTO GC",
    descricao: "Item 6 — Diagnóstico de Trabalho Operacional GC x GV",
    extensoes: ".xlsx,.xls",
    periodicidade: "2x semana",
    icon: "📝",
  },
  {
    id: "spo_coaching",
    campo: "spo_coaching",
    rotulo: "SPO — Rota Coaching",
    descricao: "Item 2 — Detalhamento de visitas de coaching por GV",
    extensoes: ".xlsx,.xls",
    periodicidade: "2x semana",
    icon: "🎯",
  },
  {
    id: "spo_visitacao_gv",
    campo: "spo_visitacao_gv",
    rotulo: "SPO — Visitação GV",
    descricao: "Item 1 — PDVs visitados pelo GV na base foco",
    extensoes: ".xlsx,.xls",
    periodicidade: "2x semana",
    icon: "🗺️",
  },
  {
    id: "pontos_bees",
    campo: "pontos_bees",
    rotulo: "Pontos Bees",
    descricao: "BI — Coins Total por setor",
    extensoes: ".xlsx,.xls",
    periodicidade: "Mensal",
    icon: "⭐",
  },
  {
    id: "spo_score5",
    campo: "spo_score5",
    rotulo: "SPO — Score 5 (ON_TRADE)",
    descricao: "Item 12 — Tasks Faturamento PDVs Score 5",
    extensoes: ".xlsx,.xls",
    periodicidade: "2x semana",
    icon: "⭐",
  },
  {
    id: "spo_alone",
    campo: "spo_alone",
    rotulo: "SPO — Pedido Alone",
    descricao: "Item 19 — PDVs com Compra Independente (Digitalização)",
    extensoes: ".xlsx,.xls",
    periodicidade: "2x semana",
    icon: "📱",
  },
  {
    id: "spo_cupons",
    campo: "spo_cupons",
    rotulo: "SPO — Cupons Digitais",
    descricao: "Item 21 — Cupons Digitais Score 5 (Planificador)",
    extensoes: ".xlsx,.xls",
    periodicidade: "2x semana",
    icon: "🎫",
  },
  {
    id: "spo_rgb",
    campo: "spo_rgb",
    rotulo: "SPO — +RGB",
    descricao: "Item 20 — PDVs Litrinho e Inteira Verde batendo meta",
    extensoes: ".xlsx,.xls",
    periodicidade: "2x semana",
    icon: "🍺",
  },
  {
    id: "inadimplencia",
    campo: "inadimplencia",
    rotulo: "Inadimplência",
    descricao: "120601 — Títulos vencidos por PDV",
    extensoes: ".csv,.inf,.txt",
    periodicidade: "Diária",
    icon: "⚠️",
  },
];

export default function Arquivos() {
  const [arquivos, setArquivos] = useState({});
  const [processando, setProcessando] = useState(false);
  const [status, setStatus] = useState([]);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState("");

  useEffect(() => { carregarStatus(); }, []);

  async function carregarStatus() {
    try {
      const res = await api.get("/api/arquivos/status");
      setStatus(res.data || []);
    } catch {
      // silencioso
    }
  }

  function selecionarArquivo(campo, file) {
    setArquivos((prev) => ({ ...prev, [campo]: file }));
  }

  async function processar() {
    const selecionados = Object.values(arquivos).filter(Boolean);

    if (selecionados.length === 0) {
      setErro("Selecione pelo menos um arquivo para processar.");
      return;
    }

    setErro("");
    setResultado(null);
    setProcessando(true);

    try {
      const form = new FormData();
      ARQUIVOS_CONFIG.forEach((cfg) => {
        if (arquivos[cfg.campo]) form.append(cfg.campo, arquivos[cfg.campo]);
      });

      const res = await api.post("/api/arquivos/processar", form, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 300000, // 5 minutos
      });

      setResultado(res.data.resultados);
      setArquivos({});
      await carregarStatus();
    } catch (err) {
      setErro(err.response?.data?.error || "Erro ao processar arquivos.");
    } finally {
      setProcessando(false);
    }
  }

  function getStatusArquivo(rotulo) {
    return status.find((s) => s.arquivo?.includes(rotulo.split(" ")[0]));
  }

  return (
    <div>
      <div style={styles.intro}>
        <h2 style={styles.introTitle}>📁 Atualização de Dados</h2>
        <p style={styles.introDesc}>
          Selecione os arquivos exportados do sistema e clique em Processar.
          Os dados serão atualizados automaticamente em todos os módulos.
        </p>
      </div>

      {/* Cards de upload */}
      <div style={styles.grid}>
        {ARQUIVOS_CONFIG.map((cfg) => {
          const st = getStatusArquivo(cfg.rotulo);
          const arquivoSelecionado = arquivos[cfg.campo];
          return (
            <div key={cfg.id} style={styles.card}>
              <div style={styles.cardHeader}>
                <span style={styles.cardIcon}>{cfg.icon}</span>
                <div>
                  <p style={styles.cardTitle}>{cfg.rotulo}</p>
                  <p style={styles.cardDesc}>{cfg.descricao}</p>
                </div>
              </div>

              {st && (
                <div style={styles.statusBox}>
                  <span style={{ fontSize: "0.8rem" }}>{st.status}</span>
                  <span style={styles.statusData}>{st.atualizado_em}</span>
                  {st.detalhes && <span style={styles.statusDetalhe}>{st.detalhes}</span>}
                </div>
              )}

              <label style={styles.uploadLabel}>
                <input
                  type="file"
                  accept={cfg.extensoes}
                  style={{ display: "none" }}
                  onChange={(e) => selecionarArquivo(cfg.campo, e.target.files[0])}
                />
                <div style={{ ...styles.uploadArea, ...(arquivoSelecionado ? styles.uploadAreaAtivo : {}) }}>
                  {arquivoSelecionado ? (
                    <>
                      <span style={styles.uploadIcon}>✅</span>
                      <span style={styles.uploadNome}>{arquivoSelecionado.name}</span>
                      <span style={styles.uploadTamanho}>
                        {(arquivoSelecionado.size / 1024).toFixed(0)} KB
                      </span>
                    </>
                  ) : (
                    <>
                      <span style={styles.uploadIcon}>📂</span>
                      <span style={styles.uploadNome}>Clique para selecionar</span>
                      <span style={styles.uploadTamanho}>{cfg.extensoes}</span>
                    </>
                  )}
                </div>
              </label>

              <div style={styles.cardFooter}>
                <span style={styles.periodicidade}>🔄 {cfg.periodicidade}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Botão processar */}
      <div style={styles.processarRow}>
        {erro && <p style={styles.erro}>{erro}</p>}
        <button
          style={{ ...styles.btnProcessar, opacity: processando ? 0.7 : 1 }}
          onClick={processar}
          disabled={processando}
        >
          {processando ? (
            <>⏳ Processando... (pode levar alguns minutos)</>
          ) : (
            <>⚡ Processar Arquivos</>
          )}
        </button>
      </div>

      {/* Resultado */}
      {resultado && (
        <div style={styles.resultado}>
          <h3 style={styles.resultadoTitle}>Resultado do Processamento</h3>
          {Object.entries(resultado).map(([k, v]) => (
            <div key={k} style={styles.resultadoItem}>
              <span style={styles.resultadoKey}>{k}</span>
              <span style={styles.resultadoVal}>{v}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tabela de status */}
      {status.length > 0 && (
        <div style={{ marginTop: "32px" }}>
          <h3 style={styles.secTitle}>Status de Atualização</h3>
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {["Arquivo", "Status", "Detalhes", "Última Atualização", "Periodicidade"].map((h) => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {status.map((s, i) => (
                  <tr key={i} style={styles.tr}>
                    <td style={styles.td}>{s.arquivo}</td>
                    <td style={styles.td}>{s.status}</td>
                    <td style={styles.td}>{s.detalhes}</td>
                    <td style={styles.td}>{s.atualizado_em}</td>
                    <td style={styles.td}>{s.periodicidade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  intro: { marginBottom: "28px" },
  introTitle: { margin: "0 0 8px", fontSize: "1.2rem", fontWeight: "700" },
  introDesc: { margin: 0, color: "rgba(255,255,255,0.5)", fontSize: "0.88rem", lineHeight: "1.6" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px", marginBottom: "24px" },
  card: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "20px", display: "flex", flexDirection: "column", gap: "14px" },
  cardHeader: { display: "flex", gap: "12px", alignItems: "flex-start" },
  cardIcon: { fontSize: "1.6rem" },
  cardTitle: { margin: "0 0 2px", fontWeight: "600", fontSize: "0.95rem" },
  cardDesc: { margin: 0, color: "rgba(255,255,255,0.4)", fontSize: "0.78rem" },
  statusBox: { background: "rgba(255,255,255,0.04)", borderRadius: "8px", padding: "10px 12px", display: "flex", flexDirection: "column", gap: "2px" },
  statusData: { color: "rgba(255,255,255,0.35)", fontSize: "0.75rem" },
  statusDetalhe: { color: "rgba(255,255,255,0.5)", fontSize: "0.78rem" },
  uploadLabel: { cursor: "pointer" },
  uploadArea: { border: "2px dashed rgba(255,255,255,0.12)", borderRadius: "10px", padding: "16px", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", transition: "all 0.2s" },
  uploadAreaAtivo: { border: "2px dashed rgba(251,185,0,0.4)", background: "rgba(251,185,0,0.05)" },
  uploadIcon: { fontSize: "1.4rem" },
  uploadNome: { color: "rgba(255,255,255,0.7)", fontSize: "0.85rem", textAlign: "center" },
  uploadTamanho: { color: "rgba(255,255,255,0.3)", fontSize: "0.75rem" },
  cardFooter: { display: "flex", justifyContent: "flex-end" },
  periodicidade: { color: "rgba(255,255,255,0.3)", fontSize: "0.75rem" },
  processarRow: { display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", marginBottom: "24px" },
  btnProcessar: { background: "linear-gradient(135deg, #fbb900, #e6a200)", color: "#0a0f1e", border: "none", borderRadius: "12px", padding: "14px 40px", fontSize: "1rem", fontWeight: "700", cursor: "pointer", fontFamily: "inherit" },
  erro: { color: "#f87171", fontSize: "0.85rem", margin: 0 },
  resultado: { background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: "12px", padding: "20px", marginBottom: "24px" },
  resultadoTitle: { margin: "0 0 14px", fontSize: "0.95rem", fontWeight: "600", color: "#4ade80" },
  resultadoItem: { display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" },
  resultadoKey: { color: "rgba(255,255,255,0.5)", fontSize: "0.85rem", textTransform: "capitalize" },
  resultadoVal: { color: "rgba(255,255,255,0.85)", fontSize: "0.85rem" },
  secTitle: { margin: "0 0 14px", fontSize: "1rem", fontWeight: "600" },
  tableWrap: { overflowX: "auto", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.08)" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)", fontSize: "0.75rem", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em", padding: "10px 14px", textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.08)" },
  tr: { borderBottom: "1px solid rgba(255,255,255,0.05)" },
  td: { padding: "10px 14px", color: "rgba(255,255,255,0.75)", fontSize: "0.85rem" },
};
