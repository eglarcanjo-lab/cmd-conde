const express = require("express");
const router = express.Router();
const { readSheet } = require("../services/sheets");
const { authMiddleware } = require("../middleware/auth");
const { filtrarPorPerfil } = require("../utils/perfil");

router.use(authMiddleware);

const num = (v) => {
  if (v === null || v === undefined || v === "") return 0;
  const n = parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? 0 : n;
};

// Trimestre civil (jan-mar, abr-jun, …) do mês informado + se é o 3º mês (acumula).
function trimestre(mesStr) {
  const [y, mo] = String(mesStr).split("-").map(Number);
  const ini = Math.floor((mo - 1) / 3) * 3; // mês 0-based do início do trimestre
  const meses = [0, 1, 2].map((i) => `${y}-${String(ini + i + 1).padStart(2, "0")}`);
  return { meses, ehTerceiro: mo - 1 === ini + 2 };
}

// GET /api/resumo/volumes?mes=YYYY-MM — bloco "Volumes" da home (meta × realizado).
// Escopo: admin/director = operação (soma dos setores); GV = sua região; RN = seu setor.
// Cerveja/NAB/Match/Mktp vêm de rv_resultado (a RV já soma "cerveja = tudo exceto
// MKTP/NAB/NAB Zero/Match", incluindo o zero). As "zero" não têm meta oficial:
// monitoramento com meta derivada = 15% do realizado da categoria regular.
router.get("/volumes", async (req, res) => {
  try {
    const mes = req.query.mes || new Date().toISOString().slice(0, 7);
    const [rvResultAll, rvVolAll] = await Promise.all([
      readSheet("rv_resultado").catch(() => []),
      readSheet("rv_volume").catch(() => []),
    ]);
    const rv = filtrarPorPerfil(rvResultAll, req.user, "setor");
    const vol = filtrarPorPerfil(rvVolAll, req.user, "setor");

    const soma = (campo) => rv.reduce((s, r) => s + num(r[campo]), 0);
    const mref = (r) => String(r.mes_ref || r.mes_referencia || "");
    const volCat = (cat) => {
      const c = cat.toUpperCase();
      const sel = vol.filter((r) => String(r.categoria || "").trim().toUpperCase() === c);
      const doMes = sel.filter((r) => mref(r).startsWith(mes));
      return (doMes.length ? doMes : sel).reduce((s, r) => s + num(r.volume), 0);
    };

    const realCerveja = soma("real_cerveja");
    const realNab = soma("real_nab");
    const r1 = (n) => Math.round(n * 10) / 10;
    const pct = (r, m) => (m > 0 ? Math.round((r / m) * 100) : null);
    const mk = (label, real, meta, monit) => ({
      label, real: r1(real), meta: r1(meta), pct: pct(real, meta), monitoramento: !!monit,
    });

    const bars = [
      mk("Cerveja", realCerveja, soma("meta_cerveja")),
      mk("NAB", realNab, soma("meta_nab")),
      mk("Match", soma("real_match"), soma("meta_match")),
      mk("Mktp", soma("real_marketplace"), soma("meta_marketplace")),
      mk("Cerveja Zero", volCat("CERVEJA ZERO"), 0.15 * realCerveja, true),
      mk("NAB Zero", volCat("NAB ZERO"), 0.15 * realNab, true),
    ];
    return res.json({ mes, bars });
  } catch (e) {
    console.error("resumo/volumes:", e);
    return res.status(500).json({ error: "Erro ao montar resumo de volumes." });
  }
});

