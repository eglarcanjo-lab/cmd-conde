const express = require("express");
const router = express.Router();
const { readSheet } = require("../services/sheets");
const { authMiddleware } = require("../middleware/auth");

router.use(authMiddleware);

function filtrarPorPerfil(dados, usuario, campoSetor = "setor") {
  if (["admin", "director"].includes(usuario.perfil)) return dados;
  if (usuario.perfil === "gv1") return dados.filter((r) => String(r[campoSetor]).startsWith("1"));
  if (usuario.perfil === "gv3") return dados.filter((r) => String(r[campoSetor]).startsWith("3"));
  return dados.filter((r) => String(r[campoSetor]) === String(usuario.cod));
}

// GET /api/pdvs/mix
router.get("/mix", async (req, res) => {
  try {
    const dados = await readSheet("pdv_mix");
    return res.json(filtrarPorPerfil(dados, req.user));
  } catch (err) {
    return res.status(500).json({ error: "Erro ao buscar mix." });
  }
});

// GET /api/pdvs/inadimplentes
router.get("/inadimplentes", async (req, res) => {
  try {
    const dados = await readSheet("inadimplencia_real");
    return res.json(filtrarPorPerfil(dados, req.user));
  } catch (err) {
    // Fallback para a aba antiga se a nova ainda não existir
    try {
      const dados = await readSheet("inadimplentes");
      return res.json(filtrarPorPerfil(dados, req.user));
    } catch {
      return res.json([]);
    }
  }
});

// GET /api/pdvs/rank
router.get("/rank", async (req, res) => {
  try {
    const dados = await readSheet("rank_clientes");
    return res.json(filtrarPorPerfil(dados, req.user));
  } catch (err) {
    return res.status(500).json({ error: "Erro ao buscar rank." });
  }
});

// GET /api/pdvs/sem-compra
router.get("/sem-compra", async (req, res) => {
  try {
    const dados = await readSheet("sem_compra");
    return res.json(filtrarPorPerfil(dados, req.user));
  } catch (err) {
    return res.status(500).json({ error: "Erro ao buscar sem compra." });
  }
});

module.exports = router;
