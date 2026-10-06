// Motivos de devolução (código do CORA → descrição).
// O CORA traz só o CÓDIGO do motivo (col EH). O processador tem uma lista padrão e lê esta
// tabela para os códigos cadastrados no app; código desconhecido vai para
// `motivos_devolucao_pendentes` (gravada no import) e aparece aqui para cadastrar.
const express = require("express");
const router = express.Router();
const { query } = require("../services/db");
const { readSheet } = require("../services/sheets");
const { authMiddleware, adminOnly } = require("../middleware/auth");

router.use(authMiddleware, adminOnly);

let _ok = false;
async function ensureTabela() {
  if (_ok) return;
  await query(`CREATE TABLE IF NOT EXISTS motivos_devolucao (
    cod TEXT PRIMARY KEY, descricao TEXT, atualizado_em TIMESTAMPTZ DEFAULT now())`);
  _ok = true;
}

// GET /api/admin/motivos-devolucao → { cadastrados:[{cod,descricao}], pendentes:[{cod,nfs,ultima}] }
router.get("/", async (req, res) => {
  try {
    await ensureTabela();
    const cad = (await query(`SELECT cod, descricao FROM motivos_devolucao ORDER BY cod`)).rows;
    const jaTem = new Set(cad.map((c) => String(c.cod)));
    const pend = (await readSheet("motivos_devolucao_pendentes").catch(() => []))
      .filter((p) => p.cod && !jaTem.has(String(p.cod).replace(/^0+/, "")));
    return res.json({ cadastrados: cad, pendentes: pend });
  } catch (e) {
    console.error("motivos GET:", e);
    return res.status(500).json({ error: "Erro ao carregar motivos." });
  }
});

// PUT /api/admin/motivos-devolucao/:cod { descricao }
router.put("/:cod", async (req, res) => {
  try {
    await ensureTabela();
    const cod = String(req.params.cod || "").trim().replace(/^0+/, "");
    const descricao = String(req.body?.descricao || "").trim().toUpperCase().slice(0, 80);
    if (!/^\d+$/.test(cod) || !descricao) return res.status(400).json({ error: "Informe o código e a descrição." });
    await query(
      `INSERT INTO motivos_devolucao (cod, descricao) VALUES ($1, $2)
       ON CONFLICT (cod) DO UPDATE SET descricao = EXCLUDED.descricao, atualizado_em = now()`, [cod, descricao]);
    return res.json({ success: true });
  } catch (e) {
    console.error("motivos PUT:", e);
    return res.status(500).json({ error: "Erro ao salvar o motivo." });
  }
});

module.exports = router;
