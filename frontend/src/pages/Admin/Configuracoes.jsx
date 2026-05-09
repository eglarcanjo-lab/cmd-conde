import { useState, useEffect } from "react";
import api from "../../services/api";

export default function Configuracoes() {
  const [config, setConfig] = useState({ maintenance_start: "05:00", maintenance_end: "06:00", admin_whatsapp: "", sheet_id: "" });
  const [loading, setLoading] = useState(true);
  const [sucesso, setSucesso] = useState("");

  useEffect(() => {
    api.get("/api/admin/config").then((r) => { setConfig(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: "rgba(255,255,255,0.4)", padding: "40px", textAlign: "center" }}>Carregando...</p>;

  return (
    <div style={styles.root}>
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>⏰ Janela de Manutenção</h3>
        <p style={styles.sectionDesc}>Horário em que o sistema fica offline para atualização de dados (horário de Brasília).</p>
        <div style={styles.row}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Início</label>
            <input type="time" style={styles.input} value={config.maintenance_start} onChange={(e) => setConfig((c) => ({ ...c, maintenance_start: e.target.value }))} />
          </div>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Fim</label>
            <input type="time" style={styles.input} value={config.maintenance_end} onChange={(e) => setConfig((c) => ({ ...c, maintenance_end: e.target.value }))} />
          </div>
        </div>
        <p style={styles.hint}>⚠️ Para alterar o horário de manutenção, atualize as variáveis MAINTENANCE_START e MAINTENANCE_END no Railway.</p>
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>📊 Google Sheets</h3>
        <p style={styles.sectionDesc}>ID da planilha conectada ao sistema.</p>
        <div style={styles.fieldGroup}>
          <label style={styles.label}>Sheet ID</label>
          <input style={{ ...styles.input, fontFamily: "monospace", fontSize: "0.82rem" }} value={config.sheet_id} readOnly />
        </div>
        <p style={styles.hint}>Para alterar, atualize a variável GOOGLE_SHEET_ID no Railway.</p>
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>📱 WhatsApp Admin</h3>
        <p style={styles.sectionDesc}>Número que recebe notificações de novos incidentes.</p>
        <div style={styles.fieldGroup}>
          <label style={styles.label}>Número</label>
          <input style={styles.input} value={config.admin_whatsapp} readOnly />
        </div>
        <p style={styles.hint}>Para alterar, atualize a variável ADMIN_WHATSAPP no Railway.</p>
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>ℹ️ Versão do Sistema</h3>
        <div style={styles.infoGrid}>
          {[
            { label: "Fase", value: "1 — Base + Admin" },
            { label: "Frontend", value: "React + Vite / Vercel" },
            { label: "Backend", value: "Node.js + Express / Railway" },
            { label: "Banco", value: "Google Sheets API" },
          ].map((item) => (
            <div key={item.label} style={styles.infoItem}>
              <span style={styles.infoLabel}>{item.label}</span>
              <span style={styles.infoValue}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles = {
  root: { display: "flex", flexDirection: "column", gap: "24px", maxWidth: "600px" },
  section: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "24px", display: "flex", flexDirection: "column", gap: "14px" },
  sectionTitle: { margin: 0, fontSize: "1rem", fontWeight: "700", color: "#fff" },
  sectionDesc: { margin: 0, fontSize: "0.85rem", color: "rgba(255,255,255,0.45)", lineHeight: "1.5" },
  row: { display: "flex", gap: "12px" },
  fieldGroup: { display: "flex", flexDirection: "column", gap: "6px", flex: 1 },
  label: { color: "rgba(255,255,255,0.5)", fontSize: "0.78rem", fontWeight: "500", textTransform: "uppercase", letterSpacing: "0.06em" },
  input: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff", padding: "10px 12px", fontSize: "0.9rem", fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" },
  hint: { margin: 0, fontSize: "0.78rem", color: "rgba(255,255,255,0.3)", lineHeight: "1.5" },
  infoGrid: { display: "flex", flexDirection: "column", gap: "10px" },
  infoItem: { display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" },
  infoLabel: { color: "rgba(255,255,255,0.4)", fontSize: "0.85rem" },
  infoValue: { color: "rgba(255,255,255,0.8)", fontSize: "0.85rem", fontWeight: "500" },
};
