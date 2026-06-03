// Popups — caixas de imagem (artes) exibidas 1x/dia no app, geridas pelo admin
const express = require("express");
const router = express.Router();
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { readSheet, sobrescreverAba, ensureTab } = require("../services/sheets");
const { authMiddleware, adminOnly } = require("../middleware/auth");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } }); // 25MB

router.use(authMiddleware);

const POPUP_HEADERS = ["id","titulo","imagem_url","ativo","data_inicio","data_fim","acao_tipo","acao_valor","publico_alvo","ordem","criado_em"];
const SET_OFF = new Set(["101","102","103"]);

function gerarId() { return "P" + Date.now().toString(36).toUpperCase(); }
function isTrue(v) { const s = String(v).trim().toLowerCase(); return s === "true" || s === "1" || s === "sim"; }
function parseDataISO(s) {
  if (!s || !/^\d{4}-\d{2}-\d{2}/.test(String(s))) return null;
  const [y, m, d] = String(s).slice(0, 10).split("-");
  const dt = new Date(Number(y), Number(m) - 1, Number(d));
  return isNaN(dt.getTime()) ? null : dt;
}
function podeVer(user, alvo) {
  const perfil = String(user.perfil || "").toLowerCase();
  if (["admin", "director", "gv1", "gv3"].includes(perfil)) return true;
  const cod = String(user.cod || "").trim();
  const a = String(alvo || "todos").trim().toLowerCase();
  if (a === "" || a === "todos") return true;
  if (a === "off") return SET_OFF.has(cod);
  if (a === "on")  return !SET_OFF.has(cod);
  return a.split(",").map((s) => s.trim()).includes(cod);
}

async function sobrescreverPopups(lista) {
  await sobrescreverAba("popups", [POPUP_HEADERS, ...lista.map((r) => POPUP_HEADERS.map((h) => r[h] ?? ""))]);
}

function cloudinaryConfigurado() {
  return !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
}

function uploadCloudinary(buffer, mimetype) {
  return new Promise((resolve, reject) => {
    const resourceType = mimetype?.startsWith("video") ? "video" : "image";
    const stream = cloudinary.uploader.upload_stream(
      { folder: "cmd-conde/popups", resource_type: resourceType, timeout: 60000 },
      (error, result) => (error ? reject(error) : resolve(result))
    );
    stream.end(buffer);
  });
}

// ─── PÚBLICO ─────────────────────────────────────────────────────────────────

// GET /api/popups/ativos — popups ativos visíveis ao usuário hoje
router.get("/ativos", async (req, res) => {
  try {
    await ensureTab("popups");
    const todos = await readSheet("popups").catch(() => []);
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const visiveis = todos
      .filter((p) => isTrue(p.ativo) && p.imagem_url)
      .filter((p) => {
        const ini = parseDataISO(p.data_inicio);
        const fim = parseDataISO(p.data_fim);
        if (ini && hoje < ini) return false;
        if (fim && hoje > fim) return false;
        return true;
      })
      .filter((p) => podeVer(req.user, p.publico_alvo))
      .sort((a, b) => (parseInt(a.ordem) || 99) - (parseInt(b.ordem) || 99));
    return res.json(visiveis);
  } catch (err) {
    console.error("popups ativos:", err);
    return res.json([]);
  }
});

// ─── ADMIN ───────────────────────────────────────────────────────────────────

router.get("/admin/all", adminOnly, async (req, res) => {
  try {
    await ensureTab("popups");
    const todos = await readSheet("popups").catch(() => []);
    return res.json(todos.sort((a, b) => (parseInt(a.ordem) || 99) - (parseInt(b.ordem) || 99)));
  } catch (err) {
    console.error("popups admin/all:", err);
    return res.status(500).json({ error: "Erro ao buscar popups." });
  }
});

