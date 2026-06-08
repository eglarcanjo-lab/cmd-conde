// Avisos — central de ajuda/avisos contextual (botão "?" em todas as telas).
// Avisos "geral" aparecem em qualquer tela; avisos com uma "tela" só naquela rota.
const express = require("express");
const router = express.Router();
const { readSheet, sobrescreverAba, ensureTab } = require("../services/sheets");
const { authMiddleware, adminOnly } = require("../middleware/auth");

router.use(authMiddleware);

const HEADERS = ["id", "tela", "titulo", "mensagem", "tipo", "publico_alvo", "ativo", "ordem", "criado_em"];
const SET_OFF = new Set(["101", "102", "103"]);

const gerarId = () => "A" + Date.now().toString(36).toUpperCase();
const isTrue = (v) => { const s = String(v).trim().toLowerCase(); return s === "true" || s === "1" || s === "sim"; };

function podeVer(user, alvo) {
  const perfil = String(user.perfil || "").toLowerCase();
  if (["admin", "director", "gv1", "gv3"].includes(perfil)) return true;
  const cod = String(user.cod || "").trim();
  const a = String(alvo || "todos").trim().toLowerCase();
  if (a === "" || a === "todos") return true;
  if (a === "off") return SET_OFF.has(cod);
  if (a === "on") return !SET_OFF.has(cod);
  return a.split(",").map((s) => s.trim()).includes(cod);
}

async function gravar(lista) {
  await sobrescreverAba("avisos", [HEADERS, ...lista.map((r) => HEADERS.map((h) => r[h] ?? ""))]);
}

// GET /api/avisos?tela=/volume-diario — avisos ativos da tela + os "geral"
router.get("/", async (req, res) => {
  try {
    await ensureTab("avisos");
    const tela = String(req.query.tela || "").trim();
    const todos = await readSheet("avisos").catch(() => []);
    const visiveis = todos
      .filter((a) => isTrue(a.ativo))
      .filter((a) => {
        const t = String(a.tela || "geral").trim().toLowerCase();
        return t === "geral" || t === "" || t === tela.toLowerCase();
      })
      .filter((a) => podeVer(req.user, a.publico_alvo))
      .sort((a, b) => (parseInt(a.ordem) || 99) - (parseInt(b.ordem) || 99))
      .map((a) => ({ id: a.id, tela: a.tela, titulo: a.titulo, mensagem: a.mensagem, tipo: a.tipo || "info" }));
    return res.json(visiveis);
  } catch (err) {
    console.error("avisos GET:", err);
    return res.json([]);
  }
});

// ─── ADMIN ───────────────────────────────────────────────────────────────────
router.get("/admin/all", adminOnly, async (req, res) => {
  try {
    await ensureTab("avisos");
    const todos = await readSheet("avisos").catch(() => []);
    return res.json(todos.sort((a, b) => (parseInt(a.ordem) || 99) - (parseInt(b.ordem) || 99)));
  } catch (err) {
    console.error("avisos admin/all:", err);
    return res.status(500).json({ error: "Erro ao buscar avisos." });
  }
});

router.post("/admin", adminOnly, async (req, res) => {
  try {
    const b = req.body || {};
    if (!String(b.mensagem || "").trim()) return res.status(400).json({ error: "Escreva a mensagem do aviso." });
    await ensureTab("avisos");
    const existentes = await readSheet("avisos").catch(() => []);
    const novo = {
      id: gerarId(),
      tela: b.tela || "geral",
      titulo: b.titulo || "",
      mensagem: b.mensagem || "",
      tipo: b.tipo || "info",
      publico_alvo: b.publico_alvo || "todos",
      ativo: b.ativo === false || b.ativo === "false" ? "false" : "true",
      ordem: b.ordem || "1",
      criado_em: new Date().toISOString(),
    };
    await gravar([...existentes, novo]);
    return res.json({ success: true, aviso: novo });
  } catch (err) {
    console.error("avisos POST:", err);
    return res.status(500).json({ error: "Erro ao criar aviso." });
  }
});

router.put("/admin/:id", adminOnly, async (req, res) => {
  try {
    const id = String(req.params.id).trim();
    const existentes = await readSheet("avisos").catch(() => []);
    const idx = existentes.findIndex((a) => String(a.id).trim() === id);
    if (idx === -1) return res.status(404).json({ error: "Aviso não encontrado." });
    const b = req.body || {};
    existentes[idx] = {
      ...existentes[idx],
      tela: b.tela ?? existentes[idx].tela,
      titulo: b.titulo ?? existentes[idx].titulo,
      mensagem: b.mensagem ?? existentes[idx].mensagem,
      tipo: b.tipo ?? existentes[idx].tipo,
      publico_alvo: b.publico_alvo ?? existentes[idx].publico_alvo,
      ativo: b.ativo !== undefined ? (isTrue(b.ativo) ? "true" : "false") : existentes[idx].ativo,
      ordem: b.ordem ?? existentes[idx].ordem,
    };
    await gravar(existentes);
    return res.json({ success: true });
  } catch (err) {
    console.error("avisos PUT:", err);
    return res.status(500).json({ error: "Erro ao editar aviso." });
  }
});

router.delete("/admin/:id", adminOnly, async (req, res) => {
  try {
    const id = String(req.params.id).trim();
    const existentes = await readSheet("avisos").catch(() => []);
    await gravar(existentes.filter((a) => String(a.id).trim() !== id));
    return res.json({ success: true });
  } catch (err) {
    console.error("avisos DELETE:", err);
    return res.status(500).json({ error: "Erro ao remover aviso." });
  }
});

module.exports = router;
