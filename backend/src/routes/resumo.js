const express = require("express");
const router = express.Router();
const { readSheet, readSheetMonths } = require("../services/sheets");
const { authMiddleware } = require("../middleware/auth");
const { filtrarPorPerfil } = require("../utils/perfil");
const { montarReport } = require("../utils/volumesReport");
const { query } = require("../services/db");
const { CATS_MONITOR, lerMetasMonitor, salvarMetasMonitor, ratearMetasMonitor } = require("../utils/metasMonitor");

router.use(authMiddleware);

const num = (v) => {
  if (v === null || v === undefined || v === "") return 0;
  const n = parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? 0 : n;
};

// GET /api/resumo/volumes?mes=YYYY-MM — bloco "Volumes" da home (meta × realizado).
// Escopo: admin/director = operação (soma dos setores); GV = sua região; RN = seu setor.
// Cerveja/NAB/Match/Mktp vêm de rv_resultado (a RV já soma "cerveja = tudo exceto
// MKTP/NAB/NAB Zero/Match", incluindo o zero). As "zero" não têm meta oficial:
// monitoramento com meta derivada = 15% do realizado da categoria regular.
router.get("/volumes", async (req, res) => {
  try {
    const mes = req.query.mes || new Date().toISOString().slice(0, 7);
    const [rvResultAll, rvVolAll, usuarios, metasMon] = await Promise.all([
      readSheet("rv_resultado").catch(() => []),
      readSheet("rv_volume").catch(() => []),
      readSheet("usuarios").catch(() => []),
      lerMetasMonitor(mes),
    ]);
    // Metas de monitoramento (Cerveja Zero / Match / NAB Zero) — rateio sobre a operação inteira
    const rateio = ratearMetasMonitor(metasMon, rvResultAll.filter((r) => !r.mes_referencia || String(r.mes_referencia).startsWith(mes)));
    // rv_resultado acumula meses — usa só o mês pedido (linhas antigas sem mês contam).
    const rv = filtrarPorPerfil(rvResultAll, req.user, "setor")
      .filter((r) => !r.mes_referencia || String(r.mes_referencia).startsWith(mes));
    const vol = filtrarPorPerfil(rvVolAll, req.user, "setor");

    const mref = (r) => String(r.mes_ref || r.mes_referencia || "");
    const r1 = (n) => Math.round(n * 10) / 10;
    const pct = (r, m) => (m > 0 ? Math.round((r / m) * 100) : null);

    // Tendência: projeta o realizado do MÊS ATUAL para o fim do mês pelo ritmo de
    // dias úteis (seg-sex). Mês passado/fechado → fator 1 (sem projeção).
    const brNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const mesAtualStr = `${brNow.getFullYear()}-${String(brNow.getMonth() + 1).padStart(2, "0")}`;
    let fator = 1, diasUteis = null;
    if (mes === mesAtualStr) {
      const yy = brNow.getFullYear(), mm = brNow.getMonth(), hoje = brNow.getDate();
      const uteis = (ate) => { let c = 0; const d = new Date(yy, mm, 1); while (d.getMonth() === mm && d.getDate() <= ate) { const w = d.getDay(); if (w >= 1 && w <= 5) c++; d.setDate(d.getDate() + 1); } return c; };
      fator = uteis(31) / Math.max(1, uteis(hoje));
      diasUteis = { feitos: uteis(hoje), total: uteis(31) };
    }

    // Monta as 6 barras (meta × real × tendência) para um recorte de linhas rv/vol.
    const catBars = (rvRows, volRows) => {
      const soma = (campo) => rvRows.reduce((s, r) => s + num(r[campo]), 0);
      const volCat = (cat) => {
        const c = cat.toUpperCase();
        const sel = volRows.filter((r) => String(r.categoria || "").trim().toUpperCase() === c);
        const doMes = sel.filter((r) => mref(r).startsWith(mes));
        return (doMes.length ? doMes : sel).reduce((s, r) => s + num(r.volume), 0);
      };
      const mk = (label, real, meta, monit) => {
        const tend = real * fator;
        return { label, real: r1(real), meta: r1(meta), pct: pct(real, meta), tend: r1(tend), pctTend: pct(tend, meta), monitoramento: !!monit };
      };
      const realCerveja = soma("real_cerveja"), realNab = soma("real_nab");
      // meta lançada (monitoramento) p/ os setores do recorte; null = não lançada
      const setoresRec = [...new Set([...rvRows, ...volRows].map((r) => String(r.setor || "").trim()).filter(Boolean))];
      const manual = (k) => (rateio[k] ? setoresRec.reduce((s, st) => s + (rateio[k][st] || 0), 0) : null);
      const mMatch = manual("match"), mCZ = manual("cervejaZero"), mNZ = manual("nabZero");
      return [
        mk("Cerveja", realCerveja, soma("meta_cerveja")),
        mk("NAB", realNab, soma("meta_nab")),
        mk("Match", soma("real_match"), mMatch ?? soma("meta_match")),
        mk("Mktp", soma("real_marketplace"), soma("meta_marketplace")),
        mk("Cerveja Zero", volCat("CERVEJA ZERO"), mCZ ?? 0.15 * realCerveja, mCZ == null),
        mk("NAB Zero", volCat("NAB ZERO"), mNZ ?? 0.15 * realNab, mNZ == null),
      ];
    };

    const bars = catBars(rv, vol);

    // Quebra por RN (setor) — pra expandir na home. RN vê só o próprio (1 item).
    const nomeSetor = {};
    usuarios.forEach((u) => { const c = String(u.cod || "").trim(); if (c) nomeSetor[c] = String(u.nome || "").trim(); });
    const setSetor = (r) => String(r.setor || "").trim();
    const setores = [...new Set([...rv.map(setSetor), ...vol.map(setSetor)].filter(Boolean))].sort();
    const porRn = setores.map((s) => ({
      setor: s, nome: nomeSetor[s] || "",
      bars: catBars(rv.filter((r) => setSetor(r) === s), vol.filter((r) => setSetor(r) === s)),
    }));

    // Analítico (planilha): Operação → GV → RN × categorias.
    const report = montarReport(rv, vol.filter((r) => mref(r).startsWith(mes)), nomeSetor, fator, { rateio });

    return res.json({ mes, bars, fator: Math.round(fator * 100) / 100, porRn, report, diasUteis, metasMonitor: metasMon });
  } catch (e) {
    console.error("resumo/volumes:", e);
    return res.status(500).json({ error: "Erro ao montar resumo de volumes." });
  }
});

