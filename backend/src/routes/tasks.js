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

// GET /api/tasks/missoes — relatório de Missões do BI (campanha), escopo por perfil.
// Inclui a data de atualização do import (status_arquivos "Missões (BI)").
router.get("/missoes", async (req, res) => {
  try {
    const [dados, statusArq] = await Promise.all([
      readSheet("missoes").catch(() => []),
      readSheet("status_arquivos").catch(() => []),
    ]);
    const st = statusArq.find((r) => /miss/i.test(String(r.arquivo || "")));
    return res.json({
      atualizado_em: st ? String(st.atualizado_em || "").trim() : "",
      missoes: filtrarPorPerfil(dados, req.user),
    });
  } catch (err) {
    console.error("tasks/missoes:", err);
    return res.status(500).json({ error: "Erro ao buscar missões." });
  }
});

module.exports = router;
