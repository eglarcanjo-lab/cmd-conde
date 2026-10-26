// Excel "Mapa" de um KPI de distribuição da Liga (ex.: Distribuição de Marketplace) p/ 1 setor.
// Dado: GET /api/incentivos-rn/:id/mapa — o mesmo cálculo da tela, então o total aqui é o da Liga.
// Abas: Resumo por PDV (base inteira; 0 = oportunidade) · Matriz PDV × SKU · Por SKU · Pedidos.
import * as XLSX from "xlsx-js-style";

const VERDE = "2E7D32", CLARO = "EEF3E8", CINZA = "F5F5F5", VERM = "FDE2E2";
const borda = { style: "thin", color: { rgb: "D9DFD3" } };
const B = { top: borda, bottom: borda, left: borda, right: borda };
const sHead = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: VERDE } }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border: B };
const sCel = (i, extra = {}) => ({ border: B, alignment: { vertical: "center", ...(extra.alignment || {}) }, fill: { fgColor: { rgb: i % 2 ? CINZA : "FFFFFF" } }, ...extra });
// Operação do item (CORA "Desc. operação") em texto curto
export const rotOperacao = (op) => {
  const u = String(op || "").toUpperCase();
  if (!u) return "—";
  if (u.startsWith("VENDA")) return "Venda";
  if (u.startsWith("BONIF")) return "Bonificação (combo)";
  if (u.includes("VASILHAME")) return "Remessa de vasilhame";
  if (u.startsWith("TROCA")) return "Troca (impróprio)";
  if (u.includes("REPOSICAO")) return "Reposição";
  if (u.startsWith("PERDA")) return "Perda";
  return u.charAt(0) + u.slice(1).toLowerCase();
};
const dataBR = (s) => { const m = String(s || "").match(/^(\d{2})\/(\d{2})\/(\d{4})/); return m ? new Date(+m[3], +m[2] - 1, +m[1]) : (s || ""); };

function tabela(headers, rows, { larguras = [], inicio = 0, topo = [] } = {}) {
  const aoa = [...topo, headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });
  const hr = topo.length + inicio;
  headers.forEach((_, j) => { const a = XLSX.utils.encode_cell({ r: hr, c: j }); if (ws[a]) ws[a].s = sHead; });
  rows.forEach((row, i) => row.forEach((v, j) => {
    const a = XLSX.utils.encode_cell({ r: hr + 1 + i, c: j });
    if (!ws[a]) return;
    ws[a].s = sCel(i);
    if (v instanceof Date) ws[a].z = "dd/mm/yyyy";
  }));
  ws["!cols"] = larguras.map((w) => ({ wch: w }));
  ws["!autofilter"] = { ref: XLSX.utils.encode_range({ r: hr, c: 0 }, { r: hr + rows.length, c: headers.length - 1 }) };
  ws["!freeze"] = { xSplit: 0, ySplit: hr + 1 };
  return ws;
}

