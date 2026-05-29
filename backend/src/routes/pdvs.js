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
// Remove acentos, pontuação e espaços duplos para matching tolerante
function normName(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")   // tira acentos
    .replace(/[^a-z0-9 ]/g, " ")      // troca pontuação por espaço
    .replace(/\s+/g, " ")             // colapsa espaços
    .trim();
}

router.get("/inadimplentes", async (req, res) => {
  try {
    const [inad, pdvBase] = await Promise.all([
      readSheet("inadimplencia_real"),
      readSheet("pdv_base"),
    ]);

    // Mapas de lookup: exato (lowercase) e normalizado (sem acentos/pontuação)
    const nomeExato = {};
    const nomeNorm  = {};
    const codSet    = new Set();
    const baseMap   = {};
    pdvBase.forEach((p) => {
      const cod  = String(p.cod_pdv      || "").trim();
      const nome = String(p.nome_fantasia || "").trim();
      if (cod) { codSet.add(cod); baseMap[cod] = p; }
      if (nome && cod) {
        nomeExato[nome.toLowerCase()] = cod;
        nomeNorm[normName(nome)]      = cod;
      }
    });

    function resolveByName(val) {
      if (!val) return null;
      return nomeExato[val.toLowerCase()]
          || nomeNorm[normName(val)]
          || null;
    }

    // Normaliza cod_pdv:
    //  1. já é código válido → garante setor/nome
    //  2. cod_pdv contém nome (coluna errada) → lookup pelo valor como nome (exato ou normalizado)
    //  3. nome_fantasia tem nome válido → lookup pelo nome
    const enriched = inad.map((r) => {
      const cod  = String(r.cod_pdv      || "").trim();
      const nome = String(r.nome_fantasia || "").trim();

      // caso 1: código já correto
      if (codSet.has(cod)) {
        const base = baseMap[cod];
        return base
          ? { ...r, setor: r.setor || base.setor, nome_fantasia: base.nome_fantasia || r.nome_fantasia }
          : r;
      }

      // caso 2: cod_pdv contém o nome (planilha com colunas trocadas)
      const codResolvido = resolveByName(cod);
      if (codResolvido) {
        const base = baseMap[codResolvido];
        return {
          ...r,
          cod_pdv:       codResolvido,
          nome_fantasia: base?.nome_fantasia || cod,
          setor:         r.setor || base?.setor,
        };
      }

      // caso 3: tenta pelo campo nome_fantasia (ignora se for numérico/lixo)
      const nomeValido = nome && isNaN(Number(nome)) && nome.length > 2;
      const codPorNome = nomeValido ? resolveByName(nome) : null;
      if (codPorNome) {
        const base = baseMap[codPorNome];
        return { ...r, cod_pdv: codPorNome, nome_fantasia: base?.nome_fantasia || nome, setor: r.setor || base?.setor };
      }

      return r;
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
