// Grade de Estoque — saldo (Disp) por produto, atualizada ~3x/dia.
// É estoque do armazém (grade), não é por setor → visível a todos os logados.
const express = require("express");
const router = express.Router();
const { readSheet } = require("../services/sheets");
const { authMiddleware } = require("../middleware/auth");

router.use(authMiddleware);

const num = (v) => parseFloat(String(v ?? "0").replace(",", ".")) || 0;
const int = (v) => Math.round(num(v));

// GET /api/grade
router.get("/", async (req, res) => {
  try {
    const [grade, statusArq] = await Promise.all([
      readSheet("grade_estoque").catch(() => []),
      readSheet("status_arquivos").catch(() => []),
    ]);

    const linha = statusArq.find((r) => /grade/i.test(String(r.arquivo || "")));
    const atualizadoEm = linha ? String(linha.atualizado_em || "").trim() : "";

    const itens = grade
      .map((r) => ({
        cod: r.cod,
        nome: r.nome,
        descricao: r.descricao,
        un: r.un,
        saldo: int(r.saldo),
        saidas: int(r.saidas),
        hl_caixa: num(r.hl_caixa),
        hl_estoque: Math.round(num(r.hl_estoque) * 1000) / 1000,
      }))
      .sort((a, b) => b.saldo - a.saldo);

    const totalHl = Math.round(itens.reduce((s, r) => s + r.hl_estoque, 0) * 10) / 10;
    const totalCx = itens.reduce((s, r) => s + r.saldo, 0);

    return res.json({
      atualizado_em: atualizadoEm,
      total_itens: itens.length,
      total_caixas: totalCx,
      total_hl: totalHl,
      itens,
    });
  } catch (err) {
    console.error("grade:", err);
    return res.status(500).json({ error: "Erro ao buscar a grade de estoque." });
  }
});

module.exports = router;
