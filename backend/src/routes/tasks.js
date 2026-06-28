const express = require("express");
const router = express.Router();
const { readSheet } = require("../services/sheets");
const { authMiddleware } = require("../middleware/auth");

router.use(authMiddleware);

const { filtrarPorPerfil } = require("../utils/perfil");

// GET /api/tasks
router.get("/", async (req, res) => {
  try {
    const dados = await readSheet("tasks");
    return res.json(filtrarPorPerfil(dados, req.user));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao buscar tasks." });
  }
});

module.exports = router;
