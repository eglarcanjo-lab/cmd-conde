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

module.exports = router;
