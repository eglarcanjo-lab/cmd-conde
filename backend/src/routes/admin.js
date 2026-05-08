const express = require("express");
const router = express.Router();
const { readSheet, appendRow, updateRow } = require("../services/sheets");
const { authMiddleware, adminOnly } = require("../middleware/auth");

// Todos os endpoints admin exigem auth + perfil admin
router.use(authMiddleware, adminOnly);

// ─── USUÁRIOS ───────────────────────────────────────────────────────────────

// GET /api/admin/usuarios
router.get("/usuarios", async (req, res) => {
  try {
    const usuarios = await readSheet("usuarios");
    return res.json(usuarios);
  } catch (err) {
    return res.status(500).json({ error: "Erro ao buscar usuários." });
  }
});

// POST /api/admin/usuarios — cadastra novo usuário
router.post("/usuarios", async (req, res) => {
  try {
    const { cod, nome, telefone, perfil, gv } = req.body;

    if (!cod || !nome || !telefone || !perfil) {
      return res.status(400).json({ error: "Campos obrigatórios: cod, nome, telefone, perfil." });
    }

    // Verifica duplicidade
    const existentes = await readSheet("usuarios");
    if (existentes.find((u) => u.cod === String(cod))) {
      return res.status(409).json({ error: "Código já cadastrado." });
    }
    if (existentes.find((u) => u.telefone?.replace(/\D/g, "") === telefone.replace(/\D/g, ""))) {
      return res.status(409).json({ error: "Telefone já cadastrado." });
    }

    const criado_em = new Date().toISOString();
    await appendRow("usuarios", [cod, nome, telefone, perfil, gv || "", "true", criado_em]);

    return res.json({ success: true, message: "Usuário cadastrado com sucesso." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao cadastrar usuário." });
  }
});

// PUT /api/admin/usuarios/:cod — atualiza usuário
router.put("/usuarios/:cod", async (req, res) => {
  try {
    const { cod } = req.params;
    const { nome, telefone, perfil, gv, ativo } = req.body;

    const usuarios = await readSheet("usuarios");
    const idx = usuarios.findIndex((u) => u.cod === cod);

    if (idx === -1) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    const u = usuarios[idx];
    const updated = [
      cod,
      nome ?? u.nome,
      telefone ?? u.telefone,
      perfil ?? u.perfil,
      gv ?? u.gv,
      ativo !== undefined ? String(ativo) : u.ativo,
      u.criado_em,
    ];

    await updateRow("usuarios", idx + 1, updated); // +1 para pular cabeçalho
    return res.json({ success: true, message: "Usuário atualizado." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao atualizar usuário." });
  }
});

// ─── METAS ──────────────────────────────────────────────────────────────────

// GET /api/admin/metas
router.get("/metas", async (req, res) => {
  try {
    const metas = await readSheet("metas");
    return res.json(metas);
  } catch (err) {
    return res.status(500).json({ error: "Erro ao buscar metas." });
  }
});

// POST /api/admin/metas — cadastra meta individual
router.post("/metas", async (req, res) => {
  try {
    const { setor, categoria, meta_volume, mes_referencia, peso } = req.body;

    if (!setor || !categoria || !meta_volume || !mes_referencia) {
      return res.status(400).json({ error: "Campos obrigatórios: setor, categoria, meta_volume, mes_referencia." });
    }

    await appendRow("metas", [setor, categoria, meta_volume, mes_referencia, peso || ""]);
    return res.json({ success: true, message: "Meta cadastrada." });
  } catch (err) {
    return res.status(500).json({ error: "Erro ao cadastrar meta." });
  }
});

// POST /api/admin/metas/import — importa planilha de metas
router.post("/metas/import", async (req, res) => {
  try {
    const { metas } = req.body; // Array de objetos: [{ setor, categoria, meta_volume, mes_referencia, peso }]

    if (!Array.isArray(metas) || metas.length === 0) {
      return res.status(400).json({ error: "Envie um array de metas." });
    }

    const erros = [];
    let importadas = 0;

    for (const m of metas) {
      if (!m.setor || !m.categoria || !m.meta_volume || !m.mes_referencia) {
        erros.push(`Linha inválida: ${JSON.stringify(m)}`);
        continue;
      }
      await appendRow("metas", [m.setor, m.categoria, m.meta_volume, m.mes_referencia, m.peso || ""]);
      importadas++;
    }

    return res.json({
      success: true,
      importadas,
      erros: erros.length > 0 ? erros : undefined,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao importar metas." });
  }
});

// ─── CONFIGURAÇÕES ──────────────────────────────────────────────────────────

// GET /api/admin/config
router.get("/config", async (req, res) => {
  return res.json({
    maintenance_start: process.env.MAINTENANCE_START,
    maintenance_end: process.env.MAINTENANCE_END,
    sheet_id: process.env.GOOGLE_SHEET_ID,
    admin_whatsapp: process.env.ADMIN_WHATSAPP,
  });
});

module.exports = router;
