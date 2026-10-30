// Farol "Report Volumes" (envio WhatsApp) — relatório único estilo planilha.
// Ordem: Consolidado Operação → Por GV (GV1/GV3) → Por RN (primeiro nome).
// Categorias: Cerveja, Cerveja Zero, NAB, NAB Zero, Match, Mktp. Sub-colunas por
// categoria: Meta · Real · % · Tend. Tendência = real projetado pelo ritmo de dias úteis.
// Fonte: rv_resultado (metas/real das 4 principais) + rv_volume (volume das "zero").
// Todo mundo com telefone recebe o relatório INTEIRO (não é escopado por RN).
const express = require("express");
const router = express.Router();
const { readSheet, readSheetMonths } = require("../services/sheets");
const { authMiddleware } = require("../middleware/auth");
const { montarReport } = require("../utils/volumesReport");
const { lerMetasMonitor, ratearMetasMonitor } = require("../utils/metasMonitor");
const { rgbPorSetor, CATS_RGB } = require("../utils/rgbVolume");

const pad = (n) => String(n).padStart(2, "0");
const DIA_LABEL = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

router.use(authMiddleware);

// "Vendido HOJE" (robô das 12h: vem antes do acumulado do mês) — mesmas categorias e seções
// do Report, só a coluna Real. Volume = vd_produto do dia (venda válida do CORA; pedido de hoje
// p/ entrega amanhã conta hoje) × categorias do produto (produtos_base, mesma regra do rv_volume:
// Cerveja = produto com a categoria CERVEJA etc.); RGB TT = CATS_RGB (produto conta 1x);
// Mktp = R$ sem ADF do dia (rv_faturamento_mktp_dia). Só setores do Report (rv_resultado).
const BRUTA = { "CERVEJA RGB": "GIRO RGB", "MKTPLACE": "MKTP", "HE BC": "HE", "CERVEJA ZERO BC": "CERVEJA ZERO" };
const NOVO_DE = { "301": "107", "302": "108", "303": "109", "304": "110", "305": "111" };
const numV = (v) => parseFloat(String(v ?? "0").replace(",", ".")) || 0;
const normC = (v) => String(v ?? "").trim().replace(/\.0$/, "").replace(/^0+/, "");
async function montarVendidoHoje(mes, hojeISO, setoresOk, nomeSetor) {
  const [base, vd, mk] = await Promise.all([
    readSheet("produtos_base").catch(() => []),
    readSheetMonths("vd_produto", "mes_referencia", [mes]).catch(() => []),
    readSheetMonths("rv_faturamento_mktp_dia", "mes_referencia", [mes]).catch(() => []),
  ]);
  const cats = {};
  base.forEach((p) => {
    cats[normC(p.cod)] = new Set(String(p.categorias || p.categoria || "").toUpperCase().split(/\s*[|,;]\s*/)
      .map((c) => BRUTA[c.trim()] || c.trim()).filter(Boolean));
  });
  const setorOk = (s) => { const x = NOVO_DE[normC(s)] || normC(s); return setoresOk.has(x) ? x : null; };
  const rvRows = {}, volRows = [], rgb = {};
  const linha = (s) => (rvRows[s] = rvRows[s] || { setor: s, real_cerveja: 0, real_nab: 0, real_match: 0, real_marketplace: 0 });
  setoresOk.forEach(linha); // todo RN aparece (com 0 se não vendeu)
  vd.forEach((r) => {
    if (String(r.data || "").slice(0, 10) !== hojeISO) return;
    const s = setorOk(r.setor); if (!s) return;
    const hl = numV(r.volume_hl), c = cats[normC(r.cod_produto)] || new Set();
    const l = linha(s);
    if (c.has("CERVEJA")) l.real_cerveja += hl;
    if (c.has("NAB")) l.real_nab += hl;
    if (c.has("MATCH")) l.real_match += hl;
    if (c.has("CERVEJA ZERO")) volRows.push({ setor: s, categoria: "CERVEJA ZERO", volume: hl });
    if (c.has("NAB ZERO")) volRows.push({ setor: s, categoria: "NAB ZERO", volume: hl });
    if ([...c].some((x) => CATS_RGB.has(x))) rgb[s] = (rgb[s] || 0) + hl;
  });
  mk.forEach((r) => {
    if (String(r.data || "").slice(0, 10) !== hojeISO) return;
    const s = setorOk(r.setor); if (s) linha(s).real_marketplace += numV(r.faturamento_mktp);
  });
  const rep = montarReport(Object.values(rvRows), volRows, nomeSetor, 1, { rgb, casas: 1 });
  if (!rep) return null;
  rep.subcols = [{ key: "real", label: "Hoje" }];
  return rep;
}

