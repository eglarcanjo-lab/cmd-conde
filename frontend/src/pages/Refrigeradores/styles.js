export const STATUS_CONFIG = {
  "Estoque": { bg: "rgba(125,186,61,0.15)", color: "#7DBA3D" },
  "Comodatado": { bg: "rgba(59,130,246,0.15)", color: "#60a5fa" },
  "Quebrado": { bg: "rgba(248,113,113,0.15)", color: "#f87171" },
};

export const CATEGORIA_CONFIG = {
  "SOPI": { bg: "rgba(168,85,247,0.15)", color: "#c084fc" },
  "VISA": { bg: "rgba(234,179,8,0.15)", color: "#facc15" },
};

const styles = {
  root: { minHeight: "100vh", background: "#0c1410", fontFamily: "'Poppins', 'Segoe UI', system-ui, sans-serif", color: "#fff" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "clamp(12px,3vw,20px) clamp(16px,4vw,32px)", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", flexWrap: "wrap", gap: "12px" },
  headerLeft: { display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" },
  backBtn: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", padding: "10px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem", fontFamily: "inherit", minHeight: "44px" },
  title: { margin: 0, fontSize: "clamp(1rem,5vw,1.3rem)", fontWeight: "700" },
  subtitle: { margin: 0, fontSize: "0.8rem", color: "rgba(255,255,255,0.4)" },
  content: { padding: "clamp(16px,4vw,24px) clamp(16px,4vw,32px)", maxWidth: "1600px", margin: "0 auto" },

  abasTopo: { display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" },
  abaTopoBtn: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.55)", padding: "12px 18px", borderRadius: "10px", cursor: "pointer", fontSize: "0.88rem", fontWeight: "600", fontFamily: "inherit", minHeight: "44px" },
  abaTopoBtnAtivo: { background: "rgba(125,186,61,0.15)", border: "1px solid rgba(125,186,61,0.4)", color: "#7DBA3D" },

  abas: { display: "flex", gap: "4px", marginBottom: "24px", borderBottom: "1px solid rgba(255,255,255,0.08)", overflowX: "auto" },
  abaBtn: { background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", padding: "12px 20px", cursor: "pointer", fontSize: "0.9rem", fontFamily: "inherit", borderBottom: "2px solid transparent", marginBottom: "-1px", whiteSpace: "nowrap", minHeight: "44px" },
  abaBtnAtivo: { color: "#7DBA3D", borderBottom: "2px solid #7DBA3D" },

  formCard: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: "clamp(16px,4vw,28px)", display: "flex", flexDirection: "column", gap: "18px" },
  formTitle: { margin: 0, fontSize: "1rem", fontWeight: "600", color: "rgba(255,255,255,0.8)" },
  linha: { display: "flex", gap: "14px", flexWrap: "wrap" },
  // field: uso avulso (largura total, fora de .linha). Dentro de .linha, use fieldLinha —
  // o "flex: 1 1 220px" aqui viraria base de ALTURA (220px) se aplicado direto num filho
  // do formCard (coluna), criando aquele espaço vazio enorme entre os campos.
  field: { display: "flex", flexDirection: "column", gap: "8px" },
  fieldLinha: { display: "flex", flexDirection: "column", gap: "8px", flex: "1 1 220px" },
  label: { color: "rgba(255,255,255,0.5)", fontSize: "0.78rem", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em" },
  hint: { color: "rgba(255,255,255,0.25)", fontSize: "0.75rem" },
  input: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff", padding: "12px", fontSize: "0.95rem", fontFamily: "inherit", outline: "none", width: "100%" },
  select: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff", padding: "12px", fontSize: "0.95rem", fontFamily: "inherit", outline: "none", width: "100%" },
  textarea: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff", padding: "12px", fontSize: "0.9rem", fontFamily: "inherit", outline: "none", resize: "vertical" },

  uploadLabel: { cursor: "pointer" },
  uploadArea: { border: "2px dashed rgba(255,255,255,0.12)", borderRadius: "10px", padding: "18px", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" },
  uploadAreaAtivo: { border: "2px dashed rgba(125,186,61,0.4)", background: "rgba(125,186,61,0.04)" },
  uploadNome: { color: "rgba(255,255,255,0.6)", fontSize: "0.85rem", textAlign: "center" },
  uploadTam: { color: "rgba(255,255,255,0.3)", fontSize: "0.75rem" },
  previewImg: { maxWidth: "100%", maxHeight: "200px", borderRadius: "8px", objectFit: "contain", marginTop: "8px" },

  btnEnviar: { background: "linear-gradient(135deg, #7DBA3D, #2E7D32)", color: "#0c1410", border: "none", borderRadius: "10px", padding: "14px", fontSize: "0.95rem", fontWeight: "700", cursor: "pointer", fontFamily: "inherit" },
  erro: { color: "#f87171", fontSize: "0.85rem", margin: 0, textAlign: "center" },
  sucesso: { color: "#4ade80", fontSize: "0.85rem", margin: 0, textAlign: "center" },
  msg: { color: "rgba(255,255,255,0.35)", textAlign: "center", padding: "40px" },

  toolbarExport: { display: "flex", gap: "8px", marginBottom: "12px" },
  btnExport: { display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.85)", padding: "10px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem", fontFamily: "inherit", minHeight: "44px", minWidth: "44px" },

  filtros: { display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" },
  filtroInput: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff", padding: "10px 12px", fontSize: "0.88rem", fontFamily: "inherit", outline: "none", flex: "1 1 180px" },
  filtroSelect: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff", padding: "10px 12px", fontSize: "0.88rem", fontFamily: "inherit", outline: "none" },

  lista: { display: "flex", flexDirection: "column", gap: "12px" },
  card: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column", gap: "10px" },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" },
  cardHeaderLeft: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" },
  tag: { padding: "3px 10px", borderRadius: "20px", fontSize: "0.72rem", fontWeight: "600" },
  cardId: { color: "rgba(255,255,255,0.2)", fontSize: "0.72rem" },
  cardTitulo: { margin: 0, color: "#fff", fontSize: "1rem", fontWeight: "600" },
  cardSub: { margin: 0, color: "rgba(255,255,255,0.5)", fontSize: "0.82rem" },
  cardGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "6px 14px", fontSize: "0.82rem" },
  cardGridLabel: { color: "rgba(255,255,255,0.35)" },
  cardGridValor: { color: "rgba(255,255,255,0.85)" },
  thumbs: { display: "flex", gap: "8px" },
  thumb: { width: "72px", height: "72px", borderRadius: "8px", objectFit: "cover", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer" },
  cardAcoes: { display: "flex", gap: "8px", justifyContent: "flex-end" },
  btnExcluir: { background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171", padding: "8px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "0.8rem", fontFamily: "inherit", minHeight: "40px" },

  pdvWrap: { position: "relative" },
  pdvLista: { position: "absolute", top: "100%", left: 0, right: 0, background: "#152018", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px", marginTop: "4px", maxHeight: "220px", overflowY: "auto", zIndex: 10 },
  pdvItem: { padding: "10px 12px", cursor: "pointer", fontSize: "0.85rem", color: "rgba(255,255,255,0.8)", borderBottom: "1px solid rgba(255,255,255,0.05)" },
  pdvSelecionado: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(125,186,61,0.08)", border: "1px solid rgba(125,186,61,0.3)", borderRadius: "8px", padding: "10px 12px", fontSize: "0.85rem", color: "#7DBA3D" },
  pdvLimpar: { background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: "0.8rem", fontFamily: "inherit" },
};

export default styles;
