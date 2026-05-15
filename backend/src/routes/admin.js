// v2.1 - fix importacao metas
const express = require("express");
const router = express.Router();
const { readSheet, appendRow, updateRow } = require("../services/sheets");
const { authMiddleware, adminOnly } = require("../middleware/auth");

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
    if (existentes.find((u) => u.cod === String(cod))) {
      return res.status(409).json({ error: "Código já cadastrado." });
    }
    if (existentes.find((u) => u.cpf?.replace(/\D/g, "") === cpfLimpo)) {
      return res.status(409).json({ error: "CPF já cadastrado." });
    }

    const criado_em = new Date().toISOString();
    // Ordem: cod, nome, cpf, telefone, perfil, gv, ativo, senha, criado_em
    await appendRow("usuarios", [cod, nome, cpfLimpo, telefone?.replace(/\D/g, "") || "", perfil, gv || "", "true", "", criado_em]); // always lowercase true

    return res.json({ success: true, message: "Usuário cadastrado com sucesso." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao cadastrar usuário." });
  }
});

router.put("/usuarios/:cod", async (req, res) => {
  try {
    const { cod } = req.params;
    const { nome, cpf, telefone, perfil, gv, ativo, senha } = req.body;

    const usuarios = await readSheet("usuarios");
    const idx = usuarios.findIndex((u) => u.cod === cod);

    if (idx === -1) return res.status(404).json({ error: "Usuário não encontrado." });

    const u = usuarios[idx];
    const updated = [
      cod,
      nome ?? u.nome,
      cpf?.replace(/\D/g, "") ?? u.cpf,
      telefone?.replace(/\D/g, "") ?? u.telefone,
      perfil ?? u.perfil,
      gv ?? u.gv,
      ativo !== undefined ? String(ativo) : u.ativo,
      senha !== undefined && senha !== "" ? senha : u.senha,
      u.criado_em,
    ];

    await updateRow("usuarios", idx + 1, updated);
    return res.json({ success: true, message: "Usuário atualizado." });
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
    let importadas = 0;
    for (const m of metas) {
      if (!m.setor || !m.categoria || !m.meta_volume || !m.mes_referencia) {
        erros.push(`Linha inválida: ${JSON.stringify(m)}`);
        continue;
      }
      await appendRow("metas", [m.setor, m.categoria, m.meta_volume, m.mes_referencia, m.peso || "", m.volume_tri || "", m.meta_aplicada || ""]);
      importadas++;
    }
    return res.json({ success: true, importadas, erros: erros.length > 0 ? erros : undefined });
  } catch (err) {
    return res.status(500).json({ error: "Erro ao importar metas." });
  }
});

// ─── CONFIG ──────────────────────────────────────────────────────────────────

router.get("/config", async (req, res) => {
  return res.json({
    maintenance_start: process.env.MAINTENANCE_START,
    maintenance_end: process.env.MAINTENANCE_END,
    sheet_id: process.env.GOOGLE_SHEET_ID,
    admin_whatsapp: process.env.ADMIN_WHATSAPP,
  });
});

module.exports = router;