// GET/PUT /api/resumo/metas-monitor?mes=YYYY-MM — metas de MONITORAMENTO da operação (HL):
// Cerveja Zero, Match e NAB Zero. Não entram na RV; só painel da Home + motor de WhatsApp.
router.get("/metas-monitor", async (req, res) => {
  const mes = String(req.query.mes || "").trim();
  if (!/^\d{4}-\d{2}$/.test(mes)) return res.status(400).json({ error: "Informe o mês (YYYY-MM)." });
  return res.json({ mes, categorias: CATS_MONITOR.map(({ key, label }) => ({ key, label })), metas: await lerMetasMonitor(mes) });
});
router.put("/metas-monitor", async (req, res) => {
  try {
    if (req.user.perfil !== "admin") return res.status(403).json({ error: "Só o admin lança metas." });
    const { mes, metas } = req.body || {};
    if (!/^\d{4}-\d{2}$/.test(String(mes || ""))) return res.status(400).json({ error: "Informe o mês (YYYY-MM)." });
    await salvarMetasMonitor(mes, metas || {});
    return res.json({ ok: true, mes, metas: await lerMetasMonitor(mes) });
  } catch (e) {
    console.error("resumo/metas-monitor PUT:", e);
    return res.status(500).json({ error: "Erro ao salvar metas de monitoramento." });
  }
});

