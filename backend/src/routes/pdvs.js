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
    const [inad, pdvBase] = await Promise.all([
      readSheet("inadimplencia_real"),
      readSheet("pdv_base"),
    ]);

    // Mapa nome_fantasia → cod_pdv a partir da base de PDVs
    const nomeMap = {};
    const codSet = new Set();
    pdvBase.forEach((p) => {
      if (p.cod_pdv) codSet.add(String(p.cod_pdv).trim());
      if (p.nome_fantasia && p.cod_pdv)
        nomeMap[String(p.nome_fantasia).trim().toLowerCase()] = String(p.cod_pdv).trim();
    });

    // Normaliza cod_pdv: se não estiver na base, tenta casar pelo nome_fantasia
    const enriched = inad.map((r) => {
      const cod = String(r.cod_pdv || "").trim();
      if (codSet.has(cod)) return r;
      const matched = nomeMap[String(r.nome_fantasia || "").trim().toLowerCase()];
      return matched ? { ...r, cod_pdv: matched } : r;
    });

    return res.json(filtrarPorPerfil(enriched, req.user));
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

// GET /api/pdvs/categorias-produto — mapeamento cod_produto → categoria (de produtos_base)
router.get("/categorias-produto", async (req, res) => {
  try {
    const dados = await readSheet("produtos_base");
    return res.json(dados);
  } catch {
    return res.json([]);
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
