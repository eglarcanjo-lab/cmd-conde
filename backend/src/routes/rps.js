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

// ── Grupos (id, rótulo, regra). p = { nome (sem acento, maiúsculo), cats:Set } ──────────
const CERV = ["CERVEJA", "CERVEJA ZERO", "CERVEJA MULTIPACK", "LITRINHO", "HE", "GIRO RGB"];
const ehCerv = (p) => CERV.some((c) => p.cats.has(c)) || [...p.cats].some((c) => c.startsWith("TRIMARCA"));
const ehMktp = (p) => p.cats.has("MKTP");
const ehNab = (p) => p.cats.has("NAB") || p.cats.has("NAB ZERO");
const ehHe = (p) => p.cats.has("HE") || [...p.cats].some((c) => c.startsWith("TRIMARCA"));
const ehLN = (p) => /LONG\s*NECK|\bLN\b/.test(p.nome);
const ehLata = (p) => /\bLATA\b|\bLT\b|SLEEK/.test(p.nome);
const ehOW = (p) => ehLN(p) || ehLata(p) || /\bOW\b|ONE\s*WAY/.test(p.nome);
const ehRgb = (p) => !ehOW(p) && !/\bPET\b/.test(p.nome) && /(300|600|1000)\s*ML|\b1\s*L\b|LITRAO|GFA\s*VD|GARRAFA/.test(p.nome);
const ml = (p, re) => re.test(p.nome);
const GRUPOS = [
  { id: "tt", label: "Total", f: () => true }, // TT do BI inclui Marketplace (conferido c/ o deck: Distribuição set/26)
  { id: "cerveja", label: "Cerveja", f: ehCerv },
  { id: "rgb", label: "Cerveja RGB", f: (p) => ehCerv(p) && ehRgb(p) },
  { id: "rgb_300", label: "RGB 300 ml", f: (p) => ehCerv(p) && ehRgb(p) && ml(p, /\b300\s*ML/) },
  { id: "rgb_600", label: "RGB 600 ml", f: (p) => ehCerv(p) && ehRgb(p) && ml(p, /\b600\s*ML/) },
  { id: "rgb_1l", label: "RGB 1 L", f: (p) => ehCerv(p) && ehRgb(p) && ml(p, /\b1\s*L\b|1000\s*ML|LITRAO/) },
  { id: "he", label: "High End", f: ehHe },
  { id: "he_rgb", label: "High End RGB", f: (p) => ehHe(p) && ehRgb(p) },
  { id: "he_350", label: "High End 350", f: (p) => ehHe(p) && ml(p, /\b350\s*ML/) },
  { id: "he_ln", label: "High End LN", f: (p) => ehHe(p) && ehLN(p) },
  { id: "ow", label: "One Way (OW)", f: (p) => ehCerv(p) && ehOW(p) },
  { id: "ow_350", label: "OW 350", f: (p) => ehCerv(p) && ehOW(p) && ml(p, /\b350\s*ML/) },
  { id: "ow_473", label: "OW 473", f: (p) => ehCerv(p) && ehOW(p) && ml(p, /\b473\s*ML/) },
  { id: "ow_ln", label: "OW LN", f: (p) => ehCerv(p) && ehLN(p) },
  { id: "zero", label: "Cerveja Zero", f: (p) => p.cats.has("CERVEJA ZERO") },
  { id: "nab", label: "NAB TT", f: ehNab },
  { id: "nab_zero", label: "NAB Zero", f: (p) => p.cats.has("NAB ZERO") },
  // Single = dose individual (lata / PET até 600 ml), mesmo vendida em caixa — a confirmar c/ o diretor
  { id: "nab_single", label: "NAB Single", f: (p) => ehNab(p) && ml(p, /\b(200|220|237|250|269|310|330|350|355|473|500|510|600)\s*ML/) },
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
const GRUPO = Object.fromEntries(GRUPOS.map((g) => [g.id, g]));

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

  const [base, full, pdvBase, usuarios, fatMktp] = await Promise.all([
    readSheet("produtos_base").catch(() => []), readSheet("produtos_full").catch(() => []),
    readSheet("pdv_base").catch(() => []), readSheet("usuarios").catch(() => []),
    readSheet("rv_faturamento_mktp").catch(() => []),
  ]);
  const catDe = {}, nomeDe = {};
  full.forEach((p) => { const c = normCod(p.cod); if (c) nomeDe[c] = semAc(p.nome); });
  base.forEach((p) => {
    const c = normCod(p.cod); if (!c) return;
    catDe[c] = new Set(String(p.categorias || p.categoria || "").split(/[,;|]/).map((x) => x.trim().toUpperCase()).filter((x) => x && x !== "NONE" && x !== "NAN"));
    if (!nomeDe[c] && p.nome) nomeDe[c] = semAc(p.nome);
  });
  const cidadeDe = {};
  pdvBase.forEach((p) => { cidadeDe[normCod(p.cod_pdv)] = String(p.cidade || "").trim().toUpperCase() || "—"; });
  const nomeRn = {};
  usuarios.forEach((u) => { const c = String(u.cod || "").trim(); if (c) nomeRn[c] = String(u.nome || "").trim().split(/\s+/)[0]; });

  // grupos de cada SKU (cache por código)
  const gruposDoSku = {};
  const gruposDe = (cod, nomeVenda) => {
    if (gruposDoSku[cod]) return gruposDoSku[cod];
    const p = { nome: nomeDe[cod] || semAc(nomeVenda), cats: catDe[cod] || new Set() };
    return (gruposDoSku[cod] = GRUPOS.filter((g) => g.f(p)).map((g) => g.id));
  };
  const marcaDe = (nome) => semAc(nome).split(/\s+/)[0] || "—";

  // Agregados por mês (lidos mês a mês p/ poupar memória)
  // vol[g][mes][setor] HL · comp[g][mes] Map pdv→setor · sku[g][mes][setor] Σ SKUs distintos por PDV
  const vol = {}, comp = {}, sku = {}, marca = {}, cidade = {};
  GRUPOS.forEach((g) => { vol[g.id] = {}; comp[g.id] = {}; sku[g.id] = {}; });
  for (const m of todos) {
    const rows = await readSheetMonths("vendas_cliente_produto", "mes_referencia", [m]).catch(() => []);
    const pares = {}; // g|pdv -> Set sku
    rows.forEach((r) => {
      const hl = num(r.volume_hl); if (hl <= 0) return;
      const s = String(r.setor || "").trim(), pdv = normCod(r.cod_pdv), cod = normCod(r.cod_produto);
      if (!pdv || !cod) return;
      const gs = gruposDe(cod, r.nome_produto);
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

  return { meses, mesAtual, diasUteis: { feitos: du.feitos, total: du.total }, gerado_em: br.toISOString(),
    volumes, marcas, cidades, compradores, distribuicao, marketplace,
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
