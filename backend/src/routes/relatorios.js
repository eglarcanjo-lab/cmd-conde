// "Outros relatórios" — relatório aberto configurável (item × indicador × meses × setor).
// Fonte: vendas_cliente_produto (setor · PDV · produto · volume_hl · mês; só venda efetiva).
//   • Cobertura    = nº de PDVs DISTINTOS que compraram o item no mês.
//   • Volume       = soma de HL do item no mês.
//   • Distribuição = Σ, por PDV, dos SKUs DISTINTOS do item que ele comprou (+ média por PDV).
// Setores 301–305 entram como 107–111 (renomeados) p/ a série do RN não quebrar.
// Itens: GRUPOS (somam as subcategorias, mesma regra da Home) · cada SUBCATEGORIA do cadastro
// de produtos da HOP · ou um SKU específico (item = "sku:<código>").
const express = require("express");
const router = express.Router();
const { readSheet, readSheetMonths } = require("../services/sheets");
const { authMiddleware } = require("../middleware/auth");
const { filtrarPorPerfil } = require("../utils/perfil");

router.use(authMiddleware);

// Grupos = macro (produto entra se tiver QUALQUER uma das categorias; conta 1x).
const CERVEJA_FAM = ["CERVEJA", "CERVEJA ZERO", "CERVEJA MULTIPACK", "GIRO RGB", "HE", "HE RGB",
  "TRIMARCA RGB HE (ORIGINAL)", "TRIMARCA RGB HE (STELLA)", "TRIMARCA RGB HE (SPATEN)", "BALANCED CHOICE", "LITRINHO"];
const GRUPOS = [
  { id: "grupo:cerveja", label: "Cerveja (todas: Zero, Multipack, Giro RGB, HE, Trimarcas, BC, Litrinho)", cats: CERVEJA_FAM },
  { id: "grupo:rgb",     label: "RGB (Giro RGB + Litrinho + Trimarcas Original/Stella/Spaten)",
    cats: ["GIRO RGB", "LITRINHO", "TRIMARCA RGB HE (ORIGINAL)", "TRIMARCA RGB HE (STELLA)", "TRIMARCA RGB HE (SPATEN)"] },
  { id: "grupo:nab",     label: "NAB (inclui NAB Zero)", cats: ["NAB", "NAB ZERO"] },
  { id: "grupo:match",   label: "Match", cats: ["MATCH"] },
  { id: "grupo:mktp",    label: "Marketplace (MKTP)", cats: ["MKTP"] },
];
const ORDEM_SUB = ["CERVEJA", "CERVEJA ZERO", "CERVEJA MULTIPACK", "GIRO RGB", "LITRINHO", "HE", "HE RGB",
  "TRIMARCA RGB HE (ORIGINAL)", "TRIMARCA RGB HE (STELLA)", "TRIMARCA RGB HE (SPATEN)", "BALANCED CHOICE", "NAB", "NAB ZERO", "MATCH", "MKTP"];
