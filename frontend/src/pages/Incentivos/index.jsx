// Incentivos — campanhas internas (cards + ranking), data-driven
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import api from "../../services/api";

function fmtData(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
function fmtValor(v, unidade) {
  const n = Number(v || 0);
  const num = n.toLocaleString("pt-BR", { maximumFractionDigits: n % 1 === 0 ? 0 : 1 });
  return unidade ? `${num} ${unidade}` : num;
}

export default function Incentivos() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState(null);          // incentivo selecionado
  const [ranking, setRanking] = useState(null);  // { ranking, minha_posicao }
  const [loadingRank, setLoadingRank] = useState(false);

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setLoading(true);
    try {
      const r = await api.get("/api/incentivos");
      setLista(r.data || []);
    } catch { /* silencioso */ }
    finally { setLoading(false); }
  }

  async function abrir(inc) {
    setSel(inc);
    setRanking(null);
    setLoadingRank(true);
    try {
      const r = await api.get(`/api/incentivos/${inc.id}/ranking`);
      setRanking(r.data);
    } catch { setRanking({ ranking: [], minha_posicao: null }); }
    finally { setLoadingRank(false); }
  }

  const medalha = (pos) => pos === 1 ? "🥇" : pos === 2 ? "🥈" : pos === 3 ? "🥉" : `${pos}º`;

  return (
    <div style={S.root}>
      <style>{CSS}</style>

      <div style={S.header}>
        <button style={S.backBtn} onClick={() => navigate("/")}>← Voltar</button>
        <div>
          <h1 style={S.title}>🏆 Incentivos</h1>
          <p style={S.subtitle}>Campanhas e ações em andamento</p>
        </div>
      </div>

      {loading ? (
        <div style={S.loadingWrap}><div className="inc-spinner" /></div>
      ) : lista.length === 0 ? (
        <div style={S.empty}>
          Nenhum incentivo ativo no momento.<br />
          <span style={{ fontSize: "0.78rem" }}>Fique de olho — novas campanhas aparecem aqui.</span>
        </div>
      ) : (
        <div style={S.grid}>
          {lista.map((inc) => (
            <div
              key={inc.id}
              style={{ ...S.card, borderColor: (inc.cor || "#7DBA3D") + "55" }}
              onClick={() => abrir(inc)}
            >
              <div style={{ ...S.cardBar, background: inc.cor || "#7DBA3D" }} />
              <div style={S.cardBody}>
                <div style={S.cardTitle}>{inc.titulo}</div>
                {inc.descricao && <div style={S.cardDesc}>{inc.descricao}</div>}
                <div style={S.cardMeta}>
                  {inc.premio && <span style={S.premioChip}>🎁 {inc.premio}</span>}
                  {(inc.data_inicio || inc.data_fim) && (
                    <span style={S.prazo}>
                      {fmtData(inc.data_inicio)}{inc.data_fim ? ` — ${fmtData(inc.data_fim)}` : ""}
                    </span>
                  )}
                </div>
              </div>
              <span style={S.cardArrow}>›</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal de ranking ── */}
      {sel && (
        <div style={S.overlay} onClick={() => setSel(null)}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <div style={{ ...S.modalHeader, borderColor: (sel.cor || "#7DBA3D") }}>
              <div>
                <div style={S.modalTitle}>{sel.titulo}</div>
                {sel.premio && <div style={S.modalPremio}>🎁 {sel.premio}</div>}
              </div>
              <button style={S.closeBtn} onClick={() => setSel(null)}>✕</button>
            </div>

            {sel.descricao && <p style={S.modalDesc}>{sel.descricao}</p>}

            {loadingRank ? (
              <div style={S.loadingWrap}><div className="inc-spinner" /></div>
            ) : (
              <>
                {ranking?.minha_posicao && (
                  <div style={S.minhaPos}>
                    <span>Sua posição</span>
                    <strong style={{ color: sel.cor || "#7DBA3D", fontSize: "1.3rem" }}>
                      {medalha(ranking.minha_posicao.posicao)}
                    </strong>
                    <span style={{ marginLeft: "auto", fontWeight: "700" }}>
                      {fmtValor(ranking.minha_posicao.valor, sel.unidade)}
                    </span>
                  </div>
                )}
                <div style={S.rankList}>
                  {(ranking?.ranking || []).length === 0 ? (
                    <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.85rem", textAlign: "center", padding: "20px" }}>
                      Ranking ainda não disponível.
                    </p>
                  ) : (
                    ranking.ranking.map((r) => {
                      const eu = String(r.setor) === String(usuario?.cod);
                      return (
                        <div key={r.setor} style={{ ...S.rankRow, ...(eu ? S.rankRowEu : {}) }}>
                          <span style={{ ...S.rankPos, color: r.posicao <= 3 ? "#7DBA3D" : "rgba(255,255,255,0.4)" }}>
                            {medalha(r.posicao)}
                          </span>
                          <div style={S.rankInfo}>
                            <div style={S.rankNome}>{r.nome} {eu && <span style={S.euTag}>você</span>}</div>
                            <div style={S.rankSetor}>Setor {r.setor}</div>
                          </div>
                          <span style={S.rankValor}>{fmtValor(r.valor, sel.unidade)}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  root:        { minHeight: "100vh", background: "#0c1410", fontFamily: "'Poppins', 'Segoe UI', system-ui, sans-serif", padding: "clamp(16px,4vw,28px)", maxWidth: "760px", margin: "0 auto", color: "#fff" },
  header:      { display: "flex", alignItems: "flex-start", gap: "14px", marginBottom: "22px" },
  backBtn:     { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", padding: "10px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem", fontFamily: "inherit", flexShrink: 0, minHeight: "44px" },
  title:       { color: "#fff", margin: "0 0 4px", fontSize: "clamp(1.1rem,5vw,1.4rem)", fontWeight: "700" },
  subtitle:    { color: "rgba(255,255,255,0.4)", margin: 0, fontSize: "0.82rem" },
  loadingWrap: { display: "flex", justifyContent: "center", padding: "48px 0" },
  empty:       { textAlign: "center", color: "rgba(255,255,255,0.3)", padding: "60px 20px", fontSize: "0.95rem", lineHeight: 1.6 },
  grid:        { display: "flex", flexDirection: "column", gap: "12px" },
  card:        { position: "relative", display: "flex", alignItems: "center", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", overflow: "hidden", cursor: "pointer", transition: "transform 0.15s, border-color 0.15s" },
  cardBar:     { width: "5px", alignSelf: "stretch", flexShrink: 0 },
  cardBody:    { flex: 1, padding: "14px 16px", minWidth: 0 },
  cardTitle:   { color: "#fff", fontWeight: "700", fontSize: "1rem" },
  cardDesc:    { color: "rgba(255,255,255,0.5)", fontSize: "0.82rem", marginTop: "3px", lineHeight: 1.4 },
  cardMeta:    { display: "flex", gap: "10px", alignItems: "center", marginTop: "8px", flexWrap: "wrap" },
  premioChip:  { background: "rgba(125,186,61,0.14)", color: "#7DBA3D", padding: "2px 10px", borderRadius: "20px", fontSize: "0.74rem", fontWeight: "600" },
  prazo:       { color: "rgba(255,255,255,0.35)", fontSize: "0.72rem" },
  cardArrow:   { color: "rgba(255,255,255,0.3)", fontSize: "1.6rem", paddingRight: "16px", flexShrink: 0 },
  // modal
  overlay:     { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", zIndex: 1000, backdropFilter: "blur(3px)" },
  modal:       { background: "#0e1712", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", width: "100%", maxWidth: "480px", maxHeight: "88vh", overflowY: "auto", padding: "20px" },
  modalHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", borderBottom: "2px solid #7DBA3D", paddingBottom: "12px", marginBottom: "12px" },
  modalTitle:  { color: "#fff", fontWeight: "700", fontSize: "1.1rem" },
  modalPremio: { color: "#7DBA3D", fontSize: "0.85rem", marginTop: "4px", fontWeight: "600" },
  closeBtn:    { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.14)", color: "#fff", borderRadius: "8px", width: "32px", height: "32px", cursor: "pointer", fontSize: "1rem", flexShrink: 0 },
  modalDesc:   { color: "rgba(255,255,255,0.55)", fontSize: "0.85rem", lineHeight: 1.5, margin: "0 0 14px" },
  minhaPos:    { display: "flex", alignItems: "center", gap: "12px", background: "rgba(125,186,61,0.1)", border: "1px solid rgba(125,186,61,0.3)", borderRadius: "10px", padding: "10px 14px", marginBottom: "14px", fontSize: "0.85rem", color: "rgba(255,255,255,0.7)" },
  rankList:    { display: "flex", flexDirection: "column", gap: "6px" },
  rankRow:     { display: "flex", alignItems: "center", gap: "12px", padding: "9px 12px", background: "rgba(255,255,255,0.03)", borderRadius: "10px", border: "1px solid transparent" },
  rankRowEu:   { background: "rgba(125,186,61,0.1)", border: "1px solid rgba(125,186,61,0.35)" },
  rankPos:     { fontWeight: "700", fontSize: "0.95rem", width: "32px", textAlign: "center", flexShrink: 0 },
  rankInfo:    { flex: 1, minWidth: 0 },
  rankNome:    { color: "#fff", fontSize: "0.88rem", fontWeight: "600", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  euTag:       { background: "#7DBA3D", color: "#0c1410", fontSize: "0.62rem", fontWeight: "700", padding: "1px 6px", borderRadius: "10px", marginLeft: "6px", verticalAlign: "middle" },
  rankSetor:   { color: "rgba(255,255,255,0.35)", fontSize: "0.7rem" },
  rankValor:   { color: "#7DBA3D", fontWeight: "700", fontSize: "0.9rem", flexShrink: 0 },
};

const CSS = `
.inc-spinner { width: 32px; height: 32px; border: 3px solid rgba(125,186,61,0.15); border-top-color: #7DBA3D; border-radius: 50%; animation: inc-spin 0.8s linear infinite; }
@keyframes inc-spin { to { transform: rotate(360deg); } }
`;
