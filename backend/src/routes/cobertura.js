const express = require("express");
const router = express.Router();
const { readSheet, readSheetMonths } = require("../services/sheets");
const { authMiddleware } = require("../middleware/auth");

router.use(authMiddleware);

// Filtra dados pelo perfil do usuário
const { filtrarPorPerfil } = require("../utils/perfil");

const num = (v) => parseFloat(String(v ?? "0").replace(",", ".")) || 0;
const r1 = (n) => Math.round(n * 10) / 10;
const r3 = (n) => Math.round(n * 1000) / 1000;
const normCod = (v) => String(v ?? "").trim().replace(/^0+/, "") || "0";
const mesAtualBR = () => {
  const br = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return `${br.getFullYear()}-${String(br.getMonth() + 1).padStart(2, "0")}`;
};

// GET /api/cobertura — status OK/Pendente/NOK por PDV x Categoria
router.get("/", async (req, res) => {
  try {
    const dados = await readSheet("cobertura");
    return res.json(filtrarPorPerfil(dados, req.user));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao buscar cobertura." });
  }
});

// GET /api/cobertura/pdv-base — base de PDVs com dia de visita
router.get("/pdv-base", async (req, res) => {
  try {
    const dados = await readSheet("pdv_base");
    return res.json(filtrarPorPerfil(dados, req.user));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao buscar PDVs." });
  }
});

// GET /api/cobertura/resumo — resumo por setor x categoria
router.get("/resumo", async (req, res) => {
  try {
    const dados = await readSheet("cobertura_resumo");
    return res.json(filtrarPorPerfil(dados, req.user));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao buscar resumo." });
  }
});

// GET /api/cobertura/sku-pdv?cod_pdv=123&categoria=CERVEJA&mes=YYYY-MM
// Drill-down de uma célula (PDV × categoria): SKUs que o PDV COMPROU no mês
// (HL + caixas) e os SKUs da categoria vendidos no setor que ele NÃO comprou.
router.get("/sku-pdv", async (req, res) => {
  try {
    const codPdv = normCod(req.query.cod_pdv);
    const categoria = String(req.query.categoria || "").trim().toUpperCase();
    if (!codPdv || codPdv === "0" || !categoria) {
      return res.status(400).json({ error: "Informe cod_pdv e categoria." });
    }
    const mes = /^\d{4}-\d{2}$/.test(String(req.query.mes || "")) ? req.query.mes : mesAtualBR();

    const [vendasRaw, prodBase, prodFull] = await Promise.all([
      readSheetMonths("vendas_cliente_produto", "mes_referencia", [mes]).catch(() => []),
      readSheet("produtos_base").catch(() => []),
      readSheet("produtos_full").catch(() => []),
    ]);
    const vendas = filtrarPorPerfil(vendasRaw, req.user, "setor");

    // cod -> categorias[] (multi-categoria)
    const catDe = {};
    prodBase.forEach((p) => {
      const cats = String(p.categorias || p.categoria || "").split(/[,;|]/).map((c) => c.trim().toUpperCase()).filter(Boolean);
      if (cats.length) catDe[normCod(p.cod)] = cats;
    });
    const naCat = (cod) => (catDe[normCod(cod)] || []).includes(categoria);
    const hlCaixa = {}, nomeFull = {};
    prodFull.forEach((p) => { const c = normCod(p.cod); hlCaixa[c] = num(p.hl_caixa); if (p.nome) nomeFull[c] = String(p.nome).trim(); });

    // SKUs que o PDV comprou nesta categoria (agrega por SKU)
    const map = {};
    let setorPdv = "";
    vendas.forEach((r) => {
      if (normCod(r.cod_pdv) !== codPdv) return;
      setorPdv = String(r.setor || "").trim() || setorPdv;
      if (!naCat(r.cod_produto)) return;
      const c = normCod(r.cod_produto);
      if (!map[c]) map[c] = { cod: c, nome: nomeFull[c] || String(r.nome_produto || "").trim() || c, volume_hl: 0 };
      map[c].volume_hl += num(r.volume_hl);
    });
    const comprou = Object.values(map)
      .map((s) => ({ cod: s.cod, nome: s.nome, volume_hl: r3(s.volume_hl), caixas: hlCaixa[s.cod] > 0 ? r1(s.volume_hl / hlCaixa[s.cod]) : null }))
      .filter((s) => s.volume_hl > 0)
      .sort((a, b) => b.volume_hl - a.volume_hl);

    // SKUs da categoria vendidos no MESMO setor que este PDV NÃO comprou (oportunidade)
    const comprados = new Set(comprou.map((s) => s.cod));
    const naoMap = {};
    vendas.forEach((r) => {
      if (String(r.setor || "").trim() !== setorPdv) return;
      if (!naCat(r.cod_produto)) return;
      const c = normCod(r.cod_produto);
      if (comprados.has(c) || naoMap[c]) return;
      naoMap[c] = { cod: c, nome: nomeFull[c] || String(r.nome_produto || "").trim() || c };
    });
    const naoComprou = Object.values(naoMap).sort((a, b) => a.nome.localeCompare(b.nome));

    return res.json({
      cod_pdv: codPdv, categoria, mes,
      comprou, naoComprou,
      total_caixas: r1(comprou.reduce((s, x) => s + (x.caixas || 0), 0)),
      total_hl: r3(comprou.reduce((s, x) => s + x.volume_hl, 0)),
    });
  } catch (err) {
    console.error("cobertura/sku-pdv:", err);
    return res.status(500).json({ error: "Erro ao buscar SKUs do PDV." });
  }
});

module.exports = router;
