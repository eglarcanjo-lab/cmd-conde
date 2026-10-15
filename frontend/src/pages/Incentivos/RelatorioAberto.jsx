// Relatório aberto configurável (dentro de "Outros relatórios"):
// item (grupo · subcategoria · SKU específico) × indicador (cobertura · volume · distribuição)
// × meses escolhidos × aberto por setor (ou só a operação). Dados: GET /api/relatorios/aberto.
import { useState, useEffect } from "react";
import * as XLSX from "xlsx-js-style";
import api from "../../services/api";
import { contarUso } from "../../utils/uso";

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

// Busca de produto por NOME ou CÓDIGO (base de produtos com categoria — não a Grade).
// Escolher = ADICIONA à lista (monta uma cesta de vários SKUs); os já escolhidos somem da lista.
function BuscaProduto({ produtos, escolhidos, onEscolher }) {
  const [q, setQ] = useState("");
  const [abrir, setAbrir] = useState(false);
  const norm = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const termos = norm(q).split(/\s+/).filter(Boolean);
  const ja = new Set(escolhidos.map((p) => p.cod));
  const livres = produtos.filter((p) => !ja.has(p.cod));
  const achados = !termos.length ? livres.slice(0, 30)
    : livres.filter((p) => { const alvo = norm(`${p.cod} ${p.nome}`); return termos.every((t) => alvo.includes(t)); }).slice(0, 30);
  return (
    <div style={{ position: "relative" }}>
      <input style={{ ...S.select, width: 300 }} value={q} placeholder={escolhidos.length ? "🔎 + adicionar outro produto" : "🔎 Digite o nome ou o código do produto"}
        onChange={(e) => { setQ(e.target.value); setAbrir(true); }}
        onFocus={() => setAbrir(true)} onBlur={() => setTimeout(() => setAbrir(false), 150)} />
      {abrir && (
        <div style={S.lista}>
          {achados.map((p) => (
            <div key={p.cod} style={S.opc} onMouseDown={() => { onEscolher(p); setQ(""); setAbrir(false); }}>
              <b style={{ color: "#fff" }}>{p.cod}</b> · {p.nome}
              <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.7rem" }}> — {p.categorias}</span>
            </div>
          ))}
          {!achados.length && <div style={{ ...S.opc, cursor: "default", color: "rgba(255,255,255,0.4)" }}>Nenhum produto com categoria encontrado.</div>}
        </div>
      )}
    </div>
  );
}