// POST /api/popups/admin — cria (com upload de imagem)
router.post("/admin", adminOnly, upload.single("imagem"), async (req, res) => {
  try {
    const b = req.body || {};
    if (!req.file && !b.imagem_url) return res.status(400).json({ error: "Envie a imagem do popup." });
    if (req.file && !cloudinaryConfigurado()) {
      return res.status(500).json({ error: "Upload de imagem indisponível: Cloudinary não configurado no servidor (CLOUDINARY_*)." });
    }

    let imagemUrl = b.imagem_url || "";
    if (req.file) {
      const r = await uploadCloudinary(req.file.buffer, req.file.mimetype);
      imagemUrl = r.secure_url;
    }

    await ensureTab("popups");
    const existentes = await readSheet("popups").catch(() => []);
    const novo = {
      id: gerarId(),
      titulo: b.titulo || "",
      imagem_url: imagemUrl,
      ativo: b.ativo === "false" ? "false" : "true",
      data_inicio: b.data_inicio || "",
      data_fim: b.data_fim || "",
      acao_tipo: b.acao_tipo || "nenhuma", // nenhuma | rota | link
      acao_valor: b.acao_valor || "",
      publico_alvo: b.publico_alvo || "todos",
      ordem: b.ordem || "1",
      criado_em: new Date().toISOString(),
    };
    await sobrescreverPopups([...existentes, novo]);
    return res.json({ success: true, popup: novo });
  } catch (err) {
    console.error("popups POST:", err);
    return res.status(500).json({ error: `Erro ao criar popup: ${err.message}` });
  }
});

// PUT /api/popups/admin/:id — edita (imagem opcional)
router.put("/admin/:id", adminOnly, upload.single("imagem"), async (req, res) => {
  try {
    const id = String(req.params.id).trim();
    const existentes = await readSheet("popups").catch(() => []);
    const idx = existentes.findIndex((p) => String(p.id).trim() === id);
    if (idx === -1) return res.status(404).json({ error: "Popup não encontrado." });

    const b = req.body || {};
    if (req.file && !cloudinaryConfigurado()) {
      return res.status(500).json({ error: "Upload de imagem indisponível: Cloudinary não configurado no servidor (CLOUDINARY_*)." });
    }
    let imagemUrl = existentes[idx].imagem_url;
    if (req.file) {
      const r = await uploadCloudinary(req.file.buffer, req.file.mimetype);
      imagemUrl = r.secure_url;
    } else if (b.imagem_url) {
      imagemUrl = b.imagem_url;
    }

    existentes[idx] = {
      ...existentes[idx],
      titulo: b.titulo ?? existentes[idx].titulo,
      imagem_url: imagemUrl,
      ativo: b.ativo !== undefined ? (isTrue(b.ativo) ? "true" : "false") : existentes[idx].ativo,
      data_inicio: b.data_inicio ?? existentes[idx].data_inicio,
      data_fim: b.data_fim ?? existentes[idx].data_fim,
      acao_tipo: b.acao_tipo ?? existentes[idx].acao_tipo,
      acao_valor: b.acao_valor ?? existentes[idx].acao_valor,
      publico_alvo: b.publico_alvo ?? existentes[idx].publico_alvo,
      ordem: b.ordem ?? existentes[idx].ordem,
    };
    await sobrescreverPopups(existentes);
    return res.json({ success: true });
  } catch (err) {
    console.error("popups PUT:", err);
    return res.status(500).json({ error: "Erro ao editar popup." });
  }
});

// DELETE /api/popups/admin/:id
router.delete("/admin/:id", adminOnly, async (req, res) => {
  try {
    const id = String(req.params.id).trim();
    const existentes = await readSheet("popups").catch(() => []);
    await sobrescreverPopups(existentes.filter((p) => String(p.id).trim() !== id));
    return res.json({ success: true });
  } catch (err) {
    console.error("popups DELETE:", err);
    return res.status(500).json({ error: "Erro ao remover popup." });
  }
});

module.exports = router;
