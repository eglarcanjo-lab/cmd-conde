// Incentivos — campanhas internas data-driven (cadastradas no admin, sem código por incentivo)
const express = require("express");
const router = express.Router();
const { readSheet, appendRow, sobrescreverAba, ensureTab } = require("../services/sheets");
const { authMiddleware, adminOnly } = require("../middleware/auth");

router.use(authMiddleware);

const INC_HEADERS = ["id","titulo","descricao","tipo","sku_codigo","premio","unidade","data_inicio","data_fim","ativo","publico_alvo","ordem","cor","criado_em"];
const RES_HEADERS = ["id_incentivo","setor","nome","valor","atualizado_em"];

const { SET_OFF, podeVer } = require("../utils/visibilidade");

function gerarId() { return "I" + Date.now().toString(36).toUpperCase(); }
function normCod(v) { const s = String(v || "").trim(); return s.replace(/^0+/, "") || s; }
function isTrue(v) { return String(v).trim().toLowerCase() === "true" || String(v).trim() === "1" || String(v).trim().toLowerCase() === "sim"; }

// Público-alvo: gestores veem tudo; RN vê conforme alvo (todos / off / on / lista de setores)
// podeVer agora vem de utils/visibilidade

// "dd/mm/yyyy" → Date (ou null)
function parseDataBR(s) {
  if (!s || !String(s).includes("/")) return null;
  const [dd, mm, yyyy] = String(s).split("/");
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  return isNaN(d.getTime()) ? null : d;
}
// "yyyy-mm-dd" → Date (ou null)
function parseDataISO(s) {
  if (!s || !/^\d{4}-\d{2}-\d{2}/.test(String(s))) return null;
  const [yyyy, mm, dd] = String(s).slice(0, 10).split("-");
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  return isNaN(d.getTime()) ? null : d;
}

// Calcula o ranking de um incentivo. Retorna [{ setor, nome, valor }] ordenado desc.
async function calcularRanking(inc, usuariosMap) {
  const tipo = String(inc.tipo || "").trim().toLowerCase();

  if (tipo === "volume_sku") {
    const vol = await readSheet("volume_diario").catch(() => []);
    const skuAlvo = normCod(inc.sku_codigo);
    const ini = parseDataISO(inc.data_inicio);
    const fim = parseDataISO(inc.data_fim);
    const acc = {};
    vol.forEach((r) => {
      if (normCod(r.cod_produto) !== skuAlvo) return;
      const d = parseDataBR(r.data);
      if (ini && d && d < ini) return;
      if (fim && d && d > fim) return;
      const setor = String(r.setor || "").trim();
      if (!setor) return;
      acc[setor] = (acc[setor] || 0) + (parseFloat(r.volume_hl) || 0);
    });
    return Object.entries(acc)
      .map(([setor, valor]) => ({ setor, nome: usuariosMap[setor] || `Setor ${setor}`, valor: Math.round(valor * 100) / 100 }))
      .sort((a, b) => b.valor - a.valor);
  }

  // tipo "manual" (ou desconhecido): lê incentivos_resultados
  const res = await readSheet("incentivos_resultados").catch(() => []);
  return res
    .filter((r) => String(r.id_incentivo).trim() === String(inc.id).trim())
    .map((r) => ({
      setor: String(r.setor || "").trim(),
      nome: String(r.nome || "").trim() || usuariosMap[String(r.setor || "").trim()] || `Setor ${r.setor}`,
      valor: parseFloat(String(r.valor || "0").replace(",", ".")) || 0,
    }))
    .sort((a, b) => b.valor - a.valor);
}

// ─── PÚBLICO (qualquer usuário logado) ───────────────────────────────────────

