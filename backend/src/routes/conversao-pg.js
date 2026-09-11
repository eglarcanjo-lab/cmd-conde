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

router.use(authMiddleware);

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
// A mensagem é DIÁRIA: lista só os PDVs cujo DIA DE VISITA é o dia escolhido (hoje por padrão).
const CAP = 40; // limite de PDVs listados na mensagem (evita texto gigante)

// Normalização do dia de visita (espelha o front) → SEG/TER/QUA/QUI/SEX/SAB/DOM.
const DIA_NORM = {
  SEG: "SEG", SEGUNDA: "SEG", "SEGUNDA-FEIRA": "SEG", "2": "SEG",
  TER: "TER", TERCA: "TER", "TERÇA": "TER", "TERCA-FEIRA": "TER", "TERÇA-FEIRA": "TER", "3": "TER",
  QUA: "QUA", QUARTA: "QUA", "QUARTA-FEIRA": "QUA", "4": "QUA",
  QUI: "QUI", QUINTA: "QUI", "QUINTA-FEIRA": "QUI", "5": "QUI",
  SEX: "SEX", SEXTA: "SEX", "SEXTA-FEIRA": "SEX", "6": "SEX",
  SAB: "SAB", SABADO: "SAB", "SÁBADO": "SAB", "7": "SAB",
  DOM: "DOM", DOMINGO: "DOM", "1": "DOM",
};
const normDia = (raw) => { const s = String(raw || "").trim().toUpperCase().split(/[\/,; \-]/)[0].trim(); return DIA_NORM[s] || s; };
const DIA_KEYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];
const DIA_LABEL = { DOM: "Domingo", SEG: "Segunda-feira", TER: "Terça-feira", QUA: "Quarta-feira", QUI: "Quinta-feira", SEX: "Sexta-feira", SAB: "Sábado" };

// Resolve o "dia alvo": ?dia=SEG..SAB (para teste) ou o dia de hoje (America/Sao_Paulo).
function resolverDia(diaParam) {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const dataBR = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  const forcado = normDia(diaParam);
  const diaKey = DIA_KEYS.includes(forcado) ? forcado : DIA_KEYS[d.getDay()];
  return { dataBR, diaKey, diaLabel: DIA_LABEL[diaKey] || diaKey };
}

function textoRN(setor, nome, dados, hoje) {
  const pg = dados.pg600.pdvs.filter((p) => p.setor === setor && normDia(p.dia_visita) === hoje.diaKey);
  const linha = (p) => `• ${p.cod_pdv} ${p.nome_pdv}` + (p.ultima_compra ? ` — últ. compra ${p.ultima_compra}` : "");
  const secao = (lista) => {
    if (!lista.length) return "PDVs: nenhum hoje 👍";
    const corpo = lista.slice(0, CAP).map(linha).join("\n");
    const resto = lista.length > CAP ? `\n… e mais ${lista.length - CAP}` : "";
    return `PDVs (${lista.length}):\n${corpo}${resto}`;
  };
  return [
    `🍺 *Base foco Stella Pure Gold* ${hoje.dataBR}`,
    `Setor ${setor}`,
    `Dia de visita ${hoje.diaLabel}`,
    "",
    "*Pure Gold 600* — compram 600ml (Original/Stella/Spaten) e ainda não a PG600",
    secao(pg),
  ].join("\n");
}

function textoGV(setores, nomeGV, dados, nomePorSetor, hoje) {
  const pgHoje = dados.pg600.pdvs.filter((p) => normDia(p.dia_visita) === hoje.diaKey);
  const cont = pgHoje.reduce((m, p) => { m[p.setor] = (m[p.setor] || 0) + 1; return m; }, {});
  const tot = pgHoje.filter((p) => setores.includes(p.setor)).length;
  const linhas = setores
    .map((s) => ({ s, pg: cont[s] || 0 }))
    .filter((x) => x.pg)
    .sort((a, b) => b.pg - a.pg)
    .map((x) => `• ${x.s} ${nomePorSetor[x.s] || ""} — PG600 ${x.pg}`.replace("  ", " "));
  return [
    `🍺 *Base foco Stella Pure Gold* ${hoje.dataBR}`,
    `Consolidado ${nomeGV || "GV"} · ${hoje.diaLabel}`,
    `Total foco hoje: *PG600 ${tot}*`,
    "",
    "Por RN:",
    linhas.length ? linhas.join("\n") : "• (sem PDVs no dia de hoje)",
  ].join("\n");
}

router.get("/mensagens", async (req, res) => {
  try {
    const hoje = resolverDia(req.query.dia);
    const dados = await computeConversao(req.user);
    const usuarios = await readSheet("usuarios").catch(() => []);
    // Só RNs com PDV-alvo cujo dia de visita é o dia escolhido (hoje por padrão).
    const setores = [...new Set(
      dados.pg600.pdvs.filter((p) => normDia(p.dia_visita) === hoje.diaKey).map((p) => p.setor).filter(Boolean)
    )].sort();
    const infoSetor = {}; // setor -> {nome, telefone}
    const nomePorSetor = {};
    usuarios.forEach((u) => {
      const c = String(u.cod || "").trim();
      if (c) { infoSetor[c] = { nome: String(u.nome || "").trim(), telefone: String(u.telefone || "").trim() }; nomePorSetor[c] = String(u.nome || "").trim(); }
    });

    // PG600 do dia (uma vez) → alimenta o texto E os dados estruturados (p/ imagem).
    const pgHoje = dados.pg600.pdvs.filter((p) => normDia(p.dia_visita) === hoje.diaKey);
    const rn = setores.map((s) => ({
      setor: s, nome: infoSetor[s]?.nome || "", telefone: infoSetor[s]?.telefone || "",
      texto: textoRN(s, infoSetor[s]?.nome || "", dados, hoje),
      pdvs: pgHoje.filter((p) => p.setor === s).map((p) => ({ cod_pdv: p.cod_pdv, nome_pdv: p.nome_pdv, ultima_compra: p.ultima_compra })),
    }));

    // GV: agrupa por prefixo do setor (1xx = GV1, 3xx = GV3), acha o usuário GV.
    const gruposGV = {}; // prefixo -> setores[]
    setores.forEach((s) => { const p = String(s)[0]; (gruposGV[p] = gruposGV[p] || []).push(s); });
    const perfilDoPrefixo = { "1": "gv1", "3": "gv3" };
    const gv = Object.entries(gruposGV).map(([prefixo, sets]) => {
      const perfilGV = perfilDoPrefixo[prefixo];
      const uGV = usuarios.find((u) => String(u.perfil || "").toLowerCase() === perfilGV && String(u.telefone || "").trim());
      const nomeGV = uGV ? `GV ${uGV.nome}` : `GV ${prefixo}xx`;
      return {
        grupo: `${prefixo}xx`, nome: uGV?.nome || "", telefone: String(uGV?.telefone || "").trim(),
        texto: textoGV(sets, nomeGV, dados, nomePorSetor, hoje),
        total: pgHoje.filter((p) => sets.includes(p.setor)).length,
        linhas: sets.map((s) => ({ setor: s, nome: nomePorSetor[s] || "", pg: pgHoje.filter((p) => p.setor === s).length })).filter((x) => x.pg).sort((a, b) => b.pg - a.pg),
      };
    });

    return res.json({ data: hoje.dataBR, dia: hoje.diaLabel, rn, gv });
  } catch (e) {
    console.error("conversao-pg/mensagens:", e);
    return res.status(500).json({ error: "Erro ao gerar mensagens." });
  }
});

module.exports = router;
