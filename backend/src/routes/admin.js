// v2.4 - motivo no sku_foco + GET /produtos para auto-fill
const express = require("express");
const router = express.Router();
const { readSheet, appendRow, appendRows, updateRow, deleteRow, sobrescreverAba, ensureTab, cacheClearAll } = require("../services/sheets");
const { authMiddleware, adminOnly } = require("../middleware/auth");

const SKU_FOCO_HEADERS = ["setor","cod_produto","nome_produto","meta_mensal_hl","mes_referencia","motivo"];

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
    const linhasValidas = [];
    for (const m of metas) {
      if (!m.setor || !m.categoria || !m.meta_volume || !m.mes_referencia) {
        erros.push(`Linha inválida: ${JSON.stringify(m)}`);
        continue;
      }
      linhasValidas.push([m.setor, m.categoria, m.meta_volume, m.mes_referencia, m.peso || "", m.volume_tri || "", m.meta_aplicada || ""]);
    }
    if (linhasValidas.length > 0) {
      await appendRows("metas", linhasValidas);
    }
    return res.json({ success: true, importadas: linhasValidas.length, erros: erros.length > 0 ? erros : undefined });
  } catch (err) {
    console.error("metas/import:", err);
    return res.status(500).json({ error: `Erro ao importar metas: ${err.message || err}` });
  }
});

// ─── PRODUTOS BASE ───────────────────────────────────────────────────────────

// GET /api/admin/produtos — retorna lista de produtos para auto-fill de nome
router.get("/produtos", async (req, res) => {
  try {
    const produtos = await readSheet("produtos_base");
    return res.json(produtos.map((p) => ({ cod: String(p.cod || "").trim(), nome: String(p.nome || "").trim() })));
  } catch (err) {
    console.error("admin/produtos GET:", err);
    return res.status(500).json({ error: "Erro ao buscar produtos." });
  }
});

// ─── SKU FOCO ────────────────────────────────────────────────────────────────
// Usa sobrescreverAba em todas as mutações para garantir que o cabeçalho
// sempre exista corretamente, independente do estado da aba no Sheets.

async function skuFocoSobrescrever(lista) {
  const rows = [SKU_FOCO_HEADERS, ...lista.map((r) => SKU_FOCO_HEADERS.map((h) => r[h] ?? ""))];
  await sobrescreverAba("sku_foco", rows);
}

router.get("/sku-foco", async (req, res) => {
  try {
    await ensureTab("sku_foco");
    const dados = await readSheet("sku_foco");
    return res.json(dados);
  } catch (err) {
    console.error("sku-foco GET:", err);
    return res.status(500).json({ error: "Erro ao buscar SKU Foco." });
  }
});

router.post("/sku-foco", async (req, res) => {
  try {
    const { setor, cod_produto, nome_produto, meta_mensal_hl, mes_referencia, motivo } = req.body;
    if (!setor || !cod_produto || !nome_produto || !meta_mensal_hl || !mes_referencia) {
      return res.status(400).json({ error: "Campos obrigatórios: setor, cod_produto, nome_produto, meta_mensal_hl, mes_referencia." });
    }
    await ensureTab("sku_foco");
    const existentes = await readSheet("sku_foco");
    const nova = { setor, cod_produto, nome_produto, meta_mensal_hl, mes_referencia, motivo: motivo || "" };
    await skuFocoSobrescrever([...existentes, nova]);
    return res.json({ success: true, message: "SKU Foco cadastrado." });
  } catch (err) {
    console.error("sku-foco POST:", err);
    return res.status(500).json({ error: `Erro ao cadastrar SKU Foco: ${err.message || err}` });
  }
});

router.delete("/sku-foco/:idx", async (req, res) => {
  try {
    const idx = parseInt(req.params.idx, 10);
    if (isNaN(idx) || idx < 0) return res.status(400).json({ error: "Índice inválido." });
    await ensureTab("sku_foco");
    const dados = await readSheet("sku_foco");
    if (idx >= dados.length) return res.status(404).json({ error: "SKU Foco não encontrado." });
    dados.splice(idx, 1);
    await skuFocoSobrescrever(dados);
    return res.json({ success: true });
  } catch (err) {
    console.error("sku-foco DELETE:", err);
    return res.status(500).json({ error: "Erro ao remover SKU Foco." });
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

// POST /api/admin/cache/limpar — força limpeza do cache do servidor
router.post("/cache/limpar", (req, res) => {
  cacheClearAll();
  return res.json({ success: true, message: "Cache limpo. Próximas requisições buscam dados frescos." });
});

module.exports = router;
