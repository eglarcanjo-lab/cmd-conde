// Farol "Report Volumes" (envio WhatsApp) — relatório único estilo planilha.
// Ordem: Consolidado Operação → Por GV (GV1/GV3) → Por RN (primeiro nome).
// Categorias: Cerveja, Cerveja Zero, NAB, NAB Zero, Match, Mktp. Sub-colunas por
// categoria: Meta · Real · % · Tend. Tendência = real projetado pelo ritmo de dias úteis.
// Fonte: rv_resultado (metas/real das 4 principais) + rv_volume (volume das "zero").
// Todo mundo com telefone recebe o relatório INTEIRO (não é escopado por RN).
const express = require("express");
const router = express.Router();
const { readSheet } = require("../services/sheets");
const { authMiddleware } = require("../middleware/auth");
const { montarReport } = require("../utils/volumesReport");

const pad = (n) => String(n).padStart(2, "0");
const DIA_LABEL = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

router.use(authMiddleware);

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

    // giroRgb: true → inclui a categoria "Giro RGB" (GIRO RGB + LITRINHO) só no motor.
    const report = montarReport(rv, vol, nomeSetor, fator, { giroRgb: true });
    if (!report) return res.json({ data: dataBR, dia: diaLabel, titulo: "Report Volumes", emoji: "📊", report: null, rn: [], gv: [], director: null, destinatarios: [] });

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

    return res.json({ data: dataBR, dia: diaLabel, titulo: "Report Volumes", emoji: "📊", report, diasUteis, destinatarios, rn: [], gv: [], director: null });
  } catch (e) {
    console.error("farol-volumes/mensagens:", e);
    return res.status(500).json({ error: "Erro ao gerar o Report Volumes." });
  }
});

module.exports = router;
