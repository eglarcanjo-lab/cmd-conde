// FORCE 20260517_105347
// updated: 2026-05-16 21:47:53
const express = require("express");
const router = express.Router();
const { readSheet } = require("../services/sheets");
const { authMiddleware } = require("../middleware/auth");

router.use(authMiddleware);

// Converte serial de data do Google Sheets → "YYYY-MM"
// Necessário quando colunas de mês são tipo date na planilha (UNFORMATTED_VALUE retorna número)
function normalizeMes(v) {
  if (!v) return v;
  if (/^\d{4}-\d{2}/.test(v)) return v.slice(0, 7); // já no formato correto
  const n = Number(v);
  if (!isNaN(n) && n > 20000) {
    const d = new Date(Date.UTC(1899, 11, 30) + n * 86400000);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  return v;
}

function filtrarGV(dados, usuario) {
  if (["admin", "director"].includes(usuario.perfil)) return dados;
  if (usuario.perfil === "gv1") return dados.filter((r) => String(r.gv) === "1");
  if (usuario.perfil === "gv3") return dados.filter((r) => String(r.gv) === "2");
  return dados.filter((r) => String(r.setor) === String(usuario.cod));
}

// GET /api/spo/dias-rota/resumo
router.get("/dias-rota/resumo", async (req, res) => {
  try {
    const dados = await readSheet("spo_dias_rota_resumo");
    return res.json(filtrarGV(dados, req.user));
  } catch { return res.json([]); }
});

// GET /api/spo/visitacao-gv/resumo
router.get("/visitacao-gv/resumo", async (req, res) => {
  try {
    const dados = await readSheet("spo_visitacao_gv_resumo");
    return res.json(filtrarGV(dados, req.user));
  } catch { return res.json([]); }
});

// GET /api/spo/coaching/resumo
router.get("/coaching/resumo", async (req, res) => {
  try {
    const dados = await readSheet("spo_coaching_resumo");
    return res.json(filtrarGV(dados, req.user));
  } catch { return res.json([]); }
});

// GET /api/spo/coaching/sem-coaching
router.get("/coaching/sem-coaching", async (req, res) => {
  try {
    const dados = await readSheet("spo_coaching_sem_coaching");
    return res.json(filtrarGV(dados, req.user));
  } catch { return res.json([]); }
});

// GET /api/spo/coaching/detalhe
router.get("/coaching/detalhe", async (req, res) => {
  try {
    const dados = await readSheet("spo_coaching_detalhe");
    return res.json(filtrarGV(dados, req.user));
  } catch { return res.json([]); }
});

// GET /api/spo/visitacao-gv/detalhe
router.get("/visitacao-gv/detalhe", async (req, res) => {
  try {
    const dados = await readSheet("spo_visitacao_gv");
    return res.json(filtrarGV(dados, req.user));
  } catch { return res.json([]); }
});

// GET /api/spo/promo/resumo
router.get("/promo/resumo", async (req, res) => {
  try {
    const [resumo, detalhe] = await Promise.all([
      readSheet("spo_promo_resumo"),
      readSheet("spo_promo_detalhe"),
    ]);

    // Recalcula linha OPERACAO a partir do detalhe (evita dado agregado obsoleto)
    if (detalhe.length > 0) {
      const pcts = detalhe
        .map((d) => parseFloat(d.pct || 0))
        .filter((v) => !isNaN(v) && v >= 0);

      const pct_op = pcts.length > 0
        ? parseFloat((pcts.reduce((s, v) => s + v, 0) / pcts.length).toFixed(1))
        : 0;

      const total_vis = detalhe.reduce((s, d) => s + parseFloat(d.visitas || 0), 0);
      const total_ac  = detalhe.reduce((s, d) => s + parseFloat(d.acesso_promo || 0), 0);
      const mes_ref   = detalhe[0]?.mes_referencia || "";

      // Pega meta da primeira linha que não seja OPERACAO
      const setores = resumo.filter(
        (r) => String(r.setor || "").toUpperCase() !== "OPERACAO"
      );
      const meta_ref = setores[0]?.meta || "10";

      const opRow = {
        setor: "OPERACAO",
        visitas: String(Math.round(total_vis)),
        acesso_promo: String(Math.round(total_ac)),
        pct: String(pct_op),
        meta: meta_ref,
        ok: pct_op >= parseFloat(meta_ref) ? "OK" : "NOK",
        mes_referencia: mes_ref,
      };

      return res.json([...setores, opRow]);
    }

    return res.json(resumo);
  } catch { return res.json([]); }
});

// GET /api/spo/promo/detalhe
router.get("/promo/detalhe", async (req, res) => {
  try {
    const dados = await readSheet("spo_promo_detalhe");
    return res.json(dados);
  } catch { return res.json([]); }
});

// GET /api/spo/dto
router.get("/dto", async (req, res) => {
  try {
    const dados = await readSheet("spo_dto_resumo");
    return res.json(dados);
  } catch { return res.json([]); }
});

// GET /api/spo/desafios
router.get("/desafios", async (req, res) => {
  try {
    const { mes } = req.query;
    const dados = await readSheet("spo_desafios");
    const normalized = dados.map((r) => ({ ...r, mes_referencia: normalizeMes(r.mes_referencia) }));
    const filtrado = mes ? normalized.filter((r) => r.mes_referencia === mes) : normalized;
    return res.json(filtrarGV(filtrado, req.user));
  } catch { return res.json([]); }
});

// POST /api/spo/desafios
router.post("/desafios", async (req, res) => {
  try {
    const { linhas } = req.body;
    if (!Array.isArray(linhas)) return res.status(400).json({ error: "Envie array de linhas." });

    const { google } = require("googleapis");
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const headers = ["gv", "dia", "mes_referencia", "status"];

    // Remove mês atual e regrava
    const todos = await readSheet("spo_desafios");
    const mesRef = linhas[0]?.mes_referencia;
    const outros = todos.filter((r) => r.mes_referencia !== mesRef);
    const novos = [...outros, ...linhas.filter((l) => l.status)];

    await sheets.spreadsheets.values.clear({ spreadsheetId: sheetId, range: "spo_desafios" });
    const rows = [headers, ...novos.map((l) => headers.map((h) => l[h] ?? ""))];
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: "spo_desafios!A1",
      valueInputOption: "USER_ENTERED",
      resource: { values: rows },
    });

    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao salvar desafios." });
  }
});

