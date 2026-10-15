const express = require("express");
const router = express.Router();
const { readSheet, appendRow, appendRows, upsertRows, updateRow, deleteRow, sobrescreverAba, ensureTab, cacheClearAll } = require("../services/sheets");
const { authMiddleware, adminOnly } = require("../middleware/auth");
const { SENHA_PADRAO, hashSenha } = require("../utils/senha");


router.use(authMiddleware, adminOnly);

// ─── USUÁRIOS ────────────────────────────────────────────────────────────────

router.get("/usuarios", async (req, res) => {
  try {
    const usuarios = await readSheet("usuarios");
    return res.json(usuarios);
  } catch {
    return res.status(500).json({ error: "Erro ao buscar usuários." });
  }
});

router.post("/usuarios", async (req, res) => {
  try {
    const { cod, nome, cpf, telefone, perfil, gv } = req.body;
    const cpfLimpo = cpf?.replace(/\D/g, "");

    if (!cod || !nome || !cpfLimpo || cpfLimpo.length !== 11 || !perfil) {
      return res.status(400).json({ error: "Campos obrigatórios: cod, nome, cpf (11 dígitos), perfil." });
    }

    const existentes = await readSheet("usuarios");
    const donoCod = existentes.find((u) => u.cod === String(cod));
    if (donoCod && String(donoCod.ativo) === "true") {
      return res.status(409).json({ error: "Código já cadastrado (usuário ativo)." });
    }
    if (existentes.find((u) => u.cpf?.replace(/\D/g, "") === cpfLimpo && u.cod !== String(cod))) {
      return res.status(409).json({ error: "CPF já cadastrado." });
    }
    // Código pertencia a um usuário INATIVO: remove o cadastro inativo p/ liberar o setor.
    if (donoCod) {
      await deleteRow("usuarios", existentes.findIndex((u) => u.cod === String(cod)));
    }

    const criado_em = new Date().toISOString();
    await appendRow("usuarios", [cod, nome, cpfLimpo, telefone?.replace(/\D/g, "") || "", perfil, gv || "", "true", "", criado_em]);

    return res.json({ success: true, message: "Usuário cadastrado com sucesso." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao cadastrar usuário." });
  }
});

router.put("/usuarios/:cod", async (req, res) => {
  try {
    const { cod } = req.params;
    const { cod: novoCodRaw, nome, cpf, telefone, perfil, gv, ativo, senha } = req.body;

    let usuarios = await readSheet("usuarios");
    let idx = usuarios.findIndex((u) => u.cod === cod);

    if (idx === -1) return res.status(404).json({ error: "Usuário não encontrado." });

    // Permite alterar o código/setor. Regra na colisão: se o dono atual está ATIVO,
    // bloqueia; se está INATIVO, libera o setor removendo o cadastro inativo (handover
    // de território). OBS: dados históricos do setor antigo (metas, incidentes, RV,
    // imports) continuam no setor antigo — a troca vale p/ login e lançamentos futuros.
    const novoCod = (novoCodRaw !== undefined && String(novoCodRaw).trim() !== "")
      ? String(novoCodRaw).trim() : cod;
    if (novoCod !== cod) {
      const dono = usuarios.find((x) => x.cod === novoCod && x.cod !== cod);
      if (dono) {
        if (String(dono.ativo) === "true") {
          return res.status(409).json({ error: `O código/setor ${novoCod} já está em uso por um usuário ATIVO (${dono.nome}). Desative-o antes de reatribuir.` });
        }
        // Dono inativo: remove p/ liberar o setor, depois relê p/ reindexar.
        await deleteRow("usuarios", usuarios.findIndex((x) => x.cod === novoCod));
        usuarios = await readSheet("usuarios");
        idx = usuarios.findIndex((u) => u.cod === cod);
        if (idx === -1) return res.status(404).json({ error: "Usuário não encontrado após liberar o setor." });
      }
    }

    const u = usuarios[idx];

    // Senha definida pelo admin: se for real, guarda como hash; "1234" fica como
    // sentinela em texto (força troca no 1º login); vazio mantém a atual.
    let senhaFinal = u.senha;
    if (senha !== undefined && senha !== "") {
      senhaFinal = senha === SENHA_PADRAO ? SENHA_PADRAO : await hashSenha(senha);
    }
    const updated = [
      novoCod,
      nome ?? u.nome,
      cpf?.replace(/\D/g, "") ?? u.cpf,
      telefone?.replace(/\D/g, "") ?? u.telefone,
      perfil ?? u.perfil,
      gv ?? u.gv,
      ativo !== undefined ? String(ativo) : u.ativo,
      senhaFinal,
      u.criado_em,
    ];

    await updateRow("usuarios", idx + 1, updated);
    return res.json({
      success: true,
      message: novoCod !== cod ? `Usuário atualizado — setor ${cod} → ${novoCod}.` : "Usuário atualizado.",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao atualizar usuário." });
  }
});

// ─── METAS ──────────────────────────────────────────────────────────────────

router.get("/metas", async (req, res) => {
  try {
    const metas = await readSheet("metas");
    return res.json(metas);
  } catch {
    return res.status(500).json({ error: "Erro ao buscar metas." });
  }
});

router.post("/metas", async (req, res) => {
  try {
    const { setor, categoria, meta_volume, mes_referencia, peso } = req.body;
    if (!setor || !categoria || !meta_volume || !mes_referencia) {
      return res.status(400).json({ error: "Campos obrigatórios: setor, categoria, meta_volume, mes_referencia." });
    }
    await appendRow("metas", [setor, categoria, meta_volume, mes_referencia, peso || "", "", ""]);
    return res.json({ success: true, message: "Meta cadastrada." });
  } catch {
    return res.status(500).json({ error: "Erro ao cadastrar meta." });
  }
});

router.post("/metas/import", async (req, res) => {
  try {
    const { metas } = req.body;
    if (!Array.isArray(metas) || metas.length === 0) {
      return res.status(400).json({ error: "Envie um array de metas." });
    }
    const erros = [];
    const linhasValidas = [];
    for (const m of metas) {
      if (!m.setor || !m.categoria || !m.meta_volume || !m.mes_referencia) {
        erros.push(`Linha inválida: ${JSON.stringify(m)}`);
        continue;
      }
      linhasValidas.push([m.setor, m.categoria, m.meta_volume, m.mes_referencia, m.peso || "", m.volume_tri || "", m.meta_aplicada || ""]);
    }
    if (linhasValidas.length > 0) {
      // UPSERT: se a meta (setor+categoria+mês) já existe, atualiza; senão insere.
      // Assim é possível reimportar o mês sem estourar violação de PK (metas_pkey).
      await upsertRows("metas", linhasValidas, ["setor", "categoria", "mes_referencia"]);
    }
    return res.json({ success: true, importadas: linhasValidas.length, erros: erros.length > 0 ? erros : undefined });
  } catch (err) {
    console.error("metas/import:", err);
    return res.status(500).json({ error: `Erro ao importar metas: ${err.message || err}` });
  }
});

// ─── PRODUTOS BASE ───────────────────────────────────────────────────────────

// NOTA: a rota GET /api/admin/produtos é servida por routes/produtos.js
// (retorna a base completa, incluindo a coluna 'categorias'). Não definir
// aqui um /produtos — senão ele sombreia a rota real e remove as categorias.

// ─── CONFIG ──────────────────────────────────────────────────────────────────

router.get("/config", async (req, res) => {
  return res.json({
    maintenance_start: process.env.MAINTENANCE_START,
    maintenance_end: process.env.MAINTENANCE_END,
    sheet_id: process.env.GOOGLE_SHEET_ID,
    admin_whatsapp: process.env.ADMIN_WHATSAPP,
  });
});

// POST /api/admin/cache/limpar — força limpeza do cache do servidor
router.post("/cache/limpar", (req, res) => {
  cacheClearAll();
  return res.json({ success: true, message: "Cache limpo. Próximas requisições buscam dados frescos." });
});

module.exports = router;