// GET /api/incentivos — incentivos ativos visíveis ao usuário (sem ranking pesado)
router.get("/", async (req, res) => {
  try {
    await ensureTab("incentivos");
    const todos = await readSheet("incentivos").catch(() => []);
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const visiveis = todos
      .filter((i) => isTrue(i.ativo))
      .filter((i) => {
        const ini = parseDataISO(i.data_inicio);
        const fim = parseDataISO(i.data_fim);
        if (ini && hoje < ini) return false;
        if (fim && hoje > fim) return false;
        return true;
      })
      .filter((i) => podeVer(req.user, i.publico_alvo))
      .sort((a, b) => (parseInt(a.ordem) || 99) - (parseInt(b.ordem) || 99));
    return res.json(visiveis);
  } catch (err) {
    console.error("incentivos GET:", err);
    return res.status(500).json({ error: "Erro ao buscar incentivos." });
  }
});

// GET /api/incentivos/:id/ranking — ranking de um incentivo + posição do usuário
router.get("/:id/ranking", async (req, res) => {
  try {
    const todos = await readSheet("incentivos").catch(() => []);
    const inc = todos.find((i) => String(i.id).trim() === String(req.params.id).trim());
    if (!inc) return res.status(404).json({ error: "Incentivo não encontrado." });

    const usuarios = await readSheet("usuarios").catch(() => []);
    const usuariosMap = {};
    usuarios.forEach((u) => { if (u.cod) usuariosMap[String(u.cod).trim()] = String(u.nome || "").trim(); });

    const ranking = (await calcularRanking(inc, usuariosMap)).map((r, i) => ({ ...r, posicao: i + 1 }));
    const minhaPos = ranking.find((r) => String(r.setor) === String(req.user.cod)) || null;

    return res.json({ incentivo: inc, ranking, minha_posicao: minhaPos });
  } catch (err) {
    console.error("incentivos ranking:", err);
    return res.status(500).json({ error: "Erro ao calcular ranking." });
  }
});

// ─── ADMIN ───────────────────────────────────────────────────────────────────

// GET /api/incentivos/admin/all — todos (incl. inativos) para gestão
router.get("/admin/all", adminOnly, async (req, res) => {
  try {
    await ensureTab("incentivos");
    const todos = await readSheet("incentivos").catch(() => []);
    return res.json(todos.sort((a, b) => (parseInt(a.ordem) || 99) - (parseInt(b.ordem) || 99)));
  } catch (err) {
    console.error("incentivos admin/all:", err);
    return res.status(500).json({ error: "Erro ao buscar incentivos." });
  }
});

async function sobrescreverIncentivos(lista) {
  const rows = [INC_HEADERS, ...lista.map((r) => INC_HEADERS.map((h) => r[h] ?? ""))];
  await sobrescreverAba("incentivos", rows);
}

// POST /api/incentivos/admin — cria
router.post("/admin", adminOnly, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.titulo || !b.tipo) return res.status(400).json({ error: "Campos obrigatórios: titulo, tipo." });
    if (b.tipo === "volume_sku" && !b.sku_codigo) return res.status(400).json({ error: "Tipo Volume de SKU exige sku_codigo." });

    await ensureTab("incentivos");
    const existentes = await readSheet("incentivos").catch(() => []);
    const novo = {
      id: gerarId(),
      titulo: b.titulo, descricao: b.descricao || "", tipo: b.tipo,
      sku_codigo: b.sku_codigo || "", premio: b.premio || "", unidade: b.unidade || "",
      data_inicio: b.data_inicio || "", data_fim: b.data_fim || "",
      ativo: b.ativo === false ? "false" : "true",
      publico_alvo: b.publico_alvo || "todos", ordem: b.ordem || "1",
      cor: b.cor || "#fbb900", criado_em: new Date().toISOString(),
    };
    await sobrescreverIncentivos([...existentes, novo]);
    return res.json({ success: true, incentivo: novo });
  } catch (err) {
    console.error("incentivos POST:", err);
    return res.status(500).json({ error: `Erro ao criar incentivo: ${err.message}` });
  }
});

