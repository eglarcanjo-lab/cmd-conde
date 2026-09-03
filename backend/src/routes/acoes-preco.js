// Ações de Preço — apoio ao cadastro de descontos escalonados (ADMIN por enquanto).
// Produtos: relação da GRADE DE ESTOQUE (saldo + disp = saldo −30%, para não usar
//   todo o estoque numa ação).
// Base histórica: 3 meses COMPLETOS anteriores ao mês atual (rolante, sem o mês corrente).
// Volume: média mensal de caixas do combo por PDV. Cobertura: quem não comprou nenhum.
// Tarja: sugestão de gap da categoria para "tendenciar 100%" da meta do mês.
const express = require("express");
const router = express.Router();
const { readSheet, readSheetMonths } = require("../services/sheets");
const { authMiddleware } = require("../middleware/auth");
const { filtrarPorPerfil } = require("../utils/perfil");

router.use(authMiddleware);
// Só admin por enquanto.
router.use((req, res, next) => {
  if (req.user?.perfil === "admin") return next();
  return res.status(403).json({ error: "Acesso restrito ao admin." });
});

const num = (v) => parseFloat(String(v ?? "0").replace(",", ".")) || 0;
const r1 = (n) => Math.round(n * 10) / 10;
const r2 = (n) => Math.round(n * 100) / 100;
const normCod = (v) => String(v ?? "").trim().replace(/^0+/, "") || "0";
const ROT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const DESC_ESTOQUE = 0.30; // reserva 30% do estoque (usa 70%)