// GET /api/resumo/curva?ano=YYYY — Curva de Volumes (12 meses × categoria):
// Volume Real (rv_volume, ano) · Budget (metas.meta_volume, ano) · Real LY (rv_volume, ano-1).
// Escopo por perfil. "Giro RGB" soma GIRO RGB + LITRINHO. "Cerveja" = macro (todas as
// variantes de cerveja). Categorias: Cerveja, Giro RGB, NAB, Match, Mktp, Cerveja Zero, NAB Zero.
router.get("/curva", async (req, res) => {
  try {
    const brNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const ano = req.query.ano ? Number(req.query.ano) : brNow.getFullYear();
    const anoLY = ano - 1;
    const up = (s) => String(s || "").trim().toUpperCase();
    const mref = (r) => String(r.mes_ref || r.mes_referencia || "");

    const [rvVolAll, metasAll, rvResAll] = await Promise.all([
      readSheet("rv_volume").catch(() => []),
      readSheet("metas").catch(() => []),
      readSheet("rv_resultado").catch(() => []),
    ]);
    const rvVol = filtrarPorPerfil(rvVolAll, req.user, "setor");
    // metas é cadastro (não passa pela conversão 301→107 da leitura): converte aqui p/ o
    // budget de set/26 p/ trás do 301 somar no 107 (mesmo RN, código novo).
    const NOVO = { "301": "107", "302": "108", "303": "109", "304": "110", "305": "111" };
    const metas = filtrarPorPerfil(metasAll.map((m) => {
      const s = String(m.setor || "").trim();
      return NOVO[s] ? { ...m, setor: NOVO[s] } : m;
    }), req.user, "setor");
    const rvRes = filtrarPorPerfil(rvResAll, req.user, "setor");

    // Categorias da curva → categorias brutas (rv_volume) e a categoria de meta correspondente.
    const CERVEJA_FAM = ["CERVEJA", "CERVEJA ZERO", "CERVEJA MULTIPACK", "GIRO RGB", "HE", "HE RGB",
      "TRIMARCA RGB HE (ORIGINAL)", "TRIMARCA RGB HE (STELLA)", "TRIMARCA RGB HE (SPATEN)", "BALANCED CHOICE", "LITRINHO"];
    //   metaRv = campo de meta no rv_resultado (a mesma meta que a HOP usa nas barras/report).
    const CURVA_CATS = [
      { key: "cerveja", label: "Cerveja", raws: CERVEJA_FAM, budget: "CERVEJA", metaRv: "meta_cerveja" },
      { key: "giroRgb", label: "Giro RGB", raws: ["GIRO RGB", "LITRINHO"], budget: null, metaRv: null },
      { key: "nab", label: "NAB", raws: ["NAB"], budget: "NAB", metaRv: "meta_nab" },
      { key: "match", label: "Match", raws: ["MATCH"], budget: "MATCH", metaRv: "meta_match" },
      { key: "mktp", label: "Mktp", raws: ["MKTP"], budget: "MARKETPLACE", metaRv: "meta_marketplace" },
      { key: "cervejaZero", label: "Cerveja Zero", raws: ["CERVEJA ZERO"], budget: null, metaRv: null },
      { key: "nabZero", label: "NAB Zero", raws: ["NAB ZERO"], budget: null, metaRv: null },
    ];

    // Índices por (categoriaUP | YYYY-MM)
    const realIdx = {}, budgetIdx = {};
    rvVol.forEach((r) => { const k = `${up(r.categoria)}|${mref(r).slice(0, 7)}`; realIdx[k] = (realIdx[k] || 0) + num(r.volume); });
    metas.forEach((r) => { const k = `${up(r.categoria)}|${String(r.mes_referencia || "").slice(0, 7)}`; budgetIdx[k] = (budgetIdx[k] || 0) + num(r.meta_volume); });
    // Meta (rv_resultado): soma por campo × mês.
    const metaIdx = {}; // `${campo}|YYYY-MM` -> soma
    rvRes.forEach((r) => {
      const m = String(r.mes_referencia || "").slice(0, 7); if (!m) return;
      ["meta_cerveja", "meta_nab", "meta_match", "meta_marketplace"].forEach((f) => {
        const k = `${f}|${m}`; metaIdx[k] = (metaIdx[k] || 0) + num(r[f]);
      });
    });

    const MM = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
    const r1 = (n) => Math.round(n * 10) / 10;
    const serieRaw = (rawsUP, yr) => MM.map((mm) => { let v = 0; rawsUP.forEach((c) => { v += realIdx[`${c}|${yr}-${mm}`] || 0; }); return r1(v); });
    const serieChave = (chave, idx) => MM.map((mm) => r1(idx[`${chave}|${ano}-${mm}`] || 0));

    const dados = {};
    CURVA_CATS.forEach((c) => {
      const rawsUP = c.raws.map(up);
      dados[c.key] = {
        real: serieRaw(rawsUP, ano),
        ly: serieRaw(rawsUP, anoLY),
        budget: c.budget ? serieChave(up(c.budget), budgetIdx) : MM.map(() => 0),
        meta: c.metaRv ? serieChave(c.metaRv, metaIdx) : MM.map(() => 0),
      };
    });

    return res.json({
      ano, anoLY,
      meses: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"],
      categorias: CURVA_CATS.map((c) => ({ key: c.key, label: c.label })),
      dados,
    });
  } catch (e) {
    console.error("resumo/curva:", e);
    return res.status(500).json({ error: "Erro ao montar a curva de volumes." });
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
    // ?mes=YYYY-MM (seletor da Home): mês FECHADO → compara o mês inteiro (01..último dia).
    const brNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const ym = (yy, mm0) => { const d = new Date(yy, mm0, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
    const mesHoje = ym(brNow.getFullYear(), brNow.getMonth());
    const mesQ = /^\d{4}-\d{2}$/.test(String(req.query.mes || "")) ? String(req.query.mes) : mesHoje;
    const y = Number(mesQ.slice(0, 4)), m0 = Number(mesQ.slice(5, 7)) - 1;
    const cutoffDia = mesQ === mesHoje ? brNow.getDate() - 1 : new Date(y, m0 + 1, 0).getDate();
    const mesAtual = mesQ;
    const mesAnterior = ym(y, m0 - 1);
    const mesY1 = ym(y - 1, m0); // mesmo mês, ano passado (Y-1)
    // Média = 3 meses COMPLETOS anteriores (EXCLUI o mês atual). Ex.: julho → abr/mai/jun.
    const media3Meses = [3, 2, 1].map((k) => ym(y, m0 - k));
    const media3Set = new Set(media3Meses);

    // Lê SÓ os meses necessários (filtro no SQL): 3 meses da média + o mês atual + o Y-1.
    const [vendas, vdPdv, vdProd, prodBase, gradeEstoque, usuarios] = await Promise.all([
      readSheetMonths("vendas_cliente_produto", "mes_referencia", [...media3Meses, mesAtual]).catch(() => []),
      readSheetMonths("vd_pdv", "mes_referencia", [mesAtual, mesY1]).catch(() => []),
      readSheetMonths("vd_produto", "mes_referencia", [mesAtual, mesY1]).catch(() => []),
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
    // Mesmo período (01..D-1) do mês atual e do mesmo mês do ANO PASSADO (Y-1).
    const d1De = (rows, codF) => {
      const d = {};
      for (const r of rows) {
        const data = String(r.data || "");
        const dia = Number(data.slice(8, 10));
        if (!(cutoffDia >= 1 && dia >= 1 && dia <= cutoffDia)) continue;
        const mes = data.slice(0, 7);
        const cod = String(r[codF] || "").trim(); if (!cod) continue;
        const e = d[cod] || (d[cod] = { atual: 0, anoAnt: 0 });
        const vol = num(r.volume_hl);
        if (mes === mesAtual) e.atual += vol; else if (mes === mesY1) e.anoAnt += vol;
      }
      return d;
    };
    // Rank pela MÉDIA 3M (volume "de base"). GAP/Δ = mês atual vs mesmo período do ano passado.
    const montar = (aggMap, d1Map, n) => Object.values(aggMap)
      .map((t) => ({ ...t, media3m: t.soma3 / 3 }))
      .sort((a, b) => b.media3m - a.media3m).slice(0, n).map((t) => {
        const d = d1Map[t.cod] || { atual: 0, anoAnt: 0 };
        return {
          cod: t.cod, nome: t.nome, setor: t.setor,
          media3m: Math.round(t.media3m * 10) / 10,
          mesAtual: Math.round(d.atual * 10) / 10,
          anoAnterior: Math.round(d.anoAnt * 10) / 10,
          gap: Math.round((d.atual - d.anoAnt) * 10) / 10,
          delta: d.anoAnt > 0 ? Math.round(((d.atual - d.anoAnt) / d.anoAnt) * 1000) / 10 : (d.atual > 0 ? null : 0),
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
    const anoLabel = (m) => `${rot(m)}/${String(m).slice(2, 4)}`; // ex. "set/25"
    return res.json({
      mesAtual, mesAnterior, mesY1, cutoffDia,
      mediaLabel: `${rot(media3Meses[0])}–${rot(media3Meses[2])}`, // ex.: "abr–jun"
      atualLabel: anoLabel(mesAtual), y1Label: anoLabel(mesY1),   // "set/26" vs "set/25"
      periodo: cutoffDia >= 1 ? `01–${String(cutoffDia).padStart(2, "0")}` : "—",
      temDiario: vdPdvF.length > 0,
      pdvs, pdvsAS, pdvsRota, produtos,
    });
  } catch (e) {
    console.error("resumo/rankings:", e);
    return res.status(500).json({ error: "Erro ao montar rankings." });
  }
});

// SKUs dos Verdes (Stella Pure Gold 600): 33857 retornável + 38172 one way. ?sku=33857 |
// 38172 | 33857,38172 (padrão = as duas; PDV que comprou qualquer uma conta 1x).
const VERDES_SKUS = ["33857", "38172"];
function skusVerdes(q) {
  const l = String(q || "").split(",").map((x) => x.trim().replace(/^0+/, "")).filter(Boolean);
  return new Set(l.length ? l : VERDES_SKUS);
}

// Metas dos Verdes (Stella PG 600, as duas juntas): por mês × setor ("OPERACAO" = operação).
// Cobertura em PDVs e volume em HL. Lançadas pelo admin no próprio bloco da Home.
let _verdesMetasOk = false;
async function ensureVerdesMetas() {
  if (_verdesMetasOk) return;
  await query(`CREATE TABLE IF NOT EXISTS verdes_metas (
    mes TEXT, setor TEXT, cobertura NUMERIC, hl NUMERIC, PRIMARY KEY (mes, setor))`);
  _verdesMetasOk = true;
}
async function metasVerdes(meses, user) {
  try {
    await ensureVerdesMetas();
    const r = await query("SELECT mes, setor, cobertura, hl FROM verdes_metas WHERE mes = ANY($1)", [meses]);
    const out = {};
    const rn = !["admin", "director", "gv1", "gv3"].includes(user.perfil);
    r.rows.forEach((x) => {
      if (rn && x.setor !== "OPERACAO" && String(x.setor) !== String(user.cod)) return;
      (out[x.mes] = out[x.mes] || {})[x.setor] = {
        cobertura: x.cobertura == null ? null : Number(x.cobertura), hl: x.hl == null ? null : Number(x.hl),
      };
    });
    return out;
  } catch (e) { console.error("verdes metas:", e.message); return {}; }
}

// PUT /api/resumo/verdes/metas { mes:"2026-10", linhas:[{ setor:"OPERACAO"|"101", cobertura, hl }] } — admin.
// Substitui as metas daquele mês (linha sem cobertura e sem HL = apaga).
router.put("/verdes/metas", async (req, res) => {
  try {
    if (req.user.perfil !== "admin") return res.status(403).json({ error: "Só o admin lança metas." });
    const { mes, linhas } = req.body || {};
    if (!/^\d{4}-\d{2}$/.test(String(mes || "")) || !Array.isArray(linhas)) return res.status(400).json({ error: "Envie { mes, linhas }." });
    await ensureVerdesMetas();
    const nOuNull = (v) => (v === "" || v == null || isNaN(Number(String(v).replace(",", "."))) ? null : Number(String(v).replace(",", ".")));
    await query("DELETE FROM verdes_metas WHERE mes = $1", [mes]);
    let n = 0;
    for (const l of linhas) {
      const setor = String(l.setor || "").trim(); const cob = nOuNull(l.cobertura), hl = nOuNull(l.hl);
      if (!setor || (cob == null && hl == null)) continue;
      await query("INSERT INTO verdes_metas (mes, setor, cobertura, hl) VALUES ($1,$2,$3,$4)", [mes, setor, cob, hl]);
      n++;
    }
    return res.json({ ok: true, mes, linhas: n });
  } catch (e) {
    console.error("resumo/verdes/metas PUT:", e);
    return res.status(500).json({ error: "Erro ao salvar metas." });
  }
});

// GET /api/resumo/verdes?sku=33857 — bloco "Verdes" focado num SKU (default 33857,
// Stella Pure Gold), mês a mês, com quebra por RN (setor) + consolidado.
// Cobertura = nº de PDVs DISTINTOS que compraram o SKU no mês (conta 1x por PDV). Vol HL = volume_hl.
router.get("/verdes", async (req, res) => {
  try {
    const normCod = (x) => { const s = String(x || "").trim(); return s.replace(/^0+/, "") || s; };
    const SKUS = skusVerdes(req.query.sku);

    // Trimestre (civil) do mês pedido (?mes=YYYY-MM, seletor da Home) ou do mês atual.
    const brNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const mesQ = /^\d{4}-\d{2}$/.test(String(req.query.mes || "")) ? String(req.query.mes) : null;
    const y = mesQ ? Number(mesQ.slice(0, 4)) : brNow.getFullYear();
    const m0 = mesQ ? Number(mesQ.slice(5, 7)) - 1 : brNow.getMonth();
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

    const nomes = {};
    prodFull.forEach((p) => { const c = normCod(p.cod); if (SKUS.has(c)) nomes[c] = String(p.nome || "").trim(); });
    const rnMap = {};
    usuarios.forEach((u) => { if (u.cod) rnMap[String(u.cod).trim()] = String(u.nome || "").trim(); });

    const perRn = {};   // setor -> { cob:{mes:Set pdv}, vol:{mes:HL} }
    const consCob = {}; // mes -> Set pdv (global)
    const consVol = {};
    v.forEach((r) => {
      const codP = normCod(r.cod_produto);
      if (!SKUS.has(codP)) return;
      const mes = String(r.mes_referencia || "").slice(0, 7);
      if (!mes) return;
      if (!nomes[codP]) nomes[codP] = String(r.nome_produto || "").trim();
      const setor = String(r.setor || "").trim();
      const pdv = String(r.cod_pdv || "").trim();
      const hl = num(r.volume_hl);
      const e = perRn[setor] || (perRn[setor] = { cob: {}, vol: {} });
      (e.cob[mes] = e.cob[mes] || new Set()).add(pdv);
      e.vol[mes] = (e.vol[mes] || 0) + hl;
      (consCob[mes] = consCob[mes] || new Set()).add(pdv);
      consVol[mes] = (consVol[mes] || 0) + hl;
    });

    const meses = janela; // sempre os 3 meses do trimestre atual (mostra Jul/Ago/Set mesmo sem dado)
    const porRn = Object.keys(perRn).sort().map((setor) => {
      const e = perRn[setor];
      return {
        setor, rn: rnMap[setor] || "",
        cobertura: meses.map((m) => (e.cob[m] ? e.cob[m].size : 0)),
        volHl: meses.map((m) => Math.round((e.vol[m] || 0) * 10) / 10),
      };
    });

    const metas = await metasVerdes(meses, req.user);
    return res.json({
      metas,
      produto: { cod: [...SKUS].join(" + "), nome: [...SKUS].map((c) => nomes[c] || c).join(" + "), skus: [...SKUS] },
      meses,
      consolidado: {
        cobertura: meses.map((m) => (consCob[m] ? consCob[m].size : 0)),
        volHl: meses.map((m) => Math.round((consVol[m] || 0) * 10) / 10),
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
    const SKUS = skusVerdes(req.query.sku);
    let lin = filtrarPorPerfil(all, req.user, "setor").filter((r) => SKUS.has(String(r.cod_produto || "").trim().replace(/^0+/, "")));
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

// GET /api/resumo/verdes/dias?mes=YYYY-MM&setor=&gv= — o mês dos Verdes aberto POR DIA.
// Por dia: PDVs que compraram NO dia, HL do dia e os ACUMULADOS do mês (PDVs distintos até
// o dia = cobertura do mês; HL acumulado). Fonte: verdes_pedidos (venda efetiva, 1 linha
// por pedido). Escopo por perfil + filtros opcionais de RN (setor) ou GV (1/3).
router.get("/verdes/dias", async (req, res) => {
  try {
    const mes = String(req.query.mes || "").trim();
    if (!/^\d{4}-\d{2}$/.test(mes)) return res.status(400).json({ error: "Informe o mês (YYYY-MM)." });
    const setor = String(req.query.setor || "").trim();
    const gv = String(req.query.gv || "").trim();
    const all = await readSheetMonths("verdes_pedidos", "mes_referencia", [mes]).catch(() => []);
    const SKUS = skusVerdes(req.query.sku);
    const escopo = filtrarPorPerfil(all, req.user, "setor")
      .filter((r) => SKUS.has(String(r.cod_produto || "").trim().replace(/^0+/, "")))
      .filter((r) => !gv || String(r.setor || "").trim().startsWith(gv));
    const lin = setor ? escopo.filter((r) => String(r.setor || "").trim() === setor) : escopo;
    const isoDe = (r) => {
      const m = String(r.data || "").match(/^(\d{2})\/(\d{2})\/(\d{4})/);
      return m ? `${m[3]}-${m[2]}-${m[1]}` : String(r.data || "").slice(0, 10);
    };

    // Ranking por RN NO DIA (faixa de baixo quando um dia é clicado): sempre TODOS os RNs
    // do escopo (perfil + GV), mesmo com um RN selecionado no gráfico.
    const rnDia = {}; // nº do dia → setor → { pdvs:Set, hl }
    escopo.forEach((r) => {
      const iso = isoDe(r); if (!iso.startsWith(mes)) return;
      const hl = num(r.volume_hl); if (hl <= 0) return;
      const dd = Number(iso.slice(8, 10)), st = String(r.setor || "").trim();
      const porSt = (rnDia[dd] = rnDia[dd] || {});
      const e = (porSt[st] = porSt[st] || { pdvs: new Set(), hl: 0 });
      e.pdvs.add(String(r.cod_pdv || "").trim()); e.hl += hl;
    });

    const porDia = {}; // AAAA-MM-DD → { pdvs:Set, hl }
    lin.forEach((r) => {
      const iso = isoDe(r);
      if (!iso.startsWith(mes)) return;
      const hl = num(r.volume_hl); if (hl <= 0) return;
      const d = porDia[iso] || (porDia[iso] = { pdvs: new Set(), hl: 0 });
      d.pdvs.add(String(r.cod_pdv || "").trim()); d.hl += hl;
    });
    // todos os dias do mês até o último com venda (ou até hoje, no mês corrente)
    const [y, mo] = mes.split("-").map(Number);
    const ultimoDia = new Date(y, mo, 0).getDate();
    const hoje = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const ehMesAtual = hoje.getFullYear() === y && hoje.getMonth() + 1 === mo;
    const comVenda = Object.keys(porDia).map((k) => Number(k.slice(8, 10)));
    const ate = ehMesAtual ? Math.max(hoje.getDate(), ...comVenda, 1) : ultimoDia;
    const vistos = new Set(); let hlAcum = 0;
    const dias = [];
    for (let dd = 1; dd <= Math.min(ate, ultimoDia); dd++) {
      const iso = `${mes}-${String(dd).padStart(2, "0")}`;
      const d = porDia[iso];
      const novos = d ? [...d.pdvs].filter((p) => !vistos.has(p)).length : 0;
      if (d) { d.pdvs.forEach((p) => vistos.add(p)); hlAcum += d.hl; }
      dias.push({
        dia: dd, dow: new Date(y, mo - 1, dd).getDay(),
        pdvs: d ? d.pdvs.size : 0, novos, hl: d ? Math.round(d.hl * 100) / 100 : 0,
        cob_acum: vistos.size, hl_acum: Math.round(hlAcum * 100) / 100,
        rn: Object.fromEntries(Object.entries(rnDia[dd] || {}).map(([st, e]) => [st, { pdvs: e.pdvs.size, hl: Math.round(e.hl * 100) / 100 }])),
      });
    }
    return res.json({ mes, dias, total_pdvs: vistos.size, total_hl: Math.round(hlAcum * 100) / 100 });
  } catch (e) {
    console.error("resumo/verdes/dias:", e);
    return res.status(500).json({ error: "Erro ao abrir o mês por dia." });
  }
});

// ── Incentivo Faturamento Marketplace (bloco da Home desktop + popup no celular) ─────────
// Meta COLETIVA da operação no mês. Próximo incentivo = trocar este objeto.
const INCENTIVO_MKTP = { mes: "2026-10", meta: 400000, titulo: "Desafio Marketplace", campanha: "Outubro" };

// dias úteis (seg–sex) do mês; "passados" = até ONTEM (o CORA traz o faturado até D-1)
function diasUteis(mes, hojeBR) {
  const [y, m] = mes.split("-").map(Number);
  let total = 0, passados = 0;
  for (let d = new Date(y, m - 1, 1); d.getMonth() === m - 1; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay(); if (dow === 0 || dow === 6) continue;
    total++; if (d < new Date(hojeBR.getFullYear(), hojeBR.getMonth(), hojeBR.getDate())) passados++;
  }
  return { total, passados };
}

// GET /api/resumo/incentivo-mktp — faturamento MKTP (R$) da operação × meta do incentivo.
// Todos veem o número da OPERAÇÃO (meta coletiva); o RN também vê a própria contribuição.
// atualizado_em = última importação do CORA (o popup reaparece quando muda).
router.get("/incentivo-mktp", async (req, res) => {
  try {
    const { mes, meta, titulo, campanha } = INCENTIVO_MKTP;
    const hoje = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const mesHoje = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
    // ativo no mês do incentivo e até o dia 5 do mês seguinte (p/ mostrar o resultado final)
    const [y, m] = mes.split("-").map(Number);
    const seguinte = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}`;
    const ativo = mesHoje === mes || (mesHoje === seguinte && hoje.getDate() <= 5);
    if (!ativo) return res.json({ ativo: false });

    const [fat, statusArq, usuarios] = await Promise.all([
      readSheet("rv_faturamento_mktp").catch(() => []),
      readSheet("status_arquivos").catch(() => []),
      readSheet("usuarios").catch(() => []),
    ]);
    const doMes = fat.filter((r) => String(r.mes_referencia || "").slice(0, 7) === mes);
    const porSetor = {};
    doMes.forEach((r) => { const s = String(r.setor || "").trim(); if (s) porSetor[s] = (porSetor[s] || 0) + num(r.faturamento_mktp_real); });
    const realizado = Object.values(porSetor).reduce((a, b) => a + b, 0);
    const nomeDe = {}; usuarios.forEach((u) => { nomeDe[String(u.cod || "").trim()] = String(u.nome || "").trim(); });
    const por_rn = Object.entries(porSetor).filter(([, v]) => v > 0)
      .map(([setor, v]) => ({ setor, nome: nomeDe[setor] || "", real: Math.round(v) }))
      .sort((a, b) => b.real - a.real);

    const encerrado = mesHoje !== mes;
    const { total, passados } = encerrado ? { total: diasUteis(mes, hoje).total, passados: diasUteis(mes, hoje).total } : diasUteis(mes, hoje);
    const restantes = Math.max(0, total - passados);
    const tendencia = passados > 0 ? Math.round((realizado / passados) * total) : null;
    const falta = Math.max(0, meta - realizado);
    const st = statusArq.find((r) => /^CORA \(Consulta/i.test(String(r.arquivo || "")))
            || statusArq.find((r) => /Faturamento Mktp/i.test(String(r.arquivo || "")));
    const meuSetor = String(req.user.cod || "").trim();
    const posicao = por_rn.findIndex((r) => r.setor === meuSetor);

    return res.json({
      ativo: true, encerrado, mes, titulo, campanha, meta,
      realizado: Math.round(realizado), pct: meta ? Math.round((realizado / meta) * 1000) / 10 : 0,
      falta: Math.round(falta), tendencia, pct_tendencia: tendencia && meta ? Math.round((tendencia / meta) * 100) : null,
      dias_uteis: total, dias_passados: passados, dias_restantes: restantes,
      ritmo_dia: restantes > 0 ? Math.round(falta / restantes) : 0,
      atualizado_em: st ? String(st.atualizado_em || "").trim() : "",
      por_rn,
      meu: req.user.perfil === "rn" ? { setor: meuSetor, real: Math.round(porSetor[meuSetor] || 0), posicao: posicao >= 0 ? posicao + 1 : null, de: por_rn.length } : null,
    });
  } catch (e) {
    console.error("resumo/incentivo-mktp:", e);
    return res.status(500).json({ error: "Erro ao montar o incentivo Marketplace." });
  }
});

module.exports = router;
