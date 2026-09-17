// Shelf — produtos perto do vencimento (guia FAROL PZC da Coleta). Visível a todos logados.
const express = require("express");
const router = express.Router();
const { readSheet } = require("../services/sheets");
const { authMiddleware } = require("../middleware/auth");

router.use(authMiddleware);

const num = (v) => parseFloat(String(v ?? "0").replace(",", ".")) || 0;
const int = (v) => Math.round(num(v));

// GET /api/shelf
router.get("/", async (req, res) => {
  try {
    const [shelf, statusArq] = await Promise.all([
      readSheet("shelf").catch(() => []),
      readSheet("status_arquivos").catch(() => []),
    ]);

    const itens = shelf.map((r) => ({
      cod: String(r.cod_produto || "").trim(),
      descricao: String(r.descricao || "").trim(),
      qtd_cx: int(r.qtd_cx),
      validade: String(r.validade || "").trim(),
      dias_vencer: int(r.dias_vencer),
      valor_shelf: num(r.valor_shelf),
    })).sort((a, b) => a.dias_vencer - b.dias_vencer);

    const st = statusArq.find((r) => /coleta/i.test(String(r.arquivo || "")));
    return res.json({
      atualizado_em: st ? String(st.atualizado_em || "").trim() : "",
      total_itens: itens.length,
      total_cx: itens.reduce((s, r) => s + r.qtd_cx, 0),
      total_valor: Math.round(itens.reduce((s, r) => s + r.valor_shelf, 0) * 100) / 100,
      itens,
    });
  } catch (e) {
    console.error("shelf:", e);
    return res.status(500).json({ error: "Erro ao carregar o Shelf." });
  }
});

module.exports = router;