export default function RelatorioAberto() {
  const [aberto, setAberto] = useState(false);
  const [opc, setOpc] = useState(null);               // { grupos, subcategorias }
  const [item, setItem] = useState("grupo:cerveja");  // grupo:… | cat:… | "sku"
  const [produtos, setProdutos] = useState([]);       // base de produtos com categoria
  const [prodSel, setProdSel] = useState([]);         // [{ cod, nome, categorias }] — 1 ou mais SKUs
  const [metaPct, setMetaPct] = useState("");         // meta de cobertura % (opcional) → pinta verde/vermelho
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

  // SKU específico: carrega a base de produtos (com categoria) 1x ao escolher a opção
  useEffect(() => {
    if (item !== "sku" || produtos.length) return;
    api.get("/api/relatorios/aberto/produtos").then((r) => setProdutos(r.data || [])).catch(() => {});
  }, [item, produtos.length]);

  const toggleMes = (m) => setMeses((ms) => (ms.includes(m) ? ms.filter((x) => x !== m) : [...ms, m]));

  async function gerar() {
    if (!meses.length) { setErro("Marque ao menos um mês."); return; }
    if (item === "sku" && !prodSel.length) { setErro("Escolha ao menos um produto na lista (digite o nome ou o código)."); return; }
    setLoading(true); setErro(""); setD(null);
    try {
      const r = await api.get("/api/relatorios/aberto", { params: { item: item === "sku" ? `sku:${prodSel.map((p) => p.cod).join(",")}` : item, indicador: ind, meses: [...meses].sort().join(",") }, timeout: 60000 });
      setD(r.data);
    } catch (e) { setErro(e.response?.data?.error || "Erro ao gerar o relatório."); }
    finally { setLoading(false); }
  }

  function exportar() {
    if (!d) return;
    const cobX = d.indicador === "cobertura";
    const cab = cobX
      ? ["Setor", "RN", "Base PDVs", ...d.meses.map((m) => `${rot(m)} PDVs`), ...d.meses.map((m) => `${rot(m)} %`), d.totalLabel, `${d.totalLabel} %`, "Total período PDVs", "Total período %"]
      : ["Setor", "RN", ...d.meses.map(rot), d.totalLabel];
    if (d.indicador === "distribuicao") cab.splice(2 + d.meses.length, 0, ...d.meses.map((m) => `Média/PDV ${rot(m)}`));
    const linha = (setor, nome, o) => {
      if (cobX) return [setor, nome, o.base || 0, ...o.valores.map((v) => v.v), ...o.valores.map((v) => (v.pct ?? "")), o.total, o.totalPct ?? "", o.acum ?? 0, o.acumPct ?? ""];
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
    const ITEM_ARQ = (id) => id.startsWith("sku:") ? (id.includes(",") ? `${id.split(",").length}SKUs_${id.slice(4).split(",").slice(0, 3).join("-")}${id.split(",").length > 3 ? "-etc" : ""}` : `SKU${id.slice(4)}`)
      : id.split(":")[1].toLowerCase().replace(/[()]/g, "").split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("")
          .replace(/^Nab/, "NAB").replace(/^Mktp$/, "MKTP").replace(/Rgb/g, "RGB").replace(/^He/, "HE");
    const anos = [...new Set(d.meses.map((m) => m.slice(2, 4)))];
    const mesesArq = anos.length === 1
      ? `${d.meses.map((m) => NOMES_MES[Number(m.slice(5, 7)) - 1]).join("-")}-${anos[0]}`
      : d.meses.map((m) => rot(m).replace("/", "")).join("-");
    XLSX.writeFile(wb, `${IND[d.indicador].label.normalize("NFD").replace(/[̀-ͯ]/g, "")}_${ITEM_ARQ(d.item.id)}_${porSetor ? "PorSetor" : "Operacao"}_${mesesArq}.xlsx`);
  }

  const dist = d?.indicador === "distribuicao";
  const cob = d?.indicador === "cobertura";
  const fmtN = (v) => (Number(v) || 0).toLocaleString("pt-BR");
  // % de cobertura (PDVs que compraram ÷ base do setor); com meta → verde bateu / vermelho não
  const meta = metaPct === "" ? null : Number(String(metaPct).replace(",", "."));
  const Pct = ({ p }) => (p === null || p === undefined ? null : (
    <span style={{ ...S.pct, color: meta === null || isNaN(meta) ? "rgba(255,255,255,0.55)" : p >= meta ? VERDE : "#f87171" }}>
      {" · "}{p.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
    </span>
  ));
  return (
    <div style={S.card}>
      <button style={S.head} onClick={() => setAberto((a) => { if (!a) contarUso("/incentivos#relatorio-aberto"); return !a; })}>
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
                <BuscaProduto produtos={produtos} escolhidos={prodSel} onEscolher={(p) => setProdSel((ps) => [...ps, p])} />
                {!produtos.length && <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.78rem" }}>carregando produtos…</span>}
              </>
            )}
            <div style={S.seg}>
              {Object.entries(IND).map(([k, v]) => (
                <button key={k} type="button" onClick={() => setInd(k)} style={ind === k ? S.segOn : S.segBtn}>{v.label}</button>
              ))}
            </div>
            <label style={S.chk}><input type="checkbox" checked={porSetor} onChange={(e) => setPorSetor(e.target.checked)} /> Abrir por setor</label>
            {ind === "cobertura" && (
              <label style={S.chk}>Meta
                <input type="number" min={0} max={100} step="0.5" value={metaPct} onChange={(e) => setMetaPct(e.target.value)}
                  placeholder="—" style={{ ...S.select, width: 64, padding: "6px 8px" }} />% da base
              </label>
            )}
          </div>
          {item === "sku" && prodSel.length > 0 && (
            <div style={{ ...S.linhaCtrl, gap: 6 }}>
              <span style={S.lbl}>{prodSel.length === 1 ? "Produto:" : `Cesta (${prodSel.length} SKUs — PDV conta se comprou QUALQUER um):`}</span>
              {prodSel.map((p) => (
                <span key={p.cod} style={S.chip}>
                  <b>{p.cod}</b> · {p.nome}
                  <button type="button" style={S.chipX} title="Tirar" onClick={() => setProdSel((ps) => ps.filter((x) => x.cod !== p.cod))}>×</button>
                </span>
              ))}
              {prodSel.length > 1 && <button type="button" style={S.chipX} onClick={() => setProdSel([])}>limpar</button>}
            </div>
          )}
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
                    {cob && <th style={S.thC}>Base PDVs</th>}
                    {d.meses.map((m) => <th key={m} style={S.thC}>{rot(m)}</th>)}
                    <th style={S.thC}>{d.totalLabel}</th>
                    {cob && <th style={S.thC} title="PDVs distintos que compraram em qualquer mês marcado ÷ base">Total período</th>}
                  </tr>
                </thead>
                <tbody>
                  {porSetor && d.linhas.map((l) => (
                    <tr key={l.setor} style={S.tr}>
                      <td style={S.td}>{l.setor}{l.nome ? ` · ${l.nome.split(" ")[0]}` : ""}</td>
                      {cob && <td style={{ ...S.tdC, color: "rgba(255,255,255,0.55)" }}>{fmtN(l.base)}</td>}
                      {l.valores.map((v, i) => (
                        <td key={i} style={S.tdC}>{fmt(v.v, d.indicador)}{dist && v.pdvs ? <span style={S.media}> · {fmt(v.media, "x")}/PDV</span> : null}{cob && <Pct p={v.pct} />}</td>
                      ))}
                      <td style={{ ...S.tdC, fontWeight: 700 }}>{fmt(l.total, d.indicador)}{cob && <Pct p={l.totalPct} />}</td>
                      {cob && <td style={{ ...S.tdC, fontWeight: 700 }}>{fmtN(l.acum)}<Pct p={l.acumPct} /></td>}
                    </tr>
                  ))}
                  {porSetor && !d.linhas.length && <tr><td colSpan={d.meses.length + 4} style={S.vazio}>Sem venda desse item nos meses escolhidos.</td></tr>}
                  <tr style={{ background: "rgba(125,186,61,0.10)" }}>
                    <td style={{ ...S.td, fontWeight: 700, color: VERDE }}>🏭 Operação</td>
                    {cob && <td style={{ ...S.tdC, fontWeight: 700 }}>{fmtN(d.operacao.base)}</td>}
                    {d.operacao.valores.map((v, i) => (
                      <td key={i} style={{ ...S.tdC, fontWeight: 700 }}>{fmt(v.v, d.indicador)}{dist && v.pdvs ? <span style={S.media}> · {fmt(v.media, "x")}/PDV</span> : null}{cob && <Pct p={v.pct} />}</td>
                    ))}
                    <td style={{ ...S.tdC, fontWeight: 800, color: VERDE }}>{fmt(d.operacao.total, d.indicador)}{cob && <Pct p={d.operacao.totalPct} />}</td>
                    {cob && <td style={{ ...S.tdC, fontWeight: 800, color: VERDE }}>{fmtN(d.operacao.acum)}<Pct p={d.operacao.acumPct} /></td>}
                  </tr>
                </tbody>
              </table>
              <p style={S.hint}>{IND[d.indicador].unid} · {d.item.label}{d.item.skus > 1 && !d.item.id.startsWith("sku:") ? ` (${d.item.skus} SKUs cadastrados na categoria)` : ""}
                {cob ? " · % = PDVs que compraram ÷ PDVs ativos do setor na base de clientes atual (média mensal % = média ÷ base · total período = PDVs distintos que compraram em qualquer mês marcado ÷ base)" : ""}
                {cob && meta !== null && !isNaN(meta) ? ` · meta ${meta}%: verde bateu, vermelho não` : ""} · setores 301–305 somados em 107–111.</p>
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
  pct: { fontSize: "0.74rem", fontWeight: 700 },
  chip: { display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(125,186,61,0.12)", border: "1px solid rgba(125,186,61,0.4)", borderRadius: 14, padding: "3px 4px 3px 10px", color: "rgba(255,255,255,0.85)", fontSize: "0.76rem" },
  chipX: { background: "transparent", border: "none", color: "rgba(255,255,255,0.55)", cursor: "pointer", fontSize: "0.85rem", padding: "0 6px", fontFamily: "inherit" },
  lista: { position: "absolute", top: "100%", left: 0, zIndex: 20, marginTop: 4, width: 460, maxWidth: "80vw", maxHeight: 300, overflowY: "auto", background: "#13231a", border: "1px solid rgba(125,186,61,0.35)", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.4)" },
  opc: { padding: "7px 10px", fontSize: "0.8rem", color: "rgba(255,255,255,0.75)", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.05)" },
  vazio: { padding: 18, textAlign: "center", color: "rgba(255,255,255,0.4)" },
};
