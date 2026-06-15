const express = require("express");
const router = express.Router();
const axios = require("axios");
const { readSheet, appendRow } = require("../services/sheets");
const { authMiddleware, adminOnly } = require("../middleware/auth");

const PROCESSOR_URL = process.env.PROCESSOR_URL;
const PROCESSOR_TOKEN = process.env.PROCESSOR_TOKEN;

router.use(authMiddleware);

function filtrarPorPerfil(dados, usuario, campoSetor = "setor") {
  if (["admin", "director"].includes(usuario.perfil)) return dados;
  if (usuario.perfil === "gv1") return dados.filter((r) => String(r[campoSetor]).startsWith("1"));
  if (usuario.perfil === "gv3") return dados.filter((r) => String(r[campoSetor]).startsWith("3"));
  return dados.filter((r) => String(r[campoSetor]) === String(usuario.cod));
}

// GET /api/rv?mes=YYYY-MM — volumes/resultado do mês selecionado
router.get("/", async (req, res) => {
  try {
    const { mes } = req.query;
    const dados = await readSheet("rv_resultado");
    const filtrado = mes ? dados.filter((r) => String(r.mes_referencia) === mes) : dados;
    return res.json(filtrarPorPerfil(filtrado, req.user));
  } catch {
    return res.json([]);
  }
});

// GET /api/rv/pontos?mes=YYYY-MM
router.get("/pontos", async (req, res) => {
  try {
    const { mes } = req.query;
    const dados = await readSheet("rv_pontos_bees");
    const filtrado = mes ? dados.filter((r) => String(r.mes_referencia) === mes) : dados;
    return res.json(filtrarPorPerfil(filtrado, req.user));
  } catch {
    return res.json([]);
  }
});

// GET /api/rv/ap
router.get("/ap", async (req, res) => {
  try {
    const { mes } = req.query;
    const dados = await readSheet("rv_ap");
    const filtrado = mes ? dados.filter((r) => r.mes_referencia === mes) : dados;
    return res.json(filtrarPorPerfil(filtrado, req.user));
  } catch {
    return res.json([]);
  }
});

// POST /api/rv/ap — salva atendimento produtivo
router.post("/ap", adminOnly, async (req, res) => {
  try {
    const { linhas } = req.body;
    if (!Array.isArray(linhas)) return res.status(400).json({ error: "Envie array de linhas." });

    const headers = ["setor","mes_referencia","tasks_compra_real","tasks_compra_meta","compradores_real","compradores_meta","rota_efetiva_real","rota_efetiva_meta","gps_real","gps_meta","ap_ok"];

    // Lê existentes, remove do mesmo mês, reinsere
    const todos = await readSheet("rv_ap");
    const mesRef = linhas[0]?.mes_referencia;
    const outros = todos.filter((r) => r.mes_referencia !== mesRef);
    const novos = [...outros, ...linhas];

    // Reconstrói aba via clear + append
    const { google } = require("googleapis");
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });
    const sheetId = process.env.GOOGLE_SHEET_ID;

    await sheets.spreadsheets.values.clear({ spreadsheetId: sheetId, range: "rv_ap" });
    const rows = [headers, ...novos.map((l) => headers.map((h) => l[h] ?? ""))];
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: "rv_ap!A1",
      valueInputOption: "USER_ENTERED",
      resource: { values: rows },
    });

    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao salvar AP." });
  }
});

// GET /api/rv/relatorio — dados completos para o relatório PDF (admin + director)
router.get("/relatorio", async (req, res) => {
  if (!["admin","director"].includes(req.user?.perfil)) {
    return res.status(403).json({ error: "Acesso negado." });
  }
  try {
    const [rvData, apData, usuarios] = await Promise.all([
      readSheet("rv_resultado"),
      readSheet("rv_ap"),
      readSheet("usuarios").catch(() => []),
    ]);

    const nomeMap = {};
    usuarios.forEach(u => { if (u.cod) nomeMap[String(u.cod).trim()] = String(u.nome || "").trim(); });

    const apMap = {};
    apData.forEach(a => { if (a.setor) apMap[String(a.setor).trim()] = a; });

    const resultado = rvData
      .filter(r => r.setor)
      .sort((a, b) => String(a.setor).localeCompare(String(b.setor)))
      .map(r => ({
        ...r,
        nome_rn: nomeMap[String(r.setor).trim()] || `Setor ${r.setor}`,
        ap_detalhe: apMap[String(r.setor).trim()] || null,
      }));

    return res.json(resultado);
  } catch (err) {
    console.error("rv/relatorio:", err);
    return res.status(500).json({ error: "Erro ao gerar relatório." });
  }
});

// POST /api/rv/calcular
router.post("/calcular", adminOnly, async (req, res) => {
  try {
    const response = await axios.post(
      `${PROCESSOR_URL}/api/rv/calcular`,
      {},
      { headers: { "X-Processor-Token": PROCESSOR_TOKEN }, timeout: 60000 }
    );
    return res.json(response.data);
  } catch (err) {
    return res.status(500).json({ error: "Erro ao calcular RV." });
  }
});

module.exports = router;
