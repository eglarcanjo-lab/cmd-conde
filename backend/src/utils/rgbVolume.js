// Volume RGB TT por setor no mês = GIRO RGB + LITRINHO + TRIMARCAS RGB HE (Original/Stella/
// Spaten). Produto com mais de uma dessas categorias conta 1x (não dá p/ somar o rv_volume,
// que explode as categorias). Fonte: vendas_cliente_produto (mês) × produtos_base.
// Mesmo grupo do Relatório aberto (grupo:rgb).
const { readSheet, readSheetMonths } = require("../services/sheets");

const CATS_RGB = new Set(["GIRO RGB", "LITRINHO", "TRIMARCA RGB HE (ORIGINAL)", "TRIMARCA RGB HE (STELLA)", "TRIMARCA RGB HE (SPATEN)"]);
const normCod = (v) => String(v ?? "").trim().replace(/\.0$/, "").replace(/^0+/, "");
const num = (v) => parseFloat(String(v ?? "0").replace(",", ".")) || 0;
const catsDe = (p) => String(p.categorias || p.categoria || "").toUpperCase().split(/\s*[|,;]\s*/).map((c) => c.trim()).filter(Boolean);

// { setor: HL } — todos os setores (o escopo por perfil é aplicado por quem usa)
async function rgbPorSetor(mes) {
  try {
    const [base, vendas] = await Promise.all([
      readSheet("produtos_base").catch(() => []),
      readSheetMonths("vendas_cliente_produto", "mes_referencia", [mes]).catch(() => []),
    ]);
    const skus = new Set(base.filter((p) => catsDe(p).some((c) => CATS_RGB.has(c))).map((p) => normCod(p.cod)));
    const out = {};
    vendas.forEach((r) => {
      if (!String(r.mes_referencia || "").startsWith(mes) || !skus.has(normCod(r.cod_produto))) return;
      const s = String(r.setor || "").trim(); if (!s) return;
      out[s] = (out[s] || 0) + num(r.volume_hl);
    });
    return out;
  } catch (e) { console.error("rgbPorSetor:", e.message); return {}; }
}

module.exports = { rgbPorSetor, CATS_RGB };
