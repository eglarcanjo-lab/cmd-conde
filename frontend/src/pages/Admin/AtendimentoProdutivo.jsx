import { useState, useEffect } from "react";
import api from "../../services/api";

const SETORES = [
  { cod: "101", nome: "João Victor", tipo: "OFF" },
  { cod: "102", nome: "Eliel Lima", tipo: "OFF" },
  { cod: "103", nome: "Bruno Leandro", tipo: "OFF" },
  { cod: "104", nome: "Weferson Alexandre", tipo: "ON" },
  { cod: "105", nome: "Iger Renan", tipo: "ON" },
  { cod: "106", nome: "Claudio Henrique", tipo: "ON" },
  { cod: "301", nome: "Luan Marques", tipo: "ON" },
  { cod: "302", nome: "Allan Fernando", tipo: "ON" },
  { cod: "303", nome: "Adriano Ferreira", tipo: "ON" },
  { cod: "304", nome: "Joicilene Alves", tipo: "ON" },
  { cod: "305", nome: "Manoel Roseno", tipo: "ON" },
];

const KPIS = [
  { key: "tasks_compra", label: "Tasks de Compra" },
  { key: "compradores", label: "Compradores" },
  { key: "rota_efetiva", label: "Rota Efetiva" },
  { key: "gps", label: "GPS" },
];

const EMPTY_ROW = () => ({
  tasks_compra_real: "", tasks_compra_meta: "",
  compradores_real: "", compradores_meta: "",
  rota_efetiva_real: "", rota_efetiva_meta: "",
  gps_real: "", gps_meta: "",
});

function calcApOk(row) {
  return KPIS.every((kpi) => {
    const real = parseFloat(row[`${kpi.key}_real`]);
    const meta = parseFloat(row[`${kpi.key}_meta`]);
    return !isNaN(real) && !isNaN(meta) && real >= meta;
  });
}

