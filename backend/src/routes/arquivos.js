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

const uploadFields = upload.fields([{ name: "clientes" }, { name: "pedidos" }, { name: "tasks" }, { name: "inadimplencia" }, { name: "devolucoes" }, { name: "grade" }, { name: "faturados" }, { name: "buffer" }, { name: "produtos_base" }, { name: "faturamento_mktp" }, { name: "pontos_bees" }, { name: "spo_visitacao_gv" }, { name: "spo_coaching" }, { name: "spo_dto" }, { name: "spo_promo" }, { name: "spo_score5" }, { name: "spo_alone" }, { name: "spo_rgb" }, { name: "spo_cupons" }, { name: "spo_loja_ideal" }, { name: "spo_scanntech" }, { name: "spo_portfolio_ideal" }, { name: "spo_ap" }, { name: "spo_rotina_mais" }, { name: "rota_efetiva" }]);

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

      // Mês de referência explícito — o processador usa em relatórios sem coluna de data
      const mesRef = req.body?.mes_ref || "";
      if (mesRef) console.log("Mês de referência:", mesRef);

      // Campos repassados ao processador (mesmos nomes do uploadFields acima)
      const CAMPOS = [
        "clientes", "pedidos", "spo_promo", "spo_dto", "spo_coaching", "spo_visitacao_gv",
        "faturamento_mktp", "pontos_bees", "produtos_base", "tasks", "spo_alone", "spo_ap",
        "spo_portfolio_ideal", "spo_scanntech", "spo_loja_ideal", "spo_cupons", "spo_rgb",
        "inadimplencia", "devolucoes", "grade", "faturados", "buffer",
        "spo_rotina_mais", "spo_score5", "rota_efetiva",
      ];
      // FormData é um STREAM: é consumido no envio. Cada tentativa monta um form NOVO
      // (os buffers dos arquivos continuam em memória — reutilizáveis).
      const montarForm = () => {
        const form = new FormData();
        if (mesRef) form.append("mes_ref", mesRef);
        for (const campo of CAMPOS) {
          const f = req.files?.[campo]?.[0];
          if (f) form.append(campo, f.buffer, { filename: f.originalname, contentType: f.mimetype });
        }
        return form;
      };

      // O Render (plano free) DORME o processador; ao acordar/redeployar a borda
      // responde 429/502/503/504 (ou a conexão cai) ANTES da requisição chegar ao app —
      // então é SEGURO retentar (e o processador é idempotente: sobrescreve por mês).
      // Até 5 tentativas com espera crescente (cobre cold start ~40-60s).
      const RETRIABLE = new Set([429, 502, 503, 504]);
      let response;
      for (let tentativa = 1; ; tentativa++) {
        try {
          const form = montarForm();
          response = await axios.post(`${PROCESSOR_URL}/api/processar/ambos`, form, {
            headers: {
              ...form.getHeaders(),
              "X-Processor-Token": PROCESSOR_TOKEN,
            },
            timeout: 290000, // 290s
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
          });
          break;
        } catch (errTent) {
          const st = errTent.response?.status;
          // Sem response (ECONNRESET/ECONNREFUSED/timeout) OU status de gateway = infra acordando.
          const infra = !errTent.response || RETRIABLE.has(st);
          if (infra && tentativa < 5) {
            const esperaMs = Math.min(tentativa * 20000, 60000); // 20s, 40s, 60s, 60s
            console.warn(`Processador indisponível (${st || errTent.code || "conn"}) — tentativa ${tentativa}/5; aguardando ${esperaMs / 1000}s (cold start)...`);
            await new Promise((r) => setTimeout(r, esperaMs));
            continue;
          }
          throw errTent;
        }
      }

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
      console.error("Erro ao chamar processador:", err.message,
        "| status:", err.response?.status,
        "| body:", String(typeof err.response?.data === "string" ? err.response.data : JSON.stringify(err.response?.data || "")).slice(0, 300));
      const status = err.response?.status;
      let msg = err.response?.data?.error;
      // 429/502/503/504 sem corpo JSON = infraestrutura (Render acordando/reiniciando),
      // não o processador. Propaga o status (o front reconhece cold start e re-tenta).
      const gateway = [429, 502, 503, 504].includes(status);
      if (!msg && gateway) {
        msg = `O processador está reiniciando/acordando (erro ${status} da infraestrutura, ` +
              "não do Google Sheets). Aguarde ~1-2 min e tente de novo.";
      }
      msg = msg || err.message || "Erro ao processar arquivos.";
      return res.status(gateway ? status : 500).json({ error: msg });
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
