// v1.0 - import/edit spo_metas
import { useState, useEffect, useRef } from "react";
import api from "../../services/api";

const MESES = ["2026-04","2026-05","2026-06"];
const MESES_LABEL = { "2026-04":"Abril","2026-05":"Maio","2026-06":"Junho" };

const ITENS = [
  {n:1,  label:"Visitação GV na Base Foco"},
  {n:2,  label:"Rota Coaching"},
  {n:3,  label:"TT Dias com Rotas"},
  {n:4,  label:"Abertura de Desafios Diários"},
  {n:5,  label:"Atendimento Produtivo"},
  {n:6,  label:"DTO GC"},
  {n:7,  label:"% Visitas RN abrindo Promoção"},
  {n:8,  label:"Aderência de Política Comercial"},
  {n:9,  label:"Execução Menu de Cerveja"},
  {n:10, label:"Academia Bees RN"},
  {n:11, label:"Tasks Cerveja TT (Portfolio)"},
  {n:12, label:"Tasks Faturamento Score 5"},
  {n:13, label:"Tasks NAB TT (Portfolio)"},
  {n:14, label:"Tasks de Volume"},
  {n:15, label:"Tasks de Marketplace"},
  {n:16, label:"Tasks de Match (Portfolio)"},
  {n:17, label:"Tasks Cerveja Zero (Portfolio)"},
  {n:18, label:"Tarefa de Digitalização"},
  {n:19, label:"PDVs com Compra Independente"},
  {n:20, label:"+RGB"},
  {n:21, label:"Cupons Digitais - Score 5"},
  {n:22, label:"% Lojas Ideais"},
  {n:23, label:"Expansão Scanntech"},
  {n:24, label:"Portfólio Ideal Score 5"},
];