export default function AtendimentoProdutivo() {
  const [dados, setDados] = useState({});
  const [mesRef, setMesRef] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { carregar(); }, [mesRef]);

  async function carregar() {
    setLoading(true);
    try {
      const res = await api.get(`/api/rv/ap?mes=${mesRef}`);
      const mapa = {};
      (res.data || []).forEach((row) => { mapa[row.setor] = row; });
      setDados(mapa);
    } catch { }
    finally { setLoading(false); }
  }

  function setField(setor, field, value) {
    setDados((prev) => ({
      ...prev,
      [setor]: { ...(prev[setor] || EMPTY_ROW()), [field]: value },
    }));
  }

  async function salvar() {
    setSalvando(true);
    setSucesso("");
    try {
      const linhas = SETORES.map((s) => {
        const row = dados[s.cod] || EMPTY_ROW();
        const ap_ok = calcApOk(row) ? "OK" : "NOK";
        return { setor: s.cod, mes_referencia: mesRef, ...row, ap_ok };
      });
      await api.post("/api/rv/ap", { linhas });
      setSucesso("Atendimento Produtivo salvo com sucesso!");
      setTimeout(() => setSucesso(""), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSalvando(false);
    }
  }

  async function calcularRV() {
    try {
      await api.post("/api/rv/calcular");
      setSucesso("RV recalculada com sucesso!");
      setTimeout(() => setSucesso(""), 3000);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div>
      <div style={styles.toolbar}>
        <div>
          <h3 style={styles.title}>Atendimento Produtivo</h3>
          <p style={styles.desc}>
            Dados importados automaticamente via <strong>SPO — Atendimento Produtivo</strong> na aba Arquivos.
            Use esta tabela apenas para correção manual pontual.
          </p>
        </div>
        <div style={styles.toolbarRight}>
          <input type="month" style={styles.inputMes} value={mesRef} onChange={(e) => setMesRef(e.target.value)} />
          <button style={styles.btnCalc} onClick={calcularRV}>🔄 Recalcular RV</button>
          <button style={{ ...styles.btnSalvar, opacity: salvando ? 0.7 : 1 }} onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando..." : "💾 Salvar"}
          </button>
        </div>
      </div>

      {sucesso && <p style={styles.sucesso}>{sucesso}</p>}

      {loading ? <p style={styles.msg}>Carregando...</p> : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Setor</th>
                <th style={styles.th}>RN</th>
                <th style={styles.th}>Tipo</th>
                {KPIS.map((k) => (
                  <th key={k.key} style={styles.th} colSpan={2}>{k.label}</th>
                ))}
                <th style={styles.th}>AP</th>
              </tr>
              <tr>
                <th style={styles.thSub} colSpan={3}/>
                {KPIS.map((k) => (
                  <>
                    <th key={`${k.key}_r`} style={styles.thSub}>Real %</th>
                    <th key={`${k.key}_m`} style={styles.thSub}>Meta %</th>
                  </>
                ))}
                <th style={styles.thSub}/>
              </tr>
            </thead>
            <tbody>
              {SETORES.map((s) => {
                const row = dados[s.cod] || EMPTY_ROW();
                const apOk = calcApOk(row);
                return (
                  <tr key={s.cod} style={styles.tr}>
                    <td style={styles.td}><span style={styles.codBadge}>{s.cod}</span></td>
                    <td style={{ ...styles.td, textAlign: "left", fontSize: "0.82rem" }}>{s.nome}</td>
                    <td style={styles.td}>
                      <span style={{ ...styles.tipoBadge, color: s.tipo === "OFF" ? "#60a5fa" : "#4ade80" }}>
                        {s.tipo}
                      </span>
                    </td>
                    {KPIS.map((k) => {
                      const real = parseFloat(row[`${k.key}_real`]);
                      const meta = parseFloat(row[`${k.key}_meta`]);
                      const ok = !isNaN(real) && !isNaN(meta) && real >= meta;
                      return (
                        <>
                          <td key={`${k.key}_r`} style={styles.tdInput}>
                            <input
                              style={{ ...styles.inputNum, borderColor: !isNaN(real) && !isNaN(meta) ? (ok ? "rgba(74,222,128,0.4)" : "rgba(248,113,113,0.4)") : "rgba(255,255,255,0.1)" }}
                              type="number"
                              step="0.1"
                              value={row[`${k.key}_real`]}
                              onChange={(e) => setField(s.cod, `${k.key}_real`, e.target.value)}
                              placeholder="0"
                            />
                          </td>
                          <td key={`${k.key}_m`} style={styles.tdInput}>
                            <input
                              style={styles.inputNum}
                              type="number"
                              step="0.1"
                              value={row[`${k.key}_meta`]}
                              onChange={(e) => setField(s.cod, `${k.key}_meta`, e.target.value)}
                              placeholder="90"
                            />
                          </td>
                        </>
                      );
                    })}
                    <td style={styles.td}>
                      <span style={{
                        ...styles.apBadge,
                        background: apOk ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                        color: apOk ? "#4ade80" : "#f87171",
                      }}>
                        {apOk ? "✅ OK" : "❌ NOK"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const styles = {
  toolbar: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", flexWrap: "wrap", gap: "12px" },
  toolbarRight: { display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" },
  title: { margin: "0 0 4px", fontSize: "1rem", fontWeight: "600" },
  desc: { margin: 0, color: "rgba(255,255,255,0.4)", fontSize: "0.82rem" },
  inputMes: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff", padding: "8px 12px", fontSize: "0.85rem", fontFamily: "inherit", outline: "none" },
  btnSalvar: { background: "linear-gradient(135deg, #fbb900, #e6a200)", color: "#0a0f1e", border: "none", borderRadius: "8px", padding: "8px 18px", fontWeight: "700", cursor: "pointer", fontSize: "0.85rem", fontFamily: "inherit" },
  btnCalc: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", borderRadius: "8px", padding: "8px 14px", cursor: "pointer", fontSize: "0.85rem", fontFamily: "inherit" },
  sucesso: { color: "#4ade80", fontSize: "0.85rem", marginBottom: "12px", textAlign: "center" },
  msg: { color: "rgba(255,255,255,0.35)", textAlign: "center", padding: "40px" },
  tableWrap: { overflowX: "auto", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.08)" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)", fontSize: "0.72rem", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.04em", padding: "8px 6px", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap" },
  thSub: { background: "rgba(255,255,255,0.02)", color: "rgba(255,255,255,0.35)", fontSize: "0.68rem", padding: "4px 6px", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.08)" },
  tr: { borderBottom: "1px solid rgba(255,255,255,0.04)" },
  td: { padding: "8px 6px", color: "rgba(255,255,255,0.8)", fontSize: "0.85rem", textAlign: "center" },
  tdInput: { padding: "4px 3px" },
  codBadge: { background: "rgba(251,185,0,0.12)", color: "#fbb900", padding: "2px 7px", borderRadius: "6px", fontSize: "0.75rem", fontWeight: "700" },
  tipoBadge: { fontSize: "0.75rem", fontWeight: "600" },
  inputNum: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: "#fff", padding: "5px 6px", fontSize: "0.82rem", fontFamily: "inherit", outline: "none", width: "64px", textAlign: "center" },
  apBadge: { padding: "3px 8px", borderRadius: "6px", fontSize: "0.75rem", fontWeight: "700", whiteSpace: "nowrap" },
};
