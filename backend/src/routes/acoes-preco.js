// Ações de Preço — apoio ao cadastro de descontos escalonados (diretoria+).
// Base: histórico de vendas do TRIMESTRE ANTERIOR (sem o mês atual).
// Volume: média mensal de caixas por PDV (para start dos descontos).
// Cobertura: PDVs que NÃO compraram o SKU no trimestre (potenciais).
const express = require("express");
const router = express.Router();
const { readSheet, readSheetMonths } = require("../services/sheets");
const { authMiddleware } = require("../middleware/auth");
const { filtrarPorPerfil } = require("../utils/perfil");

router.use(authMiddleware);
// Só diretoria pra cima (director + admin).
router.use((req, res, next) => {
  if (["admin", "director"].includes(req.user?.perfil)) return next();
  return res.status(403).json({ error: "Acesso restrito à diretoria." });
});

const num = (v) => parseFloat(String(v ?? "0").replace(",", ".")) || 0;
const r2 = (n) => Math.round(n * 100) / 100;
const normCod = (v) => String(v ?? "").trim().replace(/^0+/, "") || "0";
const ROT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// SKU único ou combo: "33857" ou "33857,12345". Dedup, sem zeros.
function parseSkus(raw) {
  const set = new Set();
  String(raw || "").split(",").map((s) => normCod(s)).forEach((c) => { if (c && c !== "0") set.add(c); });
  return [...set];
}

// Trimestre civil ANTERIOR ao atual (3 meses completos, sem o mês corrente).
function trimestreAnterior() {
  const br = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const y = br.getFullYear(), m0 = br.getMonth();
  const triStart = Math.floor(m0 / 3) * 3;
  const meses = [3, 2, 1].map((k) => { const d = new Date(y, triStart - k, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });
  const rot = (m) => ROT[(Number(m.split("-")[1]) || 1) - 1];
  return { meses, label: `${rot(meses[0])}–${rot(meses[2])}` };
}

// GET /api/acoes-preco/produtos?q= — busca SKU (com venda no escopo/tri anterior)
router.get("/produtos", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim().toLowerCase();
    if (q.length < 2) return res.json([]);
    const { meses } = trimestreAnterior();
    const [vendasRaw, prodFull] = await Promise.all([
      readSheetMonths("vendas_cliente_produto", "mes_referencia", meses).catch(() => []),
      readSheet("produtos_full").catch(() => []),
    ]);
    const vendas = filtrarPorPerfil(vendasRaw, req.user, "setor");
    const nomeMap = {};
    prodFull.forEach((p) => { nomeMap[normCod(p.cod)] = String(p.nome || "").trim(); });
    const map = {};
    vendas.forEach((r) => {
      const c = normCod(r.cod_produto);
      if (!map[c]) map[c] = { cod: c, nome: nomeMap[c] || String(r.nome_produto || "").trim() || c, vol: 0 };
      map[c].vol += num(r.volume_hl);
    });
    const lista = Object.values(map)
      .filter((p) => p.nome.toLowerCase().includes(q) || p.cod.includes(q))
      .sort((a, b) => b.vol - a.vol).slice(0, 20)
      .map((p) => ({ cod: p.cod, nome: p.nome }));
    return res.json(lista);
  } catch (e) { console.error("acoes-preco/produtos:", e); return res.status(500).json({ error: "Erro na busca." }); }
});

