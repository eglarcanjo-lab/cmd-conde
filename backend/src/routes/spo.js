// updated: 2026-05-16 21:47:53
const express = require("express");
const router = express.Router();
const { readSheet } = require("../services/sheets");
const { authMiddleware } = require("../middleware/auth");

router.use(authMiddleware);

function filtrarGV(dados, usuario) {
  if (["admin", "director"].includes(usuario.perfil)) return dados;
  if (usuario.perfil === "gv1") return dados.filter((r) => String(r.gv) === "1");
  if (usuario.perfil === "gv3") return dados.filter((r) => String(r.gv) === "2");
  return dados.filter((r) => String(r.setor) === String(usuario.cod));
}

// GET /api/spo/dias-rota/resumo
router.get("/dias-rota/resumo", async (req, res) => {
  try {
    const dados = await readSheet("spo_dias_rota_resumo");
    return res.json(filtrarGV(dados, req.user));
  } catch { return res.json([]); }
});

// GET /api/spo/visitacao-gv/resumo
router.get("/visitacao-gv/resumo", async (req, res) => {
  try {
    const dados = await readSheet("spo_visitacao_gv_resumo");
    return res.json(filtrarGV(dados, req.user));
  } catch { return res.json([]); }
});

// GET /api/spo/coaching/resumo
router.get("/coaching/resumo", async (req, res) => {
  try {
    const dados = await readSheet("spo_coaching_resumo");
    return res.json(filtrarGV(dados, req.user));
  } catch { return res.json([]); }
});

// GET /api/spo/coaching/sem-coaching
router.get("/coaching/sem-coaching", async (req, res) => {
  try {
    const dados = await readSheet("spo_coaching_sem_coaching");
    return res.json(filtrarGV(dados, req.user));
  } catch { return res.json([]); }
});

// GET /api/spo/coaching/detalhe
router.get("/coaching/detalhe", async (req, res) => {
  try {
    const dados = await readSheet("spo_coaching_detalhe");
    return res.json(filtrarGV(dados, req.user));
  } catch { return res.json([]); }
});

// GET /api/spo/visitacao-gv/detalhe
router.get("/visitacao-gv/detalhe", async (req, res) => {
  try {
    const dados = await readSheet("spo_visitacao_gv");
    return res.json(filtrarGV(dados, req.user));
  } catch { return res.json([]); }
});

// GET /api/spo/dto
router.get("/dto", async (req, res) => {
  try {
    const dados = await readSheet("spo_dto_resumo");
    return res.json(dados);
  } catch { return res.json([]); }
});

// GET /api/spo/desafios
router.get("/desafios", async (req, res) => {
  try {
    const { mes } = req.query;
    const dados = await readSheet("spo_desafios");
    const filtrado = mes ? dados.filter((r) => r.mes_referencia === mes) : dados;
    return res.json(filtrarGV(filtrado, req.user));
  } catch { return res.json([]); }
});

// POST /api/spo/desafios
router.post("/desafios", async (req, res) => {
  try {
    const { linhas } = req.body;
    if (!Array.isArray(linhas)) return res.status(400).json({ error: "Envie array de linhas." });

    const { google } = require("googleapis");
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const headers = ["gv", "dia", "mes_referencia", "status"];

    // Remove mês atual e regrava
    const todos = await readSheet("spo_desafios");
    const mesRef = linhas[0]?.mes_referencia;
    const outros = todos.filter((r) => r.mes_referencia !== mesRef);
    const novos = [...outros, ...linhas.filter((l) => l.status)];

    await sheets.spreadsheets.values.clear({ spreadsheetId: sheetId, range: "spo_desafios" });
    const rows = [headers, ...novos.map((l) => headers.map((h) => l[h] ?? ""))];
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: "spo_desafios!A1",
      valueInputOption: "USER_ENTERED",
      resource: { values: rows },
    });

    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao salvar desafios." });
  }
});

module.exports = router;
