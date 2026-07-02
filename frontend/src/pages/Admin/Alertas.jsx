import { useState, useEffect } from "react";
import api from "../../services/api";

export default function Alertas() {
  const [dados, setDados] = useState(null);
  const [novoEmail, setNovoEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);

  const carregar = () => api.get("/api/alertas").then((r) => setDados(r.data)).catch((e) => setMsg("Erro: " + (e?.response?.data?.error || e.message)));
  useEffect(() => { carregar(); }, []);

  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(""), 4000); };

  const addEmail = async () => {
    const email = novoEmail.trim().toLowerCase();
    if (!email) return;
    try { await api.post("/api/alertas/destinatarios", { email }); setNovoEmail(""); flash("E-mail adicionado."); carregar(); }
    catch (e) { flash("Erro: " + (e?.response?.data?.error || e.message)); }
  };
  const removeEmail = async (email) => {
    try { await api.delete("/api/alertas/destinatarios", { data: { email } }); carregar(); }
    catch (e) { flash("Erro: " + (e?.response?.data?.error || e.message)); }
  };
  const toggle = async () => {
    try { await api.post("/api/alertas/toggle", { ativo: !dados.config.ativo }); carregar(); }
    catch (e) { flash("Erro: " + (e?.response?.data?.error || e.message)); }
  };
  const verPreview = async () => {
    setBusy(true); setPreview(null);
    try { const r = await api.get("/api/alertas/preview"); setPreview(r.data); }
    catch (e) { flash("Erro: " + (e?.response?.data?.error || e.message)); }
    finally { setBusy(false); }
  };
  const enviarTeste = async () => {
    setBusy(true);
    try {
      const r = await api.post("/api/alertas/rodar", { teste: true });
      flash(r.data?.enviado ? `✅ Enviado: ${r.data.resumo}` : `Nada enviado: ${r.data?.motivo || "—"}`);
      carregar();
    } catch (e) { flash("Erro: " + (e?.response?.data?.error || e.message)); }
    finally { setBusy(false); }
  };

  if (!dados) return <div style={{ color: "rgba(255,255,255,0.5)", padding: 12 }}>Carregando…</div>;
  const { config, destinatarios, brevoOk, remetente } = dados;

  return (
    <div style={{ color: "#fff", maxWidth: 640 }}>
      <h3 style={{ marginTop: 0 }}>📧 Alertas de ruptura</h3>
      <p style={S.desc}>
        Dispara um e-mail (digest) quando um produto <b>top-10 zera na grade</b> ou quando há
        <b> falta em pedido</b>. Roda automático após cada import. A pessoa responde o e-mail com a devolutiva.
      </p>

      {/* Status do provedor */}
      <div style={{ ...S.box, borderColor: brevoOk ? "rgba(74,222,128,0.3)" : "rgba(240,153,123,0.4)" }}>
        <div>Provedor (Brevo): <b style={{ color: brevoOk ? "#4ade80" : "#f0997b" }}>{brevoOk ? "configurado" : "FALTA a BREVO_API_KEY no env"}</b></div>
        <div>Remetente: <b>{remetente || <span style={{ color: "#f0997b" }}>FALTA ALERTA_FROM no env</span>}</b></div>
      </div>

      {/* Liga/desliga */}
      <div style={S.row}>
        <span>Alertas automáticos:</span>
        <button style={config.ativo ? S.btnOn : S.btnOff} onClick={toggle}>{config.ativo ? "LIGADO" : "DESLIGADO"}</button>
      </div>
      {config.ultimo_envio && (
        <div style={S.small}>Último envio: {new Date(config.ultimo_envio).toLocaleString("pt-BR")} — {config.ultimo_resumo}</div>
      )}

      {/* Lista de destinatários */}
      <h4>Destinatários</h4>
      <div style={S.addRow}>
        <input style={S.input} placeholder="email@exemplo.com" value={novoEmail}
          onChange={(e) => setNovoEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addEmail()} />
        <button style={S.btn} onClick={addEmail}>Adicionar</button>
      </div>
      {destinatarios.length === 0 ? (
        <div style={S.small}>Nenhum e-mail cadastrado — os alertas não serão enviados até adicionar pelo menos um.</div>
      ) : (
        <ul style={S.list}>
          {destinatarios.map((d) => (
            <li key={d.email} style={S.item}>
              <span>{d.email}</span>
              <button style={S.rm} onClick={() => removeEmail(d.email)}>remover</button>
            </li>
          ))}
        </ul>
      )}

      {/* Ações */}
      <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
        <button style={S.btn} onClick={verPreview} disabled={busy}>👁️ Ver o que seria alertado</button>
        <button style={S.btnPrimary} onClick={enviarTeste} disabled={busy}>✉️ Enviar teste agora</button>
      </div>
      {msg && <div style={S.msg}>{msg}</div>}

      {preview && (
        <div style={S.box}>
          <b>Prévia (não enviado):</b>
          <div style={{ marginTop: 6 }}>🔴 Grade zerada (top-10): {preview.gradeFalta?.length || 0}</div>
          <ul style={S.small}>{(preview.gradeFalta || []).map((g) => <li key={g.cod}>#{g.rank} {g.nome} — {g.pct}% do volume · ~{g.freqSemana} ped/sem</li>)}</ul>
          <div>📉 Falta em pedido ({preview.ultimaData || "—"}): {preview.rupturas?.length || 0}</div>
          <ul style={S.small}>{(preview.rupturas || []).slice(0, 15).map((r, i) => <li key={i}>Setor {r.setor} · {r.nome_pdv} · {r.nome} — {r.volume} HL</li>)}</ul>
        </div>
      )}
    </div>
  );
}

const S = {
  desc: { color: "rgba(255,255,255,0.6)", fontSize: "0.85rem", lineHeight: 1.5 },
  box: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", margin: "12px 0", fontSize: "0.85rem" },
  row: { display: "flex", alignItems: "center", gap: 12, margin: "14px 0 4px" },
  small: { color: "rgba(255,255,255,0.45)", fontSize: "0.76rem", margin: "4px 0" },
  addRow: { display: "flex", gap: 8, margin: "8px 0" },
  input: { flex: 1, background: "#16211b", color: "#fff", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "9px 12px", fontFamily: "inherit", fontSize: "0.85rem" },
  list: { listStyle: "none", padding: 0, margin: "6px 0" },
  item: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "8px 12px", marginBottom: 5 },
  rm: { background: "none", border: "none", color: "#f0997b", cursor: "pointer", fontFamily: "inherit", fontSize: "0.78rem" },
  btn: { background: "rgba(125,186,61,0.12)", border: "1px solid rgba(125,186,61,0.3)", color: "#7DBA3D", padding: "9px 14px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: "0.83rem" },
  btnPrimary: { background: "#7DBA3D", border: "1px solid #7DBA3D", color: "#0c1410", padding: "9px 16px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: "0.83rem", fontWeight: 600 },
  btnOn: { background: "#7DBA3D", border: "none", color: "#0c1410", padding: "6px 16px", borderRadius: 20, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 },
  btnOff: { background: "rgba(255,255,255,0.1)", border: "none", color: "rgba(255,255,255,0.6)", padding: "6px 16px", borderRadius: 20, cursor: "pointer", fontFamily: "inherit" },
  msg: { marginTop: 10, color: "#7DBA3D", fontSize: "0.83rem" },
};
