const express = require("express");
const router = express.Router();
const { readSheet, appendRow, updateRow } = require("../services/sheets");
const { authMiddleware, adminOnly } = require("../middleware/auth");

router.use(authMiddleware, adminOnly);

// "nan"/"None" = valor vazio salvo como texto (sobra do pandas no processador) — não é nome.
const LIXO = new Set(["NAN", "NONE", "NULL", "NAT"]);
const limpo = (v) => { const t = String(v ?? "").trim(); return LIXO.has(t.toUpperCase()) ? "" : t; };
const normCod = (v) => String(v ?? "").trim().replace(/\.0$/, "").replace(/^0+/, "");

// Nome do produto quando a produtos_base não tem: cadastro completo (0111) → lista de
// sem-categoria (nome que veio do pedido).
async function nomesReserva() {
  const [full, semCat] = await Promise.all([
    readSheet("produtos_full").catch(() => []),
    readSheet("produtos_sem_categoria").catch(() => []),
  ]);
  const m = {};
  semCat.forEach((s) => { const c = normCod(s.cod_prod); if (c && limpo(s.nome_prod)) m[c] = limpo(s.nome_prod); });
  full.forEach((p) => { const c = normCod(p.cod); if (c && limpo(p.nome)) m[c] = limpo(p.nome); });
  return m;
}

// GET /api/admin/produtos — lista todos os produtos da base (nome/categoria sem "nan"/"None")
router.get("/", async (req, res) => {
  try {
    const [dados, reserva] = await Promise.all([readSheet("produtos_base"), nomesReserva()]);
    return res.json(dados.map((p) => ({
      ...p,
      nome: limpo(p.nome) || reserva[normCod(p.cod)] || "",
      categorias: limpo(p.categorias),
    })));
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
    const reserva = await nomesReserva();

    if (idx === -1) {
      // Produto não está na base ainda (ex.: ainda não vendeu) — adiciona JÁ COM O NOME
      // (antes ia em branco e o processador gravava "None", que travava p/ sempre).
      await appendRow("produtos_base", [cod, reserva[normCod(cod)] || "", categoria, new Date().toLocaleDateString("pt-BR")]);
      return res.json({ success: true, message: "Produto adicionado à base." });
    }

    const p = produtos[idx];
    const nome = limpo(p.nome) || limpo(p.descricao) || reserva[normCod(cod)] || "";
    const updated = [p.cod, nome, categoria, p.atualizado_em || ""];
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
