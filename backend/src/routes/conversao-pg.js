// Acompanhamento de conversão — Stella Pure Gold (temporário, dentro de Incentivos).
// PG600 (33857): PDVs que compram ao menos uma base 600ml (Original/Stella/Spaten) e
//   AINDA NÃO compraram a Pure Gold 600ml.
// PGLN (29580): PDVs que compram qualquer outra Long Neck e ainda NÃO compraram a Pure Gold LN.
// Base: trimestre anterior (3 meses completos, sem o mês atual). Fácil de remover: apagar
// este arquivo, o mount em index.js e o componente ConversaoPG do front.
const express = require("express");
const router = express.Router();
const { readSheet, readSheetMonths } = require("../services/sheets");
const { authMiddleware } = require("../middleware/auth");
const { filtrarPorPerfil } = require("../utils/perfil");

const normCod = (v) => String(v ?? "").trim().replace(/^0+/, "") || "0";
const num = (v) => parseFloat(String(v ?? "0").replace(",", ".")) || 0;
const ROT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const PG600 = "33857";           // STELLA ARTOIS PURE GOLD 600ML
const PGLN = "29580";            // STELLA ARTOIS PURE GOLD LONG NECK 330ML
const BASE600 = [
  { cod: "2546",  marca: "Original" }, // ORIGINAL 600ML
  { cod: "20530", marca: "Stella" },   // STELLA ARTOIS 600 ML
  { cod: "23186", marca: "Spaten" },   // SPATEN N 600ML
];

