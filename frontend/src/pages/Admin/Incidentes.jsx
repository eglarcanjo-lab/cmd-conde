import { useState, useEffect } from "react";
import api from "../../services/api";

const STATUS_CONFIG = {
  "Aguardando": { bg: "rgba(251,185,0,0.15)", color: "#fbb900" },
  "Respondido": { bg: "rgba(34,197,94,0.15)",  color: "#4ade80" },
};

export default function Incidentes() {
  const [incidentes, setIncidentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selecionado, setSelecionado] = useState(null);
  const [resposta, setResposta] = useState("");
  const [respondendo, setRespondendo] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState("Aguardando");
  const [sucesso, setSucesso] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setLoading(true);
    try {
      const res = await api.get("/api/incidentes");
      setIncidentes(res.data || []);
    } catch { }
    finally { setLoading(false); }
  }

  async function responder() {
    if (!resposta.trim()) { setErro("Digite uma resposta."); return; }
    setErro(""); setRespondendo(true);
    try {
      await api.post(`/api/incidentes/${selecionado.id}/responder`, { resposta });
      setSucesso("Resposta enviada!");
      setSelecionado(null);
      setResposta("");
      await carregar();
      setTimeout(() => setSucesso(""), 3000);
    } catch (err) {
      setErro(err.response?.data?.error || "Erro ao responder.");
    } finally {
      setRespondendo(false);
    }
  }

  const filtrados = incidentes.filter((i) => !filtroStatus || i.status === filtroStatus);
  const pendentes = incidentes.filter((i) => i.status === "Aguardando").length;

  return (
    <div>
      {/* Header com contador */}
      <div style={styles.toolbar}>
        <div style={styles.toolbarLeft}>
          <h3 style={styles.secTitle}>
            Solicitações
            {pendentes > 0 && <span style={styles.badge}>{pendentes} pendente{pendentes > 1 ? "s" : ""}</span>}
          </h3>
        </div>
        <select style={styles.select} value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
          <option value="">Todos</option>
          <option value="Aguardando">Aguardando</option>
          <option value="Respondido">Respondidos</option>
        </select>
      </div>

      {sucesso && <p style={styles.sucesso}>{sucesso}</p>}

      {loading ? (
        <p style={styles.msg}>Carregando...</p>
      ) : filtrados.length === 0 ? (
        <p style={styles.msg}>Nenhuma solicitação encontrada.</p>
      ) : (
        <div style={styles.lista}>
          {filtrados.map((inc) => {
            const stConf = STATUS_CONFIG[inc.status] || STATUS_CONFIG["Aguardando"];
            return (
              <div key={inc.id} style={styles.incCard} onClick={() => { setSelecionado(inc); setResposta(""); setErro(""); }}>
                <div style={styles.incHeader}>
                  <div style={styles.incHeaderLeft}>
                    <span style={{ ...styles.statusTag, background: stConf.bg, color: stConf.color }}>{inc.status}</span>
                    <span style={styles.incRn}>Setor {inc.setor} — {inc.nome_rn}</span>
                  </div>
                  <span style={styles.incData}>{inc.data_ocorrido || inc.criado_em}</span>
                </div>
                <p style={styles.incDesc}>{inc.descricao}</p>
                {inc.evidencia_url && (
                  <a href={inc.evidencia_url} target="_blank" rel="noreferrer" style={styles.evidenciaLink} onClick={(e) => e.stopPropagation()}>
                    📎 Ver evidência
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de resposta */}
      {selecionado && (
        <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && setSelecionado(null)}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.modalTitle}>Solicitação #{selecionado.id}</h3>
                <span style={styles.incRn}>Setor {selecionado.setor} — {selecionado.nome_rn}</span>
              </div>
              <button style={styles.closeBtn} onClick={() => setSelecionado(null)}>✕</button>
            </div>

            <div style={styles.modalBody}>
              <div style={styles.field}>
                <span style={styles.fieldLabel}>Data do ocorrido</span>
                <span style={styles.fieldVal}>{selecionado.data_ocorrido || selecionado.criado_em}</span>
              </div>

              <div style={styles.field}>
                <span style={styles.fieldLabel}>Descrição</span>
                <p style={styles.descricao}>{selecionado.descricao}</p>
              </div>

              {selecionado.evidencia_url && (
                <div style={styles.field}>
                  <span style={styles.fieldLabel}>Evidência</span>
                  {selecionado.evidencia_url.includes(".mp4") || selecionado.evidencia_url.includes("video") ? (
                    <video src={selecionado.evidencia_url} controls style={styles.evidenciaMedia} />
                  ) : (
                    <img src={selecionado.evidencia_url} alt="evidencia" style={styles.evidenciaMedia} />
                  )}
                </div>
              )}

              {selecionado.status === "Respondido" ? (
                <div style={styles.respostaBox}>
                  <p style={styles.respostaLabel}>✅ Sua resposta:</p>
                  <p style={styles.respostaTexto}>{selecionado.resposta}</p>
                </div>
              ) : (
                <div style={styles.field}>
                  <span style={styles.fieldLabel}>Resposta *</span>
                  <textarea
                    style={styles.textarea}
                    placeholder="Digite sua resposta para o RN..."
                    value={resposta}
                    onChange={(e) => setResposta(e.target.value)}
                    rows={4}
                  />
                  {erro && <p style={styles.erro}>{erro}</p>}
                  <button
                    style={{ ...styles.btnResponder, opacity: respondendo ? 0.7 : 1 }}
                    onClick={responder}
                    disabled={respondendo}
                  >
                    {respondendo ? "Enviando..." : "✅ Enviar Resposta"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  toolbar: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" },
  toolbarLeft: { display: "flex", alignItems: "center", gap: "12px" },
  secTitle: { margin: 0, fontSize: "1rem", fontWeight: "600", display: "flex", alignItems: "center", gap: "10px" },
  badge: { background: "rgba(251,185,0,0.2)", color: "#fbb900", padding: "2px 10px", borderRadius: "20px", fontSize: "0.75rem", fontWeight: "700" },
  select: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff", padding: "8px 12px", fontSize: "0.85rem", fontFamily: "inherit", outline: "none", cursor: "pointer" },
  msg: { color: "rgba(255,255,255,0.35)", textAlign: "center", padding: "40px" },
  sucesso: { color: "#4ade80", fontSize: "0.85rem", textAlign: "center", marginBottom: "12px" },
  lista: { display: "flex", flexDirection: "column", gap: "10px" },
  incCard: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "16px", cursor: "pointer", display: "flex", flexDirection: "column", gap: "8px", transition: "background 0.15s" },
  incHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  incHeaderLeft: { display: "flex", alignItems: "center", gap: "10px" },
  statusTag: { padding: "2px 10px", borderRadius: "20px", fontSize: "0.72rem", fontWeight: "600" },
  incRn: { color: "rgba(255,255,255,0.6)", fontSize: "0.82rem" },
  incData: { color: "rgba(255,255,255,0.35)", fontSize: "0.75rem" },
  incDesc: { margin: 0, color: "rgba(255,255,255,0.7)", fontSize: "0.85rem", lineHeight: "1.5", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" },
  evidenciaLink: { color: "#fbb900", fontSize: "0.8rem", textDecoration: "none" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" },
  modal: { background: "#111827", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", width: "100%", maxWidth: "580px", maxHeight: "90vh", overflow: "auto" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.08)" },
  modalTitle: { margin: "0 0 4px", fontSize: "1rem", fontWeight: "700" },
  closeBtn: { background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", fontSize: "1.2rem", cursor: "pointer" },
  modalBody: { padding: "20px 24px", display: "flex", flexDirection: "column", gap: "16px" },
  field: { display: "flex", flexDirection: "column", gap: "6px" },
  fieldLabel: { color: "rgba(255,255,255,0.4)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: "600" },
  fieldVal: { color: "#fff", fontSize: "0.9rem" },
  descricao: { margin: 0, color: "rgba(255,255,255,0.75)", fontSize: "0.9rem", lineHeight: "1.6", background: "rgba(255,255,255,0.04)", padding: "12px", borderRadius: "8px" },
  evidenciaMedia: { maxWidth: "100%", maxHeight: "280px", borderRadius: "8px", objectFit: "contain" },
  textarea: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff", padding: "12px", fontSize: "0.9rem", fontFamily: "inherit", outline: "none", resize: "vertical" },
  btnResponder: { background: "linear-gradient(135deg, #fbb900, #e6a200)", color: "#0a0f1e", border: "none", borderRadius: "10px", padding: "12px", fontSize: "0.9rem", fontWeight: "700", cursor: "pointer", fontFamily: "inherit" },
  respostaBox: { background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: "8px", padding: "14px", display: "flex", flexDirection: "column", gap: "6px" },
  respostaLabel: { margin: 0, color: "#4ade80", fontSize: "0.78rem", fontWeight: "600" },
  respostaTexto: { margin: 0, color: "rgba(255,255,255,0.75)", fontSize: "0.88rem", lineHeight: "1.5" },
  erro: { color: "#f87171", fontSize: "0.82rem", margin: 0 },
};
