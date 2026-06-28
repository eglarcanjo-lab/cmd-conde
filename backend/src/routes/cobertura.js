const express = require("express");
const router = express.Router();
const { readSheet } = require("../services/sheets");
const { authMiddleware } = require("../middleware/auth");

router.use(authMiddleware);

// Filtra dados pelo perfil do usuário
const { filtrarPorPerfil } = require("../utils/perfil");

// GET /api/cobertura — status OK/Pendente/NOK por PDV x Categoria
router.get("/", async (req, res) => {
  try {
    const dados = await readSheet("cobertura");
    return res.json(filtrarPorPerfil(dados, req.user));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao buscar cobertura." });
  }
});

// GET /api/cobertura/pdv-base — base de PDVs com dia de visita
router.get("/pdv-base", async (req, res) => {
  try {
    const dados = await readSheet("pdv_base");
    return res.json(filtrarPorPerfil(dados, req.user));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao buscar PDVs." });
  }
});

// GET /api/cobertura/resumo — resumo por setor x categoria
router.get("/resumo", async (req, res) => {
  try {
    const dados = await readSheet("cobertura_resumo");
    return res.json(filtrarPorPerfil(dados, req.user));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao buscar resumo." });
  }
});

module.exports = router;
