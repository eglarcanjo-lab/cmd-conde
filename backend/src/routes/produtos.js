const express = require("express");
const router = express.Router();
const { readSheet, appendRow, updateRow } = require("../services/sheets");
const { authMiddleware, adminOnly } = require("../middleware/auth");

router.use(authMiddleware, adminOnly);

// GET /api/admin/produtos — lista todos os produtos da base
router.get("/", async (req, res) => {
  try {
    const dados = await readSheet("produtos_base");
    return res.json(dados);
  } catch {
    return res.json([]);
  }
});

// GET /api/admin/produtos/sem-categoria
router.get("/sem-categoria", async (req, res) => {
  try {
    const dados = await readSheet("produtos_sem_categoria");
    return res.json(dados);
  } catch {
    return res.json([]);
  }
});

// PUT /api/admin/produtos/:cod — atualiza categoria de um produto
router.put("/:cod", async (req, res) => {
  try {
    const { cod } = req.params;
    const { categoria } = req.body;

    const produtos = await readSheet("produtos_base");
    const idx = produtos.findIndex((p) => String(p.cod) === String(cod));

    if (idx === -1) {
      // Produto não está na base ainda — adiciona
      await appendRow("produtos_base", [cod, "", categoria, new Date().toLocaleDateString("pt-BR")]);
      return res.json({ success: true, message: "Produto adicionado à base." });
    }

    const p = produtos[idx];
    const updated = [p.cod, p.nome || p.descricao || "", categoria, p.atualizado_em || ""];
    await updateRow("produtos_base", idx + 1, updated);

    // Remove da lista de sem_categoria se foi categorizado
    if (categoria) {
      const semCat = await readSheet("produtos_sem_categoria");
      const semIdx = semCat.findIndex((s) => String(s.cod_prod) === String(cod));
      if (semIdx !== -1) {
        const s = semCat[semIdx];
        await updateRow("produtos_sem_categoria", semIdx + 1, [s.cod_prod, s.nome_prod, categoria, ""]);
      }
    }

    return res.json({ success: true, message: "Categoria atualizada." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao atualizar produto." });
  }
});

module.exports = router;
