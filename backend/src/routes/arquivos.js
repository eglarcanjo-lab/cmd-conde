const express = require("express");
const router = express.Router();
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const { authMiddleware, adminOnly } = require("../middleware/auth");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB

const PROCESSOR_URL = process.env.PROCESSOR_URL || "http://localhost:5000";
const PROCESSOR_TOKEN = process.env.PROCESSOR_TOKEN || "cmd_processor_secret";

router.use(authMiddleware, adminOnly);

// POST /api/arquivos/processar — envia arquivos para o processador Python
router.post(
  "/processar",
  upload.fields([{ name: "clientes" }, { name: "pedidos" }, { name: "tasks" }, { name: "inadimplencia" }]),
  async (req, res) => {
    try {
      const form = new FormData();

      if (req.files?.clientes?.[0]) {
        const f = req.files.clientes[0];
        form.append("clientes", f.buffer, { filename: f.originalname, contentType: f.mimetype });
      }
      if (req.files?.pedidos?.[0]) {
        const f = req.files.pedidos[0];
        form.append("pedidos", f.buffer, { filename: f.originalname, contentType: f.mimetype });
      }

      const response = await axios.post(`${PROCESSOR_URL}/api/processar/ambos`, form, {
        headers: {
          ...form.getHeaders(),
          "X-Processor-Token": PROCESSOR_TOKEN,
        },
        timeout: 290000, // 290s
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      return res.json(response.data);
    } catch (err) {
      console.error("Erro ao chamar processador:", err.message);
      const msg = err.response?.data?.error || err.message || "Erro ao processar arquivos.";
      return res.status(500).json({ error: msg });
    }
  }
);

// GET /api/arquivos/status — retorna status de cada arquivo
router.get("/status", async (req, res) => {
  try {
    const response = await axios.get(`${PROCESSOR_URL}/api/status-arquivos`, {
      headers: { "X-Processor-Token": PROCESSOR_TOKEN },
      timeout: 15000,
    });
    return res.json(response.data);
  } catch (err) {
    return res.json([]); // silencioso se processor offline
  }
});

// GET /api/arquivos/sem-categoria — produtos sem categoria
router.get("/sem-categoria", async (req, res) => {
  try {
    const response = await axios.get(`${PROCESSOR_URL}/api/produtos-sem-categoria`, {
      headers: { "X-Processor-Token": PROCESSOR_TOKEN },
      timeout: 15000,
    });
    return res.json(response.data);
  } catch (err) {
    return res.json([]);
  }
});

module.exports = router;