// GET /api/resumo/foco-ne?mes=YYYY-MM — bloco "Foco NE" (nível operação).
// +RGB (SPO 20), Faturamento Score 5 (12), Portfólio Score 5 (24).
// Realizado: mês corrente = ao vivo (linha OPERACAO do resumo SPO); meses anteriores =
// snapshot em spo_metas.real. Meta = spo_metas.meta (operação). No 3º mês do trimestre,
// soma os 3 meses (acumulado); nos demais, mostra só o mês.
router.get("/foco-ne", async (req, res) => {
  try {
    const mes = req.query.mes || new Date().toISOString().slice(0, 7);
    const { meses, ehTerceiro } = trimestre(mes);
    const [metas, rgb, score5, portf] = await Promise.all([
      readSheet("spo_metas").catch(() => []),
      readSheet("spo_rgb_total").catch(() => []),
      readSheet("spo_score5_resumo").catch(() => []),
      readSheet("spo_portfolio_ideal_resumo").catch(() => []),
    ]);
    const ITENS = {
      20: { label: "+RGB", aba: rgb, campo: "pdvs_bateu_meta" },
      12: { label: "Fat. Score 5", aba: score5, campo: "pdvs_ok" },
      24: { label: "Portfólio Score 5", aba: portf, campo: "pdvs_ideais" },
    };
    const opRow = (aba, m) =>
      aba.find((r) => String(r.setor || "").toUpperCase() === "OPERACAO" && String(r.mes_referencia || "").startsWith(m));
    const metaRow = (item, m) => metas.find((x) => String(x.item) === String(item) && String(x.mes) === m);
    const realMes = (item, m) => {
      if (m === mes) { const r = opRow(ITENS[item].aba, m); return r ? num(r[ITENS[item].campo]) : 0; }
      const r = metaRow(item, m); return r ? num(r.real) : 0; // snapshot do mês fechado
    };
    const metaMes = (item, m) => { const r = metaRow(item, m); return r ? num(r.meta) : 0; };

    const items = [20, 12, 24].map((item) => {
      const real = ehTerceiro ? meses.reduce((s, m) => s + realMes(item, m), 0) : realMes(item, mes);
      const meta = ehTerceiro ? meses.reduce((s, m) => s + metaMes(item, m), 0) : metaMes(item, mes);
      return {
        item, label: ITENS[item].label,
        real: Math.round(real * 10) / 10, meta: Math.round(meta * 10) / 10,
        pct: meta > 0 ? Math.round((real / meta) * 100) : null,
        escopo: ehTerceiro ? "tri" : "mês",
      };
    });
    return res.json({ mes, escopo: ehTerceiro ? "acumulado do trimestre" : "mês", items });
  } catch (e) {
    console.error("resumo/foco-ne:", e);
    return res.status(500).json({ error: "Erro ao montar Foco NE." });
  }
});

// GET /api/resumo/rankings — Top 20 PDVs e Top 10 produtos por volume no trimestre,
// com variação vs o mês anterior. Escopo por perfil (RN vê só o seu).
router.get("/rankings", async (req, res) => {
  try {
    const vendas = filtrarPorPerfil(await readSheet("vendas_cliente_produto").catch(() => []), req.user, "setor");
    const meses = [...new Set(vendas.map((v) => String(v.mes_referencia || "").slice(0, 7)).filter(Boolean))].sort();
    const trimestre = meses.slice(-3);
    const triSet = new Set(trimestre);
    const mAtual = meses[meses.length - 1] || null;
    const mAnterior = meses[meses.length - 2] || null;

    const aggPdv = {}, aggProd = {};
    const acc = (bag, key, base) => {
      if (!bag[key]) bag[key] = { ...base, tri: 0, atual: 0, ant: 0 };
      return bag[key];
    };
    for (const v of vendas) {
      const m = String(v.mes_referencia || "").slice(0, 7);
      const vol = num(v.volume_hl);
      const pk = String(v.cod_pdv || "").trim();
      if (pk) {
        const a = acc(aggPdv, pk, { cod: pk, nome: String(v.nome_pdv || "").trim(), setor: String(v.setor || "").trim() });
        if (triSet.has(m)) a.tri += vol;
        if (m === mAtual) a.atual += vol; else if (m === mAnterior) a.ant += vol;
      }
      const ck = String(v.cod_produto || "").trim();
      if (ck) {
        const a = acc(aggProd, ck, { cod: ck, nome: String(v.nome_produto || "").trim() });
        if (triSet.has(m)) a.tri += vol;
        if (m === mAtual) a.atual += vol; else if (m === mAnterior) a.ant += vol;
      }
    }
    const fin = (o) => ({
      ...o,
      tri: Math.round(o.tri * 10) / 10,
      atual: Math.round(o.atual * 10) / 10,
      ant: Math.round(o.ant * 10) / 10,
      // delta % vs mês anterior; null = sem base no mês anterior (produto/PDV novo)
      delta: o.ant > 0 ? Math.round(((o.atual - o.ant) / o.ant) * 1000) / 10 : (o.atual > 0 ? null : 0),
    });
    const pdvs = Object.values(aggPdv).sort((a, b) => b.tri - a.tri).slice(0, 20).map(fin);
    const produtos = Object.values(aggProd).sort((a, b) => b.tri - a.tri).slice(0, 20).map(fin);
    return res.json({ mesAtual: mAtual, mesAnterior: mAnterior, trimestre, pdvs, produtos });
  } catch (e) {
    console.error("resumo/rankings:", e);
    return res.status(500).json({ error: "Erro ao montar rankings." });
  }
});

