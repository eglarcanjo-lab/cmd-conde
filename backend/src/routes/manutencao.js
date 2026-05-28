const express = require("express");
const router = express.Router();
const { sobrescreverAba } = require("../services/sheets");
const { authMiddleware, adminOnly } = require("../middleware/auth");
const { getEstado, setEstado } = require("../services/configuracoes");

// GET /api/manutencao/status — público, chamado pelo frontend no load
router.get("/status", (req, res) => {
  return res.json(getEstado());
});

// POST /api/manutencao — admin only
router.post("/", authMiddleware, adminOnly, async (req, res) => {
  const { ativo, mensagem } = req.body;
  const novaMsg = mensagem || "Em Manutenção";

  // Atualiza memória imediatamente (sem esperar o Sheets)
  setEstado(!!ativo, novaMsg);

  // Persiste no Sheets em background
  sobrescreverAba("configuracoes", [
    ["chave", "valor"],
    ["manutencao_ativa",   String(!!ativo)],
    ["manutencao_mensagem", novaMsg],
  ]).catch((err) => console.warn("⚠️  Falha ao persistir manutenção no Sheets:", err.message));

  return res.json({ success: true, ...getEstado() });
});

module.exports = router;
