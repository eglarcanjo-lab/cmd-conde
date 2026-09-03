// Ações de Preço (diretoria+) — apoio ao cadastro de descontos escalonados.
// Combo de SKUs: monta uma ação com 1+ produtos (ex.: Gua 2L + Gua 2L Zero).
// Volume: média mensal de caixas do combo por PDV (tri anterior) → base → quant inicial p/ desconto.
// Cobertura: PDVs que não compraram NENHUM dos SKUs do combo. Exporta Excel.
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx-js-style";
import api from "../../services/api";

const VERDE = "#7DBA3D";
const ceilN = (n) => Math.ceil(Number(n) || 0);
const fmt = (n, d = 1) => (Number(n) || 0).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

export default function AcoesPreco() {
  const navigate = useNavigate();
  const [busca, setBusca] = useState("");
  const [sugestoes, setSugestoes] = useState([]);
  const [combo, setCombo] = useState([]); // [{cod, nome}]
  const [tipo, setTipo] = useState("volume");
  const [aumento, setAumento] = useState(20);
  const [piso, setPiso] = useState(5);
  const [degraus, setDegraus] = useState([{ aumento: 20, desconto: 3 }, { aumento: 40, desconto: 5 }, { aumento: 60, desconto: 8 }]);
  const [vol, setVol] = useState(null);
  const [cob, setCob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const timer = useRef(null);

  useEffect(() => {
    if (busca.trim().length < 2) { setSugestoes([]); return; }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      api.get(`/api/acoes-preco/produtos?q=${encodeURIComponent(busca.trim())}`).then((r) => setSugestoes(r.data || [])).catch(() => {});
    }, 350);
    return () => clearTimeout(timer.current);
  }, [busca]);

  async function carregar(cods, tp) {
    if (!cods.length) { setVol(null); setCob(null); return; }
    setLoading(true); setErro(""); setVol(null); setCob(null);
    const sku = cods.join(",");
    try {
      const opt = { timeout: 60000 };
      if (tp === "volume") setVol((await api.get(`/api/acoes-preco/volume?sku=${sku}`, opt)).data);
      else setCob((await api.get(`/api/acoes-preco/cobertura?sku=${sku}`, opt)).data);
    } catch (e) { setErro(e?.response?.data?.error || "Erro ao carregar."); }
    finally { setLoading(false); }
  }
  function adicionar(p) {
    if (combo.some((x) => x.cod === p.cod)) { setBusca(""); setSugestoes([]); return; }
    const novo = [...combo, p];
    setCombo(novo); setBusca(""); setSugestoes([]); carregar(novo.map((x) => x.cod), tipo);
  }
  function remover(cod) {
    const novo = combo.filter((x) => x.cod !== cod);
    setCombo(novo); carregar(novo.map((x) => x.cod), tipo);
  }
  function trocarTipo(tp) { setTipo(tp); if (combo.length) carregar(combo.map((x) => x.cod), tp); }

  const setDeg = (i, c, v) => setDegraus((d) => d.map((x, j) => (j === i ? { ...x, [c]: v } : x)));
  const addDeg = () => setDegraus((d) => [...d, { aumento: "", desconto: "" }]);
  const rmDeg = (i) => setDegraus((d) => d.filter((_, j) => j !== i));
  const degOrd = degraus
    .filter((d) => d.aumento !== "" && !isNaN(Number(d.aumento)))
    .map((d) => ({ aumento: Number(d.aumento), desconto: Number(d.desconto) || 0 }))
    .sort((a, b) => a.aumento - b.aumento);

  const linhasVol = (vol?.pdvs || []).map((p) => {
    const base = Math.max(Number(p.media_cx) || 0, Number(piso) || 0);
    const quantInicial = ceilN(base * (1 + (Number(aumento) || 0) / 100));
    const tiers = degOrd.map((d) => ceilN(base * (1 + d.aumento / 100)));
    return { ...p, base, quantInicial, tiers };
  });

  const codsStr = (arr) => (arr || []).map((p) => p.cod).join(" + ");
  const nomesStr = (arr) => (arr || []).map((p) => p.nome).join(" + ");

  function baixar(rows, nome) {
    if (!rows.length) { alert("Sem linhas para exportar."); return; }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Acao de Preco");
    XLSX.writeFile(wb, `${nome}.xlsx`);
  }
  function exportar() {
    if (tipo === "volume" && vol) {
      const cs = codsStr(vol.produtos), ns = nomesStr(vol.produtos);
      const rows = linhasVol.map((p) => {
        const o = { "Cod PDV": p.cod_pdv, "PDV": p.nome_pdv, "Setor": p.setor, "RN": p.rn, "Combo (cod)": cs, "Combo (produtos)": ns, "Média (cx)": p.media_cx, "Base (cx)": p.base, "Quant inicial (cx)": p.quantInicial };
        degOrd.forEach((d, i) => { o[`+${d.aumento}% · ${d.desconto}% desc (cx)`] = p.tiers[i]; });
        return o;
      });
      baixar(rows, `acao_preco_volume_${vol.produtos.map((p) => p.cod).join("-")}`);
    } else if (tipo === "cobertura" && cob) {
      const cs = codsStr(cob.produtos), ns = nomesStr(cob.produtos);
      baixar((cob.nao_compradores || []).map((p) => ({ "Cod PDV": p.cod_pdv, "PDV": p.nome_pdv, "Setor": p.setor, "RN": p.rn, "Combo (cod)": cs, "Combo (produtos)": ns, "Status": "Não comprou nenhum" })), `acao_preco_cobertura_${cob.produtos.map((p) => p.cod).join("-")}`);
    }
  }

  const temCombo = combo.length > 0;

  return (
    <div style={S.root}>
      <div style={S.header}>
        <button style={S.back} onClick={() => navigate("/")}>← Início</button>
        <div>
          <h1 style={S.title}>🏷️ Ações de Preço</h1>
          <p style={S.sub}>Descontos escalonados a partir do histórico de compra (trimestre anterior)</p>
        </div>
      </div>

      <div style={S.content}>
        {/* Combo de produtos */}
        <div style={{ maxWidth: 620 }}>
          <label style={S.lbl}>Produtos da ação (combo)</label>
          {temCombo && (
            <div style={S.chips}>
              {combo.map((p) => (
                <span key={p.cod} style={S.chip}>
                  <b style={{ color: VERDE }}>{p.cod}</b> · {p.nome}
                  <button style={S.chipX} onClick={() => remover(p.cod)} title="Remover do combo">✕</button>
                </span>
              ))}
            </div>
          )}
          <div style={{ position: "relative" }}>
            <input style={S.input} value={busca} placeholder={temCombo ? "+ Adicionar outro produto ao combo…" : "Digite o código ou nome do produto…"} onChange={(e) => setBusca(e.target.value)} />
            {sugestoes.length > 0 && (
              <div style={S.drop}>
                {sugestoes.map((p) => (
                  <div key={p.cod} style={combo.some((x) => x.cod === p.cod) ? S.dropItemOn : S.dropItem} onClick={() => adicionar(p)}>
                    <span style={S.plus}>{combo.some((x) => x.cod === p.cod) ? "✓" : "+"}</span>
                    <b style={{ color: VERDE }}>{p.cod}</b> · {p.nome}
                  </div>
                ))}
              </div>
            )}
          </div>
          {temCombo && <p style={S.comboHint}>Combo com {combo.length} produto{combo.length > 1 ? "s" : ""}. Em Cobertura, aparecem os PDVs que não compraram <b>nenhum</b> deles.</p>}
        </div>

        {temCombo && (
          <>
            {/* Tipo */}
            <div style={S.tipoRow}>
              <button style={tipo === "volume" ? S.tipoOn : S.tipo} onClick={() => trocarTipo("volume")}>📈 Volume</button>
              <button style={tipo === "cobertura" ? S.tipoOn : S.tipo} onClick={() => trocarTipo("cobertura")}>🎯 Cobertura (não compradores)</button>
            </div>

            {erro && <div style={S.erro}>{erro}</div>}
            {loading && <div style={S.msg}>Carregando… (plano grátis pode levar ~50s)</div>}

            {/* ── VOLUME ── */}
            {!loading && tipo === "volume" && vol && (
              <>
                <div style={S.cfgCard}>
                  <div style={S.cfgRow}>
                    <div>
                      <label style={S.lbl}>Aumento de volume alvo (%)</label>
                      <input style={S.inputNum} type="number" value={aumento} onChange={(e) => setAumento(e.target.value)} />
                      <span style={S.hint}>gera a “quant. inicial p/ desconto”</span>
                    </div>
                    <div>
                      <label style={S.lbl}>Piso (cx)</label>
                      <input style={S.inputNum} type="number" value={piso} onChange={(e) => setPiso(e.target.value)} />
                      <span style={S.hint}>quem compra menos que isso usa o piso como base</span>
                    </div>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <label style={S.lbl}>Degraus de desconto</label>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {degraus.map((d, i) => (
                        <div key={i} style={S.degRow}>
                          <span style={S.degTxt}>a partir de +</span>
                          <input style={S.inputMini} type="number" value={d.aumento} onChange={(e) => setDeg(i, "aumento", e.target.value)} />
                          <span style={S.degTxt}>% de volume →</span>
                          <input style={S.inputMini} type="number" value={d.desconto} onChange={(e) => setDeg(i, "desconto", e.target.value)} />
                          <span style={S.degTxt}>% de desconto</span>
                          <button style={S.rmBtn} onClick={() => rmDeg(i)} title="Remover">✕</button>
                        </div>
                      ))}
                    </div>
                    <button style={S.addBtn} onClick={addDeg}>+ Degrau</button>
                  </div>
                </div>

                <div style={S.resumo}>
                  <span><b style={{ color: "#fff" }}>{nomesStr(vol.produtos)}</b></span>
                  <span> · {vol.pdvs.length} PDVs · média (soma do combo) do trimestre <b>{vol.trimestre}</b></span>
                  {vol.sem_hl && <span style={{ color: "#f0997b" }}> · ⚠️ algum produto sem HL/caixa na base — caixas podem sair zeradas</span>}
                  <button style={S.excel} onClick={exportar}>⤓ Exportar Excel</button>
                </div>

                <div style={S.tableWrap}>
                  <table style={S.table}>
                    <thead>
                      <tr>
                        {["Cod", "PDV", "Setor", "RN", "Média (cx)", "Base (cx)", `Quant. inicial (+${aumento}%)`].map((h) => <th key={h} style={S.th}>{h}</th>)}
                        {degOrd.map((d, i) => <th key={i} style={S.th}>+{d.aumento}% · {d.desconto}% desc</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {linhasVol.map((p) => (
                        <tr key={p.cod_pdv} style={S.tr}>
                          <td style={S.tdPlain}>{p.cod_pdv}</td>
                          <td style={S.tdNome} title={p.nome_pdv}>{p.nome_pdv}</td>
                          <td style={S.tdPlain}>{p.setor}</td>
                          <td style={S.tdRn} title={p.rn}>{p.rn || "—"}</td>
                          <td style={S.tdNum}>{fmt(p.media_cx)}</td>
                          <td style={S.tdNum}>{fmt(p.base)}</td>
                          <td style={{ ...S.tdNum, color: VERDE, fontWeight: 700 }}>{p.quantInicial}</td>
                          {p.tiers.map((t, i) => <td key={i} style={S.tdNum}>{t}</td>)}
                        </tr>
                      ))}
                      {!linhasVol.length && <tr><td colSpan={7 + degOrd.length} style={S.vazio}>Nenhum PDV com compra do combo no trimestre.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* ── COBERTURA ── */}
            {!loading && tipo === "cobertura" && cob && (
              <>
                <div style={S.resumo}>
                  <span><b style={{ color: "#fff" }}>{nomesStr(cob.produtos)}</b></span>
                  <span> · trimestre <b>{cob.trimestre}</b> · {cob.compradores} compraram algum · <b style={{ color: "#f0997b" }}>{cob.nao_compradores.length} não compraram nenhum</b></span>
                  <button style={S.excel} onClick={exportar}>⤓ Exportar Excel</button>
                </div>
                <div style={S.tableWrap}>
                  <table style={S.table}>
                    <thead><tr>{["Cod", "PDV", "Setor", "RN"].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {cob.nao_compradores.map((p) => (
                        <tr key={p.cod_pdv} style={S.tr}>
                          <td style={S.tdPlain}>{p.cod_pdv}</td>
                          <td style={S.tdNome} title={p.nome_pdv}>{p.nome_pdv}</td>
                          <td style={S.tdPlain}>{p.setor}</td>
                          <td style={S.tdRn} title={p.rn}>{p.rn || "—"}</td>
                        </tr>
                      ))}
                      {!cob.nao_compradores.length && <tr><td colSpan={4} style={S.vazio}>Todos os PDVs compraram algum SKU do combo no trimestre. 🎉</td></tr>}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const S = {
  root: { minHeight: "100vh", background: "#0c1410", fontFamily: "'Poppins','Segoe UI',system-ui,sans-serif", color: "#fff" },
  header: { display: "flex", alignItems: "flex-start", gap: 14, padding: "clamp(12px,3vw,20px) clamp(16px,4vw,32px)", borderBottom: "1px solid rgba(255,255,255,0.08)" },
  back: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", padding: "9px 14px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: "0.85rem", flexShrink: 0 },
  title: { margin: 0, fontSize: "1.3rem", fontWeight: 700 },
  sub: { margin: "3px 0 0", fontSize: "0.8rem", color: "rgba(255,255,255,0.4)" },
  content: { padding: "clamp(16px,4vw,28px)", maxWidth: 1500, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 },
  lbl: { display: "block", color: "rgba(255,255,255,0.5)", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 },
  input: { width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, color: "#fff", padding: "11px 14px", fontSize: "0.9rem", fontFamily: "inherit", outline: "none" },
  chips: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  chip: { display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(125,186,61,0.12)", border: "1px solid rgba(125,186,61,0.4)", borderRadius: 20, padding: "5px 6px 5px 12px", fontSize: "0.82rem", color: "rgba(255,255,255,0.9)" },
  chipX: { background: "rgba(255,255,255,0.1)", border: "none", color: "rgba(255,255,255,0.7)", borderRadius: "50%", width: 20, height: 20, cursor: "pointer", fontSize: "0.7rem", lineHeight: 1 },
  drop: { position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: "#16211b", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, zIndex: 20, maxHeight: 280, overflowY: "auto" },
  dropItem: { display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", fontSize: "0.85rem", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.85)" },
  dropItemOn: { display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", fontSize: "0.85rem", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", background: "rgba(125,186,61,0.06)" },
  plus: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: "50%", background: "rgba(125,186,61,0.2)", color: VERDE, fontWeight: 700, fontSize: "0.8rem", flexShrink: 0 },
  comboHint: { margin: "8px 0 0", fontSize: "0.75rem", color: "rgba(255,255,255,0.4)" },
  tipoRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  tipo: { background: "transparent", border: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.6)", borderRadius: 20, padding: "8px 16px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.85rem" },
  tipoOn: { background: "rgba(125,186,61,0.16)", border: "1px solid #7DBA3D", color: "#7DBA3D", borderRadius: 20, padding: "8px 16px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.85rem", fontWeight: 700 },
  cfgCard: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 16 },
  cfgRow: { display: "flex", gap: 24, flexWrap: "wrap" },
  inputNum: { width: 110, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff", padding: "8px 10px", fontSize: "0.9rem", fontFamily: "inherit", outline: "none" },
  hint: { display: "block", color: "rgba(255,255,255,0.3)", fontSize: "0.68rem", marginTop: 3 },
  degRow: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" },
  degTxt: { color: "rgba(255,255,255,0.55)", fontSize: "0.8rem" },
  inputMini: { width: 56, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, color: "#fff", padding: "5px 7px", fontSize: "0.82rem", fontFamily: "inherit", outline: "none", textAlign: "center" },
  rmBtn: { background: "transparent", border: "none", color: "rgba(248,113,113,0.7)", cursor: "pointer", fontSize: "0.9rem" },
  addBtn: { marginTop: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.7)", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.8rem" },
  resumo: { display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", color: "rgba(255,255,255,0.6)", fontSize: "0.85rem" },
  excel: { marginLeft: "auto", background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.4)", color: "#4ade80", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.82rem", fontWeight: 600 },
  tableWrap: { overflowX: "auto", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" },
  th: { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)", fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", padding: "9px 10px", textAlign: "left", whiteSpace: "nowrap", borderBottom: "1px solid rgba(255,255,255,0.08)" },
  tr: { borderBottom: "1px solid rgba(255,255,255,0.05)" },
  tdPlain: { padding: "7px 10px", color: "rgba(255,255,255,0.55)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" },
  tdNome: { padding: "7px 10px", color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 220 },
  tdRn: { padding: "7px 10px", color: "rgba(255,255,255,0.6)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 130 },
  tdNum: { padding: "7px 10px", color: "rgba(255,255,255,0.85)", textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" },
  vazio: { padding: 16, textAlign: "center", color: "rgba(255,255,255,0.35)" },
  erro: { background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", borderRadius: 8, padding: "10px 14px", fontSize: "0.85rem" },
  msg: { color: "rgba(255,255,255,0.4)", fontSize: "0.85rem", padding: "10px 2px" },
};