// GET /api/spo/menu/resumo
router.get("/menu/resumo", async (req, res) => {
  try {
    const dados = await readSheet("spo_menu_resumo");
    return res.json(dados);
  } catch { return res.json([]); }
});

// GET /api/spo/politica-comercial/resumo
router.get("/politica-comercial/resumo", async (req, res) => {
  try {
    const dados = await readSheet("spo_politica_resumo");
    return res.json(dados);
  } catch { return res.json([]); }
});

// GET /api/spo/politica-comercial/detalhe
router.get("/politica-comercial/detalhe", async (req, res) => {
  try {
    const dados = await readSheet("spo_politica_detalhe");
    return res.json(filtrarGV(dados, req.user));
  } catch { return res.json([]); }
});


// GET /api/spo/tasks-cerveja/resumo
router.get("/tasks-cerveja/resumo", async (req, res) => {
  try {
    const dados = await readSheet("spo_tasks_cerveja_resumo");
    return res.json(dados);
  } catch { return res.json([]); }
});

// GET /api/spo/tasks-cerveja/detalhe
router.get("/tasks-cerveja/detalhe", async (req, res) => {
  try {
    const dados = await readSheet("spo_tasks_cerveja_detalhe");
    return res.json(filtrarGV(dados, req.user));
  } catch { return res.json([]); }
});


// GET /api/spo/score5/resumo
router.get("/score5/resumo", async (req, res) => {
  try {
    const dados = await readSheet("spo_score5_resumo");
    return res.json(dados);
  } catch { return res.json([]); }
});


// GET /api/spo/tasks-nab/resumo
router.get("/tasks-nab/resumo", async (req, res) => {
  try {
    const dados = await readSheet("spo_tasks_nab_resumo");
    return res.json(dados);
  } catch { return res.json([]); }
});


// GET /api/spo/tasks-volume/resumo
router.get("/tasks-volume/resumo", async (req, res) => {
  try {
    const dados = await readSheet("spo_tasks_volume_resumo");
    return res.json(dados);
  } catch { return res.json([]); }
});


// GET /api/spo/tasks-marketplace/resumo
router.get("/tasks-marketplace/resumo", async (req, res) => {
  try {
    const dados = await readSheet("spo_tasks_marketplace_resumo");
    return res.json(dados);
  } catch { return res.json([]); }
});


// GET /api/spo/tasks-match/resumo
router.get("/tasks-match/resumo", async (req, res) => {
  try {
    const dados = await readSheet("spo_tasks_match_resumo");
    return res.json(dados);
  } catch { return res.json([]); }
});


// GET /api/spo/tasks-cerv-zero/resumo
router.get("/tasks-cerv-zero/resumo", async (req, res) => {
  try {
    const dados = await readSheet("spo_tasks_cerv_zero_resumo");
    return res.json(dados);
  } catch { return res.json([]); }
});


// GET /api/spo/tasks-digitalizacao/resumo
router.get("/tasks-digitalizacao/resumo", async (req, res) => {
  try {
    const dados = await readSheet("spo_tasks_digit_resumo");
    return res.json(dados);
  } catch { return res.json([]); }
});


// GET /api/spo/pedido-alone/resumo
router.get("/pedido-alone/resumo", async (req, res) => {
  try {
    const dados = await readSheet("spo_pedido_alone_resumo");
    return res.json(dados);
  } catch { return res.json([]); }
});

// GET /api/spo/pedido-alone/detalhe
router.get("/pedido-alone/detalhe", async (req, res) => {
  try {
    const dados = await readSheet("spo_pedido_alone_detalhe");
    return res.json(filtrarGV(dados, req.user));
  } catch { return res.json([]); }
});


