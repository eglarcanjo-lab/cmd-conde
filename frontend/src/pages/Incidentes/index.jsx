import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";

const STATUS_CONFIG = {
  "Aguardando": { bg: "rgba(125,186,61,0.15)",  color: "#7DBA3D" },
  "Respondido": { bg: "rgba(34,197,94,0.15)",  color: "#4ade80" },
};

export default function Incidentes() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const [aba, setAba] = useState("novo");
  const [meus, setMeus] = useState([]);
  const [loading, setLoading] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState("");
  const [erro, setErro] = useState("");

  // Form
  const [dataOcorrido, setDataOcorrido] = useState("");
  const [descricao, setDescricao] = useState("");
  const [arquivo, setArquivo] = useState(null);
  const [preview, setPreview] = useState(null);

  useEffect(() => { if (aba === "historico") carregarMeus(); }, [aba]);

  async function carregarMeus() {
    setLoading(true);
    try {
      const res = await api.get("/api/incidentes/meus");
      setMeus(res.data || []);
    } catch { }
    finally { setLoading(false); }
  }

  function selecionarArquivo(file) {
    if (!file) return;
    setArquivo(file);
    const url = URL.createObjectURL(file);
    setPreview({ url, tipo: file.type.startsWith("video") ? "video" : "imagem" });
  }

  async function enviar() {
    setErro("");
    if (!descricao.trim()) { setErro("Descreva a ocorrência."); return; }
    if (!arquivo) { setErro("Anexe uma evidência (imagem ou vídeo)."); return; }

    setEnviando(true);
    try {
      const form = new FormData();
      form.append("descricao", descricao);
      form.append("data_ocorrido", dataOcorrido || new Date().toISOString().split("T")[0]);
      form.append("evidencia", arquivo);

      await api.post("/api/incidentes", form, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 60000,
      });

      setSucesso("Solicitação enviada com sucesso!");
      setDescricao(""); setDataOcorrido(""); setArquivo(null); setPreview(null);
      setTimeout(() => setSucesso(""), 4000);
    } catch (err) {
      setErro(err.response?.data?.error || "Erro ao enviar. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <button style={styles.backBtn} onClick={() => navigate("/")}>← Voltar</button>
          <div>
            <h1 style={styles.title}>🚨 Incidentes</h1>
            <p style={styles.subtitle}>{usuario?.nome} · Setor {usuario?.cod}</p>
          </div>
        </div>
        <button style={styles.logoutBtn} onClick={logout}>Sair</button>
      </div>

      <div style={styles.content}>
        {/* Abas */}
        <div style={styles.abas}>
          <button style={{ ...styles.abaBtn, ...(aba === "novo" ? styles.abaBtnAtivo : {}) }} onClick={() => setAba("novo")}>
            📝 Nova Solicitação
          </button>
          <button style={{ ...styles.abaBtn, ...(aba === "historico" ? styles.abaBtnAtivo : {}) }} onClick={() => setAba("historico")}>
            📋 Minhas Solicitações
          </button>
        </div>

        {/* Nova solicitação */}
        {aba === "novo" && (
          <div style={styles.formCard}>
            <h3 style={styles.formTitle}>Registrar Ocorrência</h3>

            <div style={styles.field}>
              <label style={styles.label}>Data do ocorrido</label>
              <input
                type="date"
                style={styles.input}
                value={dataOcorrido}
                onChange={(e) => setDataOcorrido(e.target.value)}
              />
              <span style={styles.hint}>Se não preenchido, será usada a data de hoje.</span>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Descrição da ocorrência *</label>
              <textarea
                style={styles.textarea}
                placeholder="Descreva o que aconteceu, qual PDV está relacionado, o que você precisa..."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={5}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Evidência * (imagem ou vídeo)</label>
              <label style={styles.uploadLabel}>
                <input
                  type="file"
                  accept="image/*,video/*"
                  style={{ display: "none" }}
                  onChange={(e) => selecionarArquivo(e.target.files[0])}
                />
                <div style={{ ...styles.uploadArea, ...(arquivo ? styles.uploadAreaAtivo : {}) }}>
                  {arquivo ? (
                    <>
                      <span style={{ fontSize: "1.5rem" }}>{preview?.tipo === "video" ? "🎥" : "🖼️"}</span>
                      <span style={styles.uploadNome}>{arquivo.name}</span>
                      <span style={styles.uploadTam}>{(arquivo.size / 1024).toFixed(0)} KB</span>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: "1.5rem" }}>📎</span>
                      <span style={styles.uploadNome}>Clique para anexar evidência</span>
                      <span style={styles.uploadTam}>Imagem ou vídeo</span>
                    </>
                  )}
                </div>
              </label>

              {/* Preview */}
              {preview && preview.tipo === "imagem" && (
                <img src={preview.url} alt="preview" style={styles.previewImg} />
              )}
              {preview && preview.tipo === "video" && (
                <video src={preview.url} controls style={styles.previewImg} />
              )}
            </div>

            {erro && <p style={styles.erro}>{erro}</p>}
            {sucesso && <p style={styles.sucesso}>{sucesso}</p>}

            <button
              style={{ ...styles.btnEnviar, opacity: enviando ? 0.7 : 1 }}
              onClick={enviar}
              disabled={enviando}
            >
              {enviando ? "Enviando..." : "📤 Enviar Solicitação"}
            </button>
          </div>
        )}

        {/* Histórico */}
        {aba === "historico" && (
          <div>
            {loading ? (
              <p style={styles.msg}>Carregando...</p>
            ) : meus.length === 0 ? (
              <p style={styles.msg}>Nenhuma solicitação encontrada.</p>
            ) : (
              <div style={styles.lista}>
                {meus.map((inc) => {
                  const stConf = STATUS_CONFIG[inc.status] || STATUS_CONFIG["Aguardando"];
                  return (
                    <div key={inc.id} style={styles.incCard}>
                      <div style={styles.incHeader}>
                        <div style={styles.incHeaderLeft}>
                          <span style={{ ...styles.statusTag, background: stConf.bg, color: stConf.color }}>
                            {inc.status}
                          </span>
                          <span style={styles.incData}>📅 {inc.data_ocorrido || inc.criado_em}</span>
                        </div>
                        <span style={styles.incId}>#{inc.id}</span>
                      </div>

                      <p style={styles.incDesc}>{inc.descricao}</p>

                      {inc.evidencia_url && (
                        <a href={inc.evidencia_url} target="_blank" rel="noreferrer" style={styles.evidenciaLink}>
                          📎 Ver evidência
                        </a>
                      )}

                      {inc.resposta && (
                        <div style={styles.respostaBox}>
                          <p style={styles.respostaLabel}>✅ Resposta:</p>
                          <p style={styles.respostaTexto}>{inc.resposta}</p>
                          <span style={styles.respostaData}>{inc.respondido_em}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  root: { minHeight: "100vh", background: "#0c1410", fontFamily: "'Poppins', 'Segoe UI', system-ui, sans-serif", color: "#fff" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "clamp(12px,3vw,20px) clamp(16px,4vw,32px)", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", flexWrap: "wrap", gap: "12px" },
  headerLeft: { display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" },
  backBtn: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", padding: "10px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem", fontFamily: "inherit", minHeight: "44px" },
  title: { margin: 0, fontSize: "clamp(1rem,5vw,1.3rem)", fontWeight: "700" },
  subtitle: { margin: 0, fontSize: "0.8rem", color: "rgba(255,255,255,0.4)" },
  logoutBtn: { background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)", padding: "10px 12px", borderRadius: "8px", cursor: "pointer", fontSize: "0.82rem", fontFamily: "inherit", minHeight: "44px" },
  content: { padding: "clamp(16px,4vw,24px) clamp(16px,4vw,32px)", maxWidth: "700px", margin: "0 auto" },
  abas: { display: "flex", gap: "4px", marginBottom: "24px", borderBottom: "1px solid rgba(255,255,255,0.08)", overflowX: "auto" },
  abaBtn: { background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", padding: "12px 20px", cursor: "pointer", fontSize: "0.9rem", fontFamily: "inherit", borderBottom: "2px solid transparent", marginBottom: "-1px", whiteSpace: "nowrap", minHeight: "44px" },
  abaBtnAtivo: { color: "#7DBA3D", borderBottom: "2px solid #7DBA3D" },
  formCard: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: "clamp(16px,4vw,28px)", display: "flex", flexDirection: "column", gap: "20px" },
  formTitle: { margin: 0, fontSize: "1rem", fontWeight: "600", color: "rgba(255,255,255,0.8)" },
  field: { display: "flex", flexDirection: "column", gap: "8px" },
  label: { color: "rgba(255,255,255,0.5)", fontSize: "0.78rem", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em" },
  hint: { color: "rgba(255,255,255,0.25)", fontSize: "0.75rem" },
  input: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff", padding: "10px 12px", fontSize: "0.9rem", fontFamily: "inherit", outline: "none", maxWidth: "220px", width: "100%" },
  textarea: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff", padding: "12px", fontSize: "0.9rem", fontFamily: "inherit", outline: "none", resize: "vertical" },
  uploadLabel: { cursor: "pointer" },
  uploadArea: { border: "2px dashed rgba(255,255,255,0.12)", borderRadius: "10px", padding: "20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" },
  uploadAreaAtivo: { border: "2px dashed rgba(125,186,61,0.4)", background: "rgba(125,186,61,0.04)" },
  uploadNome: { color: "rgba(255,255,255,0.6)", fontSize: "0.85rem" },
  uploadTam: { color: "rgba(255,255,255,0.3)", fontSize: "0.75rem" },
  previewImg: { maxWidth: "100%", maxHeight: "240px", borderRadius: "8px", objectFit: "contain", marginTop: "8px" },
  btnEnviar: { background: "linear-gradient(135deg, #7DBA3D, #2E7D32)", color: "#0c1410", border: "none", borderRadius: "10px", padding: "14px", fontSize: "0.95rem", fontWeight: "700", cursor: "pointer", fontFamily: "inherit" },
  erro: { color: "#f87171", fontSize: "0.85rem", margin: 0, textAlign: "center" },
  sucesso: { color: "#4ade80", fontSize: "0.85rem", margin: 0, textAlign: "center" },
  msg: { color: "rgba(255,255,255,0.35)", textAlign: "center", padding: "40px" },
  lista: { display: "flex", flexDirection: "column", gap: "12px" },
  incCard: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "18px", display: "flex", flexDirection: "column", gap: "10px" },
  incHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  incHeaderLeft: { display: "flex", alignItems: "center", gap: "10px" },
  statusTag: { padding: "3px 10px", borderRadius: "20px", fontSize: "0.75rem", fontWeight: "600" },
  incData: { color: "rgba(255,255,255,0.4)", fontSize: "0.78rem" },
  incId: { color: "rgba(255,255,255,0.2)", fontSize: "0.75rem" },
  incDesc: { margin: 0, color: "rgba(255,255,255,0.75)", fontSize: "0.88rem", lineHeight: "1.5" },
  evidenciaLink: { color: "#7DBA3D", fontSize: "0.82rem", textDecoration: "none" },
  respostaBox: { background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: "8px", padding: "12px", display: "flex", flexDirection: "column", gap: "4px" },
  respostaLabel: { margin: 0, color: "#4ade80", fontSize: "0.78rem", fontWeight: "600" },
  respostaTexto: { margin: 0, color: "rgba(255,255,255,0.75)", fontSize: "0.88rem", lineHeight: "1.5" },
  respostaData: { color: "rgba(255,255,255,0.3)", fontSize: "0.72rem" },
};
