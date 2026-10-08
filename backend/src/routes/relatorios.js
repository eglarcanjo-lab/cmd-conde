// "Outros relatórios" — relatório aberto configurável (item × indicador × meses × setor).
// Fonte: vendas_cliente_produto (setor · PDV · produto · volume_hl · mês; só venda efetiva).
//   • Cobertura    = nº de PDVs DISTINTOS que compraram o item no mês.
//   • Volume       = soma de HL do item no mês.
//   • Distribuição = Σ, por PDV, dos SKUs DISTINTOS do item que ele comprou (+ média por PDV).
// Setores 301–305 entram como 107–111 (renomeados) p/ a série do RN não quebrar.
// Novo item = 1 linha em ITENS.
const express = require("express");
const router = express.Router();
const { readSheet, readSheetMonths } = require("../services/sheets");
const { authMiddleware } = require("../middleware/auth");
const { filtrarPorPerfil } = require("../utils/perfil");

router.use(authMiddleware);

const ITENS = [
  { id: "spg600",       label: "Stella Pure Gold 600 (SPG 600)", sku: "33857" },
  { id: "cerveja_zero", label: "Cerveja Zero",                    categoria: "CERVEJA ZERO" },
  { id: "nab_zero",     label: "NAB Zero",                        categoria: "NAB ZERO" },
  { id: "mktp",         label: "Marketplace (MKTP)",              categoria: "MKTP" },
];
const INDICADORES = ["cobertura", "volume", "distribuicao"];
const NOVO_DE = { "301": "107", "302": "108", "303": "109", "304": "110", "305": "111" };
const num = (v) => parseFloat(String(v ?? "0").replace(",", ".")) || 0;
const normCod = (v) => String(v ?? "").trim().replace(/\.0$/, "").replace(/^0+/, "");
const setorHop = (s) => { const x = String(s || "").trim(); return NOVO_DE[x] || x; };

// GET /api/relatorios/aberto/opcoes → itens e indicadores disponíveis
router.get("/aberto/opcoes", (req, res) =>
  res.json({ itens: ITENS.map(({ id, label }) => ({ id, label })), indicadores: INDICADORES }));

// GET /api/relatorios/aberto?item=&indicador=&meses=2026-06,2026-07&porSetor=1
router.get("/aberto", async (req, res) => {
  try {
    const item = ITENS.find((i) => i.id === req.query.item);
    const indicador = String(req.query.indicador || "");
    const meses = String(req.query.meses || "").split(",").map((m) => m.trim()).filter((m) => /^\d{4}-\d{2}$/.test(m)).sort();
    if (!item) return res.status(400).json({ error: "Item inválido." });
    if (!INDICADORES.includes(indicador)) return res.status(400).json({ error: "Indicador inválido." });
    if (!meses.length) return res.status(400).json({ error: "Escolha ao menos um mês." });

    const [vendasAll, prodBase, usuarios] = await Promise.all([
      readSheetMonths("vendas_cliente_produto", "mes_referencia", meses).catch(() => []),
      item.categoria ? readSheet("produtos_base").catch(() => []) : Promise.resolve([]),
      readSheet("usuarios").catch(() => []),
    ]);

    // Produtos do item (SKU fixo ou todos da categoria cadastrada na HOP)
    let doItem;
    if (item.sku) doItem = new Set([item.sku]);
    else {
      const alvo = item.categoria.toUpperCase();
      doItem = new Set(prodBase
        .filter((p) => String(p.categorias || p.categoria || "").toUpperCase().split(/\s*[|,;]\s*/).includes(alvo))
        .map((p) => normCod(p.cod)));
    }

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
