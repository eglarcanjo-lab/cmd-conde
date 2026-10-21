// Acompanhamento Comercial — RPS (reunião semanal do diretor). Pré-escopo 21/10/2026, a partir
// da "Planilha base Reunião mensal" e do deck "ACOMPANHAMENTO MENSAL COMERCIAL".
// 13 meses (M-12..M) por indicador, por RN: mês, vs M-1, vs L3M (média dos 3 anteriores), vs LY.
// Mês atual = TENDÊNCIA (dias úteis seg–sex). Fonte: vendas_cliente_produto (HL por mês × PDV × SKU).
//   • Volumes (HL) por grupo · por marca · por cidade
//   • Compradores (PDVs que compraram) por grupo + Estáveis / Instáveis / Novos (3 meses anteriores)
//   • Distribuição (Σ SKUs distintos por PDV comprador e média SKU/PDV) por grupo
//   • Marketplace: faturamento (rv_faturamento_mktp) + compradores/distribuição do grupo mktp
// Grupos por categoria da HOP + nome do produto (aberturas 300/600/1L, LN, 350, 473…).
// Pesado (16 meses de vendas): resultado em cache por 30 min.
const express = require("express");
const router = express.Router();
const { readSheet, readSheetMonths } = require("../services/sheets");
const { authMiddleware } = require("../middleware/auth");

router.use(authMiddleware);

const GESTORES = ["admin", "director", "gv1", "gv3"];
const num = (v) => parseFloat(String(v ?? "0").replace(",", ".")) || 0;
const normCod = (v) => String(v ?? "").trim().replace(/\.0$/, "").replace(/^0+/, "");
const p2 = (n) => String(n).padStart(2, "0");
const semAc = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
const SET_RN = ["101", "102", "103", "104", "105", "106", "107", "108", "109", "110", "111"];