// GET /api/acoes-preco/volume?sku=33857[,12345] — média mensal de caixas por PDV (tri anterior).
// Combo: soma as caixas de todos os SKUs por PDV; meses = união dos meses em que comprou qualquer um.
router.get("/volume", async (req, res) => {
  try {
    const skus = parseSkus(req.query.sku);
    if (!skus.length) return res.status(400).json({ error: "Informe o(s) SKU(s)." });
    const skuSet = new Set(skus);
    const { meses, label } = trimestreAnterior();
    const [vendasRaw, prodFull, usuarios] = await Promise.all([
      readSheetMonths("vendas_cliente_produto", "mes_referencia", meses).catch(() => []),
      readSheet("produtos_full").catch(() => []),
      readSheet("usuarios").catch(() => []),
    ]);
    const vendas = filtrarPorPerfil(vendasRaw, req.user, "setor");
    const hlMap = {}, nomeMap = {};
    prodFull.forEach((p) => { const c = normCod(p.cod); if (skuSet.has(c)) { hlMap[c] = num(p.hl_caixa); nomeMap[c] = String(p.nome || "").trim(); } });
    const rnMap = {};
    usuarios.forEach((u) => { if (u.cod) rnMap[String(u.cod).trim()] = String(u.nome || "").trim(); });

    const map = {};
    vendas.forEach((r) => {
      const c = normCod(r.cod_produto);
      if (!skuSet.has(c)) return;
      const cod = String(r.cod_pdv || "").trim(); if (!cod) return;
      if (!nomeMap[c]) nomeMap[c] = String(r.nome_produto || "").trim();
      const mes = String(r.mes_referencia || "").slice(0, 7);
      const hlc = hlMap[c] || 0;
      const cx = hlc > 0 ? num(r.volume_hl) / hlc : 0;
      const e = map[cod] || (map[cod] = { cod_pdv: cod, nome_pdv: String(r.nome_pdv || "").trim(), setor: String(r.setor || "").trim(), caixas: 0, meses: new Set() });
      e.caixas += cx;
      if (cx > 0) e.meses.add(mes);
    });
    const pdvs = Object.values(map)
      .map((e) => {
        const nm = e.meses.size || 1;
        return { cod_pdv: e.cod_pdv, nome_pdv: e.nome_pdv, setor: e.setor, rn: rnMap[e.setor] || "", meses_comprados: e.meses.size, caixas_tri: r2(e.caixas), media_cx: r2(e.caixas / nm) };
      })
      .filter((p) => p.media_cx > 0)
      .sort((a, b) => b.media_cx - a.media_cx);

    const produtos = skus.map((c) => ({ cod: c, nome: nomeMap[c] || c, hl_caixa: hlMap[c] || 0 }));
    return res.json({ produtos, trimestre: label, meses, sem_hl: produtos.some((p) => p.hl_caixa <= 0), pdvs });
  } catch (e) { console.error("acoes-preco/volume:", e); return res.status(500).json({ error: "Erro ao calcular volume." }); }
});

// GET /api/acoes-preco/cobertura?sku=33857[,12345] — PDVs que NÃO compraram NENHUM
// dos SKUs do combo no tri anterior (comprador = comprou pelo menos um deles).
router.get("/cobertura", async (req, res) => {
  try {
    const skus = parseSkus(req.query.sku);
    if (!skus.length) return res.status(400).json({ error: "Informe o(s) SKU(s)." });
    const skuSet = new Set(skus);
    const { meses, label } = trimestreAnterior();
    const [vendasRaw, prodFull, usuarios, pdvBaseRaw] = await Promise.all([
      readSheetMonths("vendas_cliente_produto", "mes_referencia", meses).catch(() => []),
      readSheet("produtos_full").catch(() => []),
      readSheet("usuarios").catch(() => []),
      readSheet("pdv_base").catch(() => []),
    ]);
    const vendas = filtrarPorPerfil(vendasRaw, req.user, "setor");
    const pdvBase = filtrarPorPerfil(pdvBaseRaw, req.user);
    const nomeMap = {};
    prodFull.forEach((p) => { const c = normCod(p.cod); if (skuSet.has(c)) nomeMap[c] = String(p.nome || "").trim(); });
    const rnMap = {};
    usuarios.forEach((u) => { if (u.cod) rnMap[String(u.cod).trim()] = String(u.nome || "").trim(); });

    const compradores = new Set();
    vendas.forEach((r) => { if (skuSet.has(normCod(r.cod_produto)) && num(r.volume_hl) > 0) compradores.add(normCod(r.cod_pdv)); });
    const naoCompradores = pdvBase
      .map((p) => ({ cod_pdv: normCod(p.cod_pdv || p.cod), nome_pdv: String(p.nome_fantasia || p.nome || "").trim(), setor: String(p.setor || "").trim() }))
      .filter((p) => p.cod_pdv && p.cod_pdv !== "0" && !compradores.has(p.cod_pdv))
      .map((p) => ({ ...p, rn: rnMap[p.setor] || "" }))
      .sort((a, b) => String(a.setor).localeCompare(String(b.setor)) || a.nome_pdv.localeCompare(b.nome_pdv));

    const produtos = skus.map((c) => ({ cod: c, nome: nomeMap[c] || c }));
    return res.json({ produtos, trimestre: label, total_base: pdvBase.length, compradores: compradores.size, nao_compradores: naoCompradores });
  } catch (e) { console.error("acoes-preco/cobertura:", e); return res.status(500).json({ error: "Erro ao calcular cobertura." }); }
});

module.exports = router;
