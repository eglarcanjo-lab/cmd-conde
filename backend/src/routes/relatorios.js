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
  { id: "grupo:nab",     label: "NAB (inclui NAB Zero)", cats: ["NAB", "NAB ZERO"] },
  { id: "grupo:match",   label: "Match", cats: ["MATCH"] },
  { id: "grupo:mktp",    label: "Marketplace (MKTP)", cats: ["MKTP"] },
];
const ORDEM_SUB = ["CERVEJA", "CERVEJA ZERO", "CERVEJA MULTIPACK", "GIRO RGB", "LITRINHO", "HE", "HE RGB",
  "TRIMARCA RGB HE (ORIGINAL)", "TRIMARCA RGB HE (STELLA)", "TRIMARCA RGB HE (SPATEN)", "BALANCED CHOICE", "NAB", "NAB ZERO", "MATCH", "MKTP"];
const catsDe = (p) => String(p.categorias || p.categoria || "").toUpperCase().split(/\s*[|,;]\s*/).map((c) => c.trim()).filter(Boolean);
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

// GET /api/relatorios/aberto/sku/:cod → nome do produto (p/ o campo "SKU específico")
router.get("/aberto/sku/:cod", async (req, res) => {
  const cod = normCod(req.params.cod);
  const [full, base] = await Promise.all([readSheet("produtos_full").catch(() => []), readSheet("produtos_base").catch(() => [])]);
  const p = full.find((x) => normCod(x.cod) === cod) || base.find((x) => normCod(x.cod) === cod);
  return p ? res.json({ cod, nome: String(p.nome || "").trim() }) : res.status(404).json({ error: `SKU ${cod} não encontrado no cadastro.` });
});

// Resolve o item pedido → { id, label, skus:Set }
async function resolverItem(id) {
  const raw = String(id || "");
  if (raw.startsWith("sku:")) {
    const cod = normCod(raw.slice(4));
    if (!/^\d+$/.test(cod)) return null;
    const full = await readSheet("produtos_full").catch(() => []);
    const p = full.find((x) => normCod(x.cod) === cod);
    return { id: raw, label: `SKU ${cod}${p ? ` · ${String(p.nome || "").trim()}` : ""}`, skus: new Set([cod]) };
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

    const [vendasAll, usuarios] = await Promise.all([
      readSheetMonths("vendas_cliente_produto", "mes_referencia", meses).catch(() => []),
      readSheet("usuarios").catch(() => []),
    ]);
    const doItem = item.skus;

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

    const valor = (c) => {
      if (!c) return { v: 0, pdvs: 0 };
      if (indicador === "cobertura") return { v: c.pdvs.size, pdvs: c.pdvs.size };
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
    const linhas = Object.keys(agg).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map((setor) => {
      const vals = meses.map((m) => valor(agg[setor][m]));
      return { setor, nome: nomeDe[setor] || "", valores: vals, total: fechar(vals) };
    });
    const valsOp = meses.map((m) => valor(op[m]));

    return res.json({
      item: { id: item.id, label: item.label, skus: doItem.size },
      indicador, meses,
      totalLabel: indicador === "volume" ? "Total" : "Média mensal",
      linhas,
      operacao: { valores: valsOp, total: fechar(valsOp) },
    });
  } catch (e) {
    console.error("relatorios/aberto:", e);
    return res.status(500).json({ error: "Erro ao montar o relatório." });
  }
});

module.exports = router;