// PUT /api/incentivos/admin/:id — edita
router.put("/admin/:id", adminOnly, async (req, res) => {
  try {
    const existentes = await readSheet("incentivos").catch(() => []);
    const idx = existentes.findIndex((i) => String(i.id).trim() === String(req.params.id).trim());
    if (idx === -1) return res.status(404).json({ error: "Incentivo não encontrado." });
    const b = req.body || {};
    existentes[idx] = {
      ...existentes[idx],
      titulo: b.titulo ?? existentes[idx].titulo,
      descricao: b.descricao ?? existentes[idx].descricao,
      tipo: b.tipo ?? existentes[idx].tipo,
      sku_codigo: b.sku_codigo ?? existentes[idx].sku_codigo,
      premio: b.premio ?? existentes[idx].premio,
      unidade: b.unidade ?? existentes[idx].unidade,
      data_inicio: b.data_inicio ?? existentes[idx].data_inicio,
      data_fim: b.data_fim ?? existentes[idx].data_fim,
      ativo: b.ativo !== undefined ? (b.ativo ? "true" : "false") : existentes[idx].ativo,
      publico_alvo: b.publico_alvo ?? existentes[idx].publico_alvo,
      ordem: b.ordem ?? existentes[idx].ordem,
      cor: b.cor ?? existentes[idx].cor,
    };
    await sobrescreverIncentivos(existentes);
    return res.json({ success: true });
  } catch (err) {
    console.error("incentivos PUT:", err);
    return res.status(500).json({ error: "Erro ao editar incentivo." });
  }
});

// DELETE /api/incentivos/admin/:id — remove (+ resultados manuais)
router.delete("/admin/:id", adminOnly, async (req, res) => {
  try {
    const id = String(req.params.id).trim();
    const existentes = await readSheet("incentivos").catch(() => []);
    await sobrescreverIncentivos(existentes.filter((i) => String(i.id).trim() !== id));

    const res2 = await readSheet("incentivos_resultados").catch(() => []);
    const restantes = res2.filter((r) => String(r.id_incentivo).trim() !== id);
    await sobrescreverAba("incentivos_resultados", [RES_HEADERS, ...restantes.map((r) => RES_HEADERS.map((h) => r[h] ?? ""))]);

    return res.json({ success: true });
  } catch (err) {
    console.error("incentivos DELETE:", err);
    return res.status(500).json({ error: "Erro ao remover incentivo." });
  }
});

// GET /api/incentivos/admin/:id/resultados — resultados manuais (para edição)
router.get("/admin/:id/resultados", adminOnly, async (req, res) => {
  try {
    const id = String(req.params.id).trim();
    const res2 = await readSheet("incentivos_resultados").catch(() => []);
    return res.json(res2.filter((r) => String(r.id_incentivo).trim() === id));
  } catch (err) {
    console.error("incentivos resultados GET:", err);
    return res.status(500).json({ error: "Erro ao buscar resultados." });
  }
});

// POST /api/incentivos/admin/:id/resultados — substitui resultados manuais
router.post("/admin/:id/resultados", adminOnly, async (req, res) => {
  try {
    const id = String(req.params.id).trim();
    const linhas = req.body?.linhas;
    if (!Array.isArray(linhas)) return res.status(400).json({ error: "Envie { linhas: [...] }." });

    await ensureTab("incentivos_resultados");
    const todos = await readSheet("incentivos_resultados").catch(() => []);
    const outros = todos.filter((r) => String(r.id_incentivo).trim() !== id);
    const agora = new Date().toISOString();
    const novas = linhas
      .filter((l) => l.setor && (l.valor !== "" && l.valor != null))
      .map((l) => ({
        id_incentivo: id,
        setor: String(l.setor).trim(),
        nome: String(l.nome || "").trim(),
        valor: String(l.valor),
        atualizado_em: agora,
      }));

    const final = [...outros, ...novas];
    await sobrescreverAba("incentivos_resultados", [RES_HEADERS, ...final.map((r) => RES_HEADERS.map((h) => r[h] ?? ""))]);
    return res.json({ success: true, total: novas.length });
  } catch (err) {
    console.error("incentivos resultados POST:", err);
    return res.status(500).json({ error: "Erro ao salvar resultados." });
  }
});

module.exports = router;
