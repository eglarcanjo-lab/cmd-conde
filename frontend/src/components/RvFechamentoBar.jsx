// Barra de FECHAMENTO da RV do mês (congelamento).
// - Mês fechado: aviso 🔒 com data/quem fechou (todo mundo vê) + "Reabrir" (só admin, com confirmação).
// - Mês aberto: botão "Fechar RV" (só admin, `podeFechar`) → caixa de confirmação onde é preciso
//   digitar o mês (MM/AAAA). Ao fechar, os valores ficam congelados: nenhum import/recálculo altera.
import { useState, useEffect } from "react";
import api from "../services/api";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const rotulo = (ym) => `${MESES[Number(ym.slice(5, 7)) - 1]}/${ym.slice(0, 4)}`;
const mmaaaa = (ym) => `${ym.slice(5, 7)}/${ym.slice(0, 4)}`;

export default function RvFechamentoBar({ mes, podeFechar = false, onMudou }) {
  const [st, setSt] = useState(null);
  const [modal, setModal] = useState(null);   // "fechar" | "reabrir" | null
  const [digitado, setDigitado] = useState("");
  const [ok, setOk] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const carregar = () => {
    if (!mes) return;
    api.get("/api/rv/fechamento", { params: { mes } }).then((r) => setSt(r.data)).catch(() => setSt(null));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(carregar, [mes]);

  const abrirModal = (tipo) => { setModal(tipo); setDigitado(""); setOk(false); setErro(""); };

  async function confirmar() {
    if (digitado.trim() !== mmaaaa(mes)) { setErro(`Digite exatamente ${mmaaaa(mes)} para confirmar.`); return; }
    if (modal === "fechar" && !ok) { setErro("Marque a caixa de ciência para continuar."); return; }
    setSalvando(true); setErro("");
    try {
      await api.post(modal === "fechar" ? "/api/rv/fechar" : "/api/rv/reabrir", { mes, confirmacao: mes }, { timeout: 60000 });
      setModal(null); carregar(); onMudou && onMudou();
    } catch (e) { setErro(e.response?.data?.error || "Erro ao salvar."); }
    finally { setSalvando(false); }
  }

  if (!st) return null;

  return (
    <>
      {st.fechado ? (
        <div style={S.barFechada}>
          <span style={{ fontSize: "1.1rem" }}>🔒</span>
          <span><b>RV de {rotulo(mes)} FECHADA</b> em {new Date(st.fechado_em).toLocaleDateString("pt-BR")}
            {st.fechado_por ? ` por ${st.fechado_por}` : ""} — valores congelados; imports e recálculos não alteram este mês.</span>
          {podeFechar && <button style={S.btnLink} onClick={() => abrirModal("reabrir")}>Reabrir</button>}
        </div>
      ) : podeFechar ? (
        <div style={S.barAberta}>
          <span>RV de <b>{rotulo(mes)}</b> em aberto — ainda pode mudar com novos imports.</span>
          <button style={S.btnFechar} onClick={() => abrirModal("fechar")}>🔒 Fechar RV de {rotulo(mes)}</button>
        </div>
      ) : null}

      {modal && (
        <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && setModal(null)}>
          <div style={S.modal}>
            <h3 style={{ margin: "0 0 10px", fontSize: "1.05rem", color: modal === "fechar" ? "#f5c451" : "#f87171" }}>
              {modal === "fechar" ? `🔒 Fechar a RV de ${rotulo(mes)}?` : `🔓 Reabrir a RV de ${rotulo(mes)}?`}
            </h3>
            {modal === "fechar" ? (
              <ul style={S.lista}>
                <li>Os valores de RV, AP e Pontos BEES de <b>{rotulo(mes)}</b> ficam <b>congelados</b> como estão agora.</li>
                <li>Novos imports (base de clientes, pedidos, setores renomeados…) e o "Recalcular RV" <b>não alteram mais</b> este mês.</li>
                <li>Confira os valores antes: o que estiver na tela é o que fica registrado como pago.</li>
              </ul>
            ) : (
              <ul style={S.lista}>
                <li>A foto congelada de <b>{rotulo(mes)}</b> é <b>descartada</b>.</li>
                <li>O mês volta a ser recalculado com a base ATUAL — se setores/carteira mudaram, os valores podem mudar.</li>
              </ul>
            )}
            <label style={S.lbl}>Para confirmar, digite o mês: <b>{mmaaaa(mes)}</b></label>
            <input style={S.input} value={digitado} onChange={(e) => setDigitado(e.target.value)} placeholder={mmaaaa(mes)} autoFocus />
            {modal === "fechar" && (
              <label style={S.chk}><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} /> Conferi os valores e quero congelar a RV deste mês.</label>
            )}
            {erro && <p style={{ color: "#f87171", fontSize: "0.82rem", margin: "8px 0 0" }}>{erro}</p>}
            <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
              <button style={S.btnCancel} onClick={() => setModal(null)} disabled={salvando}>Cancelar</button>
              <button style={modal === "fechar" ? S.btnFechar : S.btnReabrir} onClick={confirmar} disabled={salvando}>
                {salvando ? "Salvando…" : modal === "fechar" ? "🔒 Fechar e congelar" : "🔓 Reabrir mês"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const S = {
  barFechada: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 14px", marginBottom: 14, borderRadius: 10, background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.35)", color: "rgba(255,255,255,0.85)", fontSize: "0.84rem" },
  barAberta: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "8px 14px", marginBottom: 14, borderRadius: 10, background: "rgba(245,196,81,0.06)", border: "1px solid rgba(245,196,81,0.25)", color: "rgba(255,255,255,0.7)", fontSize: "0.82rem", justifyContent: "space-between" },
  btnFechar: { background: "linear-gradient(135deg,#f5c451,#d4a017)", color: "#1a1404", border: "none", borderRadius: 8, padding: "8px 14px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: "0.82rem" },
  btnReabrir: { background: "rgba(248,113,113,0.15)", color: "#f87171", border: "1px solid rgba(248,113,113,0.5)", borderRadius: 8, padding: "8px 14px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: "0.82rem" },
  btnLink: { marginLeft: "auto", background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.6)", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.78rem" },
  btnCancel: { background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.7)", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.82rem" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 },
  modal: { background: "#111827", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: "20px 22px", width: "100%", maxWidth: 520, color: "#fff" },
  lista: { margin: "0 0 14px", paddingLeft: 18, color: "rgba(255,255,255,0.75)", fontSize: "0.85rem", lineHeight: 1.6 },
  lbl: { display: "block", color: "rgba(255,255,255,0.65)", fontSize: "0.82rem", marginBottom: 6 },
  input: { width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, color: "#fff", padding: "10px 12px", fontSize: "0.95rem", fontFamily: "inherit", outline: "none" },
  chk: { display: "flex", gap: 8, alignItems: "center", marginTop: 10, color: "rgba(255,255,255,0.75)", fontSize: "0.82rem", cursor: "pointer" },
};
