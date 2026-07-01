// v2.4 - spo visitacao gv
const express = require("express");
const router = express.Router();
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const { authMiddleware, adminOnly } = require("../middleware/auth");
const { cacheClearAll } = require("../services/sheets");

const MAX_FILE_MB = 200;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_MB * 1024 * 1024 } });

const PROCESSOR_URL = process.env.PROCESSOR_URL || "http://localhost:5000";
const PROCESSOR_TOKEN = process.env.PROCESSOR_TOKEN; // sem default fixo (D2 da Auditoria 2)

router.use(authMiddleware, adminOnly);

const uploadFields = upload.fields([{ name: "clientes" }, { name: "pedidos" }, { name: "tasks" }, { name: "inadimplencia" }, { name: "devolucoes" }, { name: "grade" }, { name: "faturados" }, { name: "buffer" }, { name: "produtos_base" }, { name: "faturamento_mktp" }, { name: "pontos_bees" }, { name: "spo_visitacao_gv" }, { name: "spo_coaching" }, { name: "spo_dto" }, { name: "spo_promo" }, { name: "spo_score5" }, { name: "spo_alone" }, { name: "spo_rgb" }, { name: "spo_cupons" }, { name: "spo_loja_ideal" }, { name: "spo_scanntech" }, { name: "spo_portfolio_ideal" }, { name: "spo_ap" }]);

// Wrapper que captura erros do multer (ex: arquivo grande demais) com mensagem clara
function uploadHandler(req, res, next) {
  uploadFields(req, res, (err) => {
    if (err) {
      console.error("Erro no upload (multer):", err.code, err.message);
      if (err.code === "LIMIT_FILE_SIZE") return res.status(413).json({ error: `Arquivo muito grande (máximo ${MAX_FILE_MB}MB por arquivo).` });
      return res.status(400).json({ error: `Falha no upload do arquivo: ${err.message}` });
    }
    next();
  });
}

