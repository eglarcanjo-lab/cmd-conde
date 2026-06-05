import { useState, useEffect } from "react";
import api from "../../services/api";

const GVS = ["1", "3"];
const META_PCT = 90; // 90% dos dias trabalhados

function getDiasUteis(ano, mes) {
  const dias = [];
  const total = new Date(ano, mes, 0).getDate();
  for (let d = 1; d <= total; d++) {
    const dow = new Date(ano, mes - 1, d).getDay();
    if (dow !== 0 && dow !== 6) dias.push(d);
  }
  return dias;
}

export default function SpoDesafios() {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [dados, setDados] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState("");

  const diasUteis = getDiasUteis(ano, mes);
  const mesRef = `${ano}-${String(mes).padStart(2, "0")}`;

  useEffect(() => { carregar(); }, [mesRef]);

  async function carregar() {
    try {
      const res = await api.get(`/api/spo/desafios?mes=${mesRef}`);
      const mapa = {};
      (res.data || []).forEach((r) => {
        const key = `${r.gv}_${r.dia}`;
        mapa[key] = r.status;
      });
      setDados(mapa);
    } catch { }
  }

  function toggle(gv, dia) {
    const key = `${gv}_${dia}`;
    setDados((prev) => ({
      ...prev,
      [key]: prev[key] === "OK" ? "NOK" : prev[key] === "NOK" ? "" : "OK",
    }));
  }

  async function salvar() {
    setSalvando(true);
    setSucesso("");
    try {
      const linhas = [];
      GVS.forEach((gv) => {
        diasUteis.forEach((dia) => {
          const key = `${gv}_${dia}`;
          linhas.push({ gv, dia, mes_referencia: mesRef, status: dados[key] || "" });
        });
      });
      await api.post("/api/spo/desafios", { linhas });
      setSucesso("Salvo com sucesso!");
      setTimeout(() => setSucesso(""), 2000);
    } catch { }
    finally { setSalvando(false); }
  }

  // Estatísticas por GV
  function stats(gv) {
    const total = diasUteis.length;
    const ok = diasUteis.filter((d) => dados[`${gv}_${d}`] === "OK").length;
    const nok = diasUteis.filter((d) => dados[`${gv}_${d}`] === "NOK").length;
    const pct = total > 0 ? Math.round((ok / total) * 100) : 0;
    return { ok, nok, total, pct };
  }

  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

  return (
    <div>
      <div style={styles.toolbar}>
        <div>
          <h3 style={styles.title}>Item 4 — Abertura de Desafios Diários</h3>
          <p style={styles.desc}>Marque OK/NOK por dia e GV. Meta: ≥ 90% dos dias úteis com desafio aberto.</p>
        </div>
        <div style={styles.toolbarRight}>
          <select style={styles.sel} value={mes} onChange={(e) => setMes(Number(e.target.value))}>
            {meses.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
          <select style={styles.sel} value={ano} onChange={(e) => setAno(Number(e.target.value))}>
            {[2025, 2026, 2027].map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <button style={{ ...styles.btnSalvar, opacity: salvando ? 0.7 : 1 }} onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando..." : "💾 Salvar"}
          </button>
        </div>
      </div>

      {sucesso && <p style={styles.sucesso}>{sucesso}</p>}

      {/* Cards resumo por GV */}
      <div style={styles.statsRow}>
        {GVS.map((gv) => {
          const s = stats(gv);
          const cor = s.pct >= 100 ? "#4ade80" : s.pct >= META_PCT ? "#4ade80" : s.pct >= 70 ? "#7DBA3D" : "#f87171";
          return (
            <div key={gv} style={styles.statCard}>
              <div style={styles.statHeader}>
                <span style={styles.statGv}>GV {gv}</span>
                <span style={{ ...styles.statBadge, background: s.pct >= META_PCT ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: s.pct >= META_PCT ? "#4ade80" : "#f87171" }}>
                  {s.pct >= META_PCT ? "OK" : "NOK"}
                </span>
              </div>
              <p style={{ margin: "6px 0 2px", fontSize: "1.8rem", fontWeight: "800", color: cor }}>{s.pct}%</p>
              <div style={{ height: "6px", background: "rgba(255,255,255,0.08)", borderRadius: "3px", marginBottom: "8px" }}>
                <div style={{ height: "100%", width: `${Math.min(s.pct, 100)}%`, background: cor, borderRadius: "3px" }} />
              </div>
              <div style={{ display: "flex", gap: "12px", fontSize: "0.78rem" }}>
                <span style={{ color: "#4ade80" }}>✅ {s.ok} OK</span>
                <span style={{ color: "#f87171" }}>❌ {s.nok} NOK</span>
                <span style={{ color: "rgba(255,255,255,0.3)" }}>📅 {s.total} dias úteis</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabela dias × GVs */}
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Dia</th>
              <th style={styles.th}>Semana</th>
              {GVS.map((gv) => <th key={gv} style={styles.th}>GV {gv}</th>)}
            </tr>
          </thead>
          <tbody>
            {diasUteis.map((dia) => {
              const date = new Date(ano, mes - 1, dia);
              const semana = ["Dom","Seg","Ter","Qua","Qui","Sex","Sab"][date.getDay()];
              return (
                <tr key={dia} style={styles.tr}>
                  <td style={styles.td}>{dia}/{String(mes).padStart(2,"0")}</td>
                  <td style={{ ...styles.td, color: "rgba(255,255,255,0.4)", fontSize: "0.78rem" }}>{semana}</td>
                  {GVS.map((gv) => {
                    const key = `${gv}_${dia}`;
                    const status = dados[key] || "";
                    return (
                      <td key={gv} style={styles.td}>
                        <button
                          style={{
                            ...styles.btnStatus,
                            background: status === "OK" ? "rgba(34,197,94,0.2)" : status === "NOK" ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.05)",
                            color: status === "OK" ? "#4ade80" : status === "NOK" ? "#f87171" : "rgba(255,255,255,0.25)",
                            border: `1px solid ${status === "OK" ? "rgba(34,197,94,0.3)" : status === "NOK" ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.08)"}`,
                          }}
                          onClick={() => toggle(gv, dia)}
                        >
                          {status || "—"}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.75rem", textAlign: "center", marginTop: "8px" }}>
        Clique nas células para alternar: — → OK → NOK → —
      </p>
    </div>
  );
}

const styles = {
  toolbar: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", flexWrap: "wrap", gap: "12px" },
  toolbarRight: { display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" },
  title: { margin: "0 0 4px", fontSize: "1rem", fontWeight: "600" },
  desc: { margin: 0, color: "rgba(255,255,255,0.4)", fontSize: "0.82rem" },
  sel: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff", padding: "7px 12px", fontSize: "0.85rem", fontFamily: "inherit", outline: "none" },
  btnSalvar: { background: "linear-gradient(135deg, #7DBA3D, #2E7D32)", color: "#0c1410", border: "none", borderRadius: "8px", padding: "8px 18px", fontWeight: "700", cursor: "pointer", fontSize: "0.85rem", fontFamily: "inherit" },
  sucesso: { color: "#4ade80", fontSize: "0.85rem", textAlign: "center", marginBottom: "12px" },
  statsRow: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "12px", marginBottom: "20px" },
  statCard: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "12px", padding: "16px" },
  statHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  statGv: { fontWeight: "700", fontSize: "0.95rem" },
  statBadge: { padding: "2px 10px", borderRadius: "20px", fontSize: "0.75rem", fontWeight: "700" },
  tableWrap: { overflowX: "auto", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.08)" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)", fontSize: "0.75rem", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.04em", padding: "9px 12px", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.08)" },
  tr: { borderBottom: "1px solid rgba(255,255,255,0.04)" },
  td: { padding: "6px 12px", color: "rgba(255,255,255,0.75)", fontSize: "0.85rem", textAlign: "center" },
  btnStatus: { borderRadius: "6px", padding: "4px 16px", cursor: "pointer", fontSize: "0.82rem", fontWeight: "600", fontFamily: "inherit", minWidth: "56px" },
};
