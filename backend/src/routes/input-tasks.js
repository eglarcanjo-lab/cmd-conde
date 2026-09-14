// Input de Tasks — gerador de tarefas (grupo Ações de Preço, ADMIN).
// Cada "definição" de task = { tipo, base, produtos[], texto }. Ao gerar, vira uma
// linha por PDV: UNB_PDV = 1035185_{cod_pdv} · cod_produto (vírgula) · texto · tipo.
//   • base "total"          → toda a base (pdv_base).
//   • base "nao_compradora" → PDVs que NÃO compraram nenhum dos SKUs listados
//     (janela = trimestre anterior, 3 meses completos — mesmo critério das Ações de Preço).
// Persistência: tabela input_tasks (regravada inteira a cada mudança — CRUD leve de admin).
const express = require("express");
const router = express.Router();
const { readSheet, readSheetMonths, sobrescreverAba } = require("../services/sheets");
const { authMiddleware } = require("../middleware/auth");

const UNB = "1035185";
const num = (v) => parseFloat(String(v ?? "0").replace(",", ".")) || 0;
const normCod = (v) => String(v ?? "").trim().replace(/^0+/, "") || "0";
const ROT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const brNow = () => new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));

// 3 meses completos ANTERIORES ao mês atual (rolante). Ex.: em set → jun, jul, ago.
function trimestreAnterior() {
  const d = brNow(), y = d.getFullYear(), m0 = d.getMonth();
  const meses = [3, 2, 1].map((k) => { const x = new Date(y, m0 - k, 1); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`; });
  const rot = (m) => ROT[(Number(m.split("-")[1]) || 1) - 1];
  return { meses, label: `${rot(meses[0])}–${rot(meses[2])}` };
}

const parseProdutos = (raw) => String(raw || "").split(",").map((c) => normCod(c)).filter((c) => c && c !== "0");

router.use(authMiddleware);
router.use((req, res, next) => {
  if (req.user?.perfil === "admin") return next();
  return res.status(403).json({ error: "Acesso restrito ao admin." });
});

const HEADER = ["id", "tipo", "base", "produtos", "texto", "criado_em"];
async function lerDefs() {
  const rows = await readSheet("input_tasks").catch(() => []);
  return rows.map((r) => ({
    id: String(r.id || "").trim(),
    tipo: String(r.tipo || "").trim(),
    base: String(r.base || "total").trim(),
    produtos: parseProdutos(r.produtos),
    texto: String(r.texto || ""),
    criado_em: String(r.criado_em || ""),
  })).filter((d) => d.id);
}
async function salvarDefs(defs) {
  const linhas = defs.map((d) => [d.id, d.tipo, d.base, (d.produtos || []).join(","), d.texto, d.criado_em]);
  await sobrescreverAba("input_tasks", [HEADER, ...linhas]);
}

// GET /api/input-tasks/produtos?q=  — busca na GRADE DE ESTOQUE (SKUs com saldo).
router.get("/produtos", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim().toLowerCase();
    if (q.length < 2) return res.json([]);
    const [grade, prodFull] = await Promise.all([
      readSheet("grade_estoque").catch(() => []),
      readSheet("produtos_full").catch(() => []),
    ]);
    const nomeMap = {}; prodFull.forEach((p) => { nomeMap[normCod(p.cod)] = String(p.nome || "").trim(); });
    const lista = grade
      .map((r) => { const c = normCod(r.cod); return { cod: c, nome: nomeMap[c] || String(r.descricao || r.nome || "").trim() || c, saldo: Math.round(num(r.saldo)) }; })
      .filter((p) => p.cod && p.cod !== "0" && (p.nome.toLowerCase().includes(q) || p.cod.includes(q)))
      .sort((a, b) => b.saldo - a.saldo)
      .slice(0, 25);
    return res.json(lista);
  } catch (e) { console.error("input-tasks/produtos:", e); return res.status(500).json({ error: "Erro na busca." }); }
});

// GET /api/input-tasks — lista as definições cadastradas (com nomes dos produtos).
router.get("/", async (req, res) => {
  try {
    const defs = await lerDefs();
    const prodFull = await readSheet("produtos_full").catch(() => []);
    const nomeMap = {}; prodFull.forEach((p) => { nomeMap[normCod(p.cod)] = String(p.nome || "").trim(); });
    const out = defs.map((d) => ({ ...d, produtos_nomes: d.produtos.map((c) => ({ cod: c, nome: nomeMap[c] || c })) }));
    return res.json(out);
  } catch (e) { console.error("input-tasks/list:", e); return res.status(500).json({ error: "Erro ao listar tasks." }); }
});

// POST /api/input-tasks — cria uma definição.
router.post("/", async (req, res) => {
  try {
    const { tipo, base, produtos, texto } = req.body || {};
    const prods = Array.isArray(produtos) ? produtos.map(normCod).filter((c) => c && c !== "0") : parseProdutos(produtos);
    if (!String(tipo || "").trim()) return res.status(400).json({ error: "Informe o tipo da task." });
    if (!prods.length) return res.status(400).json({ error: "Liste ao menos um produto." });
    if (!String(texto || "").trim()) return res.status(400).json({ error: "Informe o texto da tarefa." });
    const defs = await lerDefs();
    const nova = {
      id: `t${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`,
      tipo: String(tipo).trim(), base: base === "nao_compradora" ? "nao_compradora" : "total",
      produtos: prods, texto: String(texto), criado_em: new Date().toISOString(),
    };
    await salvarDefs([...defs, nova]);
    return res.json({ ok: true, id: nova.id });
  } catch (e) { console.error("input-tasks/create:", e); return res.status(500).json({ error: "Erro ao criar task." }); }
});

// PUT /api/input-tasks/:id — edita uma definição.
router.put("/:id", async (req, res) => {
  try {
    const { tipo, base, produtos, texto } = req.body || {};
    const prods = Array.isArray(produtos) ? produtos.map(normCod).filter((c) => c && c !== "0") : parseProdutos(produtos);
    const defs = await lerDefs();
    const i = defs.findIndex((d) => d.id === req.params.id);
    if (i < 0) return res.status(404).json({ error: "Task não encontrada." });
    if (!prods.length) return res.status(400).json({ error: "Liste ao menos um produto." });
    if (!String(texto || "").trim()) return res.status(400).json({ error: "Informe o texto da tarefa." });
    defs[i] = { ...defs[i], tipo: String(tipo || defs[i].tipo).trim(), base: base === "nao_compradora" ? "nao_compradora" : "total", produtos: prods, texto: String(texto) };
    await salvarDefs(defs);
    return res.json({ ok: true });
  } catch (e) { console.error("input-tasks/update:", e); return res.status(500).json({ error: "Erro ao editar task." }); }
});

// DELETE /api/input-tasks/:id — remove uma definição.
router.delete("/:id", async (req, res) => {
  try {
    const defs = await lerDefs();
    const rest = defs.filter((d) => d.id !== req.params.id);
    if (rest.length === defs.length) return res.status(404).json({ error: "Task não encontrada." });
    await salvarDefs(rest);
    return res.json({ ok: true });
  } catch (e) { console.error("input-tasks/delete:", e); return res.status(500).json({ error: "Erro ao remover task." }); }
});

// GET /api/input-tasks/gerar — monta a tabela de saída (1 linha por PDV × definição).
router.get("/gerar", async (req, res) => {
  try {
    const defs = await lerDefs();
    if (!defs.length) return res.json({ linhas: [], resumo: [], janela: trimestreAnterior().label });

    const precisaVendas = defs.some((d) => d.base === "nao_compradora");
    const { meses, label } = trimestreAnterior();
    const [pdvBase, vendas] = await Promise.all([
      readSheet("pdv_base").catch(() => []),
      precisaVendas ? readSheetMonths("vendas_cliente_produto", "mes_referencia", meses).catch(() => []) : Promise.resolve([]),
    ]);

    // Base total de PDVs (cods válidos, únicos).
    const codsBase = [...new Set(pdvBase.map((p) => normCod(p.cod_pdv || p.cod)).filter((c) => c && c !== "0"))];

    const linhas = [];
    const resumo = defs.map((d) => {
      let cods = codsBase;
      if (d.base === "nao_compradora") {
        const skuSet = new Set(d.produtos);
        const compradores = new Set();
        vendas.forEach((r) => { if (skuSet.has(normCod(r.cod_produto)) && num(r.volume_hl) > 0) compradores.add(normCod(r.cod_pdv)); });
        cods = codsBase.filter((c) => !compradores.has(c));
      }
      const codProduto = d.produtos.join(",");
      cods.forEach((c) => linhas.push({ unb_pdv: `${UNB}_${c}`, cod_produto: codProduto, texto: d.texto, tipo: d.tipo }));
      return { id: d.id, tipo: d.tipo, base: d.base, produtos: d.produtos, qtd_pdvs: cods.length };
    });

    return res.json({ linhas, resumo, janela: label, total_base: codsBase.length });
  } catch (e) { console.error("input-tasks/gerar:", e); return res.status(500).json({ error: "Erro ao gerar as tasks." }); }
});

module.exports = router;