// ── Grupos (id, rótulo, regra). p = { nome (sem acento, maiúsculo), cats:Set, e: embalagem } ──
// EMBALAGEM: vem da coluna G "Embalagem" da 0111 (produtos_full.embalagem, ex. "018 - GARRAFA
// INTEIRA"). Sem ela (produto fora do cadastro), cai na leitura do nome do produto.
const CERV = ["CERVEJA", "CERVEJA ZERO", "CERVEJA MULTIPACK", "LITRINHO", "HE", "GIRO RGB"];
const ehCerv = (p) => CERV.some((c) => p.cats.has(c)) || [...p.cats].some((c) => c.startsWith("TRIMARCA"));
const ehMktp = (p) => p.cats.has("MKTP");
const ehNab = (p) => p.cats.has("NAB") || p.cats.has("NAB ZERO");
const ehHe = (p) => p.cats.has("HE") || [...p.cats].some((c) => c.startsWith("TRIMARCA"));
// Tamanho em ml a partir de um texto ("LATA 355", "PET 1,5", "GFA VD 300ML", "PET 2")
function mlDe(txt, padraoLitro) {
  let m = txt.match(/(\d+(?:[.,]\d+)?)\s*ML\b/); if (m) return Math.round(parseFloat(m[1].replace(",", ".")));
  m = txt.match(/(\d+(?:[.,]\d+)?)\s*L\b/); if (m) return Math.round(parseFloat(m[1].replace(",", ".")) * 1000);
  m = txt.match(/(\d+(?:[.,]\d+)?)/); if (!m) return null;
  const v = parseFloat(m[1].replace(",", "."));
  return padraoLitro && v < 10 ? Math.round(v * 1000) : Math.round(v); // "PET 2" = 2 L · "LATA 355" = 355 ml
}
// Classifica a embalagem do Promax → { tipo: LN|LT|RGB|OW|PET|CHOPP|OUTROS, ml }
function classificaEmb(raw) {
  const e = String(raw || "").replace(/^\s*\d+\s*-\s*/, "").toUpperCase().trim();
  if (!e || /NAO CADASTRADO|NÃO CADASTRADO/.test(e)) return null;
  if (/BARRIL|KEG|PETAINER|SEM EMBALAGEM|POST-MIX|PRE-MIX/.test(e)) return { tipo: "CHOPP", ml: null };
  if (/LONG|\bLN\b/.test(e)) return { tipo: "LN", ml: mlDe(e) };
  if (/\bLATA?\b|SLEEK|\bLAT\b/.test(e)) { let v = mlDe(e); if (v === 355 || v === 354) v = 350; return { tipo: "LT", ml: v }; }
  if (/GARRAFA MEIA/.test(e)) return { tipo: "RGB", ml: 300 };
  if (/GARRAFA INTEIRA|GARRAFA 630/.test(e)) return { tipo: "RGB", ml: 600 };
  if (/GARRAFA LITRO|RET\.?\s*1000/.test(e)) return { tipo: "RGB", ml: 1000 };
  if (/GFA VD 300/.test(e)) return { tipo: "RGB", ml: 300 };
  if (/\bPET\b|PVC|PRB|TWISTER/.test(e)) return { tipo: "PET", ml: mlDe(e, true) };
  if (/ONE.?WAY|\bOW\b|DESCARTAV|ALUMINIO/.test(e)) { const v = mlDe(e); return [210, 250, 275, 330, 343, 355].includes(v) ? { tipo: "LN", ml: v } : { tipo: "OW", ml: v }; }
  if (/GARRAFA|GFA/.test(e)) return { tipo: "RGB", ml: mlDe(e, true) };
  return { tipo: "OUTROS", ml: mlDe(e) };
}
// Reserva pelo nome (produto sem embalagem no cadastro)
const nLata = (p) => /\bLATA\b|\bLT\b|SLEEK/.test(p.nome);
const nLN = (p) => /LONG\s*NECK|\bLN\b/.test(p.nome) || (!nLata(p) && /\bOW\b|ONE\s*WAY/.test(p.nome) && /\b(330|343|355)\s*ML/.test(p.nome));
const ehLata = (p) => (p.e ? p.e.tipo === "LT" : nLata(p));
const ehLN = (p) => (p.e ? p.e.tipo === "LN" : nLN(p));
const ehOW = (p) => (p.e ? ["LN", "LT", "OW"].includes(p.e.tipo) : nLN(p) || nLata(p) || /\bOW\b|ONE\s*WAY/.test(p.nome));
const ehRgb = (p) => (p.e ? p.e.tipo === "RGB" : !ehOW(p) && !/\bPET\b/.test(p.nome) && /(300|600|1000)\s*ML|\b1\s*L\b|LITRAO|GFA\s*VD|GARRAFA/.test(p.nome));
const tam = (p) => (p.e && p.e.ml ? p.e.ml : tamanhoMl(p.nome));
const tamanhoMl = (nome) => {
  let m = nome.match(/(\d+(?:[.,]\d+)?)\s*ML\b/); if (m) return Math.round(parseFloat(m[1].replace(",", ".")));
  m = nome.match(/(\d+(?:[.,]\d+)?)\s*L\b/); if (m) return Math.round(parseFloat(m[1].replace(",", ".")) * 1000);
  return null;
};
const GRUPOS = [
  { id: "tt", label: "Total", f: () => true }, // TT do BI inclui Marketplace (conferido c/ o deck: Distribuição set/26)
  { id: "cerveja", label: "Cerveja", f: ehCerv },
  { id: "rgb", label: "Cerveja RGB", f: (p) => ehCerv(p) && ehRgb(p) },
  { id: "rgb_300", label: "RGB 300 ml", f: (p) => ehCerv(p) && ehRgb(p) && tam(p) === 300 },
  { id: "rgb_600", label: "RGB 600 ml", f: (p) => ehCerv(p) && ehRgb(p) && [600, 630].includes(tam(p)) },
  { id: "rgb_1l", label: "RGB 1 L", f: (p) => ehCerv(p) && ehRgb(p) && tam(p) >= 900 },
  { id: "he", label: "High End", f: ehHe },
  { id: "he_rgb", label: "High End RGB", f: (p) => ehHe(p) && ehRgb(p) },
  { id: "he_350", label: "High End 350", f: (p) => ehHe(p) && ehLata(p) && tam(p) === 350 },
  { id: "he_ln", label: "High End LN", f: (p) => ehHe(p) && ehLN(p) },
  { id: "ow", label: "One Way (OW)", f: (p) => ehCerv(p) && ehOW(p) },
  { id: "ow_350", label: "OW 350", f: (p) => ehCerv(p) && ehLata(p) && tam(p) === 350 },
  { id: "ow_473", label: "OW 473", f: (p) => ehCerv(p) && ehOW(p) && tam(p) === 473 },
  { id: "ow_ln", label: "OW LN", f: (p) => ehCerv(p) && ehLN(p) },
  { id: "zero", label: "Cerveja Zero", f: (p) => p.cats.has("CERVEJA ZERO") },
  { id: "nab", label: "NAB TT", f: ehNab },
  { id: "nab_zero", label: "NAB Zero", f: (p) => p.cats.has("NAB ZERO") },
  // Single = dose individual (lata / PET até 600 ml), mesmo vendida em caixa — a confirmar c/ o diretor
  { id: "nab_single", label: "NAB Single", f: (p) => ehNab(p) && tam(p) != null && tam(p) <= 600 },
  { id: "guarana", label: "Guaraná", f: (p) => ehNab(p) && /GUARANA/.test(p.nome) },
  { id: "gatorade", label: "Gatorade", f: (p) => /GATORADE/.test(p.nome) },
  { id: "match", label: "Match TT", f: (p) => p.cats.has("MATCH") },
  { id: "match_ln", label: "Match LN", f: (p) => p.cats.has("MATCH") && ehLN(p) },
  { id: "match_lt", label: "Match LT", f: (p) => p.cats.has("MATCH") && ehLata(p) },
  { id: "senses", label: "Senses", f: (p) => p.cats.has("MATCH") && /SENSES/.test(p.nome) },
  { id: "sabores", label: "Sabores", f: (p) => p.cats.has("MATCH") && !/SENSES/.test(p.nome) },
  { id: "mktp", label: "Marketplace", f: ehMktp },
];
// O que cada seção do deck mostra (ordem dos slides)
const SECOES = {
  volumes: ["tt", "cerveja", "rgb", "rgb_300", "rgb_600", "rgb_1l", "he", "he_rgb", "he_350", "he_ln", "ow", "ow_350", "ow_473", "ow_ln", "zero", "nab", "nab_zero", "nab_single", "guarana", "gatorade", "match", "match_ln", "match_lt", "senses", "sabores", "mktp"],
  compradores: ["tt", "cerveja", "rgb", "rgb_600", "rgb_1l", "rgb_300", "he", "zero", "nab", "nab_zero", "match", "mktp"],
  distribuicao: ["tt", "cerveja", "rgb", "marcas_foco", "zero", "he", "he_ln", "he_rgb", "nab", "nab_zero", "match", "mktp"],
};
// Marcas foco (distribuição) — a confirmar com o diretor
const MARCAS_FOCO = ["STELLA", "SPATEN", "ORIGINAL", "CORONA", "BUDWEISER", "MICHELOB"];
GRUPOS.push({ id: "marcas_foco", label: "Marcas foco", f: (p) => ehCerv(p) && MARCAS_FOCO.some((m) => p.nome.includes(m)) });
GRUPOS.push({ id: "mp", label: "Multipack", f: (p) => ehCerv(p) && (p.cats.has("CERVEJA MULTIPACK") || /MULTIPACK/.test(p.nome)) });
GRUPOS.push({ id: "lata_cerv", label: "Cerveja lata", f: (p) => ehCerv(p) && ehLata(p) });
const GRUPO = Object.fromEntries(GRUPOS.map((g) => [g.id, g]));