// "nan"/"none" = valor vazio salvo como texto (sobra do pandas) — não é nome nem categoria
const LIXO = new Set(["NAN", "NONE", "NULL", "NAT"]);
const limpo = (v) => { const t = String(v ?? "").trim(); return LIXO.has(t.toUpperCase()) ? "" : t; };
const catsDe = (p) => limpo(p.categorias || p.categoria).toUpperCase().split(/\s*[|,;]\s*/).map((c) => c.trim()).filter((c) => c && !LIXO.has(c));
const titulo = (c) => c.toLowerCase().replace(/(^|\s|\()\S/g, (x) => x.toUpperCase()).replace(/\bHe\b/g, "HE").replace(/\bRgb\b/g, "RGB").replace(/\bNab\b/g, "NAB").replace(/\bMktp\b/g, "MKTP").replace(/\bBc\b/g, "BC");
const INDICADORES = ["cobertura", "volume", "distribuicao"];
const NOVO_DE = { "301": "107", "302": "108", "303": "109", "304": "110", "305": "111" };
const num = (v) => parseFloat(String(v ?? "0").replace(",", ".")) || 0;
const normCod = (v) => String(v ?? "").trim().replace(/\.0$/, "").replace(/^0+/, "");
const setorHop = (s) => { const x = String(s || "").trim(); return NOVO_DE[x] || x; };

// GET /api/relatorios/aberto/opcoes → grupos + subcategorias existentes no cadastro + indicadores
router.get("/aberto/opcoes", async (req, res) => {
  const base = await readSheet("produtos_base").catch(() => []);
  const existentes = new Set(base.flatMap(catsDe));
  const subs = [...existentes].sort((a, b) => {
    const ia = ORDEM_SUB.indexOf(a), ib = ORDEM_SUB.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
  }).map((c) => ({ id: `cat:${c}`, label: c === "CERVEJA" ? "Cerveja (só a categoria CERVEJA)" : c === "NAB" ? "NAB (sem o NAB Zero)" : titulo(c) }));
  return res.json({ grupos: GRUPOS.map(({ id, label }) => ({ id, label })), subcategorias: subs, indicadores: INDICADORES });
});

// GET /api/relatorios/aberto/produtos → produtos da BASE DE PRODUTOS com categoria
// ({cod, nome, categorias}) p/ a busca do "SKU específico" (não usa a Grade).
router.get("/aberto/produtos", async (req, res) => {
  const [base, full] = await Promise.all([readSheet("produtos_base").catch(() => []), readSheet("produtos_full").catch(() => [])]);
  const nomeFull = {};
  full.forEach((p) => { const c = normCod(p.cod); if (c && limpo(p.nome)) nomeFull[c] = limpo(p.nome); });
  const porCod = new Map();   // 1 por código (prefere a linha com nome)
  base.forEach((p) => {
    const cod = normCod(p.cod), categorias = catsDe(p).join(" | ");
    if (!cod || !categorias) return;
    const nome = limpo(p.nome) || nomeFull[cod] || "";
    if (!porCod.has(cod) || (!porCod.get(cod).nome && nome)) porCod.set(cod, { cod, nome, categorias });
  });
  const semNome = [...porCod.values()].filter((p) => !p.nome);
  if (semNome.length) {
    const d = new Date(); const ms = [0, 1, 2].map((k) => { const x = new Date(d.getFullYear(), d.getMonth() - k, 1); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`; });
    const vd = await readSheetMonths("vd_produto", "mes_referencia", ms).catch(() => []);
    const nomeVenda = {};
    vd.forEach((r) => { const c = normCod(r.cod_produto); if (c && limpo(r.nome_produto) && !nomeVenda[c]) nomeVenda[c] = limpo(r.nome_produto); });
    semNome.forEach((p) => { p.nome = nomeVenda[p.cod] || ""; });
  }
  return res.json([...porCod.values()].sort((a, b) => (a.nome || "~").localeCompare(b.nome || "~", "pt-BR")));
});

// GET /api/relatorios/aberto/sku/:cod → nome do produto (p/ o campo "SKU específico")
router.get("/aberto/sku/:cod", async (req, res) => {
  const cod = normCod(req.params.cod);
  const [full, base] = await Promise.all([readSheet("produtos_full").catch(() => []), readSheet("produtos_base").catch(() => [])]);
  const p = full.find((x) => normCod(x.cod) === cod) || base.find((x) => normCod(x.cod) === cod);
  return p ? res.json({ cod, nome: limpo(p.nome) }) : res.status(404).json({ error: `SKU ${cod} não encontrado no cadastro.` });
});

// Resolve o item pedido → { id, label, skus:Set }
async function resolverItem(id) {
  const raw = String(id || "");
  if (raw.startsWith("sku:")) {
    // 1 ou mais SKUs: "sku:33857" ou "sku:33857,25065,…" (cesta — ex.: incentivo de um fornecedor)
    const cods = [...new Set(raw.slice(4).split(",").map(normCod).filter((c) => /^\d+$/.test(c)))];
    if (!cods.length) return null;
    const full = await readSheet("produtos_full").catch(() => []);
    const nome = (cod) => { const p = full.find((x) => normCod(x.cod) === cod); return p && limpo(p.nome) ? limpo(p.nome) : ""; };
    const label = cods.length === 1 ? `SKU ${cods[0]}${nome(cods[0]) ? ` · ${nome(cods[0])}` : ""}` : `${cods.length} SKUs (${cods.join(", ")})`;
    return { id: `sku:${cods.join(",")}`, label, skus: new Set(cods) };
  }
  const base = await readSheet("produtos_base").catch(() => []);
  let cats, label;
  const g = GRUPOS.find((x) => x.id === raw);
  if (g) { cats = g.cats; label = g.label.split(" (")[0]; }
  else if (raw.startsWith("cat:")) { cats = [raw.slice(4).toUpperCase()]; label = titulo(cats[0]); }
  else return null;
  const alvo = new Set(cats);
  return { id: raw, label, skus: new Set(base.filter((p) => catsDe(p).some((c) => alvo.has(c))).map((p) => normCod(p.cod))) };
}

// GET /api/relatorios/aberto?item=&indicador=&meses=2026-06,2026-07&porSetor=1
router.get("/aberto", async (req, res) => {
  try {
    const item = await resolverItem(req.query.item);
    const indicador = String(req.query.indicador || "");
    const meses = String(req.query.meses || "").split(",").map((m) => m.trim()).filter((m) => /^\d{4}-\d{2}$/.test(m)).sort();
    if (!item) return res.status(400).json({ error: "Item inválido." });
    if (!INDICADORES.includes(indicador)) return res.status(400).json({ error: "Indicador inválido." });
    if (!meses.length) return res.status(400).json({ error: "Escolha ao menos um mês." });

    const [vendasAll, usuarios, pdvBase] = await Promise.all([
      readSheetMonths("vendas_cliente_produto", "mes_referencia", meses).catch(() => []),
      readSheet("usuarios").catch(() => []),
      readSheet("pdv_base").catch(() => []),
    ]);
    const doItem = item.skus;

    // Base de PDVs ATIVOS (base de clientes atual) por setor → % de cobertura (PDVs que
    // compraram ÷ base do setor). Mesma base p/ todos os meses (não há foto mensal da base).
    const baseDe = {}; let baseOp = 0; const vistos = new Set();
    filtrarPorPerfil(pdvBase.map((p) => ({ ...p, setor: setorHop(p.setor) })), req.user, "setor").forEach((p) => {
      const c = normCod(p.cod_pdv || p.cod); if (!c || vistos.has(c)) return; vistos.add(c);
      const s = String(p.setor || "").trim(); if (!s) return;
      baseDe[s] = (baseDe[s] || 0) + 1; baseOp++;
    });
    const pct = (n, b) => (b ? Math.round((n / b) * 1000) / 10 : null);

    const vendas = filtrarPorPerfil(
      vendasAll.map((v) => ({ ...v, setor: setorHop(v.setor) })), req.user, "setor");
    // agg[setor][mes] = { pdvs:Set, hl, skusPorPdv: Map(pdv → Set(sku)) }
    const agg = {};
    const op = {};
    const novo = () => ({ pdvs: new Set(), hl: 0, sk: new Map() });
    for (const v of vendas) {
      const mes = String(v.mes_referencia || "").slice(0, 7);
      if (!meses.includes(mes)) continue;
      const sku = normCod(v.cod_produto);
      if (!doItem.has(sku)) continue;
      const hl = num(v.volume_hl);
      if (hl <= 0) continue;
      const setor = String(v.setor || "").trim();
      const pdv = normCod(v.cod_pdv);
      for (const alvo of [((agg[setor] = agg[setor] || {})[mes] = agg[setor][mes] || novo()), (op[mes] = op[mes] || novo())]) {
        alvo.pdvs.add(pdv);
        alvo.hl += hl;
        if (!alvo.sk.has(pdv)) alvo.sk.set(pdv, new Set());
        alvo.sk.get(pdv).add(sku);
      }
    }

    const valor = (c, base) => {
      if (!c) return { v: 0, pdvs: 0, ...(indicador === "cobertura" ? { pct: pct(0, base) } : {}) };
      if (indicador === "cobertura") return { v: c.pdvs.size, pdvs: c.pdvs.size, pct: pct(c.pdvs.size, base) };
      if (indicador === "volume") return { v: Math.round(c.hl * 10) / 10, pdvs: c.pdvs.size };
      let soma = 0; c.sk.forEach((s) => { soma += s.size; });
      return { v: soma, pdvs: c.pdvs.size, media: c.pdvs.size ? Math.round((soma / c.pdvs.size) * 10) / 10 : 0 };
    };
    // Total do período: volume = soma; cobertura/distribuição = média mensal (somar não faz sentido)
    const fechar = (vals) => {
      const soma = vals.reduce((s, x) => s + x.v, 0);
      return indicador === "volume" ? Math.round(soma * 10) / 10 : Math.round((soma / vals.length) * 10) / 10;
    };

    const nomeDe = {};
    usuarios.forEach((u) => { const c = String(u.cod || "").trim(); if (c) nomeDe[c] = String(u.nome || "").trim(); });
    // Todos os setores da base aparecem (inclusive quem não vendeu = 0%), + quem vendeu fora da base.
    const cob = indicador === "cobertura";
    // Cobertura ACUMULADA do período: PDVs DISTINTOS que compraram em QUALQUER mês marcado
    // (soma as vendas dos meses, PDV conta 1x) ÷ a mesma base do setor.
    const acumulado = (cels, base) => {
      const u = new Set(); cels.forEach((c) => c.pdvs.forEach((p) => u.add(p)));
      return { acum: u.size, acumPct: pct(u.size, base) };
    };
    const setores = [...new Set([...Object.keys(baseDe), ...Object.keys(agg)])];
    const linhas = setores.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map((setor) => {
      const vals = meses.map((m) => valor((agg[setor] || {})[m], baseDe[setor]));
      const total = fechar(vals);
      return { setor, nome: nomeDe[setor] || "", base: baseDe[setor] || 0, valores: vals, total, totalPct: cob ? pct(total, baseDe[setor]) : null,
        ...(cob ? acumulado(Object.values(agg[setor] || {}), baseDe[setor]) : {}) };
    });
    const valsOp = meses.map((m) => valor(op[m], baseOp));
    const totalOp = fechar(valsOp);

    return res.json({
      item: { id: item.id, label: item.label, skus: doItem.size },
      indicador, meses,
      totalLabel: indicador === "volume" ? "Total" : "Média mensal",
      linhas,
      operacao: { base: baseOp, valores: valsOp, total: totalOp, totalPct: cob ? pct(totalOp, baseOp) : null,
        ...(cob ? acumulado(Object.values(op), baseOp) : {}) },
    });
  } catch (e) {
    console.error("relatorios/aberto:", e);
    return res.status(500).json({ error: "Erro ao montar o relatório." });
  }
});

// ── Base de PDVs × dia de visita (estudo de rota) ───────────────────────────────
// GET /api/relatorios/base-visita?meses=2026-01,...,2026-09
// 1 linha por PDV ATIVO da base de clientes (0105070402): cidade, bairro, categoria, setor,
// dia de visita + volume (HL) do período (vendas_cliente_produto, venda efetiva) e média
// mensal. Os resumos (dia × cidade, cidade/bairro, maiores PDVs, cidade × setor) são
// montados na tela a partir destas linhas.
const DIAS = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB"];
router.get("/base-visita", async (req, res) => {
  try {
    const meses = String(req.query.meses || "").split(",").map((m) => m.trim()).filter((m) => /^\d{4}-\d{2}$/.test(m)).sort();
    if (!meses.length) return res.status(400).json({ error: "Escolha ao menos um mês." });
    const [baseAll, vendas, usuarios] = await Promise.all([
      readSheet("pdv_base").catch(() => []),
      readSheetMonths("vendas_cliente_produto", "mes_referencia", meses).catch(() => []),
      readSheet("usuarios").catch(() => []),
    ]);
    const base = filtrarPorPerfil(baseAll.map((p) => ({ ...p, setor: setorHop(p.setor) })), req.user, "setor");

    const vol = {};
    vendas.forEach((v) => {
      if (!meses.includes(String(v.mes_referencia || "").slice(0, 7))) return;
      const c = normCod(v.cod_pdv), hl = num(v.volume_hl);
      if (c && hl) vol[c] = (vol[c] || 0) + hl;
    });
    const nomeDe = {};
    usuarios.forEach((u) => { const c = String(u.cod || "").trim(); if (c) nomeDe[c] = String(u.nome || "").trim(); });

    const vistos = new Set();
    const linhas = [];
    base.forEach((p) => {
      const cod = normCod(p.cod_pdv || p.cod);
      if (!cod || vistos.has(cod)) return;
      vistos.add(cod);
      const d = String(p.dia_visita || "").trim().toUpperCase().slice(0, 3);
      const v = Math.round((vol[cod] || 0) * 10000) / 10000;
      linhas.push({
        cod_pdv: cod,
        nome: limpo(p.nome_fantasia) || limpo(p.razao_social),
        cidade: limpo(p.cidade).toUpperCase(),
        bairro: limpo(p.bairro),
        categoria: limpo(p.categoria) || limpo(p.segmento),
        setor: String(p.setor || "").trim(),
        dia: DIAS.includes(d) ? d : "",
        volume: v,
        media: Math.round((v / meses.length) * 10000) / 10000,
      });
    });
    linhas.sort((a, b) => b.volume - a.volume);
    return res.json({
      meses,
      tem_bairro: linhas.some((l) => l.bairro),
      setores: [...new Set(linhas.map((l) => l.setor))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        .map((s) => ({ setor: s, nome: nomeDe[s] || "" })),
      linhas,
    });
  } catch (e) {
    console.error("relatorios/base-visita:", e);
    return res.status(500).json({ error: "Erro ao montar a base de PDVs." });
  }
});

module.exports = router;