// 3 meses completos ANTERIORES ao mês atual (rolante, sem o mês corrente).
function trimestreAnterior() {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const y = d.getFullYear(), m0 = d.getMonth();
  const meses = [3, 2, 1].map((k) => { const x = new Date(y, m0 - k, 1); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`; });
  const rot = (m) => ROT[(Number(m.split("-")[1]) || 1) - 1];
  return { meses, label: `${rot(meses[0])}–${rot(meses[2])}` };
}

// Trimestre ATUAL = quadrimestre calendário do mês corrente (ex.: set → jul/ago/set).
// Retorna os meses do tri, o mês atual e os meses do tri já decorridos (anteriores ao atual).
function trimestreAtual() {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const y = d.getFullYear(), m = d.getMonth(); // m: 0-11
  const startM = m - (m % 3); // 0,3,6,9
  const meses = [0, 1, 2].map((k) => `${y}-${String(startM + k + 1).padStart(2, "0")}`);
  const mesAtual = `${y}-${String(m + 1).padStart(2, "0")}`;
  const anteriores = meses.filter((mm) => mm < mesAtual);
  const rot = (mm) => ROT[(Number(mm.split("-")[1]) || 1) - 1];
  return { meses, mesAtual, anteriores, label: `${rot(meses[0])}–${rot(meses[2])}` };
}

router.use(authMiddleware);

// GET /api/conversao-pg/skus?q= — catálogo de SKUs (cod + nome) para o seletor.
router.get("/skus", async (req, res) => {
  try {
    const prodFull = await readSheet("produtos_full").catch(() => []);
    const q = String(req.query.q || "").trim().toLowerCase();
    const seen = new Set();
    let out = [];
    prodFull.forEach((p) => {
      const cod = normCod(p.cod);
      const nome = String(p.nome || "").trim();
      if (!cod || cod === "0" || seen.has(cod)) return;
      seen.add(cod);
      out.push({ cod, nome });
    });
    if (q) out = out.filter((s) => s.nome.toLowerCase().includes(q) || s.cod.includes(q));
    out.sort((a, b) => a.nome.localeCompare(b.nome));
    return res.json(out.slice(0, 300));
  } catch (e) {
    console.error("conversao-pg/skus:", e);
    return res.json([]);
  }
});

// GET /api/conversao-pg/comparativo?skus=cod1,cod2,cod3 — comparativo entre SKUs no tri atual.
// Lista todos os PDVs (no escopo do usuário) que compraram ≥1 dos SKUs no trimestre atual.
// Por SKU: "atual" (comprou este mês) · "anterior" (comprou nos meses anteriores do tri) · "nao".
router.get("/comparativo", async (req, res) => {
  try {
    const skusReq = String(req.query.skus || "").split(",").map(normCod).filter((c) => c && c !== "0").slice(0, 3);
    const { meses, mesAtual, anteriores, label } = trimestreAtual();
    if (!skusReq.length) return res.json({ skus: [], pdvs: [], meses, mesAtual, trimestre: label, total: 0 });

    const [vendasRaw, prodFull, pdvBase] = await Promise.all([
      readSheetMonths("vendas_cliente_produto", "mes_referencia", meses).catch(() => []),
      readSheet("produtos_full").catch(() => []),
      readSheet("pdv_base").catch(() => []),
    ]);
    const vendas = filtrarPorPerfil(vendasRaw, req.user, "setor");

    const nomePorCod = {};
    prodFull.forEach((p) => { nomePorCod[normCod(p.cod)] = String(p.nome || "").trim(); });
    const skus = skusReq.map((c) => ({ cod: c, nome: nomePorCod[c] || `SKU ${c}` }));
    const skuSet = new Set(skusReq);

    const diaMap = {};
    pdvBase.forEach((p) => { const c = normCod(p.cod_pdv || p.cod); if (c) diaMap[c] = String(p.dia_visita || "").trim(); });

    // Agrega compras (volume > 0) por PDV × SKU × mês.
    const pdvs = {};
    vendas.forEach((r) => {
      if (num(r.volume_hl) <= 0) return;
      const sku = normCod(r.cod_produto);
      if (!skuSet.has(sku)) return;
      const cod = String(r.cod_pdv || "").trim(); if (!cod) return;
      const e = pdvs[cod] || (pdvs[cod] = { cod_pdv: cod, nome_pdv: String(r.nome_pdv || "").trim(), setor: String(r.setor || "").trim(), porSku: {} });
      (e.porSku[sku] = e.porSku[sku] || new Set()).add(String(r.mes_referencia || "").slice(0, 7));
    });

    const statusSku = (mesesSet) => {
      if (!mesesSet || !mesesSet.size) return "nao";
      if (mesesSet.has(mesAtual)) return "atual";
      if (anteriores.some((m) => mesesSet.has(m))) return "anterior";
      return "nao";
    };

    const pdvsOut = Object.values(pdvs)
      .map((e) => ({
        cod_pdv: e.cod_pdv, nome_pdv: e.nome_pdv, setor: e.setor,
        dia_visita: diaMap[normCod(e.cod_pdv)] || "",
        skus: skusReq.map((c) => statusSku(e.porSku[c])),
      }))
      .sort((a, b) => String(a.setor).localeCompare(String(b.setor)) || a.nome_pdv.localeCompare(b.nome_pdv));

    return res.json({ skus, pdvs: pdvsOut, meses, mesAtual, anteriores, trimestre: label, total: pdvsOut.length });
  } catch (e) {
    console.error("conversao-pg/comparativo:", e);
    return res.status(500).json({ error: "Erro ao montar o comparativo." });
  }
});

// Núcleo reutilizável: calcula os PDVs-alvo (PG600 e PGLN) no escopo do usuário.
async function computeConversao(user) {
    const { meses, label } = trimestreAnterior();
    const [vendasRaw, prodFull, pdvBase, vdPdv] = await Promise.all([
      readSheetMonths("vendas_cliente_produto", "mes_referencia", meses).catch(() => []),
      readSheet("produtos_full").catch(() => []),
      readSheet("pdv_base").catch(() => []),
      readSheet("vd_pdv").catch(() => []),
    ]);
    const vendas = filtrarPorPerfil(vendasRaw, user, "setor");

    // Dia de visita (pdv_base) e última compra (maior data em vd_pdv) por PDV.
    const diaMap = {};
    pdvBase.forEach((p) => { const c = normCod(p.cod_pdv || p.cod); if (c) diaMap[c] = String(p.dia_visita || "").trim(); });
    const ultMap = {};
    vdPdv.forEach((r) => {
      const c = normCod(r.cod_pdv);
      const dt = String(r.data || "").slice(0, 10);
      if (!c || !/^\d{4}-\d{2}-\d{2}$/.test(dt)) return;
      if (!ultMap[c] || dt > ultMap[c]) ultMap[c] = dt;
    });
    const fmtBR = (iso) => { if (!iso) return ""; const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; };

    // SKUs Long Neck (por nome), exceto a própria Pure Gold LN.
    const lnCods = new Set();
    prodFull.forEach((p) => {
      const nome = String(p.nome || "").toUpperCase();
      const c = normCod(p.cod);
      if (c !== PGLN && (nome.includes("LONG NECK") || /\bLN\b/.test(nome))) lnCods.add(c);
    });

    // Compras por PDV no trimestre (SKUs com volume > 0).
    const pdvs = {};
    vendas.forEach((r) => {
      if (num(r.volume_hl) <= 0) return;
      const cod = String(r.cod_pdv || "").trim(); if (!cod) return;
      const e = pdvs[cod] || (pdvs[cod] = { cod_pdv: cod, nome_pdv: String(r.nome_pdv || "").trim(), setor: String(r.setor || "").trim(), comprou: new Set() });
      e.comprou.add(normCod(r.cod_produto));
    });
    const arr = Object.values(pdvs);
    const ordena = (a, b) => String(a.setor).localeCompare(String(b.setor)) || a.nome_pdv.localeCompare(b.nome_pdv);

    // PG600: NÃO comprou 33857 e comprou ≥1 base 600ml.
    const pg600 = arr
      .filter((e) => !e.comprou.has(PG600) && BASE600.some((b) => e.comprou.has(b.cod)))
      .map((e) => ({
        cod_pdv: e.cod_pdv, nome_pdv: e.nome_pdv, setor: e.setor,
        dia_visita: diaMap[normCod(e.cod_pdv)] || "", ultima_compra: fmtBR(ultMap[normCod(e.cod_pdv)]),
        original: e.comprou.has("2546"), stella: e.comprou.has("20530"), spaten: e.comprou.has("23186"),
      }))
      .sort(ordena);

    // PGLN: NÃO comprou 29580 e comprou qualquer outra LN.
    const pgln = arr
      .filter((e) => !e.comprou.has(PGLN) && [...e.comprou].some((c) => lnCods.has(c)))
      .map((e) => ({
        cod_pdv: e.cod_pdv, nome_pdv: e.nome_pdv, setor: e.setor,
        dia_visita: diaMap[normCod(e.cod_pdv)] || "", ultima_compra: fmtBR(ultMap[normCod(e.cod_pdv)]),
        qtd_ln: [...e.comprou].filter((c) => lnCods.has(c)).length,
      }))
      .sort(ordena);

    return {
      trimestre: label, meses,
      pg600: { alvo: PG600, base: BASE600, total: pg600.length, pdvs: pg600 },
      pgln: { alvo: PGLN, ln_skus: lnCods.size, total: pgln.length, pdvs: pgln },
    };
}

router.get("/", async (req, res) => {
  try {
    return res.json(await computeConversao(req.user));
  } catch (e) {
    console.error("conversao-pg:", e);
    return res.status(500).json({ error: "Erro ao montar o acompanhamento." });
  }
});

// ─── MOTOR DE FARÓIS — mensagens prontas por RN e por GV (texto p/ WhatsApp) ──
// Não envia nada: só gera o texto consolidado. O canal (link/robô/API) fica p/ depois.
const CAP = 25; // limite de PDVs listados por seção na mensagem (evita texto gigante)

function textoRN(setor, nome, dados) {
  const pg = dados.pg600.pdvs.filter((p) => p.setor === setor);
  const ln = dados.pgln.pdvs.filter((p) => p.setor === setor);
  const linha = (p) => `• ${p.cod_pdv} ${p.nome_pdv}` +
    (p.dia_visita ? ` — visita ${p.dia_visita}` : "") +
    (p.ultima_compra ? ` — últ. compra ${p.ultima_compra}` : "");
  const secao = (titulo, lista) => {
    if (!lista.length) return `${titulo}: nenhum 👍`;
    const corpo = lista.slice(0, CAP).map(linha).join("\n");
    const resto = lista.length > CAP ? `\n… e mais ${lista.length - CAP}` : "";
    return `${titulo} (${lista.length}):\n${corpo}${resto}`;
  };
  return [
    `🍺 *Conversão Stella Pure Gold* — ${dados.trimestre}`,
    `Setor ${setor}${nome ? ` · ${nome}` : ""}`,
    "",
    `*Pure Gold 600* — compram 600ml (Original/Stella/Spaten) e ainda não a PG600`,
    secao("PDVs", pg),
    "",
    `*Pure Gold LN* — compram outra Long Neck e ainda não a PG LN`,
    secao("PDVs", ln),
  ].join("\n");
}

function textoGV(setores, nomeGV, dados, nomePorSetor) {
  const cont = (arr) => arr.reduce((m, p) => { m[p.setor] = (m[p.setor] || 0) + 1; return m; }, {});
  const cpg = cont(dados.pg600.pdvs), cln = cont(dados.pgln.pdvs);
  const totPg = dados.pg600.pdvs.filter((p) => setores.includes(p.setor)).length;
  const totLn = dados.pgln.pdvs.filter((p) => setores.includes(p.setor)).length;
  const linhas = setores
    .map((s) => ({ s, pg: cpg[s] || 0, ln: cln[s] || 0 }))
    .filter((x) => x.pg || x.ln)
    .sort((a, b) => (b.pg + b.ln) - (a.pg + a.ln))
    .map((x) => `• ${x.s} ${nomePorSetor[x.s] || ""} — PG600 ${x.pg} · PG LN ${x.ln}`.replace("  ", " "));
  return [
    `🍺 *Conversão Stella Pure Gold* — ${dados.trimestre}`,
    `Consolidado ${nomeGV || "GV"}`,
    `Total a converter: *PG600 ${totPg}* · *PG LN ${totLn}*`,
    "",
    "Por RN:",
    linhas.length ? linhas.join("\n") : "• (sem PDVs no recorte)",
  ].join("\n");
}

router.get("/mensagens", async (req, res) => {
  try {
    const dados = await computeConversao(req.user);
    const usuarios = await readSheet("usuarios").catch(() => []);
    // Setores presentes nos alvos, dentro do escopo já aplicado em computeConversao.
    const setores = [...new Set([...dados.pg600.pdvs, ...dados.pgln.pdvs].map((p) => p.setor).filter(Boolean))].sort();
    const infoSetor = {}; // setor -> {nome, telefone}
    const nomePorSetor = {};
    usuarios.forEach((u) => {
      const c = String(u.cod || "").trim();
      if (c) { infoSetor[c] = { nome: String(u.nome || "").trim(), telefone: String(u.telefone || "").trim() }; nomePorSetor[c] = String(u.nome || "").trim(); }
    });

    const rn = setores.map((s) => ({
      setor: s, nome: infoSetor[s]?.nome || "", telefone: infoSetor[s]?.telefone || "",
      texto: textoRN(s, infoSetor[s]?.nome || "", dados),
    }));

    // GV: agrupa por prefixo do setor (1xx = GV1, 3xx = GV3), acha o usuário GV.
    const gruposGV = {}; // prefixo -> setores[]
    setores.forEach((s) => { const p = String(s)[0]; (gruposGV[p] = gruposGV[p] || []).push(s); });
    const perfilDoPrefixo = { "1": "gv1", "3": "gv3" };
    const gv = Object.entries(gruposGV).map(([prefixo, sets]) => {
      const perfilGV = perfilDoPrefixo[prefixo];
      const uGV = usuarios.find((u) => String(u.perfil || "").toLowerCase() === perfilGV && String(u.telefone || "").trim());
      const nomeGV = uGV ? `GV ${uGV.nome}` : `GV ${prefixo}xx`;
      return { grupo: `${prefixo}xx`, nome: uGV?.nome || "", telefone: String(uGV?.telefone || "").trim(), texto: textoGV(sets, nomeGV, dados, nomePorSetor) };
    });

    return res.json({ trimestre: dados.trimestre, rn, gv });
  } catch (e) {
    console.error("conversao-pg/mensagens:", e);
    return res.status(500).json({ error: "Erro ao gerar mensagens." });
  }
});

module.exports = router;
