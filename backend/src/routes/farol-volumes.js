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
const { opVolume } = require("../utils/opVolume");
const rvf = require("../services/rvFechamento");

const pad = (n) => String(n).padStart(2, "0");
const DIA_LABEL = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

router.use(authMiddleware);

// "Programado p/ entregar AMANHÃ" (robô das 12h: vem antes do acumulado do mês). Regra única de
// 04/11/2026: venda/RV só contam quando ENTREGUE, no dia da entrega; o relatório diário mostra o que
// está PROGRAMADO para a próxima entrega. Fonte: cora_dia (CORA, data = Data entrega) com data =
// amanhã (domingo pula p/ segunda), item ATENDIDO, op 1 (venda) ou 2 (bonificação). HL já vem pelo
// Fator Hecto Comercial; Mktp = R$ sem ADF (valor) dos produtos MKTP. Mesmas categorias e seções do
// Report (Cerveja = produto c/ categoria CERVEJA etc.; RGB TT = CATS_RGB, produto 1x).
const BRUTA = { "CERVEJA RGB": "GIRO RGB", "MKTPLACE": "MKTP", "HE BC": "HE", "CERVEJA ZERO BC": "CERVEJA ZERO" };
const NOVO_DE = { "301": "107", "302": "108", "303": "109", "304": "110", "305": "111" };
const numV = (v) => parseFloat(String(v ?? "0").replace(",", ".")) || 0;
const normC = (v) => String(v ?? "").trim().replace(/\.0$/, "").replace(/^0+/, "");
function proximaEntrega(hoje) {
  const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1);
  if (d.getDay() === 0) d.setDate(d.getDate() + 1); // domingo não tem entrega
  return d;
}
async function montarProgramado(dataBR, setoresOk, nomeSetor) {
  const [base, coraDia] = await Promise.all([
    readSheet("produtos_base").catch(() => []),
    readSheet("cora_dia").catch(() => []),
  ]);
  const cats = {};
  base.forEach((p) => {
    cats[normC(p.cod)] = new Set(String(p.categorias || p.categoria || "").toUpperCase().split(/\s*[|,;]\s*/)
      .map((c) => BRUTA[c.trim()] || c.trim()).filter(Boolean));
  });
  const setorOk = (s) => { const x = NOVO_DE[normC(s)] || normC(s); return setoresOk.has(x) ? x : null; };
  const rvRows = {}, volRows = [], rgb = {};
  const linha = (s) => (rvRows[s] = rvRows[s] || { setor: s, real_cerveja: 0, real_nab: 0, real_match: 0, real_marketplace: 0 });
  setoresOk.forEach(linha); // todo RN aparece (com 0 se não tem nada programado)
  let algum = false;
  coraDia.forEach((r) => {
    if (r.data !== dataBR || String(r.situacao || "").toUpperCase() !== "ATENDIDO" || !opVolume(r)) return;
    const s = setorOk(r.setor); if (!s) return;
    algum = true;
    const hl = numV(r.volume_hl), c = cats[normC(r.cod_produto)] || new Set();
    const l = linha(s);
    if (c.has("CERVEJA")) l.real_cerveja += hl;
    if (c.has("NAB")) l.real_nab += hl;
    if (c.has("MATCH")) l.real_match += hl;
    if (c.has("MKTP")) l.real_marketplace += numV(r.valor);
    if (c.has("CERVEJA ZERO")) volRows.push({ setor: s, categoria: "CERVEJA ZERO", volume: hl });
    if (c.has("NAB ZERO")) volRows.push({ setor: s, categoria: "NAB ZERO", volume: hl });
    if ([...c].some((x) => CATS_RGB.has(x))) rgb[s] = (rgb[s] || 0) + hl;
  });
  const rep = montarReport(Object.values(rvRows), volRows, nomeSetor, 1, { rgb, casas: 1 });
  if (!rep) return null;
  rep.subcols = [{ key: "real", label: "Prog." }];
  rep.data_entrega = dataBR; rep.vazio = !algum;
  return rep;
}

// Monta o JSON do Report Volumes (robô WhatsApp E Painel TV — routes/tv.js).
async function montarMensagens(mesParam) {
    // ?mes=YYYY-MM (mês ANTERIOR) = FECHAMENTO: usa o último dia daquele mês (tendência = real,
    // todos os dias úteis feitos) e não monta o "Vendido hoje". Robô: MES=2026-10 node enviar.js
    const agora = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const mesAtual = `${agora.getFullYear()}-${pad(agora.getMonth() + 1)}`;
    const mesQ = /^\d{4}-\d{2}$/.test(String(mesParam || "")) ? String(mesParam) : "";
    const fechamento = !!mesQ && mesQ < mesAtual;
    const d = fechamento ? new Date(+mesQ.slice(0, 4), +mesQ.slice(5, 7), 0) : agora;
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
    // Fechamento de mês anterior: RNs DAQUELE mês (troca de RN entre setores não muda o passado)
    if (fechamento) Object.assign(nomeSetor, (await rvf.nomesDoMes(mes).catch(() => null)) || {});

    // RGB TT entra como categoria após Cerveja (meta = monitoramento, se lançada).
    // RGB TT (Giro RGB + Litrinho + Trimarcas) no lugar do antigo "Giro RGB" (só Giro + Litrinho)
    const report = montarReport(rv, vol, nomeSetor, fator, { rateio, rgb: await rgbPorSetor(mes) });
    if (!report) return ({ data: dataBR, dia: diaLabel, titulo: "Report Volumes", emoji: "📊", report: null, rn: [], gv: [], director: null, destinatarios: [] });
    const pe = proximaEntrega(agora);
    const dataEntregaBR = `${pad(pe.getDate())}/${pad(pe.getMonth() + 1)}/${pe.getFullYear()}`;
    const reportDia = fechamento ? null : await montarProgramado(dataEntregaBR, new Set(rv.map((r) => norm(r.setor))), nomeSetor).catch((e) => { console.error("programado amanhã:", e.message); return null; });

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

    return { data: dataBR, dia: diaLabel, titulo: "Report Volumes", emoji: "📊", report, report_dia: reportDia, fechamento: fechamento ? mes : null, diasUteis, destinatarios, rn: [], gv: [], director: null };
}

// GET /api/farol-volumes/mensagens  (mês corrente; relatório consolidado p/ todos)
router.get("/mensagens", async (req, res) => {
  try {
    return res.json(await montarMensagens(req.query.mes));
  } catch (e) {
    console.error("farol-volumes/mensagens:", e);
    return res.status(500).json({ error: "Erro ao gerar o Report Volumes." });
  }
});

module.exports = router;
module.exports.montarMensagens = montarMensagens;
