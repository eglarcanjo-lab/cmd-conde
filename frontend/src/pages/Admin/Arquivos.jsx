import { useState, useEffect, useRef } from "react";
import api from "../../services/api";

const ARQUIVOS_CONFIG = [
  // ── PROMAX ──────────────────────────────────────────────
  { id: "clientes",         campo: "clientes",         rotulo: "Base de Clientes",        numero: "0105070402", extensoes: ".csv,.inf,.txt", grupo: "promax", icon: "🏪" },
  { id: "pedidos",          campo: "pedidos",           rotulo: "Pedidos Faturados",        numero: "03014701",   extensoes: ".csv,.inf,.txt", grupo: "promax", icon: "📦" },
  { id: "produtos_base",    campo: "produtos_base",     rotulo: "Base de Produtos",         numero: "0111",       extensoes: ".csv,.inf,.txt", grupo: "promax", icon: "🗂️" },
  { id: "faturamento_mktp", campo: "faturamento_mktp",  rotulo: "Faturamento Marketplace",  numero: "030509",     extensoes: ".csv,.inf,.txt", grupo: "promax", icon: "🛒" },
  { id: "inadimplencia",    campo: "inadimplencia",     rotulo: "Inadimplência",            numero: "120601",     extensoes: ".csv,.inf,.txt", grupo: "promax", icon: "⚠️" },
  // ── SPO ─────────────────────────────────────────────────
  { id: "spo_visitacao_gv",  campo: "spo_visitacao_gv",  rotulo: "Visitação GV",          item: "1",  extensoes: ".xlsx,.xls", grupo: "spo", icon: "🗺️" },
  { id: "spo_coaching",      campo: "spo_coaching",      rotulo: "Rota Coaching",          item: "2",  extensoes: ".xlsx,.xls", grupo: "spo", icon: "🎯" },
  { id: "spo_dto",           campo: "spo_dto",           rotulo: "DTO GC",                 item: "6",  extensoes: ".xlsx,.xls", grupo: "spo", icon: "📝" },
  { id: "spo_promo",         campo: "spo_promo",         rotulo: "Aba Promoção BEES",      item: "7",  extensoes: ".xlsx,.xls", grupo: "spo", icon: "🏷️" },
  { id: "spo_score5",        campo: "spo_score5",        rotulo: "Score 5 (ON_TRADE)",     item: "12", extensoes: ".xlsx,.xls", grupo: "spo", icon: "⭐" },
  { id: "spo_alone",         campo: "spo_alone",         rotulo: "Pedido Alone",           item: "19", extensoes: ".xlsx,.xls", grupo: "spo", icon: "📱" },
  { id: "spo_rgb",           campo: "spo_rgb",           rotulo: "+RGB",                   item: "20", extensoes: ".xlsx,.xls", grupo: "spo", icon: "🍺" },
  { id: "spo_cupons",        campo: "spo_cupons",        rotulo: "Cupons Digitais",        item: "21", extensoes: ".xlsx,.xls", grupo: "spo", icon: "🎫" },
  { id: "spo_loja_ideal",    campo: "spo_loja_ideal",    rotulo: "Loja Ideal Vizinhança",  item: "22", extensoes: ".xlsx,.xls", grupo: "spo", icon: "🏪" },
  { id: "spo_scanntech",     campo: "spo_scanntech",     rotulo: "Expansão Scanntech",     item: "23", extensoes: ".xlsx,.xls", grupo: "spo", icon: "📡" },
  { id: "spo_portfolio_ideal",campo:"spo_portfolio_ideal",rotulo: "Portfólio Ideal Score 5",item:"24", extensoes: ".xlsx,.xls", grupo: "spo", icon: "🏆" },
  { id: "spo_ap",            campo: "spo_ap",            rotulo: "Atendimento Produtivo",  item: "5",  extensoes: ".xlsx,.xls", grupo: "spo", icon: "🎯" },
  // ── OUTROS ──────────────────────────────────────────────
  { id: "tasks",        campo: "tasks",        rotulo: "Tasks (BI)",          extensoes: ".xlsx,.xls",     grupo: "outros", icon: "✅" },
  { id: "pontos_bees",  campo: "pontos_bees",  rotulo: "Pontos Bees",         extensoes: ".xlsx,.xls",     grupo: "outros", icon: "⭐" },
];