// ── Deep Dive (materiais MPR / Fast Start / Deep Dive Q1) ──────────────────────
// Tags de marca × embalagem p/ os cruzamentos de High End (Fast Start p.72/170/171)
const PG = /PURE\s*GOLD/, ZEROCERO = /\bZERO\b|\bCERO\b|0[.,]0/;
const TAGS = [
  { id: "ste_ln", f: (p) => /STELLA/.test(p.nome) && !PG.test(p.nome) && !ZEROCERO.test(p.nome) && ehLN(p) },
  { id: "spt_ln", f: (p) => /SPATEN/.test(p.nome) && ehLN(p) },
  { id: "cor_ln", f: (p) => /CORONA/.test(p.nome) && !ZEROCERO.test(p.nome) && ehLN(p) },
  { id: "bud_ln", f: (p) => /BUDWEISER|\bBUD\b/.test(p.nome) && !ZEROCERO.test(p.nome) && ehLN(p) },
  { id: "pg", f: (p) => PG.test(p.nome) },
  { id: "cor_cero", f: (p) => /CORONA/.test(p.nome) && ZEROCERO.test(p.nome) },
  { id: "cor", f: (p) => /CORONA/.test(p.nome) && !ZEROCERO.test(p.nome) },
  { id: "ste_600", f: (p) => /STELLA/.test(p.nome) && !PG.test(p.nome) && tam(p) === 600 },
  { id: "spt_600", f: (p) => /SPATEN/.test(p.nome) && tam(p) === 600 },
  { id: "ori_600", f: (p) => /ORIGINAL/.test(p.nome) && tam(p) === 600 },
];
// Embalagem de cerveja (build-up do MPR / Deep Dive): RGB 300/600/1L · LT 269/350/473 · LN
function embCerv(p) {
  if (ehLN(p)) return "LN";
  const v = tam(p);
  if (ehLata(p)) return v ? `LT ${v}` : "LT outros";
  if (ehRgb(p)) return v === 300 ? "RGB 300" : [600, 630].includes(v) ? "RGB 600" : v >= 900 ? "RGB 1L" : "RGB outros";
  if (p.e && p.e.tipo === "OW") return v ? `OW ${v}` : "OW outros";
  if (p.e && p.e.tipo === "CHOPP") return "Chopp";
  return "Outros";
}
// Embalagem de NAB (Fast Start p.76): PET 2000/1000/500… · LT 350/269/473
function embNab(p) {
  const v = tam(p);
  const tipo = p.e ? ({ RGB: "VIDRO", LN: "VIDRO", OW: "VIDRO" }[p.e.tipo] || p.e.tipo)
    : /\bPET\b/.test(p.nome) ? "PET" : /\bLATA\b|\bLT\b|SLEEK/.test(p.nome) ? "LT" : /GFA|GARRAFA|VD/.test(p.nome) ? "VIDRO" : "OUTROS";
  return v ? `${tipo} ${v}` : tipo;
}