// GET /api/spo/rgb/resumo
router.get("/rgb/resumo", async (req, res) => {
  try {
    const dados = await readSheet("spo_rgb_total");
    return res.json(dados);
  } catch { return res.json([]); }
});

// GET /api/spo/rgb/litrinho
router.get("/rgb/litrinho", async (req, res) => {
  try {
    const dados = await readSheet("spo_rgb_litrinho");
    return res.json(dados);
  } catch { return res.json([]); }
});

// GET /api/spo/rgb/inteira
router.get("/rgb/inteira", async (req, res) => {
  try {
    const dados = await readSheet("spo_rgb_inteira");
    return res.json(dados);
  } catch { return res.json([]); }
});

// GET /api/spo/rgb/detalhe
router.get("/rgb/detalhe", async (req, res) => {
  try {
    const dados = await readSheet("spo_rgb_detalhe");
    return res.json(filtrarGV(dados, req.user));
  } catch { return res.json([]); }
});


// GET /api/spo/cupons/resumo
router.get("/cupons/resumo", async (req, res) => {
  try {
    const dados = await readSheet("spo_cupons_resumo");
    return res.json(filtrarGV(dados, req.user));
  } catch { return res.json([]); }
});

// GET /api/spo/cupons/detalhe
router.get("/cupons/detalhe", async (req, res) => {
  try {
    const dados = await readSheet("spo_cupons_detalhe");
    return res.json(filtrarGV(dados, req.user));
  } catch { return res.json([]); }
});


// GET /api/spo/loja-ideal/resumo
router.get("/loja-ideal/resumo", async (req, res) => {
  try {
    const dados = await readSheet("spo_loja_ideal_resumo");
    return res.json(filtrarGV(dados, req.user));
  } catch { return res.json([]); }
});

// GET /api/spo/loja-ideal/detalhe
router.get("/loja-ideal/detalhe", async (req, res) => {
  try {
    const dados = await readSheet("spo_loja_ideal_detalhe");
    return res.json(filtrarGV(dados, req.user));
  } catch { return res.json([]); }
});


// GET /api/spo/scanntech/resumo
router.get("/scanntech/resumo", async (req, res) => {
  try {
    const dados = await readSheet("spo_scanntech_resumo");
    return res.json(dados);
  } catch { return res.json([]); }
});

// GET /api/spo/scanntech/detalhe
router.get("/scanntech/detalhe", async (req, res) => {
  try {
    const dados = await readSheet("spo_scanntech_detalhe");
    return res.json(dados);
  } catch { return res.json([]); }
});


// GET /api/spo/portfolio-ideal/resumo
router.get("/portfolio-ideal/resumo", async (req, res) => {
  try {
    const dados = await readSheet("spo_portfolio_ideal_resumo");
    return res.json(filtrarGV(dados, req.user));
  } catch { return res.json([]); }
});

// GET /api/spo/portfolio-ideal/detalhe
router.get("/portfolio-ideal/detalhe", async (req, res) => {
  try {
    const dados = await readSheet("spo_portfolio_ideal_detalhe");
    return res.json(filtrarGV(dados, req.user));
  } catch { return res.json([]); }
});


// GET /api/spo/painel/metas
router.get("/painel/metas", async (req, res) => {
  try {
    const dados = await readSheet("spo_metas");
    const normalized = dados.map((r) => ({ ...r, mes: normalizeMes(r.mes) }));
    return res.json(normalized);
  } catch { return res.json([]); }
});

// POST /api/spo/painel/metas — substitui toda a aba spo_metas
router.post("/painel/metas", async (req, res) => {
  try {
    const { linhas } = req.body;
    if (!Array.isArray(linhas)) return res.status(400).json({ error: "Envie { linhas: [...] }." });

    const { google } = require("googleapis");
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const headers = ["item", "mes", "meta", "real"];

    await sheets.spreadsheets.values.clear({ spreadsheetId: sheetId, range: "spo_metas" });
    const rows = [
      headers,
      ...linhas.map((l) => [
        String(l.item ?? ""),
        String(l.mes ?? ""),
        l.meta !== "" && l.meta !== null && l.meta !== undefined ? String(l.meta) : "",
        l.real !== "" && l.real !== null && l.real !== undefined ? String(l.real) : "",
      ]),
    ];
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: "spo_metas!A1",
      valueInputOption: "USER_ENTERED",
      resource: { values: rows },
    });

    // Invalida cache
    const { cacheClearAll } = require("../services/sheets");
    cacheClearAll();

    return res.json({ success: true, total: linhas.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao salvar metas SPO." });
  }
});


// GET /api/spo/ap/resumo
router.get("/ap/resumo", async (req, res) => {
  try {
    const dados = await readSheet("spo_ap_resumo");
    return res.json(dados);
  } catch { return res.json([]); }
});

// GET /api/spo/ap/detalhe
router.get("/ap/detalhe", async (req, res) => {
  try {
    const dados = await readSheet("spo_ap_detalhe");
    return res.json(filtrarGV(dados, req.user));
  } catch { return res.json([]); }
});

module.exports = router;