// GET /api/resumo/verdes?mes=YYYY-MM — bloco "Verdes" (Trimarca Stella + Spaten), mês a mês.
// Cobertura = nº de pares distintos (PDV × trimarca) que compraram (PDV que comprou as
// duas conta 2). Distribuição = total de CAIXAS (= volume_hl ÷ hl_por_caixa).
// Fonte: vendas_cliente_produto (acumula por mês) + produtos_base (categoria) + produtos_full (hl_caixa).
router.get("/verdes", async (req, res) => {
  try {
    const [vendas, prodBase, prodFull] = await Promise.all([
      readSheet("vendas_cliente_produto").catch(() => []),
      readSheet("produtos_base").catch(() => []),
      readSheet("produtos_full").catch(() => []),
    ]);
    const v = filtrarPorPerfil(vendas, req.user, "setor");

    const trimDe = {}; // cod -> "Stella" | "Spaten"
    prodBase.forEach((p) => {
      const cod = String(p.cod || "").trim();
      if (!cod) return;
      const cats = String(p.categorias || p.categoria || "").toUpperCase();
      if (cats.includes("STELLA")) trimDe[cod] = "Stella";
      else if (cats.includes("SPATEN")) trimDe[cod] = "Spaten";
    });
    const hlCaixa = {};
    prodFull.forEach((p) => { const cod = String(p.cod || "").trim(); if (cod) hlCaixa[cod] = num(p.hl_caixa); });

    const cob = {};     // mes -> Set("pdv|trimarca")
    const distrib = {}; // mes -> caixas
    v.forEach((r) => {
      const cod = String(r.cod_produto || "").trim();
      const trim = trimDe[cod];
      if (!trim) return;
      const m = String(r.mes_referencia || "").slice(0, 7);
      if (!m) return;
      const pdv = String(r.cod_pdv || "").trim();
      (cob[m] = cob[m] || new Set()).add(pdv + "|" + trim);
      const hlc = hlCaixa[cod];
      if (hlc > 0) distrib[m] = (distrib[m] || 0) + num(r.volume_hl) / hlc;
    });

    const meses = [...new Set([...Object.keys(cob), ...Object.keys(distrib)])].sort();
    return res.json({
      meses,
      cobertura: meses.map((m) => (cob[m] ? cob[m].size : 0)),
      distribuicao: meses.map((m) => Math.round(distrib[m] || 0)),
    });
  } catch (e) {
    console.error("resumo/verdes:", e);
    return res.status(500).json({ error: "Erro ao montar Verdes." });
  }
});

module.exports = router;
