// Relatório aberto configurável (dentro de "Outros relatórios"):
// item (grupo · subcategoria · SKU específico) × indicador (cobertura · volume · distribuição)
// × meses escolhidos × aberto por setor (ou só a operação). Dados: GET /api/relatorios/aberto.
import { useState, useEffect } from "react";
import * as XLSX from "xlsx-js-style";
import api from "../../services/api";

const VERDE = "#7DBA3D";
const NOMES_MES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const rot = (ym) => `${NOMES_MES[Number(ym.slice(5, 7)) - 1]}/${ym.slice(2, 4)}`;
const IND = {
  cobertura:    { label: "Cobertura",    unid: "PDVs", desc: "Nº de PDVs distintos que compraram no mês" },
  volume:       { label: "Volume",       unid: "HL",   desc: "Soma de HL vendidos no mês" },
  distribuicao: { label: "Distribuição", unid: "SKUs", desc: "Σ por PDV dos SKUs distintos comprados (e a média por PDV)" },
};
const fmt = (v, ind) => (Number(v) || 0).toLocaleString("pt-BR", { maximumFractionDigits: ind === "volume" ? 1 : 1 });

// Últimos 12 meses (mais recente primeiro); padrão = os 4 meses completos antes do atual.
function mesesDisponiveis() {
  const d = new Date(); const out = [];
  for (let k = 0; k < 12; k++) {
    const x = new Date(d.getFullYear(), d.getMonth() - k, 1);
    out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export default function RelatorioAberto() {
  const [aberto, setAberto] = useState(false);
  const [opc, setOpc] = useState(null);               // { grupos, subcategorias }
  const [item, setItem] = useState("grupo:cerveja");  // grupo:… | cat:… | "sku"
  const [sku, setSku] = useState("");
  const [skuNome, setSkuNome] = useState("");
  const [ind, setInd] = useState("cobertura");
  const opcoesMes = mesesDisponiveis();
  const [meses, setMeses] = useState(() => opcoesMes.slice(1, 5));
  const [porSetor, setPorSetor] = useState(true);
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!aberto || opc) return;
    api.get("/api/relatorios/aberto/opcoes").then((r) => setOpc(r.data)).catch(() => {});
  }, [aberto, opc]);

  // SKU específico: mostra o nome do produto enquanto digita
  useEffect(() => {
    if (item !== "sku" || !/^\d{2,}$/.test(sku.trim())) { setSkuNome(""); return; }
    const h = setTimeout(() => {
      api.get(`/api/relatorios/aberto/sku/${sku.trim()}`).then((r) => setSkuNome(r.data?.nome || ""))
        .catch(() => setSkuNome("⚠️ não encontrado no cadastro"));
    }, 500);
    return () => clearTimeout(h);
  }, [item, sku]);

  const toggleMes = (m) => setMeses((ms) => (ms.includes(m) ? ms.filter((x) => x !== m) : [...ms, m]));

  async function gerar() {
    if (!meses.length) { setErro("Marque ao menos um mês."); return; }
    if (item === "sku" && !/^\d+$/.test(sku.trim())) { setErro("Digite o código do SKU."); return; }
    setLoading(true); setErro(""); setD(null);
    try {
      const r = await api.get("/api/relatorios/aberto", { params: { item: item === "sku" ? `sku:${sku.trim()}` : item, indicador: ind, meses: [...meses].sort().join(",") }, timeout: 60000 });
      setD(r.data);
    } catch (e) { setErro(e.response?.data?.error || "Erro ao gerar o relatório."); }
    finally { setLoading(false); }
  }

  function exportar() {
    if (!d) return;
    const cab = ["Setor", "RN", ...d.meses.map(rot), d.totalLabel];
    if (d.indicador === "distribuicao") cab.splice(2 + d.meses.length, 0, ...d.meses.map((m) => `Média/PDV ${rot(m)}`));
    const linha = (setor, nome, o) => {
      const base = [setor, nome, ...o.valores.map((v) => v.v)];
      if (d.indicador === "distribuicao") base.push(...o.valores.map((v) => v.media ?? 0));
      return [...base, o.total];
    };
    const corpo = [...(porSetor ? d.linhas.map((l) => linha(l.setor, l.nome, l)) : []), linha("OPERAÇÃO", "", d.operacao)];
    const ws = XLSX.utils.aoa_to_sheet([[`${d.item.label} — ${IND[d.indicador].label} (${IND[d.indicador].unid})`], [], cab, ...corpo]);
    const head = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "2E7D32" } }, alignment: { horizontal: "center" } };
    cab.forEach((_, c) => { const ref = XLSX.utils.encode_cell({ r: 2, c }); if (ws[ref]) ws[ref].s = head; });
    ws["A1"].s = { font: { bold: true, sz: 13, color: { rgb: "2E7D32" } } };
    const ult = corpo.length + 2;
    cab.forEach((_, c) => { const ref = XLSX.utils.encode_cell({ r: ult, c }); if (ws[ref]) ws[ref].s = { font: { bold: true }, fill: { fgColor: { rgb: "EAF3DE" } } }; });
    ws["!cols"] = cab.map((h, i) => ({ wch: i === 1 ? 22 : Math.max(10, String(h).length + 2) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatório");
    // Nome com TODAS as escolhas: indicador, item, por setor/operação e cada mês marcado.
    // grupo:cerveja → Cerveja · cat:CERVEJA ZERO → CervejaZero · sku:33857 → SKU33857
    const ITEM_ARQ = (id) => id.startsWith("sku:") ? `SKU${id.slice(4)}`
      : id.split(":")[1].toLowerCase().replace(/[()]/g, "").split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("")
          .replace(/^Nab/, "NAB").replace(/^Mktp$/, "MKTP").replace(/Rgb/g, "RGB").replace(/^He/, "HE");
    const anos = [...new Set(d.meses.map((m) => m.slice(2, 4)))];
    const mesesArq = anos.length === 1
      ? `${d.meses.map((m) => NOMES_MES[Number(m.slice(5, 7)) - 1]).join("-")}-${anos[0]}`
      : d.meses.map((m) => rot(m).replace("/", "")).join("-");
    XLSX.writeFile(wb, `${IND[d.indicador].label.normalize("NFD").replace(/[̀-ͯ]/g, "")}_${ITEM_ARQ(d.item.id)}_${porSetor ? "PorSetor" : "Operacao"}_${mesesArq}.xlsx`);
  }

  const dist = d?.indicador === "distribuicao";
  return (
    <div style={S.card}>
      <button style={S.head} onClick={() => setAberto((a) => !a)}>
        <span>📊 Relatório aberto por setor — cobertura · volume · distribuição</span>
        <span style={{ color: "rgba(255,255,255,0.5)" }}>{aberto ? "▾" : "▸"}</span>
      </button>
      {aberto && (
        <div style={{ padding: "4px 14px 14px" }}>
          <div style={S.linhaCtrl}>
            <select style={{ ...S.select, maxWidth: 340 }} value={item} onChange={(e) => setItem(e.target.value)}>
              <optgroup label="Grupos (somam as subcategorias)">
                {(opc?.grupos || [{ id: "grupo:cerveja", label: "Cerveja (todas)" }]).map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
              </optgroup>
              {opc?.subcategorias?.length > 0 && (
                <optgroup label="Subcategorias">
                  {opc.subcategorias.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
                </optgroup>
              )}
              <optgroup label="Outro">
                <option value="sku">🔎 SKU específico…</option>
              </optgroup>
            </select>
            {item === "sku" && (
              <>
                <input style={{ ...S.select, width: 110 }} value={sku} onChange={(e) => setSku(e.target.value.replace(/\D/g, ""))} placeholder="Código" inputMode="numeric" />
                {skuNome && <span style={{ color: skuNome.startsWith("⚠️") ? "#f87171" : "rgba(255,255,255,0.7)", fontSize: "0.8rem" }}>{skuNome}</span>}
              </>
            )}
            <div style={S.seg}>
              {Object.entries(IND).map(([k, v]) => (
                <button key={k} type="button" onClick={() => setInd(k)} style={ind === k ? S.segOn : S.segBtn}>{v.label}</button>
              ))}
            </div>
            <label style={S.chk}><input type="checkbox" checked={porSetor} onChange={(e) => setPorSetor(e.target.checked)} /> Abrir por setor</label>
          </div>
          <div style={S.linhaCtrl}>
            <span style={S.lbl}>Meses:</span>
            {[...opcoesMes].reverse().map((m) => (
              <button key={m} type="button" onClick={() => toggleMes(m)} style={meses.includes(m) ? S.mesOn : S.mes}>{rot(m)}</button>
            ))}
          </div>
          <p style={S.hint}>{IND[ind].label}: {IND[ind].desc}.</p>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <button style={S.gerar} onClick={gerar} disabled={loading}>{loading ? "Gerando…" : "Gerar"}</button>
            {d && <button style={S.excel} onClick={exportar}>⤓ Excel</button>}
          </div>
          {erro && <p style={{ color: "#f87171", fontSize: "0.84rem" }}>{erro}</p>}

          {d && (
            <div style={S.tableWrap}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Setor / RN</th>
                    {d.meses.map((m) => <th key={m} style={S.thC}>{rot(m)}</th>)}
                    <th style={S.thC}>{d.totalLabel}</th>
                  </tr>
                </thead>
                <tbody>
                  {porSetor && d.linhas.map((l) => (
                    <tr key={l.setor} style={S.tr}>
                      <td style={S.td}>{l.setor}{l.nome ? ` · ${l.nome.split(" ")[0]}` : ""}</td>
                      {l.valores.map((v, i) => (
                        <td key={i} style={S.tdC}>{fmt(v.v, d.indicador)}{dist && v.pdvs ? <span style={S.media}> · {fmt(v.media, "x")}/PDV</span> : null}</td>
                      ))}
                      <td style={{ ...S.tdC, fontWeight: 700 }}>{fmt(l.total, d.indicador)}</td>
                    </tr>
                  ))}
                  {porSetor && !d.linhas.length && <tr><td colSpan={d.meses.length + 2} style={S.vazio}>Sem venda desse item nos meses escolhidos.</td></tr>}
                  <tr style={{ background: "rgba(125,186,61,0.10)" }}>
                    <td style={{ ...S.td, fontWeight: 700, color: VERDE }}>🏭 Operação</td>
                    {d.operacao.valores.map((v, i) => (
                      <td key={i} style={{ ...S.tdC, fontWeight: 700 }}>{fmt(v.v, d.indicador)}{dist && v.pdvs ? <span style={S.media}> · {fmt(v.media, "x")}/PDV</span> : null}</td>
                    ))}
                    <td style={{ ...S.tdC, fontWeight: 800, color: VERDE }}>{fmt(d.operacao.total, d.indicador)}</td>
                  </tr>
                </tbody>
              </table>
              <p style={S.hint}>{IND[d.indicador].unid} · {d.item.label}{d.item.skus > 1 ? ` (${d.item.skus} SKUs cadastrados na categoria)` : ""} · setores 301–305 aparecem como 107–111.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const S = {
  card: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(125,186,61,0.25)", borderRadius: 14, marginBottom: 16, overflow: "hidden" },
  head: { width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", background: "transparent", border: "none", color: "#fff", padding: "14px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.95rem", fontWeight: 700, textAlign: "left" },
  linhaCtrl: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 },
  select: { background: "#13231a", color: "#fff", border: "1px solid rgba(125,186,61,0.3)", borderRadius: 8, padding: "8px 10px", fontSize: "0.84rem", fontFamily: "inherit" },
  seg: { display: "inline-flex", background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: 2 },
  segBtn: { background: "transparent", border: "none", color: "rgba(255,255,255,0.55)", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", fontSize: "0.82rem" },
  segOn: { background: "rgba(125,186,61,0.22)", border: "none", color: VERDE, padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", fontSize: "0.82rem", fontWeight: 700 },
  chk: { display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.75)", fontSize: "0.84rem", cursor: "pointer" },
  lbl: { color: "rgba(255,255,255,0.55)", fontSize: "0.8rem" },
  mes: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.55)", borderRadius: 16, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.78rem" },
  mesOn: { background: "rgba(125,186,61,0.18)", border: "1px solid rgba(125,186,61,0.6)", color: VERDE, borderRadius: 16, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.78rem", fontWeight: 700 },
  hint: { color: "rgba(255,255,255,0.4)", fontSize: "0.76rem", margin: "4px 0 10px" },
  gerar: { background: "linear-gradient(135deg,#7DBA3D,#2E7D32)", color: "#0c1410", border: "none", borderRadius: 8, padding: "8px 18px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  excel: { background: "transparent", border: "1px solid rgba(125,186,61,0.5)", color: VERDE, borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 },
  tableWrap: { overflowX: "auto", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" },
  th: { padding: "8px 10px", color: "rgba(255,255,255,0.5)", textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap" },
  thC: { padding: "8px 10px", color: "rgba(255,255,255,0.5)", textAlign: "right", borderBottom: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap" },
  tr: { borderBottom: "1px solid rgba(255,255,255,0.05)" },
  td: { padding: "7px 10px", color: "rgba(255,255,255,0.85)", whiteSpace: "nowrap" },
  tdC: { padding: "7px 10px", color: "#fff", textAlign: "right", whiteSpace: "nowrap" },
  media: { color: "rgba(255,255,255,0.4)", fontSize: "0.72rem", fontWeight: 400 },
  vazio: { padding: 18, textAlign: "center", color: "rgba(255,255,255,0.4)" },
};