// GET /api/farol-volumes/mensagens  (mês corrente; relatório consolidado p/ todos)
router.get("/mensagens", async (req, res) => {
  try {
    const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const mes = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    const dataBR = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    const diaLabel = DIA_LABEL[d.getDay()];

    // Tendência: projeta o real do mês pelo ritmo de dias úteis (seg–sex).
    const uteis = (ate) => { let c = 0; const x = new Date(d.getFullYear(), d.getMonth(), 1); while (x.getMonth() === d.getMonth() && x.getDate() <= ate) { const w = x.getDay(); if (w >= 1 && w <= 5) c++; x.setDate(x.getDate() + 1); } return c; };
    const fator = uteis(31) / Math.max(1, uteis(d.getDate()));
    const diasUteis = { feitos: uteis(d.getDate()), total: uteis(31) };

    const [rvAll, volAll, usuarios] = await Promise.all([
      readSheet("rv_resultado").catch(() => []),
      readSheet("rv_volume").catch(() => []),
      readSheet("usuarios").catch(() => []),
    ]);
    let rv = rvAll.filter((r) => !r.mes_referencia || String(r.mes_referencia).startsWith(mes));
    // metas de monitoramento (Cerveja Zero/Match/NAB Zero) — rateio sobre a operação inteira (antes de ocultar setores)
    const rateio = ratearMetasMonitor(await lerMetasMonitor(mes), rv);
    let vol = volAll.filter((r) => !r.mes_referencia && !r.mes_ref ? true : String(r.mes_ref || r.mes_referencia || "").startsWith(mes));

    // Setores ocultos SÓ no relatório do motor (não no app). Vazie a lista quando o RN
    // do 102 for contratado — está tudo pronto pra voltar sem mais nada.
    const SETORES_OCULTOS = ["102"];
    const norm = (s) => String(s || "").trim().replace(/^0+/, "");
    if (SETORES_OCULTOS.length) {
      const ocultos = new Set(SETORES_OCULTOS.map(norm));
      rv = rv.filter((r) => !ocultos.has(norm(r.setor)));
      vol = vol.filter((r) => !ocultos.has(norm(r.setor)));
    }

    const nomeSetor = {};
    usuarios.forEach((u) => { const c = String(u.cod || "").trim(); if (c) nomeSetor[c] = String(u.nome || "").trim(); });

    // RGB TT entra como categoria após Cerveja (meta = monitoramento, se lançada).
    // RGB TT (Giro RGB + Litrinho + Trimarcas) no lugar do antigo "Giro RGB" (só Giro + Litrinho)
    const report = montarReport(rv, vol, nomeSetor, fator, { rateio, rgb: await rgbPorSetor(mes) });
    if (!report) return res.json({ data: dataBR, dia: diaLabel, titulo: "Report Volumes", emoji: "📊", report: null, rn: [], gv: [], director: null, destinatarios: [] });
    const hojeISO = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const reportDia = await montarVendidoHoje(mes, hojeISO, new Set(rv.map((r) => norm(r.setor))), nomeSetor).catch((e) => { console.error("vendido hoje:", e.message); return null; });

    // Destinatários: todos com telefone (perfis de campo). Recebem o relatório INTEIRO.
    const perfisEnvio = new Set(["director", "gv1", "gv3", "rn"]);
    const vistos = new Set();
    const destinatarios = [];
    usuarios.forEach((u) => {
      const tel = String(u.telefone || "").replace(/\D/g, "");
      if (!tel || !perfisEnvio.has(String(u.perfil || "").toLowerCase())) return;
      if (vistos.has(tel)) return; vistos.add(tel);
      destinatarios.push({ nome: String(u.nome || "").trim() || "HOP", telefone: String(u.telefone).trim() });
    });

    return res.json({ data: dataBR, dia: diaLabel, titulo: "Report Volumes", emoji: "📊", report, report_dia: reportDia, diasUteis, destinatarios, rn: [], gv: [], director: null });
  } catch (e) {
    console.error("farol-volumes/mensagens:", e);
    return res.status(500).json({ error: "Erro ao gerar o Report Volumes." });
  }
});

module.exports = router;