// POST /api/arquivos/processar — envia arquivos para o processador Python
router.post(
  "/processar",
  uploadHandler,
  async (req, res) => {
    try {
      console.log("Arquivos recebidos:", Object.keys(req.files || {}));
      const form = new FormData();

      // Passa o mês de referência explícito para o processador
      // O processador usará esse valor em relatórios sem coluna de data (visitação, score5, etc.)
      const mesRef = req.body?.mes_ref || "";
      if (mesRef) {
        form.append("mes_ref", mesRef);
        console.log("Mês de referência:", mesRef);
      }

      if (req.files?.clientes?.[0]) {
        const f = req.files.clientes[0];
        form.append("clientes", f.buffer, { filename: f.originalname, contentType: f.mimetype });
      }
      if (req.files?.pedidos?.[0]) {
        const f = req.files.pedidos[0];
        form.append("pedidos", f.buffer, { filename: f.originalname, contentType: f.mimetype });
      }
      if (req.files?.spo_promo?.[0]) {
        const f = req.files.spo_promo[0];
        form.append("spo_promo", f.buffer, { filename: f.originalname, contentType: f.mimetype });
      }
      if (req.files?.spo_dto?.[0]) {
        const f = req.files.spo_dto[0];
        form.append("spo_dto", f.buffer, { filename: f.originalname, contentType: f.mimetype });
      }
      if (req.files?.spo_coaching?.[0]) {
        const f = req.files.spo_coaching[0];
        form.append("spo_coaching", f.buffer, { filename: f.originalname, contentType: f.mimetype });
      }
      if (req.files?.spo_visitacao_gv?.[0]) {
        const f = req.files.spo_visitacao_gv[0];
        form.append("spo_visitacao_gv", f.buffer, { filename: f.originalname, contentType: f.mimetype });
      }
      if (req.files?.faturamento_mktp?.[0]) {
        const f = req.files.faturamento_mktp[0];
        form.append("faturamento_mktp", f.buffer, { filename: f.originalname, contentType: f.mimetype });
      }
      if (req.files?.pontos_bees?.[0]) {
        const f = req.files.pontos_bees[0];
        form.append("pontos_bees", f.buffer, { filename: f.originalname, contentType: f.mimetype });
      }
      if (req.files?.produtos_base?.[0]) {
        const f = req.files.produtos_base[0];
        form.append("produtos_base", f.buffer, { filename: f.originalname, contentType: f.mimetype });
      }
      if (req.files?.tasks?.[0]) {
        const f = req.files.tasks[0];
        form.append("tasks", f.buffer, { filename: f.originalname, contentType: f.mimetype });
      }
      if (req.files?.spo_alone?.[0]) {
        const f = req.files.spo_alone[0];
        form.append("spo_alone", f.buffer, { filename: f.originalname, contentType: f.mimetype });
      }
      if (req.files?.spo_ap?.[0]) {
        const f = req.files.spo_ap[0];
        form.append("spo_ap", f.buffer, { filename: f.originalname, contentType: f.mimetype });
      }
      if (req.files?.spo_portfolio_ideal?.[0]) {
        const f = req.files.spo_portfolio_ideal[0];
        form.append("spo_portfolio_ideal", f.buffer, { filename: f.originalname, contentType: f.mimetype });
      }
      if (req.files?.spo_scanntech?.[0]) {
        const f = req.files.spo_scanntech[0];
        form.append("spo_scanntech", f.buffer, { filename: f.originalname, contentType: f.mimetype });
      }
      if (req.files?.spo_loja_ideal?.[0]) {
        const f = req.files.spo_loja_ideal[0];
        form.append("spo_loja_ideal", f.buffer, { filename: f.originalname, contentType: f.mimetype });
      }
      if (req.files?.spo_cupons?.[0]) {
        const f = req.files.spo_cupons[0];
        form.append("spo_cupons", f.buffer, { filename: f.originalname, contentType: f.mimetype });
      }
      if (req.files?.spo_rgb?.[0]) {
        const f = req.files.spo_rgb[0];
        form.append("spo_rgb", f.buffer, { filename: f.originalname, contentType: f.mimetype });
      }
      if (req.files?.inadimplencia?.[0]) {
        const f = req.files.inadimplencia[0];
        form.append("inadimplencia", f.buffer, { filename: f.originalname, contentType: f.mimetype });
      }
      if (req.files?.devolucoes?.[0]) {
        const f = req.files.devolucoes[0];
        form.append("devolucoes", f.buffer, { filename: f.originalname, contentType: f.mimetype });
      }
      if (req.files?.grade?.[0]) {
        const f = req.files.grade[0];
        form.append("grade", f.buffer, { filename: f.originalname, contentType: f.mimetype });
      }
      if (req.files?.faturados?.[0]) {
        const f = req.files.faturados[0];
        form.append("faturados", f.buffer, { filename: f.originalname, contentType: f.mimetype });
      }
      if (req.files?.buffer?.[0]) {
        const f = req.files.buffer[0];
        form.append("buffer", f.buffer, { filename: f.originalname, contentType: f.mimetype });
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

      // Limpa cache do servidor para que os dados novos sejam lidos imediatamente
      cacheClearAll();

      // Alertas de ruptura: roda em background após o import (não bloqueia a resposta).
      // Só em modo SQL (usa o Postgres). Erros não afetam o import.
      if (String(process.env.DATA_BACKEND || "").trim().toLowerCase() === "sql") {
        require("../services/alertas").rodar()
          .then((r) => r?.enviado && console.log("📧 Alertas enviados:", r.resumo))
          .catch((e) => console.error("Alertas (pós-import):", e.message));
      }

      return res.json(response.data);
    } catch (err) {
      console.error("Erro ao chamar processador:", err.message);
      const status = err.response?.status;
      let msg = err.response?.data?.error;
      if (!msg && status === 429) {
        msg = "Quota do Google Sheets excedida. Importe menos relatórios por vez e aguarde ~1 min.";
      }
      msg = msg || err.message || "Erro ao processar arquivos.";
      return res.status(status === 429 ? 429 : 500).json({ error: msg });
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