// O que aparece nos materiais de reunião (MPR fev/26 e set/25, Deep Dive Q1 Supercom, Fast Start 2026)
// e a HOP NÃO entrega. Viram slides vazios no PowerPoint (mesmo tema) p/ colar o print da fonte.
// tipo "externo" = dado fora da HOP · "na_hop" = existe em outra tela da HOP, ainda fora da RPS.
const EXTERNOS = [
  { secao: "Mercado", titulo: "Share Nielsen · Total, Core e High End", fonte: "Nielsen", tipo: "externo", onde: "MPR fev/26 (sl. 24) · MPR set/25 (sl. 15–17) · Fast Start p. 63–65" },
  { secao: "Mercado", titulo: "Share Nielsen · build-up por segmento, embalagem e marca (MS, WGT e PI)", fonte: "Nielsen", tipo: "externo", onde: "Deep Dive Q1 (sl. 40–48) · Fast Start p. 64–67" },
  { secao: "Mercado", titulo: "Share Nielsen · Cerveja Zero e mix packs (Top / Bottom SKU de mercado)", fonte: "Nielsen", tipo: "externo", onde: "Deep Dive Q1 (sl. 46–48)" },
  { secao: "Mercado", titulo: "Share Scanntech · Total, Score 5 Total e Score 5 High End", fonte: "Scanntech", tipo: "externo", onde: "MPR fev/26 (sl. 23) · MPR set/25 (sl. 18–19)" },
  { secao: "Mercado", titulo: "Scanntech · positivação, expansão e base de ressarcimento", fonte: "Scanntech", tipo: "externo", onde: "Deep Dive Q1 (sl. 35–36) · Fast Start p. 91–92" },
  { secao: "Mercado", titulo: "Volume sell-out", fonte: "BI / Scanntech", tipo: "externo", onde: "Fast Start p. 68–78" },
  { secao: "Resultado", titulo: "Orçamento (BGT) e FY · volume vs BGT", fonte: "Orçamento / BI", tipo: "externo", onde: "Deep Dive Q1 (sl. 10–34)" },
  { secao: "Resultado", titulo: "Meta Bônus", fonte: "Supercom / GEO", tipo: "externo", onde: "Deep Dive Q1 (sl. 7–8)" },
  { secao: "Resultado", titulo: "Ranking PEX / SPO das operações e comerciais", fonte: "BI oficial", tipo: "externo", onde: "Fast Start p. 143–146" },
  { secao: "Nível de serviço", titulo: "NPS · total, on trade, off trade e ranking", fonte: "BI NPS", tipo: "externo", onde: "MPR fev/26 (sl. 19) · Deep Dive Q1 (sl. 38) · Fast Start p. 127, 179–180" },
  { secao: "Nível de serviço", titulo: "NPS · motivos neutros e detratores", fonte: "BI NPS", tipo: "externo", onde: "Deep Dive Q1 (sl. 38) · Fast Start p. 179" },
  { secao: "Nível de serviço", titulo: "OTIF, falta teórica (TOOS) e entregas sem falhas", fonte: "Logística", tipo: "externo", onde: "Fast Start p. 128, 174, 178" },
  { secao: "Nível de serviço", titulo: "DPO / SDPO · status e itens críticos", fonte: "DPO", tipo: "externo", onde: "MPR fev/26 (sl. 22) · Deep Dive Q1 (sl. 5) · Fast Start p. 144" },
  { secao: "Execução e trade", titulo: "Score 5 · cooler, execução de preço, materiais e cupons", fonte: "BI Score 5", tipo: "externo", onde: "MPR fev/26 (sl. 20–21) · Deep Dive Q1 (sl. 26–27)" },
  { secao: "Execução e trade", titulo: "Cobertura de coolers e promotores (vizinhança)", fonte: "Trade", tipo: "externo", onde: "Deep Dive Q1 (sl. 35–37)" },
  { secao: "Execução e trade", titulo: "Trade · CTS, exclusivos, chopp e SOPI / venda zero", fonte: "Trade", tipo: "externo", onde: "Deep Dive Q1 (sl. 36–37) · Fast Start p. 89–90" },
  { secao: "Execução e trade", titulo: "Contratos · investimento e ROI", fonte: "Contratos / Financeiro", tipo: "externo", onde: "Fast Start p. 164–166" },
  { secao: "Marketplace", titulo: "Marketplace · GMV e SKUs por indústria, nº de indústrias (fat. ≥ R$ 3 mil)", fonte: "Relatório Marketplace", tipo: "externo", onde: "MPR fev/26 (sl. 14) · Fast Start p. 78–79" },
  { secao: "Marketplace", titulo: "Marketplace · margem por SKU e total", fonte: "Custo por SKU", tipo: "externo", onde: "Deck do diretor (sl. 3)" },
  { secao: "Pessoas", titulo: "Gente · estrutura e movimentações", fonte: "RH", tipo: "externo", onde: "Deep Dive Q1 (sl. 49) · Fast Start" },
  { secao: "Pessoas", titulo: "Destaques do time (slide livre)", fonte: "Gestor", tipo: "externo", onde: "MPR fev/26 (sl. 25)" },
  { secao: "Pessoas", titulo: "Sonho e plano do ano (volume e share)", fonte: "Gestor", tipo: "externo", onde: "MPR fev/26 (sl. 26) · Fast Start p. 195" },
  { secao: "Já existe na HOP (fora da RPS)", titulo: "SPO · pontuação por KPI e ranking", fonte: "HOP › SPO", tipo: "na_hop", onde: "Deep Dive Q1 (sl. 4) · MPR fev/26 (sl. 22)" },
  { secao: "Já existe na HOP (fora da RPS)", titulo: "Atendimento Produtivo · % RNs com os pilares, GPS e Rota Efetiva", fonte: "HOP › SPO / Rota Efetiva", tipo: "na_hop", onde: "Fast Start p. 84–86" },
  { secao: "Já existe na HOP (fora da RPS)", titulo: "Score 5 · compradores, visitação, tasks e portfólio ideal", fonte: "HOP › SPO", tipo: "na_hop", onde: "MPR fev/26 (sl. 20–21) · Deep Dive Q1 (sl. 27)" },
  { secao: "Já existe na HOP (fora da RPS)", titulo: "Tarefas de portfólio (Cerveja / NAB) e Bees alone · cupons", fonte: "HOP › Tasks / SPO", tipo: "na_hop", onde: "Fast Start p. 87–88" },
];