const brNow = () => new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
const mesAtualBR = () => { const d = brNow(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };

// 3 meses completos ANTERIORES ao mês atual (rolante). Ex.: em set → jun, jul, ago.
function trimestreAnterior() {
  const d = brNow(), y = d.getFullYear(), m0 = d.getMonth();
  const meses = [3, 2, 1].map((k) => { const x = new Date(y, m0 - k, 1); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`; });
  const rot = (m) => ROT[(Number(m.split("-")[1]) || 1) - 1];
  return { meses, label: `${rot(meses[0])}–${rot(meses[2])}` };
}

// cod -> categorias[] (produtos_base, multi-categoria)
function mapaCategorias(prodBase) {
  const m = {};
  prodBase.forEach((p) => {
    const cats = String(p.categorias || p.categoria || "").split(/[,;|]/).map((c) => c.trim().toUpperCase()).filter(Boolean);
    if (cats.length) m[normCod(p.cod)] = cats;
  });
  return m;
}

// Categoria granular -> bucket de meta (Cerveja/NAB/Match/Mktp + Zero).
function mapBucket(catRaw) {
  const c = String(catRaw || "").toUpperCase();
  if (!c) return null;
  const zero = c.includes("ZERO");
  if (c.includes("MATCH")) return "Match";
  if (c.includes("MKTP") || c.includes("MARKET")) return "Mktp";
  if (c.includes("NAB")) return zero ? "NAB Zero" : "NAB";
  return zero ? "Cerveja Zero" : "Cerveja"; // GIRO/LITRINHO/HE/MULTIPACK/TRIMARCA/BALANCED/CERVEJA
}

// Projeção do mês pelo ritmo de dias úteis (seg-sex).
function fatorDiasUteis() {
  const d = brNow(), yy = d.getFullYear(), mm = d.getMonth(), hoje = d.getDate();
  const uteis = (ate) => { let c = 0; const x = new Date(yy, mm, 1); while (x.getMonth() === mm && x.getDate() <= ate) { const w = x.getDay(); if (w >= 1 && w <= 5) c++; x.setDate(x.getDate() + 1); } return c; };
  return uteis(31) / Math.max(1, uteis(hoje));
}

// Tarja: quanto falta (HL / %) para a categoria tendenciar 100% da meta do mês.
async function sugestaoCategoria(categoria, user) {
  const bucket = mapBucket(categoria);
  if (!bucket) return null;
  const mes = mesAtualBR();
  const [rvResAll, rvVolAll] = await Promise.all([
    readSheet("rv_resultado").catch(() => []),
    readSheet("rv_volume").catch(() => []),
  ]);
  const rv = filtrarPorPerfil(rvResAll, user, "setor").filter((r) => !r.mes_referencia || String(r.mes_referencia).startsWith(mes));
  const vol = filtrarPorPerfil(rvVolAll, user, "setor");
  const soma = (campo) => rv.reduce((s, r) => s + num(r[campo]), 0);
  const mref = (r) => String(r.mes_ref || r.mes_referencia || "");
  const volCat = (cat) => { const c = cat.toUpperCase(); const sel = vol.filter((r) => String(r.categoria || "").trim().toUpperCase() === c); const doMes = sel.filter((r) => mref(r).startsWith(mes)); return (doMes.length ? doMes : sel).reduce((s, r) => s + num(r.volume), 0); };
  const realCerveja = soma("real_cerveja"), realNab = soma("real_nab");
  let real = 0, meta = 0;
  if (bucket === "Cerveja") { real = realCerveja; meta = soma("meta_cerveja"); }
  else if (bucket === "NAB") { real = realNab; meta = soma("meta_nab"); }
  else if (bucket === "Match") { real = soma("real_match"); meta = soma("meta_match"); }
  else if (bucket === "Mktp") { real = soma("real_marketplace"); meta = soma("meta_marketplace"); }
  else if (bucket === "Cerveja Zero") { real = volCat("CERVEJA ZERO"); meta = 0.15 * realCerveja; }
  else if (bucket === "NAB Zero") { real = volCat("NAB ZERO"); meta = 0.15 * realNab; }
  const tend = real * fatorDiasUteis();
  const faltaHl = Math.max(0, meta - tend);
  const aumentoPct = tend > 0 ? (faltaHl / tend) * 100 : null;
  return {
    categoria: bucket, mes,
    real_hl: r1(real), meta_hl: r1(meta), tend_hl: r1(tend),
    pct_tend: meta > 0 ? Math.round((tend / meta) * 100) : null,
    falta_hl: r1(faltaHl), aumento_pct: aumentoPct != null ? Math.round(aumentoPct) : null,
  };
}

// Categoria "primária" do combo (produtos não misturam categoria → pega a do 1º SKU).
function categoriaDoCombo(skus, catMap) {
  for (const s of skus) { const cats = catMap[s]; if (cats && cats.length) return cats[0]; }
  return "";
}

// GET /api/acoes-preco/produtos?q= — relação da GRADE DE ESTOQUE (saldo + disp −30%)
router.get("/produtos", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim().toLowerCase();
    if (q.length < 2) return res.json([]);
    const [grade, prodFull, prodBase] = await Promise.all([
      readSheet("grade_estoque").catch(() => []),
      readSheet("produtos_full").catch(() => []),
      readSheet("produtos_base").catch(() => []),
    ]);
    const nomeMap = {}, hlMap = {};
    prodFull.forEach((p) => { const c = normCod(p.cod); nomeMap[c] = String(p.nome || "").trim(); hlMap[c] = num(p.hl_caixa); });
    const catMap = mapaCategorias(prodBase);
    const lista = grade
      .map((r) => {
        const c = normCod(r.cod);
        const saldo = Math.round(num(r.saldo));
        return { cod: c, nome: nomeMap[c] || String(r.descricao || r.nome || "").trim() || c, categoria: (catMap[c] || [])[0] || "", hl_caixa: hlMap[c] || 0, saldo, disp: Math.floor(saldo * (1 - DESC_ESTOQUE)) };
      })
      .filter((p) => p.cod && p.cod !== "0" && (p.nome.toLowerCase().includes(q) || p.cod.includes(q)))
      .sort((a, b) => b.saldo - a.saldo)
      .slice(0, 25);
    return res.json(lista);
  } catch (e) { console.error("acoes-preco/produtos:", e); return res.status(500).json({ error: "Erro na busca." }); }
});

// GET /api/acoes-preco/volume?sku=33857[,12345] — média mensal de caixas por PDV (tri anterior).
router.get("/volume", async (req, res) => {
  try {
    const skus = parseSkus(req.query.sku);
    if (!skus.length) return res.status(400).json({ error: "Informe o(s) SKU(s)." });
    const skuSet = new Set(skus);
    const { meses, label } = trimestreAnterior();
    const [vendasRaw, prodFull, prodBase, usuarios, grade] = await Promise.all([
      readSheetMonths("vendas_cliente_produto", "mes_referencia", meses).catch(() => []),
      readSheet("produtos_full").catch(() => []),
      readSheet("produtos_base").catch(() => []),
      readSheet("usuarios").catch(() => []),
      readSheet("grade_estoque").catch(() => []),
    ]);
    const vendas = filtrarPorPerfil(vendasRaw, req.user, "setor");
    const hlMap = {}, nomeMap = {}, saldoMap = {};
    prodFull.forEach((p) => { const c = normCod(p.cod); if (skuSet.has(c)) { hlMap[c] = num(p.hl_caixa); nomeMap[c] = String(p.nome || "").trim(); } });
    grade.forEach((r) => { const c = normCod(r.cod); if (skuSet.has(c)) saldoMap[c] = Math.round(num(r.saldo)); });
    const catMap = mapaCategorias(prodBase);
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
      .map((e) => { const nm = e.meses.size || 1; return { cod_pdv: e.cod_pdv, nome_pdv: e.nome_pdv, setor: e.setor, rn: rnMap[e.setor] || "", meses_comprados: e.meses.size, caixas_tri: r2(e.caixas), media_cx: r2(e.caixas / nm) }; })
      .filter((p) => p.media_cx > 0)
      .sort((a, b) => b.media_cx - a.media_cx);

    const produtos = skus.map((c) => { const saldo = saldoMap[c] ?? null; return { cod: c, nome: nomeMap[c] || c, categoria: (catMap[c] || [])[0] || "", hl_caixa: hlMap[c] || 0, saldo, disp: saldo != null ? Math.floor(saldo * (1 - DESC_ESTOQUE)) : null }; });
    const sugestao = await sugestaoCategoria(categoriaDoCombo(skus, catMap), req.user);
    return res.json({ produtos, trimestre: label, meses, sem_hl: produtos.some((p) => p.hl_caixa <= 0), sugestao, pdvs });
  } catch (e) { console.error("acoes-preco/volume:", e); return res.status(500).json({ error: "Erro ao calcular volume." }); }
});

// GET /api/acoes-preco/cobertura?sku=33857[,12345] — PDVs que NÃO compraram NENHUM do combo.
router.get("/cobertura", async (req, res) => {
  try {
    const skus = parseSkus(req.query.sku);
    if (!skus.length) return res.status(400).json({ error: "Informe o(s) SKU(s)." });
    const skuSet = new Set(skus);
    const { meses, label } = trimestreAnterior();
    const [vendasRaw, prodFull, prodBase, usuarios, pdvBaseRaw, grade] = await Promise.all([
      readSheetMonths("vendas_cliente_produto", "mes_referencia", meses).catch(() => []),
      readSheet("produtos_full").catch(() => []),
      readSheet("produtos_base").catch(() => []),
      readSheet("usuarios").catch(() => []),
      readSheet("pdv_base").catch(() => []),
      readSheet("grade_estoque").catch(() => []),
    ]);
    const vendas = filtrarPorPerfil(vendasRaw, req.user, "setor");
    const pdvBase = filtrarPorPerfil(pdvBaseRaw, req.user);
    const nomeMap = {}, hlMap = {}, saldoMap = {};
    prodFull.forEach((p) => { const c = normCod(p.cod); if (skuSet.has(c)) { nomeMap[c] = String(p.nome || "").trim(); hlMap[c] = num(p.hl_caixa); } });
    grade.forEach((r) => { const c = normCod(r.cod); if (skuSet.has(c)) saldoMap[c] = Math.round(num(r.saldo)); });
    const catMap = mapaCategorias(prodBase);
    const rnMap = {};
    usuarios.forEach((u) => { if (u.cod) rnMap[String(u.cod).trim()] = String(u.nome || "").trim(); });

    const compradores = new Set();
    vendas.forEach((r) => { if (skuSet.has(normCod(r.cod_produto)) && num(r.volume_hl) > 0) compradores.add(normCod(r.cod_pdv)); });
    const naoCompradores = pdvBase
      .map((p) => ({ cod_pdv: normCod(p.cod_pdv || p.cod), nome_pdv: String(p.nome_fantasia || p.nome || "").trim(), setor: String(p.setor || "").trim() }))
      .filter((p) => p.cod_pdv && p.cod_pdv !== "0" && !compradores.has(p.cod_pdv))
      .map((p) => ({ ...p, rn: rnMap[p.setor] || "" }))
      .sort((a, b) => String(a.setor).localeCompare(String(b.setor)) || a.nome_pdv.localeCompare(b.nome_pdv));

    const produtos = skus.map((c) => { const saldo = saldoMap[c] ?? null; return { cod: c, nome: nomeMap[c] || c, categoria: (catMap[c] || [])[0] || "", hl_caixa: hlMap[c] || 0, saldo, disp: saldo != null ? Math.floor(saldo * (1 - DESC_ESTOQUE)) : null }; });
    const sugestao = await sugestaoCategoria(categoriaDoCombo(skus, catMap), req.user);
    return res.json({ produtos, trimestre: label, total_base: pdvBase.length, compradores: compradores.size, sugestao, nao_compradores: naoCompradores });
  } catch (e) { console.error("acoes-preco/cobertura:", e); return res.status(500).json({ error: "Erro ao calcular cobertura." }); }
});

// SKU único ou combo: "33857" ou "33857,12345". Dedup, sem zeros.
function parseSkus(raw) {
  const set = new Set();
  String(raw || "").split(",").map((s) => normCod(s)).forEach((c) => { if (c && c !== "0") set.add(c); });
  return [...set];
}

module.exports = router;