const GRUPOS = [
  { id: "promax", label: "Promax",  desc: "Rotinas do sistema (número da rotina)" },
  { id: "spo",    label: "SPO",     desc: "Arquivos do painel SPO" },
  { id: "outros", label: "Outros",  desc: "BI e diversos" },
];

const hoje = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
const MESES_NOMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

// Default = mês ATUAL (caso comum: importar dados do mês corrente no dia a dia).
// Para fechar/reimportar um mês passado, é só trocar o seletor.
function mesAtualStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function mesPorExtenso(mesRef) {
  const [y, m] = (mesRef || "").split("-");
  const nome = MESES_NOMES[(parseInt(m, 10) || 1) - 1];
  return nome ? `${nome} ${y}` : mesRef;
}

export default function Arquivos() {
  const [arquivos, setArquivos] = useState({});
  const [processando, setProcessando] = useState(false);
  const [status, setStatus] = useState([]);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState("");
  // Mês de referência: garante que relatórios sem data sejam atribuídos ao mês correto
  const [mesRef, setMesRef] = useState(mesAtualStr());
  const inputRefs = useRef({});

  useEffect(() => { carregarStatus(); }, []);

  async function carregarStatus() {
    try {
      const res = await api.get("/api/arquivos/status");
      setStatus(res.data || []);
    } catch { /* silencioso */ }
  }

  function getStatus(campo) {
    return status.find(s => s.arquivo === campo || s.arquivo?.includes(campo));
  }

  function importadoHoje(campo) {
    const st = getStatus(campo);
    if (!st?.atualizado_em) return false;
    return st.atualizado_em.slice(0, 10) === hoje;
  }

  function selecionarArquivo(campo, file) {
    setArquivos(prev => ({ ...prev, [campo]: file }));
  }

  // monta um FormData novo a cada tentativa (File pode ser reenviado)
  function montarForm() {
    const form = new FormData();
    ARQUIVOS_CONFIG.forEach(cfg => { if (arquivos[cfg.campo]) form.append(cfg.campo, arquivos[cfg.campo]); });
    if (mesRef) form.append("mes_ref", mesRef); // mês para relatórios sem data própria
    return form;
  }

  // erro de cold start / conexão (processador acordando) — vale a pena re-tentar
  function ehColdStart(err) {
    return err.code === "ECONNABORTED" || (err.message || "").includes("Network") || (err.response?.status >= 502 && err.response?.status <= 504);
  }

  async function processar() {
    const selecionados = Object.values(arquivos).filter(Boolean);
    if (selecionados.length === 0) { setErro("Selecione pelo menos um arquivo."); return; }
    setErro(""); setResultado(null); setProcessando(true);

    const enviar = () => api.post("/api/arquivos/processar", montarForm(), {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 300000,
    });
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    try {
      let res;
      try {
        res = await enviar();
      } catch (err1) {
        if (!ehColdStart(err1)) throw err1;
        // processador estava dormindo — a 1ª tentativa o acordou. Espera e tenta de novo.
        setErro("⏳ Processador iniciando (pode levar ~1 min)… tentando novamente, aguarde.");
        await sleep(20000);
        try {
          res = await enviar();
        } catch (err2) {
          if (!ehColdStart(err2)) throw err2;
          await sleep(25000);
          res = await enviar(); // última tentativa
        }
      }
      setErro("");
      setResultado(res.data.resultados);
      setArquivos({});
      await carregarStatus();
    } catch (err) {
      const status = err.response?.status;
      let detalhe = err.response?.data?.error;
      if (!detalhe) {
        if (err.code === "ECONNABORTED") detalhe = "tempo esgotado. Tente de novo em ~30s.";
        else if ((err.message || "").includes("Network")) detalhe = "sem resposta do processador mesmo após tentativas. Pode estar fora do ar — tente novamente em 1-2 min.";
        else detalhe = err.message || "erro desconhecido";
      }
      setErro(`Erro ao processar${status ? ` [${status}]` : ""}: ${detalhe}`);
    } finally {
      setProcessando(false);
    }
  }

  const temSelecionado = Object.values(arquivos).some(Boolean);

  return (
    <div>
      <div style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: "1.1rem", fontWeight: "700" }}>📁 Importação de Arquivos</h2>
          <p style={{ margin: 0, color: "rgba(255,255,255,0.4)", fontSize: "0.82rem" }}>
            Clique em um card para selecionar o arquivo. Borda verde = importado hoje.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {/* Seletor de mês — define qual mês será atribuído aos relatórios sem data (Visitação, Score5, etc.) */}
          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
            <label style={{ color: "rgba(165,180,252,0.7)", fontSize: "0.62rem", fontWeight: "700", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Mês de Referência
            </label>
            <input
              type="month"
              value={mesRef}
              onChange={e => setMesRef(e.target.value)}
              title="Define o mês para relatórios que não têm data no arquivo (Visitação GV, Score5, etc.)"
              style={{ background: "rgba(46,125,50,0.12)", border: "1px solid rgba(46,125,50,0.35)", borderRadius: "8px", color: "#7DBA3D", padding: "6px 10px", fontSize: "0.85rem", fontFamily: "inherit", colorScheme: "dark", minHeight: "36px" }}
            />
          </div>
          <button
            style={{ background: temSelecionado ? "linear-gradient(135deg,#7DBA3D,#2E7D32)" : "rgba(255,255,255,0.07)", color: temSelecionado ? "#0c1410" : "rgba(255,255,255,0.35)", border: "none", borderRadius: "10px", padding: "10px 28px", fontSize: "0.9rem", fontWeight: "700", cursor: temSelecionado ? "pointer" : "not-allowed", fontFamily: "inherit", opacity: processando ? 0.7 : 1 }}
            onClick={processar}
            disabled={processando || !temSelecionado}
          >
            {processando ? "⏳ Processando..." : "⚡ Processar"}
          </button>
        </div>
      </div>

      {/* Banner do mês de destino — bem visível para evitar importar no mês errado */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "rgba(46,125,50,0.1)", border: "1px solid rgba(46,125,50,0.3)", borderRadius: "10px", padding: "10px 16px", marginBottom: "18px", flexWrap: "wrap" }}>
        <span style={{ fontSize: "1.1rem" }}>📅</span>
        <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.85rem" }}>
          Importando para o mês:
        </span>
        <span style={{ color: "#7DBA3D", fontWeight: "800", fontSize: "1rem", textTransform: "uppercase", letterSpacing: "0.03em" }}>
          {mesPorExtenso(mesRef)}
        </span>
        <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.76rem", marginLeft: "4px" }}>
          — confira antes de processar (afeta relatórios sem data própria)
        </span>
      </div>

      {erro && <p style={{ color: "#f87171", fontSize: "0.85rem", marginBottom: "16px" }}>{erro}</p>}

      {/* Colunas por grupo */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px", alignItems: "start" }}>
        {GRUPOS.map(grupo => (
          <div key={grupo.id}>
            <div style={{ marginBottom: "10px", paddingBottom: "8px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <p style={{ margin: 0, fontWeight: "700", fontSize: "1rem", color: "#7DBA3D" }}>{grupo.label}</p>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "rgba(255,255,255,0.4)" }}>{grupo.desc}</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {ARQUIVOS_CONFIG.filter(c => c.grupo === grupo.id).map(cfg => {
                const hoje_ok   = importadoHoje(cfg.campo);
                const selecionado = arquivos[cfg.campo];
                return (
                  <label key={cfg.id} style={{ cursor: "pointer", display: "block" }}>
                    <input
                      type="file"
                      accept={cfg.extensoes}
                      style={{ display: "none" }}
                      ref={el => inputRefs.current[cfg.campo] = el}
                      onChange={e => selecionarArquivo(cfg.campo, e.target.files[0])}
                    />
                    <div style={{
                      background: selecionado ? "rgba(125,186,61,0.07)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${selecionado ? "rgba(125,186,61,0.5)" : hoje_ok ? "rgba(74,222,128,0.45)" : "rgba(255,255,255,0.08)"}`,
                      borderRadius: "8px",
                      padding: "10px 12px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      transition: "all 0.15s",
                    }}>
                      {/* dot de status */}
                      <span style={{
                        width: "7px", height: "7px", borderRadius: "50%", flexShrink: 0,
                        background: selecionado ? "#7DBA3D" : hoje_ok ? "#4ade80" : "rgba(255,255,255,0.15)",
                      }} />
                      <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>{cfg.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: "0.88rem", fontWeight: "600", color: selecionado ? "#7DBA3D" : "rgba(255,255,255,0.85)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {cfg.numero ? <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.76rem", marginRight: "4px" }}>{cfg.numero}</span> : cfg.item ? <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.74rem", marginRight: "4px" }}>#{cfg.item}</span> : null}
                          {selecionado ? selecionado.name : cfg.rotulo}
                        </p>
                        {selecionado && (
                          <p style={{ margin: 0, fontSize: "0.68rem", color: "rgba(255,255,255,0.35)" }}>
                            {(selecionado.size / 1024).toFixed(0)} KB
                          </p>
                        )}
                      </div>
                      {selecionado && (
                        <span
                          style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.3)", cursor: "pointer", flexShrink: 0, padding: "2px 4px" }}
                          onClick={e => { e.preventDefault(); selecionarArquivo(cfg.campo, null); }}
                        >✕</span>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Resultado */}
      {resultado && (
        <div style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: "12px", padding: "18px", marginTop: "24px" }}>
          <h3 style={{ margin: "0 0 12px", fontSize: "0.9rem", fontWeight: "600", color: "#4ade80" }}>Resultado do Processamento</h3>
          {Object.entries(resultado).map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.82rem", textTransform: "capitalize" }}>{k}</span>
              <span style={{ color: "rgba(255,255,255,0.85)", fontSize: "0.82rem" }}>{v}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tabela de status */}
      {status.length > 0 && (
        <div style={{ marginTop: "28px" }}>
          <h3 style={{ margin: "0 0 12px", fontSize: "0.9rem", fontWeight: "600", color: "rgba(255,255,255,0.5)" }}>Histórico de importações</h3>
          <div style={{ overflowX: "auto", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.08)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Arquivo", "Status", "Detalhes", "Última Atualização"].map(h => (
                    <th key={h} style={{ background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.4)", fontSize: "0.72rem", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em", padding: "8px 12px", textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {status.map((s, i) => {
                  const isHoje = s.atualizado_em?.slice(0, 10) === hoje;
                  return (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <td style={{ padding: "7px 12px", color: "rgba(255,255,255,0.75)", fontSize: "0.82rem" }}>{s.arquivo}</td>
                      <td style={{ padding: "7px 12px", fontSize: "0.82rem" }}>
                        <span style={{ color: isHoje ? "#4ade80" : "rgba(255,255,255,0.4)", fontWeight: isHoje ? "600" : "400" }}>{s.status}</span>
                      </td>
                      <td style={{ padding: "7px 12px", color: "rgba(255,255,255,0.5)", fontSize: "0.78rem" }}>{s.detalhes}</td>
                      <td style={{ padding: "7px 12px", color: isHoje ? "#4ade80" : "rgba(255,255,255,0.4)", fontSize: "0.78rem" }}>{s.atualizado_em}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
