const express = require("express");
const router = express.Router();
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { readSheet, appendRow, updateRow } = require("../services/sheets");
const { authMiddleware, adminOnly } = require("../middleware/auth");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB

router.use(authMiddleware);

function gerarId() {
  return Date.now().toString(36).toUpperCase();
}

// POST /api/incidentes — RN abre um incidente
router.post("/", upload.single("evidencia"), async (req, res) => {
  try {
    const { descricao, data_ocorrido } = req.body;

    if (!descricao?.trim()) return res.status(400).json({ error: "Descrição obrigatória." });
    if (!req.file) return res.status(400).json({ error: "Evidência obrigatória." });

    // Upload para Cloudinary
    const resultado = await new Promise((resolve, reject) => {
      const resourceType = req.file.mimetype.startsWith("video") ? "video" : "image";
      const stream = cloudinary.uploader.upload_stream(
        { folder: "cmd-conde/incidentes", resource_type: resourceType },
        (error, result) => error ? reject(error) : resolve(result)
      );
      stream.end(req.file.buffer);
    });

    const id = gerarId();
    const criado_em = new Date().toLocaleString("pt-BR");
    const data = data_ocorrido || new Date().toISOString().split("T")[0];

    // Ordem: data_criacao | id | setor | nome_rn | descricao | evidencia_url | status | resposta | finalizado_em | data_ocorrido | perfil_rn
    await appendRow("incidentes", [
      criado_em,
      id,
      req.user.cod,
      req.user.nome,
      descricao.trim(),
      resultado.secure_url,
      "Aguardando",
      "",
      "",
      data,
      req.user.perfil,
    ]);

    return res.json({ success: true, message: "Solicitação registrada com sucesso." });
  } catch (err) {
    console.error("Erro ao criar incidente:", err);
    return res.status(500).json({ error: "Erro ao registrar incidente." });
  }
});

// GET /api/incidentes/meus — RN vê seus próprios incidentes
router.get("/meus", async (req, res) => {
  try {
    const todos = await readSheet("incidentes");
    const meus = todos
      .filter((i) => String(i.cod_rn) === String(req.user.cod))
      .sort((a, b) => b.criado_em?.localeCompare(a.criado_em));
    return res.json(meus);
  } catch (err) {
    return res.status(500).json({ error: "Erro ao buscar incidentes." });
  }
});

// GET /api/incidentes — Admin vê todos
router.get("/", async (req, res) => {
  try {
    const todos = await readSheet("incidentes");
    // Gestor vê tudo, RN vê só os seus
    const isGestor = ["admin", "director", "gv1", "gv3"].includes(req.user.perfil);
    const lista = isGestor ? todos : todos.filter((i) => String(i.cod_rn) === String(req.user.cod));
    return res.json(lista.sort((a, b) => b.criado_em?.localeCompare(a.criado_em)));
  } catch (err) {
    return res.status(500).json({ error: "Erro ao buscar incidentes." });
  }
});

// GET /api/incidentes/pendentes — conta pendentes para o sininho
router.get("/pendentes", async (req, res) => {
  try {
    const todos = await readSheet("incidentes");
    const pendentes = todos.filter((i) => i.status === "Aguardando").length;
    return res.json({ pendentes });
  } catch {
    return res.json({ pendentes: 0 });
  }
});

// POST /api/incidentes/:id/responder — Admin responde
router.post("/:id/responder", adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { resposta } = req.body;

    if (!resposta?.trim()) return res.status(400).json({ error: "Resposta obrigatória." });

    const todos = await readSheet("incidentes");
    const idx = todos.findIndex((i) => i.id === id);
    if (idx === -1) return res.status(404).json({ error: "Incidente não encontrado." });

    const inc = todos[idx];
    const respondido_em = new Date().toLocaleString("pt-BR");

    // Mesma ordem: data_criacao | id | setor | nome_rn | descricao | evidencia_url | status | resposta | finalizado_em | data_ocorrido | perfil_rn
    const updated = [
      inc.data_criacao || inc.criado_em,
      inc.id,
      inc.setor || inc.cod_rn,
      inc.nome_rn,
      inc.descricao,
      inc.evidencia_url,
      "Respondido",
      resposta.trim(),
      respondido_em,
      inc.data_ocorrido,
      inc.perfil_rn,
    ];

    await updateRow("incidentes", idx + 1, updated);
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao responder incidente." });
  }
});

module.exports = router;
