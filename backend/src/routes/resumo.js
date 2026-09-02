const express = require("express");
const router = express.Router();
const { readSheet, readSheetMonths } = require("../services/sheets");
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
    // rv_resultado acumula meses — usa só o mês pedido (linhas antigas sem mês contam).
    const rv = filtrarPorPerfil(rvResultAll, req.user, "setor")
      .filter((r) => !r.mes_referencia || String(r.mes_referencia).startsWith(mes));
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

    // Tendência: projeta o realizado do MÊS ATUAL para o fim do mês pelo ritmo de
    // dias úteis (seg-sex). Mês passado/fechado → fator 1 (sem projeção).
    const brNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const mesAtualStr = `${brNow.getFullYear()}-${String(brNow.getMonth() + 1).padStart(2, "0")}`;
    let fator = 1;
    if (mes === mesAtualStr) {
      const yy = brNow.getFullYear(), mm = brNow.getMonth(), hoje = brNow.getDate();
      const uteis = (ate) => { let c = 0; const d = new Date(yy, mm, 1); while (d.getMonth() === mm && d.getDate() <= ate) { const w = d.getDay(); if (w >= 1 && w <= 5) c++; d.setDate(d.getDate() + 1); } return c; };
      const totalMes = uteis(31);
      const decorridos = Math.max(1, uteis(hoje));
      fator = totalMes / decorridos;
    }

    const mk = (label, real, meta, monit) => {
      const tend = real * fator;
      return {
        label, real: r1(real), meta: r1(meta), pct: pct(real, meta),
        tend: r1(tend), pctTend: pct(tend, meta), monitoramento: !!monit,
      };
    };

    const bars = [
      mk("Cerveja", realCerveja, soma("meta_cerveja")),
      mk("NAB", realNab, soma("meta_nab")),
      mk("Match", soma("real_match"), soma("meta_match")),
      mk("Mktp", soma("real_marketplace"), soma("meta_marketplace")),
      mk("Cerveja Zero", volCat("CERVEJA ZERO"), 0.15 * realCerveja, true),
      mk("NAB Zero", volCat("NAB ZERO"), 0.15 * realNab, true),
    ];
    return res.json({ mes, bars, fator: Math.round(fator * 100) / 100 });
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

