// Deck de Estoque — visão por categoria (HOP) × produtos, no estilo do deck em PDF.
// Linhas: Grade de Estoque, Agendados D+7, 1º Vencimento (+ Trânsito/Previsão vazias).
// Fontes: grade_estoque (saldo) · deck_agendados (caixas D+7) · deck_vencimento (validade)
//         · produtos_base (cod→categorias) · produtos_full (nome). Visível a todos logados.
const express = require("express");
const router = express.Router();
const { readSheet } = require("../services/sheets");
const { authMiddleware } = require("../middleware/auth");

router.use(authMiddleware);

const num = (v) => parseFloat(String(v ?? "0").replace(",", ".")) || 0;
const int = (v) => Math.round(num(v));
const normCod = (v) => String(v ?? "").trim().replace(/^0+/, "") || "0";

// Ordem de exibição das categorias (as demais entram depois, em ordem alfabética).
const ORDEM_CAT = [
  "CERVEJA", "CERVEJA ZERO", "CERVEJA MULTIPACK", "NAB", "NAB ZERO",
  "MATCH", "LITRINHO", "BALANCED CHOICE", "HE", "GIRO RGB",
];

// Categorias que NÃO entram no Deck.
const CAT_FORA = new Set(["MKTP", "MARKETPLACE"]);

// dias até a validade (a partir de hoje) — p/ colorir o 1º vencimento
function diasAte(ddmmyyyy) {
  const m = String(ddmmyyyy || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  return Math.round((d - hoje) / 86400000);
}

// GET /api/deck
router.get("/", async (req, res) => {
  try {
    const [grade, agendados, vencimento, base, full, statusArq] = await Promise.all([
      readSheet("grade_estoque").catch(() => []),
      readSheet("deck_agendados").catch(() => []),
      readSheet("deck_vencimento").catch(() => []),
      readSheet("produtos_base").catch(() => []),
      readSheet("produtos_full").catch(() => []),
      readSheet("status_arquivos").catch(() => []),
    ]);

    // cod → categorias (uma ou mais)
    const catDe = {};
    base.forEach((p) => {
      const c = normCod(p.cod);
      const cats = String(p.categorias || p.categoria || "")
        .split(/[,;|]/).map((x) => x.trim().toUpperCase()).filter(Boolean)
        .filter((x) => !CAT_FORA.has(x));
      if (c) catDe[c] = cats;
    });

    // cod → nome (base de produtos completa)
    const nomeDe = {};
    full.forEach((p) => { const c = normCod(p.cod); if (c) nomeDe[c] = String(p.nome || "").trim(); });

    // Índices das 3 métricas
    const gradeDe = {}; grade.forEach((r) => { gradeDe[normCod(r.cod)] = int(r.saldo); });
    const agendDe = {}, nomeAg = {};
    agendados.forEach((r) => { const c = normCod(r.cod_produto); agendDe[c] = int(r.caixas); if (r.nome_produto) nomeAg[c] = String(r.nome_produto).trim(); });
    const vencDe = {}; vencimento.forEach((r) => { vencDe[normCod(r.cod_produto)] = String(r.validade || "").trim(); });

    // Universo: produtos COM categoria que aparecem em alguma das 3 fontes.
    const universo = new Set();
    [Object.keys(gradeDe), Object.keys(agendDe), Object.keys(vencDe)].forEach((ks) =>
      ks.forEach((c) => { if (catDe[c] && catDe[c].length) universo.add(c); }));

    // Monta produtos por categoria
    const porCat = {};
    universo.forEach((cod) => {
      const prod = {
        cod,
        nome: nomeDe[cod] || nomeAg[cod] || cod,
        foto: `/produtos/${cod}.png`,
        grade: gradeDe[cod] ?? 0,
        agendados: agendDe[cod] ?? 0,
        venc: vencDe[cod] || "",
        vencDias: diasAte(vencDe[cod]),
        transito: null,   // linhas previstas p/ preencher depois
        previsao: null,
      };
      catDe[cod].forEach((cat) => {
        (porCat[cat] = porCat[cat] || []).push(prod);
      });
    });

    // Ordena categorias (ORDEM_CAT primeiro) e produtos (grade desc, depois agendados)
    const cats = Object.keys(porCat).sort((a, b) => {
      const ia = ORDEM_CAT.indexOf(a), ib = ORDEM_CAT.indexOf(b);
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      return a.localeCompare(b);
    });
    // Dentro da categoria, ordena por MARCA (início do nome) → mesma marca fica junta;
    // desempate por nome completo (agrupa embalagens da marca) e depois grade desc.
    const marca = (p) => String(p.nome || "").trim().split(/\s+/)[0].toUpperCase();
    const secoes = cats.map((cat) => ({
      categoria: cat,
      produtos: porCat[cat].sort((a, b) =>
        marca(a).localeCompare(marca(b), "pt-BR") ||
        String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR", { numeric: true }) ||
        b.grade - a.grade),
    }));

    const st = statusArq.find((r) => /grade/i.test(String(r.arquivo || "")));
    return res.json({
      atualizado_em: st ? String(st.atualizado_em || "").trim() : "",
      total_produtos: universo.size,
      secoes,
    });
  } catch (e) {
    console.error("deck:", e);
    return res.status(500).json({ error: "Erro ao montar o Deck de Estoque." });
  }
});

module.exports = router;