function mesesAte(br, n) {
  return Array.from({ length: n }, (_, k) => { const d = new Date(br.getFullYear(), br.getMonth() - (n - 1 - k), 1); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}`; });
}
function diasUteis(br) {
  const yy = br.getFullYear(), mm = br.getMonth();
  const uteis = (ate) => { let c = 0; const d = new Date(yy, mm, 1); while (d.getMonth() === mm && d.getDate() <= ate) { const w = d.getDay(); if (w >= 1 && w <= 5) c++; d.setDate(d.getDate() + 1); } return c; };
  const feitos = Math.max(1, uteis(br.getDate())), total = uteis(31);
  return { feitos, total, fator: total / feitos };
}

let _cache = null; // { chave, em, dados }

async function montar() {
  const br = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const todos = mesesAte(br, 16);            // 3 extras p/ classificar estáveis/instáveis/novos
  const meses = todos.slice(3);              // 13 exibidos (M-12..M)
  const mesAtual = meses[12];
  const du = diasUteis(br);
  // Deep Dive / YTD: de jan do ano passado até antes do 1º mês de "todos" (só volume por SKU)
  const anoAtual = br.getFullYear();
  const extras = [];
  for (let d = new Date(anoAtual - 1, 0, 1); ; d.setMonth(d.getMonth() + 1)) {
    const m = `${d.getFullYear()}-${p2(d.getMonth() + 1)}`; if (m >= todos[0]) break; extras.push(m);
  }
  const ult4 = todos.slice(-4); // M-3..M — compradores por marca/embalagem p/ os cruzamentos

  const [base, full, pdvBase, usuarios, fatMktp] = await Promise.all([
    readSheet("produtos_base").catch(() => []), readSheet("produtos_full").catch(() => []),
    readSheet("pdv_base").catch(() => []), readSheet("usuarios").catch(() => []),
    readSheet("rv_faturamento_mktp").catch(() => []),
  ]);
  const catDe = {}, nomeDe = {}, embDe = {};
  full.forEach((p) => { const c = normCod(p.cod); if (!c) return; nomeDe[c] = semAc(p.nome); embDe[c] = classificaEmb(semAc(p.embalagem)); });
  base.forEach((p) => {
    const c = normCod(p.cod); if (!c) return;
    catDe[c] = new Set(String(p.categorias || p.categoria || "").split(/[,;|]/).map((x) => x.trim().toUpperCase()).filter((x) => x && x !== "NONE" && x !== "NAN"));
    if (!nomeDe[c] && p.nome) nomeDe[c] = semAc(p.nome);
  });
  const cidadeDe = {};
  const segDe = {}, nomePdv = {};
  pdvBase.forEach((p) => { nomePdv[normCod(p.cod_pdv)] = String(p.nome_fantasia || p.razao_social || "").trim(); });
  pdvBase.forEach((p) => { const c = normCod(p.cod_pdv); cidadeDe[c] = String(p.cidade || "").trim().toUpperCase() || "—"; segDe[c] = String(p.segmento || "").trim().toUpperCase() || "SEM SEGMENTO"; });
  const nomeRn = {};
  usuarios.forEach((u) => { const c = String(u.cod || "").trim(); if (c) nomeRn[c] = String(u.nome || "").trim().split(/\s+/)[0]; });

  // grupos de cada SKU (cache por código)
  const gruposDoSku = {};
  const gruposDe = (cod, nomeVenda) => {
    if (gruposDoSku[cod]) return gruposDoSku[cod];
    const p = { nome: nomeDe[cod] || semAc(nomeVenda), cats: catDe[cod] || new Set(), e: embDe[cod] || null };
    return (gruposDoSku[cod] = GRUPOS.filter((g) => g.f(p)).map((g) => g.id));
  };
  const marcaDe = (nome) => semAc(nome).split(/\s+/)[0] || "—";
  const tagsDoSku = {};
  const tagsDe = (cod) => {
    if (tagsDoSku[cod]) return tagsDoSku[cod];
    const p = { nome: nomeDe[cod] || "", cats: catDe[cod] || new Set(), e: embDe[cod] || null };
    return (tagsDoSku[cod] = TAGS.filter((t) => t.f(p)).map((t) => t.id));
  };

  // Agregados por mês (lidos mês a mês p/ poupar memória)
  // vol[g][mes][setor] HL · comp[g][mes] Map pdv→setor · sku[g][mes][setor] Σ SKUs distintos por PDV
  const vol = {}, comp = {}, sku = {}, marca = {}, cidade = {};
  GRUPOS.forEach((g) => { vol[g.id] = {}; comp[g.id] = {}; sku[g.id] = {}; });
  // Deep Dive: skuM[mes][cod] HL · segM[mes][segmento] HL (cerveja) · tagM[mes][tag] Map pdv→setor
  const skuM = {}, skuNome = {}, segM = {}, tagM = {};
  const setTodos = new Set(todos), setUlt4 = new Set(ult4);
  for (const m of [...extras, ...todos]) {
    const rows = await readSheetMonths("vendas_cliente_produto", "mes_referencia", [m]).catch(() => []);
    const pares = {}; // g|pdv -> Set sku
    rows.forEach((r) => {
      const hl = num(r.volume_hl); if (hl <= 0) return;
      const s = String(r.setor || "").trim(), pdv = normCod(r.cod_pdv), cod = normCod(r.cod_produto);
      if (!pdv || !cod) return;
      const gs = gruposDe(cod, r.nome_produto);
      const sm = (skuM[m] = skuM[m] || {}); sm[cod] = (sm[cod] || 0) + hl;
      if (!skuNome[cod]) skuNome[cod] = nomeDe[cod] || semAc(r.nome_produto);
      if (!setTodos.has(m)) return; // meses extras: só volume por SKU (YTD do ano passado)
      if (gs.includes("cerveja")) { const sg = (segM[m] = segM[m] || {}); const k = segDe[pdv] || "SEM SEGMENTO"; sg[k] = (sg[k] || 0) + hl; }
      if (setUlt4.has(m)) tagsDe(cod).forEach((t) => { const tm = (tagM[m] = tagM[m] || {}); (tm[t] = tm[t] || new Map()).set(pdv, s); });
      gs.forEach((g) => {
        const vg = (vol[g][m] = vol[g][m] || {}); vg[s] = (vg[s] || 0) + hl;
        (comp[g][m] = comp[g][m] || new Map()).set(pdv, s);
        const k = `${g}|${pdv}`; (pares[k] = pares[k] || { s, set: new Set() }).set.add(cod);
      });
      if (meses.includes(m) && gs.includes("cerveja")) {
        const mk = marcaDe(r.nome_produto); const mm = (marca[mk] = marca[mk] || {}); mm[m] = (mm[m] || 0) + hl;
      }
      if (meses.includes(m) && gs.includes("tt")) {
        const cd = cidadeDe[pdv] || "—"; const cc = (cidade[cd] = cidade[cd] || {}); cc[m] = (cc[m] || 0) + hl;
      }
    });
    Object.entries(pares).forEach(([k, v]) => {
      const g = k.split("|")[0]; const sg = (sku[g][m] = sku[g][m] || {}); sg[v.s] = (sg[v.s] || 0) + v.set.size;
    });
  }

  const tend = (v) => v * du.fator;                       // volume: projeção por dias úteis
  const pct = (a, b) => (b ? Math.round(((a - b) / b) * 1000) / 10 : null);
  const r1 = (v) => Math.round(v * 10) / 10;
  // Linha comparativa: real do mês atual, tendência, M-1, L3M, LY e % (com a tendência)
  const comparar = (serie, tendAtual) => {
    const atual = serie[12], t = tendAtual, m1 = serie[11], l3 = (serie[9] + serie[10] + serie[11]) / 3, ly = serie[0];
    return { real: r1(atual), tend: r1(t), m1: r1(m1), l3m: r1(l3), ly: r1(ly), vs_m1: pct(t, m1), vs_l3m: pct(t, l3), vs_ly: pct(t, ly) };
  };
  const setoresCom = (obj) => SET_RN.filter((s) => meses.some((m) => (obj[m] || {})[s]));

  // ── VOLUMES ──
  const volumes = SECOES.volumes.map((g) => {
    const tot = meses.map((m) => Object.values(vol[g][m] || {}).reduce((a, b) => a + b, 0));
    return {
      id: g, label: GRUPO[g].label, unidade: "HL", serie: tot.map(r1), tend: r1(tend(tot[12])), ...comparar(tot, tend(tot[12])),
      porRn: setoresCom(vol[g]).map((s) => { const sr = meses.map((m) => (vol[g][m] || {})[s] || 0); return { setor: s, rn: nomeRn[s] || "", ...comparar(sr, tend(sr[12])) }; }),
    };
  });
  const serieDe = (obj) => meses.map((m) => r1(obj[m] || 0));
  const marcas = Object.entries(marca).map(([k, o]) => { const sr = meses.map((m) => o[m] || 0); return { marca: k, serie: serieDe(o), ...comparar(sr, tend(sr[12])) }; })
    .filter((x) => x.serie.some((v) => v > 0)).sort((a, b) => b.l3m - a.l3m).slice(0, 15);
  const cidades = Object.entries(cidade).map(([k, o]) => { const sr = meses.map((m) => o[m] || 0); return { cidade: k, serie: serieDe(o), ...comparar(sr, tend(sr[12])) }; })
    .filter((x) => x.serie.some((v) => v > 0)).sort((a, b) => b.l3m - a.l3m);

  // ── COMPRADORES (+ estáveis / instáveis / novos) ──
  // Tendência de compradores: real + compradores do M-1 que ainda não compraram × fração restante do mês.
  const restante = Math.max(0, 1 - du.feitos / du.total);
  const compradores = SECOES.compradores.map((g) => {
    const cm = (i) => comp[g][todos[i]] || new Map(); // i em todos (0..15)
    const quebra = meses.map((m, k) => {
      const i = k + 3, atual = cm(i), m1 = cm(i - 1), m2 = cm(i - 2), m3 = cm(i - 3);
      let est = 0, inst = 0, novo = 0;
      atual.forEach((_, pdv) => { if (m1.has(pdv)) est++; else if (m2.has(pdv) || m3.has(pdv)) inst++; else novo++; });
      return { est, inst, novo };
    });
    const contaSet = (i, s) => { let c = 0; cm(i).forEach((st) => { if (!s || st === s) c++; }); return c; };
    const tendC = (s) => { let falta = 0; const at = cm(15); cm(14).forEach((st, pdv) => { if ((!s || st === s) && !at.has(pdv)) falta++; }); return contaSet(15, s) + falta * restante; };
    const tot = meses.map((_, k) => contaSet(k + 3));
    const porRn = SET_RN.filter((s) => meses.some((_, k) => contaSet(k + 3, s))).map((s) => {
      const sr = meses.map((_, k) => contaSet(k + 3, s)); return { setor: s, rn: nomeRn[s] || "", ...comparar(sr, tendC(s)) };
    });
    return { id: g, label: GRUPO[g].label, unidade: "PDVs", serie: tot, quebra, ...comparar(tot, tendC()), porRn };
  });

  // ── DISTRIBUIÇÃO (Σ SKUs distintos por PDV e média SKU/PDV) ──
  const distribuicao = SECOES.distribuicao.map((g) => {
    const tot = meses.map((m) => Object.values(sku[g][m] || {}).reduce((a, b) => a + b, 0));
    const nComp = meses.map((m) => (comp[g][m] || new Map()).size);
    const media = tot.map((v, k) => (nComp[k] ? Math.round((v / nComp[k]) * 100) / 100 : 0));
    const porRn = setoresCom(sku[g]).map((s) => {
      const sr = meses.map((m) => (sku[g][m] || {})[s] || 0);
      const nc = meses.map((m) => { let c = 0; (comp[g][m] || new Map()).forEach((st) => { if (st === s) c++; }); return c; });
      const md = sr.map((v, k) => (nc[k] ? v / nc[k] : 0));
      return { setor: s, rn: nomeRn[s] || "", ...comparar(md, md[12]), skus: sr[12] };
    });
    return { id: g, label: GRUPO[g].label, unidade: "SKU/PDV", serie: tot, media, ...comparar(media, media[12]), porRn };
  });

  // ── MARKETPLACE (faturamento R$) ──
  const fatM = {};
  fatMktp.forEach((r) => { const m = String(r.mes_referencia || "").slice(0, 7), s = String(r.setor || "").trim(); if (!meses.includes(m)) return; (fatM[m] = fatM[m] || {}); fatM[m][s] = (fatM[m][s] || 0) + num(r.faturamento_mktp_real); });
  const fatTot = meses.map((m) => Object.values(fatM[m] || {}).reduce((a, b) => a + b, 0));
  const marketplace = {
    faturamento: { id: "mktp_fat", label: "Faturamento Marketplace", unidade: "R$", serie: fatTot.map(Math.round), ...comparar(fatTot, tend(fatTot[12])),
      porRn: setoresCom(fatM).map((s) => { const sr = meses.map((m) => (fatM[m] || {})[s] || 0); return { setor: s, rn: nomeRn[s] || "", ...comparar(sr, tend(sr[12])) }; }) },
    compradores: compradores.find((c) => c.id === "mktp"),
    distribuicao: distribuicao.find((c) => c.id === "mktp"),
    pendente: "Margem por SKU/TT, faturamento e SKUs por indústria e curso de entrega por SKU — entram quando houver relatório com custo e indústria por SKU.",
  };

  // ═══ DEEP DIVE ═══
  const mesNum = br.getMonth() + 1, frac = du.feitos / du.total;
  const mesesAno = (ano) => Array.from({ length: 12 }, (_, k) => `${ano}-${p2(k + 1)}`);
  const ytdAt = mesesAno(anoAtual).slice(0, mesNum), ytdLy = mesesAno(anoAtual - 1).slice(0, mesNum);
  const prodDe = (cod) => ({ nome: skuNome[cod] || nomeDe[cod] || "", cats: catDe[cod] || new Set(), e: embDe[cod] || null });
  const somaMes = (m, filtro) => Object.entries(skuM[m] || {}).reduce((a, [c, v]) => a + (filtro(c) ? v : 0), 0);
  // YTD atual (mês atual parcial) × YTD LY (mês corrente do LY proporcional aos dias úteis feitos)
  const ytd = (filtro) => {
    const at = ytdAt.reduce((a, m) => a + somaMes(m, filtro), 0);
    const ly = ytdLy.reduce((a, m, i) => a + somaMes(m, filtro) * (i === ytdLy.length - 1 ? frac : 1), 0);
    return { ytd: r1(at), ytd_ly: r1(ly), vs_ly: pct(at, ly) };
  };
  const doGrupo = (g) => (c) => (gruposDoSku[c] || []).includes(g);
  const temLy = ytdLy.some((m) => skuM[m]);
  const ytdGrupos = SECOES.volumes.map((g) => ({ id: g, label: GRUPO[g].label, ...ytd(doGrupo(g)),
    ano: mesesAno(anoAtual).map((m, k) => (k < mesNum ? r1(somaMes(m, doGrupo(g))) : null)),
    ano_ly: mesesAno(anoAtual - 1).map((m) => r1(somaMes(m, doGrupo(g)))) }));
  // build-up genérico: agrupa SKUs por chave → YTD, YTD LY, vs LY, peso (WGT)
  const buildUp = (filtro, chave) => {
    const k = {};
    const add = (m, peso, campo) => Object.entries(skuM[m] || {}).forEach(([c, v]) => {
      if (!filtro(c)) return; const kk = chave(prodDe(c), c); const e = (k[kk] = k[kk] || { item: kk, ytd: 0, ytd_ly: 0 }); e[campo] += v * peso;
    });
    ytdAt.forEach((m) => add(m, 1, "ytd")); ytdLy.forEach((m, i) => add(m, i === ytdLy.length - 1 ? frac : 1, "ytd_ly"));
    const tot = Object.values(k).reduce((a, e) => a + e.ytd, 0);
    return Object.values(k).map((e) => ({ item: e.item, ytd: r1(e.ytd), ytd_ly: r1(e.ytd_ly), vs_ly: pct(e.ytd, e.ytd_ly), wgt: tot ? r1((e.ytd / tot) * 100) : 0 }))
      .filter((e) => e.ytd > 0 || e.ytd_ly > 0).sort((a, b) => b.ytd - a.ytd);
  };
  const ehCervC = doGrupo("cerveja"), ehNabC = doGrupo("nab");
  const porSku = buildUp(() => true, (p, c) => c).map((e) => ({ ...e, nome: skuNome[e.item] || e.item, delta: r1(e.ytd - e.ytd_ly) }));
  // Compradores (M-3..M) por tag → Map pdv→setor
  const compTag = (t) => { const mm = new Map(); ult4.forEach((m) => ((tagM[m] || {})[t] || new Map()).forEach((st, pdv) => mm.set(pdv, st))); return mm; };
  const T = Object.fromEntries(TAGS.map((t) => [t.id, compTag(t.id)]));
  const cruzar = (id, label, a, semB, acao) => {
    const alvo = [...a].filter(([pdv]) => !semB.some((b) => b.has(pdv)));
    const porRn = SET_RN.map((s) => { const n = [...a].filter(([, st]) => st === s).length, x = alvo.filter(([, st]) => st === s).length; return { setor: s, rn: nomeRn[s] || "", compradores: n, oportunidade: x, pct: n ? r1((x / n) * 100) : null }; }).filter((l) => l.compradores);
    return { id, label, acao, compradores: a.size, oportunidade: alvo.length, pct: a.size ? r1((alvo.length / a.size) * 100) : null, porRn,
      pdvs: alvo.slice(0, 400).map(([pdv, st]) => ({ setor: st, cod_pdv: pdv, nome_pdv: nomePdv[pdv] || "" })).sort((x, y) => x.setor.localeCompare(y.setor)) };
  };
  const he600 = new Map(); ["ste_600", "spt_600", "ori_600"].forEach((t) => T[t].forEach((st, pdv) => he600.set(pdv, st)));
  const soUma = (t) => new Map([...T[t]].filter(([pdv]) => ["ste_600", "spt_600", "ori_600"].filter((x) => T[x].has(pdv)).length === 1));
  const cruzamentos = [
    cruzar("ste_ln_sem_pg", "Compram Stella LN e não compram Stella Pure Gold", T.ste_ln, [T.pg], "Ofertar Stella PG (LN/600)"),
    cruzar("spt_ln_sem_pg", "Compram Spaten LN e não compram Stella Pure Gold", T.spt_ln, [T.pg], "Ofertar Stella PG"),
    cruzar("cor_ln_sem_cero", "Compram Corona LN e não compram Corona Cero", T.cor_ln, [T.cor_cero], "Ofertar Corona Cero"),
    cruzar("bud_ln_sem_cor", "Compram Budweiser LN e não compram Corona", T.bud_ln, [T.cor], "Ofertar Corona"),
    cruzar("so_ste_600", "HE 600: compram só Stella 600", soUma("ste_600"), [], "Ofertar Original / Spaten 600"),
    cruzar("so_spt_600", "HE 600: compram só Spaten 600", soUma("spt_600"), [], "Ofertar Stella 600"),
    cruzar("so_ori_600", "HE 600: compram só Original 600", soUma("ori_600"), [], "Ofertar Stella / Spaten 600"),
  ];
  const he600Uma = [...he600.keys()].filter((pdv) => ["ste_600", "spt_600", "ori_600"].filter((x) => T[x].has(pdv)).length === 1).length;
  // Cobertura RGB 300 × Cerveja TT por RN (mês atual e M-1) — Litrinho +RGB
  const cobRazao = (g1, g2, m) => {
    const a = comp[g1][m] || new Map(), b = comp[g2][m] || new Map();
    const cont = (mm, s) => { let c = 0; mm.forEach((st) => { if (!s || st === s) c++; }); return c; };
    const linha = (s) => { const n2 = cont(b, s), n1 = cont(a, s); return { setor: s || "", rn: s ? nomeRn[s] || "" : "Operação", comp_cerv: n2, comp_300: n1, pct: n2 ? r1((n1 / n2) * 100) : null }; };
    return [...SET_RN.map(linha).filter((l) => l.comp_cerv), linha(null)];
  };
  const cob300 = { atual: cobRazao("rgb_300", "cerveja", mesAtual), m1: cobRazao("rgb_300", "cerveja", meses[11]) };
  // Multipack: peso no volume de lata e cobertura (13 meses)
  const multipack = {
    meses, peso: meses.map((m) => { const mp = Object.values(vol.mp[m] || {}).reduce((a, b) => a + b, 0), lt = Object.values(vol.lata_cerv[m] || {}).reduce((a, b) => a + b, 0); return lt ? r1((mp / lt) * 100) : 0; }),
    volume: meses.map((m) => r1(Object.values(vol.mp[m] || {}).reduce((a, b) => a + b, 0))),
    compradores: meses.map((m) => (comp.mp[m] || new Map()).size),
    cobertura_lata: meses.map((m) => { const a = (comp.mp[m] || new Map()).size, b = (comp.lata_cerv[m] || new Map()).size; return b ? r1((a / b) * 100) : 0; }),
    skus: buildUp(doGrupo("mp"), (p) => p.nome).slice(0, 12),
  };
  // Segmento do PDV (cerveja): mês atual (tendência) × M-1 × LY
  const segmentos = Object.keys(Object.assign({}, ...meses.map((m) => segM[m] || {}))).map((k) => {
    const sr = meses.map((m) => (segM[m] || {})[k] || 0); return { segmento: k, ...comparar(sr, tend(sr[12])) };
  }).sort((a, b) => b.l3m - a.l3m);
  const deepDive = {
    ano: anoAtual, mesesAno: mesesAno(anoAtual), temLy, ytdGrupos,
    marcasCerv: buildUp(ehCervC, (p) => marcaDe(p.nome)).slice(0, 15),
    embCerv: buildUp(ehCervC, embCerv),
    embNab: buildUp(ehNabC, embNab).slice(0, 15),
    coreHe: buildUp(ehCervC, (p) => (ehHe(p) ? "HIGH END" : "CORE")),
    segmentos,
    topSku: [...porSku].sort((a, b) => b.delta - a.delta).slice(0, 10),
    bottomSku: [...porSku].sort((a, b) => a.delta - b.delta).slice(0, 10),
    cruzamentos, he600: { compradores: he600.size, so_uma_marca: he600Uma, pct: he600.size ? r1((he600Uma / he600.size) * 100) : null },
    cob300, multipack,
    externos: EXTERNOS,
  };

  return { meses, mesAtual, diasUteis: { feitos: du.feitos, total: du.total }, gerado_em: br.toISOString(),
    volumes, marcas, cidades, compradores, distribuicao, marketplace, deepDive,
    regras: {
      tendencia: "Volume e faturamento: realizado ÷ dias úteis feitos × dias úteis do mês. Compradores: realizado + compradores do mês anterior que ainda não compraram × fração do mês que falta.",
      comparacoes: "vs M-1 = mês anterior · vs L3M = média dos 3 meses anteriores · vs LY = mesmo mês do ano anterior (todos contra a tendência do mês atual).",
      compradores: "Estável = comprou no mês e no anterior · Instável = não comprou no anterior mas sim em algum dos 2 antes · Novo = nada nos 3 meses anteriores.",
      distribuicao: "Σ de SKUs distintos que cada PDV comprou no mês; média = Σ ÷ PDVs compradores do grupo.",
      marcas_foco: MARCAS_FOCO.join(", "),
    } };
}

// GET /api/rps?refresh=1 — gestores
router.get("/", async (req, res) => {
  try {
    if (!GESTORES.includes(req.user.perfil)) return res.status(403).json({ error: "Acesso restrito a gestores." });
    const chave = new Date().toISOString().slice(0, 13);
    if (!req.query.refresh && _cache && _cache.chave === chave && Date.now() - _cache.em < 30 * 60 * 1000) return res.json(_cache.dados);
    const dados = await montar();
    _cache = { chave, em: Date.now(), dados };
    return res.json(dados);
  } catch (e) {
    console.error("rps:", e);
    return res.status(500).json({ error: "Erro ao montar o acompanhamento RPS." });
  }
});

module.exports = router;