// GET /api/resumo/rankings — Top 20 PDVs e Top 20 produtos por volume no trimestre,
// com comparação D-1 ACUMULADA (dia 01..ontem deste mês vs mesmo período do mês anterior)
// + GAP em HL. Escopo por perfil. Diário vem de vd_pdv/vd_produto; rank do trimestre (vendas).
router.get("/rankings", async (req, res) => {
  try {
    // Janela (fuso BR): mês atual, anterior e trimestre = 3 meses de CALENDÁRIO.
    // (Antes o trimestre eram os "3 meses mais recentes das vendas"; com 2025 carregado
    //  isso obrigava a ler a tabela inteira. Agora derivamos do calendário e lemos só esses.)
    const brNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const cutoffDia = brNow.getDate() - 1;
    const y = brNow.getFullYear(), m0 = brNow.getMonth();
    const ym = (yy, mm0) => { const d = new Date(yy, mm0, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
    const mesAtual = ym(y, m0);
    const mesAnterior = ym(y, m0 - 1);
    // Média = 3 meses COMPLETOS anteriores (EXCLUI o mês atual). Ex.: julho → abr/mai/jun.
    const media3Meses = [3, 2, 1].map((k) => ym(y, m0 - k));
    const media3Set = new Set(media3Meses);

    // Lê SÓ os meses necessários (filtro no SQL): 3 meses da média + o mês atual (p/ o total).
    const [vendas, vdPdv, vdProd, prodBase, gradeEstoque, usuarios] = await Promise.all([
      readSheetMonths("vendas_cliente_produto", "mes_referencia", [...media3Meses, mesAtual]).catch(() => []),
      readSheetMonths("vd_pdv", "mes_referencia", [mesAtual, mesAnterior]).catch(() => []),
      readSheetMonths("vd_produto", "mes_referencia", [mesAtual, mesAnterior]).catch(() => []),
      readSheet("produtos_base").catch(() => []),
      readSheet("grade_estoque").catch(() => []),
      readSheet("usuarios").catch(() => []),
    ]);
    const vendasF = filtrarPorPerfil(vendas, req.user, "setor");
    const vdPdvF = filtrarPorPerfil(vdPdv, req.user, "setor");
    const vdProdF = filtrarPorPerfil(vdProd, req.user, "setor");

    // Agrega por cod: soma3 = volume dos 3 meses da média; atualTotal = volume do mês atual.
    const aggDe = (rows, codF, nomeF) => {
      const t = {};
      for (const v of rows) {
        const mes = String(v.mes_referencia || "").slice(0, 7);
        const cod = String(v[codF] || "").trim(); if (!cod) continue;
        const e = t[cod] || (t[cod] = { cod, nome: String(v[nomeF] || "").trim(), setor: String(v.setor || "").trim(), soma3: 0, atualTotal: 0 });
        const vol = num(v.volume_hl);
        if (media3Set.has(mes)) e.soma3 += vol;
        else if (mes === mesAtual) e.atualTotal += vol;
      }
      return t;
    };
    const d1De = (rows, codF) => {
      const d = {};
      for (const r of rows) {
        const data = String(r.data || "");
        const dia = Number(data.slice(8, 10));
        if (!(cutoffDia >= 1 && dia >= 1 && dia <= cutoffDia)) continue;
        const mes = data.slice(0, 7);
        const cod = String(r[codF] || "").trim(); if (!cod) continue;
        const e = d[cod] || (d[cod] = { atual: 0, anterior: 0 });
        const vol = num(r.volume_hl);
        if (mes === mesAtual) e.atual += vol; else if (mes === mesAnterior) e.anterior += vol;
      }
      return d;
    };
    // Rank pela MÉDIA 3M (representa o volume "de base" do PDV/produto).
    const montar = (aggMap, d1Map, n) => Object.values(aggMap)
      .map((t) => ({ ...t, media3m: t.soma3 / 3 }))
      .sort((a, b) => b.media3m - a.media3m).slice(0, n).map((t) => {
        const d = d1Map[t.cod] || { atual: 0, anterior: 0 };
        return {
          cod: t.cod, nome: t.nome, setor: t.setor,
          media3m: Math.round(t.media3m * 10) / 10,
          mesAtualTotal: Math.round(t.atualTotal * 10) / 10,
          gap: Math.round((d.atual - d.anterior) * 10) / 10,
          delta: d.anterior > 0 ? Math.round(((d.atual - d.anterior) / d.anterior) * 1000) / 10 : (d.atual > 0 ? null : 0),
        };
      });

    // PDVs: ranking completo p/ separar por segmento — AS = setor 101-103, Rota = os demais.
    const pdvsFull = montar(aggDe(vendasF, "cod_pdv", "nome_pdv"), d1De(vdPdvF, "cod_pdv"), 100000);
    // RN responsável = usuário cujo cod é o setor do PDV.
    const rnMap = {};
    usuarios.forEach((u) => { if (u.cod) rnMap[String(u.cod).trim()] = String(u.nome || "").trim(); });
    pdvsFull.forEach((p) => { p.rn = rnMap[String(p.setor).trim()] || ""; });
    const isAS = (s) => ["101", "102", "103"].includes(String(s || "").trim());
    const pdvs = pdvsFull.slice(0, 20);
    const pdvsAS = pdvsFull.filter((p) => isAS(p.setor)).slice(0, 20);
    const pdvsRota = pdvsFull.filter((p) => !isAS(p.setor)).slice(0, 20);
    const produtos = montar(aggDe(vendasF, "cod_produto", "nome_produto"), d1De(vdProdF, "cod_produto"), 20);

    // Nome COMPLETO do produto vem da base de produtos (a nomenclatura das vendas é abreviada).
    // Casa por código (com e sem zeros à esquerda); se não achar, mantém o nome das vendas.
    const normCod = (v) => { const s = String(v || "").trim(); return s.replace(/^0+/, "") || s; };
    const nomeBase = {};
    prodBase.forEach((p) => {
      const nome = String(p.nome || p.descricao || p.nome_produto || "").trim();
      const cod = String(p.cod || "").trim();
      if (nome && cod) { nomeBase[cod] = nome; nomeBase[normCod(cod)] = nome; }
    });
    produtos.forEach((p) => {
      const full = nomeBase[String(p.cod).trim()] || nomeBase[normCod(p.cod)];
      if (full) p.nome = full;
    });

    // Estoque disponível (saldo/"Disp") por produto — vem da Grade de Estoque (grade_estoque).
    const estoqueMap = {};
    gradeEstoque.forEach((r) => { const c = normCod(r.cod); if (c && c !== "0") estoqueMap[c] = Math.round(num(r.saldo)); });
    produtos.forEach((p) => {
      const e = estoqueMap[String(p.cod).trim()] ?? estoqueMap[normCod(p.cod)];
      p.estoque = e === undefined ? null : e;
    });

    const rot = (m) => { const [, mo] = String(m).split("-"); return ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"][(Number(mo) || 1) - 1]; };
    return res.json({
      mesAtual, mesAnterior, cutoffDia,
      mediaLabel: `${rot(media3Meses[0])}–${rot(media3Meses[2])}`, // ex.: "abr–jun"
      periodo: cutoffDia >= 1 ? `01–${String(cutoffDia).padStart(2, "0")}` : "—",
      temDiario: vdPdvF.length > 0,
      pdvs, pdvsAS, pdvsRota, produtos,
    });
  } catch (e) {
    console.error("resumo/rankings:", e);
    return res.status(500).json({ error: "Erro ao montar rankings." });
  }
});

// GET /api/resumo/verdes?sku=33857 — bloco "Verdes" focado num SKU (default 33857,
// Stella Pure Gold), mês a mês, com quebra por RN (setor) + consolidado.
// Cobertura = nº de PDVs distintos que compraram o SKU. Distribuição = CAIXAS (volume_hl ÷ hl_caixa).
router.get("/verdes", async (req, res) => {
  try {
    const normCod = (x) => { const s = String(x || "").trim(); return s.replace(/^0+/, "") || s; };
    const SKU = normCod(req.query.sku || "33857");

    // Trimestre atual (civil): jan-mar, abr-jun, jul-set, out-dez.
    const brNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const y = brNow.getFullYear(), m0 = brNow.getMonth();
    const triStart = Math.floor(m0 / 3) * 3;
    const janela = [0, 1, 2].map((k) => {
      const d = new Date(y, triStart + k, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    });
    const [vendas, prodFull, usuarios] = await Promise.all([
      readSheetMonths("vendas_cliente_produto", "mes_referencia", janela).catch(() => []),
      readSheet("produtos_full").catch(() => []),
      readSheet("usuarios").catch(() => []),
    ]);
    const v = filtrarPorPerfil(vendas, req.user, "setor");

    let hlc = 0, nomeSku = "";
    prodFull.forEach((p) => { if (normCod(p.cod) === SKU) { hlc = num(p.hl_caixa); nomeSku = String(p.nome || "").trim(); } });
    const rnMap = {};
    usuarios.forEach((u) => { if (u.cod) rnMap[String(u.cod).trim()] = String(u.nome || "").trim(); });

    const perRn = {};   // setor -> { cob:{mes:Set pdv}, dist:{mes:caixas} }
    const consCob = {}; // mes -> Set pdv (global)
    const consDist = {};
    v.forEach((r) => {
      if (normCod(r.cod_produto) !== SKU) return;
      const mes = String(r.mes_referencia || "").slice(0, 7);
      if (!mes) return;
      if (!nomeSku) nomeSku = String(r.nome_produto || "").trim();
      const setor = String(r.setor || "").trim();
      const pdv = String(r.cod_pdv || "").trim();
      const cx = hlc > 0 ? num(r.volume_hl) / hlc : 0;
      const e = perRn[setor] || (perRn[setor] = { cob: {}, dist: {} });
      (e.cob[mes] = e.cob[mes] || new Set()).add(pdv);
      e.dist[mes] = (e.dist[mes] || 0) + cx;
      (consCob[mes] = consCob[mes] || new Set()).add(pdv);
      consDist[mes] = (consDist[mes] || 0) + cx;
    });

    const meses = janela; // sempre os 3 meses do trimestre atual (mostra Jul/Ago/Set mesmo sem dado)
    const porRn = Object.keys(perRn).sort().map((setor) => {
      const e = perRn[setor];
      return {
        setor, rn: rnMap[setor] || "",
        cobertura: meses.map((m) => (e.cob[m] ? e.cob[m].size : 0)),
        distribuicao: meses.map((m) => Math.round(e.dist[m] || 0)),
      };
    });

    return res.json({
      produto: { cod: SKU, nome: nomeSku || SKU },
      meses,
      consolidado: {
        cobertura: meses.map((m) => (consCob[m] ? consCob[m].size : 0)),
        distribuicao: meses.map((m) => Math.round(consDist[m] || 0)),
      },
      porRn,
    });
  } catch (e) {
    console.error("resumo/verdes:", e);
    return res.status(500).json({ error: "Erro ao montar Verdes." });
  }
});

// GET /api/resumo/verdes/pedidos?setor=&mes= — linha a linha dos pedidos do SKU
// (33857) p/ export Excel. Fonte: verdes_pedidos (montada no processador).
router.get("/verdes/pedidos", async (req, res) => {
  try {
    const all = await readSheet("verdes_pedidos").catch(() => []);
    let lin = filtrarPorPerfil(all, req.user, "setor");
    const setor = String(req.query.setor || "").trim();
    const mes = String(req.query.mes || "").trim();
    if (setor) lin = lin.filter((r) => String(r.setor || "").trim() === setor);
    if (mes) lin = lin.filter((r) => String(r.mes_referencia || "").slice(0, 7) === mes);
    return res.json(lin);
  } catch (e) {
    console.error("resumo/verdes/pedidos:", e);
    return res.status(500).json({ error: "Erro ao buscar pedidos dos Verdes." });
  }
});

module.exports = router;
