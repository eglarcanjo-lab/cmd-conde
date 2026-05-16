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

module.exports = router;
