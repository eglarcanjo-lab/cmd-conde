// Shelf — produtos perto do vencimento (guia FAROL PZC da Coleta). Visível a todos logados.
const express = require("express");
const router = express.Router();
const { readSheet } = require("../services/sheets");
const { authMiddleware } = require("../middleware/auth");

router.use(authMiddleware);

const num = (v) => parseFloat(String(v ?? "0").replace(",", ".")) || 0;
const int = (v) => Math.round(num(v));
// Dias corridos de hoje (Brasília) até a validade dd/mm/aaaa. Assim o contador cai a
// cada dia, sem depender da próxima importação (que é semanal).
function diasAte(ddmmaaaa) {
  const m = String(ddmmaaaa || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const alvo = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const hojeBR = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  hojeBR.setHours(0, 0, 0, 0);
  return Math.round((alvo - hojeBR) / 86400000);
}

// GET /api/shelf
router.get("/", async (req, res) => {
  try {
    const [shelf, statusArq] = await Promise.all([
      readSheet("shelf").catch(() => []),
      readSheet("status_arquivos").catch(() => []),
    ]);

    const itens = shelf.map((r) => {
      const validade = String(r.validade || "").trim();
      const dLive = diasAte(validade); // corrido; cai à cada dia
      return {
        cod: String(r.cod_produto || "").trim(),
        descricao: String(r.descricao || "").trim(),
        qtd_cx: int(r.qtd_cx),
        validade,
        dias_vencer: dLive != null ? dLive : int(r.dias_vencer),
        valor_shelf: num(r.valor_shelf),
      };
    }).sort((a, b) => a.dias_vencer - b.dias_vencer);

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