export default function SpoMetas() {
  const fileRef = useRef(null);
  const [dados, setDados] = useState({});   // { "1_2026-04": {meta, real}, ... }
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setLoading(true);
    try {
      const res = await api.get("/api/spo/painel/metas");
      const mapa = {};
      (res.data || []).forEach((r) => {
        const k = `${r.item}_${r.mes}`;
        mapa[k] = { meta: r.meta ?? "", real: r.real ?? "" };
      });
      setDados(mapa);
    } catch {
      setMsg("❌ Erro ao carregar metas.");
    } finally {
      setLoading(false);
    }
  }

  function getVal(item, mes, campo) {
    return dados[`${item}_${mes}`]?.[campo] ?? "";
  }

  function setVal(item, mes, campo, v) {
    const k = `${item}_${mes}`;
    setDados((prev) => ({
      ...prev,
      [k]: { ...prev[k], [campo]: v },
    }));
  }

  async function salvar() {
    setSalvando(true);
    setMsg("");
    try {
      const linhas = [];
      ITENS.forEach(({ n }) => {
        MESES.forEach((mes) => {
          const meta = getVal(n, mes, "meta");
          const real = getVal(n, mes, "real");
          if (meta !== "" || real !== "") {
            linhas.push({ item: n, mes, meta: meta !== "" ? meta : "", real: real !== "" ? real : "" });
          }
        });
      });
      await api.post("/api/spo/painel/metas", { linhas });
      setMsg(`✅ ${linhas.length} linhas salvas com sucesso!`);
    } catch {
      setMsg("❌ Erro ao salvar metas.");
    } finally {
      setSalvando(false);
      setTimeout(() => setMsg(""), 5000);
    }
  }

  // Importar Excel (lê via FileReader como CSV-like via SheetJS se disponível, ou JSON)
  function importarExcel(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Tenta ler como JSON/CSV via texto
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        // Tenta JSON primeiro
        const json = JSON.parse(ev.target.result);
        aplicarLinhas(json);
      } catch {
        // Tenta CSV
        const lines = ev.target.result.split("\n").filter(Boolean);
        const header = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g,""));
        const parsed = lines.slice(1).map((l) => {
          const cols = l.split(",").map((c) => c.trim().replace(/"/g,""));
          const obj = {};
          header.forEach((h, i) => { obj[h] = cols[i] ?? ""; });
          return obj;
        }).filter((r) => r.item && r.mes);
        aplicarLinhas(parsed);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function aplicarLinhas(linhas) {
    const mapa = {};
    linhas.forEach((r) => {
      const k = `${r.item}_${r.mes}`;
      mapa[k] = { meta: r.meta ?? "", real: r.real ?? "" };
    });
    setDados(mapa);
    setMsg(`📥 ${linhas.length} linhas carregadas. Clique em Salvar para confirmar.`);
    setTimeout(() => setMsg(""), 6000);
  }

  const inpStyle = {
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "5px",
    color: "#fff",
    padding: "4px 6px",
    fontSize: "0.78rem",
    width: "70px",
    textAlign: "center",
    fontFamily: "inherit",
    outline: "none",
  };
  const thS = {
    padding: "7px 10px",
    color: "rgba(255,255,255,0.45)",
    fontSize: "0.72rem",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    textAlign: "center",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    whiteSpace: "nowrap",
  };

  return (
    <div style={{ padding: "0 4px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h3 style={{ margin: 0, fontWeight: "700", fontSize: "1rem" }}>📊 Metas SPO — Painel Consolidado</h3>
          <p style={{ margin: "4px 0 0", fontSize: "0.78rem", color: "rgba(255,255,255,0.4)" }}>
            Edite meta e realizado por item × mês. Deixe em branco para usar dados ao vivo (mês atual).
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <input ref={fileRef} type="file" accept=".json,.csv" style={{ display: "none" }} onChange={importarExcel} />
          <button
            onClick={() => fileRef.current?.click()}
            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)", padding: "7px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "0.82rem", fontFamily: "inherit" }}>
            📥 Importar JSON/CSV
          </button>
          <button
            onClick={salvar}
            disabled={salvando}
            style={{ background: salvando ? "rgba(251,185,0,0.1)" : "rgba(251,185,0,0.2)", border: "1px solid rgba(251,185,0,0.4)", color: "#fbb900", padding: "7px 18px", borderRadius: "8px", cursor: salvando ? "not-allowed" : "pointer", fontSize: "0.85rem", fontWeight: "600", fontFamily: "inherit" }}>
            {salvando ? "⏳ Salvando..." : "💾 Salvar"}
          </button>
        </div>
      </div>

      {msg && (
        <div style={{ background: msg.startsWith("✅") ? "rgba(74,222,128,0.1)" : msg.startsWith("📥") ? "rgba(251,185,0,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${msg.startsWith("✅") ? "rgba(74,222,128,0.3)" : msg.startsWith("📥") ? "rgba(251,185,0,0.3)" : "rgba(239,68,68,0.3)"}`, borderRadius: "8px", padding: "10px 14px", marginBottom: "14px", fontSize: "0.85rem" }}>
          {msg}
        </div>
      )}

      {loading ? (
        <p style={{ color: "rgba(255,255,255,0.35)", textAlign: "center", padding: "40px" }}>Carregando...</p>
      ) : (
        <div style={{ overflowX: "auto", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.08)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
            <thead>
              <tr>
                <th style={{ ...thS, textAlign: "left", minWidth: "40px" }}>#</th>
                <th style={{ ...thS, textAlign: "left", minWidth: "200px" }}>Indicador</th>
                {MESES.map((mes) => (
                  <th key={mes} colSpan={2} style={{ ...thS, background: "rgba(251,185,0,0.06)", borderLeft: "1px solid rgba(255,255,255,0.08)" }}>
                    {MESES_LABEL[mes]}
                  </th>
                ))}
              </tr>
              <tr>
                <th style={thS} colSpan={2}></th>
                {MESES.map((mes) => (
                  ["Meta", "Real"].map((h) => (
                    <th key={mes + h} style={{ ...thS, background: "rgba(251,185,0,0.04)", fontSize: "0.68rem" }}>{h}</th>
                  ))
                ))}
              </tr>
            </thead>
            <tbody>
              {ITENS.map(({ n, label }) => (
                <tr key={n} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <td style={{ padding: "6px 10px", color: "rgba(255,255,255,0.4)", fontSize: "0.75rem" }}>{n}</td>
                  <td style={{ padding: "6px 10px", color: "rgba(255,255,255,0.8)", fontSize: "0.8rem", whiteSpace: "nowrap" }}>{label}</td>
                  {MESES.map((mes) => (
                    [
                      <td key={mes + "m"} style={{ padding: "4px 6px", borderLeft: "1px solid rgba(255,255,255,0.06)" }}>
                        <input
                          style={inpStyle}
                          value={getVal(n, mes, "meta")}
                          onChange={(e) => setVal(n, mes, "meta", e.target.value)}
                          placeholder="—"
                        />
                      </td>,
                      <td key={mes + "r"} style={{ padding: "4px 6px" }}>
                        <input
                          style={{ ...inpStyle, borderColor: getVal(n, mes, "real") !== "" ? "rgba(74,222,128,0.3)" : "rgba(255,255,255,0.12)" }}
                          value={getVal(n, mes, "real")}
                          onChange={(e) => setVal(n, mes, "real", e.target.value)}
                          placeholder="ao vivo"
                        />
                      </td>,
                    ]
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
