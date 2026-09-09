// v1.1 - botão Snapshot (fechar mês) + import/edit spo_metas
import { useState, useEffect, useRef } from "react";
import api from "../../services/api";
import { SPO_KPIS, SPO_KPIS_BASICO } from "../../config/spoKpis";

const MESES = ["2026-07","2026-08","2026-09"];
const MESES_LABEL = { "2026-07":"Julho","2026-08":"Agosto","2026-09":"Setembro" };

// Calcula o mês anterior ao atual (padrão do snapshot)
function mesAnterior() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Lista de KPIs vem do registro único (config/spoKpis.js).
const ITENS = SPO_KPIS_BASICO;
// Defaults de pts/peso do registro — placeholder até o admin salvar a config.
const REG = {};
SPO_KPIS.forEach((k) => { REG[k.n] = { pts: k.pts, peso: k.peso }; });

export default function SpoMetas() {
  const fileRef = useRef(null);
  const [dados, setDados] = useState({});   // { "1_2026-07": {meta, real}, ... }
  const [cfg, setCfg] = useState({});       // { item: { pts, peso } }
  const [loading, setLoading] = useState(true);
  const [loadOk, setLoadOk] = useState(false); // proteção: só salva se carregou OK
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState("");

  // Snapshot state
  const [mesFecha, setMesFecha] = useState(mesAnterior());
  const [fechando, setFechando] = useState(false);
  const [snapshotResult, setSnapshotResult] = useState(null); // { salvos, mes, reais }

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setLoading(true);
    setLoadOk(false);
    try {
      const [resM, resC] = await Promise.all([
        api.get("/api/spo/painel/metas"),
        api.get("/api/spo/painel/config").catch(() => ({ data: [] })),
      ]);
      const mapa = {};
      (resM.data || []).forEach((r) => {
        const k = `${r.item}_${r.mes}`;
        mapa[k] = { meta: r.meta ?? "", real: r.real ?? "" };
      });
      setDados(mapa);
      const cmap = {};
      (resC.data || []).forEach((r) => { cmap[String(r.item)] = { pts: r.pts ?? "", peso: r.peso ?? "", inicio: r.inicio ?? "" }; });
      setCfg(cmap);
      setLoadOk(true); // carregou sem erro → seguro salvar
    } catch {
      setMsg("❌ Erro ao carregar metas. Recarregue antes de salvar.");
    } finally {
      setLoading(false);
    }
  }

  const getCfg = (item, campo) => cfg[String(item)]?.[campo] ?? "";
  const setCfgVal = (item, campo, v) =>
    setCfg((prev) => ({ ...prev, [String(item)]: { ...prev[String(item)], [campo]: v } }));

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
    // Proteção contra apagar tudo: o POST substitui a aba inteira. Se o carregamento
    // falhou (dados vazios por erro), NÃO deixa salvar — senão sobrescreve em branco.
    if (!loadOk) {
      setMsg("❌ Os dados não carregaram — recarregue a página antes de salvar (proteção contra apagar as metas).");
      setTimeout(() => setMsg(""), 7000);
      return;
    }
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
      // Nunca sobrescreve as metas com um conjunto VAZIO (evita zerar a aba por engano).
      if (linhas.length === 0) {
        const cfgLinhas0 = ITENS
          .map(({ n }) => ({ item: n, pts: getCfg(n, "pts"), peso: getCfg(n, "peso"), inicio: getCfg(n, "inicio") }))
          .filter((l) => l.pts !== "" || l.peso !== "" || l.inicio !== "");
        if (cfgLinhas0.length) await api.post("/api/spo/painel/config", { linhas: cfgLinhas0 });
        setMsg("⚠️ Nenhuma meta/real preenchido — metas NÃO foram sobrescritas (proteção). Config salva.");
        setSalvando(false);
        setTimeout(() => setMsg(""), 7000);
        return;
      }
      await api.post("/api/spo/painel/metas", { linhas });

      // Salva também a config de pontuação/peso por KPI (alimenta o consolidado).
      const cfgLinhas = ITENS
        .map(({ n }) => ({ item: n, pts: getCfg(n, "pts"), peso: getCfg(n, "peso"), inicio: getCfg(n, "inicio") }))
        .filter((l) => l.pts !== "" || l.peso !== "" || l.inicio !== "");
      await api.post("/api/spo/painel/config", { linhas: cfgLinhas });

      setMsg(`✅ ${linhas.length} metas + ${cfgLinhas.length} configs salvas!`);
    } catch {
      setMsg("❌ Erro ao salvar metas.");
    } finally {
      setSalvando(false);
      setTimeout(() => setMsg(""), 5000);
    }
  }

  // ── Limpar reais de um mês do spo_metas ───────────────────────────────────
  async function limparReais() {
    const label = MESES_LABEL[mesFecha] || mesFecha;
    if (!window.confirm(
      `Limpar todos os realizados de ${label} do histórico?\n\n` +
      `As METAS de ${label} serão preservadas. Apenas os valores da coluna "Real" serão apagados.\n\n` +
      `Use isso para corrigir realizados gravados incorretamente.`
    )) return;

    setFechando(true);
    setSnapshotResult(null);
    setMsg("");
    try {
      const res = await api.patch("/api/spo/painel/limpar-reais", { mes: mesFecha });
      setMsg(`🗑️ ${res.data.limpos} realizados de ${label} foram limpos.`);
      await carregar();
    } catch (err) {
      setMsg(err.response?.data?.error || "❌ Erro ao limpar realizados.");
    } finally {
      setFechando(false);
      setTimeout(() => setMsg(""), 6000);
    }
  }

  // ── Snapshot: grava os reais calculados do mês em spo_metas ─────────────
  async function fecharMes() {
    const label = MESES_LABEL[mesFecha] || mesFecha;
    if (!window.confirm(
      `Gravar os realizados de ${label} no histórico?\n\n` +
      `Isso vai ler todos os dados atuais de ${label} e salvar os valores calculados na coluna "Real" do spo_metas.\n\n` +
      `Faça isso ANTES de importar arquivos de outro mês para não perder os dados de ${label}.`
    )) return;

    setFechando(true);
    setSnapshotResult(null);
    setMsg("");
    try {
      const res = await api.patch("/api/spo/painel/fechar-mes", { mes: mesFecha });
      setSnapshotResult(res.data);
      setMsg(`✅ Snapshot de ${label} gravado — ${res.data.salvos} KPIs salvos.`);
      await carregar(); // atualiza a tabela com os novos reais
    } catch (err) {
      setMsg(err.response?.data?.error || "❌ Erro ao fechar o mês.");
    } finally {
      setFechando(false);
      setTimeout(() => setMsg(""), 8000);
    }
  }

  // Importar Excel (lê via FileReader como CSV-like via SheetJS se disponível, ou JSON)
  function importarExcel(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target.result);
        aplicarLinhas(json);
      } catch {
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

  // Baixa um MODELO CSV já preenchido com os valores atuais (metas + realizado) de
  // todos os KPIs × meses. O admin edita no Excel e reimporta pelo "Importar JSON/CSV".
  // Real em branco = usa o dado ao vivo. Colunas ordem/indicador são só de leitura.
  function baixarModelo() {
    const headers = ["ordem", "indicador", "item", "mes", "meta", "real"];
    const linhas = [headers.join(",")];
    ITENS.forEach(({ n, label, ord }) => {
      const ind = String(label).replace(/[,\r\n]/g, " "); // sem vírgula (CSV simples)
      MESES.forEach((mes) => {
        linhas.push([ord ?? "", ind, n, mes, getVal(n, mes, "meta"), getVal(n, mes, "real")].join(","));
      });
    });
    const csv = "﻿" + linhas.join("\n"); // BOM p/ Excel abrir UTF-8 (ç/ã)
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `modelo_metas_spo_${MESES[0]}_a_${MESES[MESES.length - 1]}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setMsg("⬇️ Modelo baixado (com os valores atuais). Edite meta/real e reimporte. Real vazio = ao vivo.");
    setTimeout(() => setMsg(""), 7000);
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

      {/* ── Cabeçalho + ações ── */}
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
            onClick={baixarModelo}
            title="Baixa um CSV com os valores atuais para editar no Excel e reimportar"
            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)", padding: "7px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "0.82rem", fontFamily: "inherit" }}>
            ⬇️ Baixar modelo
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)", padding: "7px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "0.82rem", fontFamily: "inherit" }}>
            📥 Importar JSON/CSV
          </button>
          <button
            onClick={salvar}
            disabled={salvando}
            style={{ background: salvando ? "rgba(125,186,61,0.1)" : "rgba(125,186,61,0.2)", border: "1px solid rgba(125,186,61,0.4)", color: "#7DBA3D", padding: "7px 18px", borderRadius: "8px", cursor: salvando ? "not-allowed" : "pointer", fontSize: "0.85rem", fontWeight: "600", fontFamily: "inherit" }}>
            {salvando ? "⏳ Salvando..." : "💾 Salvar"}
          </button>
        </div>
      </div>

      {/* ── Painel de Snapshot ── */}
      <div style={{ background: "rgba(46,125,50,0.08)", border: "1px solid rgba(46,125,50,0.25)", borderRadius: "12px", padding: "14px 18px", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: "220px" }}>
            <p style={{ margin: "0 0 3px", fontWeight: "700", fontSize: "0.88rem", color: "#7DBA3D" }}>
              📸 Snapshot de Fechamento
            </p>
            <p style={{ margin: 0, fontSize: "0.76rem", color: "rgba(255,255,255,0.4)", lineHeight: 1.4 }}>
              Lê os dados calculados do mês selecionado e grava os realizados no histórico.<br />
              <strong style={{ color: "rgba(255,255,255,0.6)" }}>Use antes de importar arquivos de outro mês.</strong>
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0, flexWrap: "wrap" }}>
            <select
              value={mesFecha}
              onChange={(e) => setMesFecha(e.target.value)}
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(46,125,50,0.35)", borderRadius: "8px", color: "#fff", padding: "7px 12px", fontSize: "0.85rem", fontFamily: "inherit", cursor: "pointer" }}
            >
              {MESES.map((m) => (
                <option key={m} value={m}>{MESES_LABEL[m] || m}</option>
              ))}
            </select>
            <button
              onClick={fecharMes}
              disabled={fechando}
              style={{ background: fechando ? "rgba(46,125,50,0.1)" : "rgba(46,125,50,0.25)", border: "1px solid rgba(46,125,50,0.5)", color: "#7DBA3D", padding: "7px 18px", borderRadius: "8px", cursor: fechando ? "not-allowed" : "pointer", fontSize: "0.85rem", fontWeight: "600", fontFamily: "inherit", whiteSpace: "nowrap" }}
            >
              {fechando ? "⏳ Calculando..." : "📸 Gerar Snapshot"}
            </button>
            <button
              onClick={limparReais}
              disabled={fechando}
              title="Apaga os valores da coluna Real para o mês selecionado — preserva as metas"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", padding: "7px 14px", borderRadius: "8px", cursor: fechando ? "not-allowed" : "pointer", fontSize: "0.82rem", fontFamily: "inherit", whiteSpace: "nowrap" }}
            >
              🗑️ Limpar Reais
            </button>
          </div>
        </div>

        {/* Resultado do último snapshot */}
        {snapshotResult && (
          <div style={{ marginTop: "12px", borderTop: "1px solid rgba(46,125,50,0.2)", paddingTop: "10px" }}>
            <p style={{ margin: "0 0 8px", fontSize: "0.78rem", color: "rgba(165,180,252,0.8)", fontWeight: "600" }}>
              ✅ {snapshotResult.salvos} KPIs gravados para {MESES_LABEL[snapshotResult.mes] || snapshotResult.mes}:
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {(snapshotResult.reais || []).map(({ item, real }) => {
                const it = ITENS.find((x) => x.n === item);
                return (
                  <span key={item} style={{ background: "rgba(46,125,50,0.15)", border: "1px solid rgba(46,125,50,0.25)", borderRadius: "6px", padding: "3px 8px", fontSize: "0.72rem", color: "rgba(255,255,255,0.7)" }}>
                    <span style={{ color: "rgba(165,180,252,0.7)", fontWeight: "700" }}>#{item}</span>{" "}
                    {it?.label.split(" ").slice(0, 2).join(" ")}:{" "}
                    <strong style={{ color: "#4ade80" }}>{real}</strong>
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Mensagem de status ── */}
      {msg && (
        <div style={{
          background: msg.startsWith("✅") ? "rgba(74,222,128,0.1)" : msg.startsWith("📥") ? "rgba(125,186,61,0.1)" : "rgba(239,68,68,0.1)",
          border: `1px solid ${msg.startsWith("✅") ? "rgba(74,222,128,0.3)" : msg.startsWith("📥") ? "rgba(125,186,61,0.3)" : "rgba(239,68,68,0.3)"}`,
          borderRadius: "8px", padding: "10px 14px", marginBottom: "14px", fontSize: "0.85rem"
        }}>
          {msg}
        </div>
      )}

      {/* ── Tabela ── */}
      {loading ? (
        <p style={{ color: "rgba(255,255,255,0.35)", textAlign: "center", padding: "40px" }}>Carregando...</p>
      ) : (
        <div style={{ overflowX: "auto", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.08)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
            <thead>
              <tr>
                <th style={{ ...thS, textAlign: "left", minWidth: "40px" }}>#</th>
                <th style={{ ...thS, textAlign: "left", minWidth: "200px" }}>Indicador</th>
                <th style={{ ...thS, minWidth: "56px", background: "rgba(125,186,61,0.1)" }} rowSpan={2}>Pts</th>
                <th style={{ ...thS, minWidth: "56px", background: "rgba(125,186,61,0.1)" }} rowSpan={2}>Peso %</th>
                <th style={{ ...thS, minWidth: "92px", background: "rgba(125,186,61,0.1)" }} rowSpan={2} title="Mês a partir do qual o KPI passa a ser apontado (AAAA-MM)">Início apont.</th>
                {MESES.map((mes) => (
                  <th key={mes} colSpan={2} style={{ ...thS, background: "rgba(125,186,61,0.06)", borderLeft: "1px solid rgba(255,255,255,0.08)" }}>
                    {MESES_LABEL[mes]}
                  </th>
                ))}
              </tr>
              <tr>
                <th style={thS} colSpan={2}></th>
                {MESES.map((mes) => (
                  ["Meta", "Real"].map((h) => (
                    <th key={mes + h} style={{ ...thS, background: "rgba(125,186,61,0.04)", fontSize: "0.68rem" }}>{h}</th>
                  ))
                ))}
              </tr>
            </thead>
            <tbody>
              {ITENS.map(({ n, label, ord }) => (
                <tr key={n} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <td style={{ padding: "6px 10px", color: "rgba(255,255,255,0.4)", fontSize: "0.75rem" }}>{ord ?? n}</td>
                  <td style={{ padding: "6px 10px", color: "rgba(255,255,255,0.8)", fontSize: "0.8rem", whiteSpace: "nowrap" }}>{label}</td>
                  <td style={{ padding: "4px 6px", background: "rgba(125,186,61,0.04)" }}>
                    <input style={{ ...inpStyle, width: "50px" }} value={getCfg(n, "pts")} onChange={(e) => setCfgVal(n, "pts", e.target.value)} placeholder={String(REG[n]?.pts ?? "")} />
                  </td>
                  <td style={{ padding: "4px 6px", background: "rgba(125,186,61,0.04)" }}>
                    <input style={{ ...inpStyle, width: "50px" }} value={getCfg(n, "peso")} onChange={(e) => setCfgVal(n, "peso", e.target.value)} placeholder={String(REG[n]?.peso ?? "")} />
                  </td>
                  <td style={{ padding: "4px 6px", background: "rgba(125,186,61,0.04)" }}>
                    <input type="month" style={{ ...inpStyle, width: "84px" }} value={getCfg(n, "inicio")} onChange={(e) => setCfgVal(n, "inicio", e.target.value)} title="Mês de início do apontamento" />
                  </td>
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
                          style={{ ...inpStyle, borderColor: getVal(n, mes, "real") !== "" ? "rgba(74,222,128,0.4)" : "rgba(255,255,255,0.12)", background: getVal(n, mes, "real") !== "" ? "rgba(74,222,128,0.06)" : "rgba(255,255,255,0.07)" }}
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