export function exportarMapa(m) {
  const wb = XLSX.utils.book_new();
  const pct = m.meta ? m.real / m.meta : null;
  const comp = m.base.filter((p) => p.skus.length);
  const rot = `${m.kpi.label} · setor ${m.setor}${m.nome ? ` · ${m.nome}` : ""} · ${m.mes}`;

  // 1) Resumo por PDV
  const topo = [
    [`${m.incentivo} — ${rot}`],
    ["Mesmo cálculo da tela da Liga: SKUs distintos de Marketplace que cada PDV levou no mês (venda ou bonificação de combo atendida, sem cancelado/devolvido)."],
    [],
    ["Meta", m.meta ?? "—", "Realizado (HOP)", m.real, "% da meta", pct == null ? "—" : pct, "PDVs na base", m.base.filter((p) => p.na_base).length, "PDVs que compraram", comp.length],
    [],
  ];
  const rows1 = m.base.map((p) => [p.cod_pdv, p.nome, p.razao, p.na_base ? "Sim" : "Não (fora da base)", p.skus.length,
    p.skus.map((s) => s.nome).join(" | ") || "— não comprou MKTP no mês —"]);
  const ws1 = tabela(["Cód. PDV", "PDV", "Razão social", "Na base do setor?", "SKUs que contam", "SKUs comprados"], rows1,
    { larguras: [10, 30, 32, 16, 10, 110], topo });
  ws1.A1.s = { font: { bold: true, sz: 14, color: { rgb: VERDE } } };
  ws1.A2.s = { font: { italic: true, color: { rgb: "6B6B6B" } } };
  ["B4", "D4", "F4", "H4", "J4"].forEach((a) => { if (ws1[a]) ws1[a].s = { font: { bold: true, sz: 13, color: { rgb: VERDE } }, fill: { fgColor: { rgb: CLARO } }, border: B }; });
  ["A4", "C4", "E4", "G4", "I4"].forEach((a) => { if (ws1[a]) ws1[a].s = { font: { bold: true, color: { rgb: "6B6B6B" } }, border: B }; });
  if (ws1.F4 && pct != null) ws1.F4.z = "0.0%";
  rows1.forEach((r, i) => { if (!r[4]) { const a = XLSX.utils.encode_cell({ r: topo.length + 1 + i, c: 4 }); ws1[a].s = sCel(i, { fill: { fgColor: { rgb: VERM } }, font: { bold: true, color: { rgb: "A52834" } } }); } });
  XLSX.utils.book_append_sheet(wb, ws1, "Resumo por PDV");

  // 2) Matriz PDV × SKU
  const skus = m.skus;
  const tem = new Set(comp.flatMap((p) => p.skus.map((s) => `${p.cod_pdv}|${s.sku}`)));
  const rows2 = comp.map((p) => [p.cod_pdv, p.nome, p.skus.length, ...skus.map((s) => (tem.has(`${p.cod_pdv}|${s.sku}`) ? 1 : ""))]);
  const ws2 = tabela(["Cód. PDV", "PDV", "SKUs", ...skus.map((s) => s.nome)], rows2, { larguras: [10, 30, 6, ...skus.map(() => 5)] });
  skus.forEach((_, j) => { const a = XLSX.utils.encode_cell({ r: 0, c: 3 + j }); ws2[a].s = { ...sHead, alignment: { textRotation: 90, horizontal: "center", vertical: "bottom", wrapText: true } }; });
  ws2["!rows"] = [{ hpt: 190 }];
  rows2.forEach((r, i) => r.forEach((v, j) => {
    if (j < 3 || v !== 1) return;
    const a = XLSX.utils.encode_cell({ r: 1 + i, c: j });
    ws2[a].s = { border: B, fill: { fgColor: { rgb: VERDE } }, font: { bold: true, color: { rgb: "FFFFFF" } }, alignment: { horizontal: "center" } };
  }));
  ws2["!freeze"] = { xSplit: 3, ySplit: 1 };
  XLSX.utils.book_append_sheet(wb, ws2, "Matriz PDV x SKU");

  // 2b) Itens: 1 linha por PDV × SKU que contou (HL do mês — bala/Halls aparecem com 0)
  const rowsI = comp.flatMap((p) => p.skus.map((s) => [p.cod_pdv, p.nome, s.sku, s.nome, s.hl, dataBR(s.ultima_compra)]));
  XLSX.utils.book_append_sheet(wb, tabela(["Cód. PDV", "PDV", "Cód. produto", "SKU", "HL no mês", "Última compra"], rowsI,
    { larguras: [10, 30, 12, 56, 10, 13] }), "Itens PDV x SKU");

  // 3) Por SKU
  const nBase = m.base.filter((p) => p.na_base).length || 1;
  const ws3 = tabela(["Cód. produto", "SKU", "PDVs que compraram", "% da base"],
    skus.map((s) => [s.sku, s.nome, s.pdvs, s.pdvs / nBase]), { larguras: [12, 56, 12, 10] });
  skus.forEach((_, i) => { const a = XLSX.utils.encode_cell({ r: 1 + i, c: 3 }); ws3[a].z = "0.0%"; });
  XLSX.utils.book_append_sheet(wb, ws3, "Por SKU");

  // 4) Pedidos
  const ws4 = tabela(["Data (NF)", "Nº pedido", "Pedido BEES", "NF", "Situação", "Cód. PDV", "PDV", "Cód. produto", "Item comprado", "Operação", "HL pedido", "HL entregue"],
    m.pedidos.map((p) => [dataBR(p.data), p.pedido, p.bees, p.nf, p.situacao, p.cod_pdv, p.nome_pdv, p.cod_produto, p.nome_produto, rotOperacao(p.operacao), p.hl_marcacao, p.hl_entrega]),
    { larguras: [11, 10, 14, 10, 18, 10, 30, 11, 50, 22, 9, 9] });
  XLSX.utils.book_append_sheet(wb, ws4, "Pedidos");

  XLSX.writeFile(wb, `Mapa_${m.kpi.key}_setor${m.setor}_${m.mes}.xlsx`);
}
