// Acompanhamento de conversão — Stella Pure Gold (temporário, dentro de Incentivos).
// PG600 (33857): PDVs que compram ao menos uma base 600ml (Original/Stella/Spaten) e
//   AINDA NÃO compraram a Pure Gold 600ml.
// PGLN (29580): PDVs que compram qualquer outra Long Neck e ainda NÃO compraram a Pure Gold LN.
// Base: trimestre anterior (3 meses completos, sem o mês atual). Fácil de remover: apagar
// este arquivo, o mount em index.js e o componente ConversaoPG do front.
const express = require("express");
const router = express.Router();
const { readSheet, readSheetMonths } = require("../services/sheets");
const { authMiddleware } = require("../middleware/auth");
const { filtrarPorPerfil } = require("../utils/perfil");

const normCod = (v) => String(v ?? "").trim().replace(/^0+/, "") || "0";
const num = (v) => parseFloat(String(v ?? "0").replace(",", ".")) || 0;
const ROT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const PG600 = "33857";           // STELLA ARTOIS PURE GOLD 600ML
const PGLN = "29580";            // STELLA ARTOIS PURE GOLD LONG NECK 330ML
const BASE600 = [
  { cod: "2546",  marca: "Original" }, // ORIGINAL 600ML
  { cod: "20530", marca: "Stella" },   // STELLA ARTOIS 600 ML
  { cod: "23186", marca: "Spaten" },   // SPATEN N 600ML
];

// 3 meses completos ANTERIORES ao mês atual (rolante, sem o mês corrente).
function trimestreAnterior() {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const y = d.getFullYear(), m0 = d.getMonth();
  const meses = [3, 2, 1].map((k) => { const x = new Date(y, m0 - k, 1); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`; });
  const rot = (m) => ROT[(Number(m.split("-")[1]) || 1) - 1];
  return { meses, label: `${rot(meses[0])}–${rot(meses[2])}` };
}

router.use(authMiddleware);

router.get("/", async (req, res) => {
  try {
    const { meses, label } = trimestreAnterior();
    const [vendasRaw, prodFull, usuarios] = await Promise.all([
      readSheetMonths("vendas_cliente_produto", "mes_referencia", meses).catch(() => []),
      readSheet("produtos_full").catch(() => []),
      readSheet("usuarios").catch(() => []),
    ]);
    const vendas = filtrarPorPerfil(vendasRaw, req.user, "setor");
    const rnMap = {};
    usuarios.forEach((u) => { if (u.cod) rnMap[String(u.cod).trim()] = String(u.nome || "").trim(); });

    // SKUs Long Neck (por nome), exceto a própria Pure Gold LN.
    const lnCods = new Set();
    prodFull.forEach((p) => {
      const nome = String(p.nome || "").toUpperCase();
      const c = normCod(p.cod);
      if (c !== PGLN && (nome.includes("LONG NECK") || /\bLN\b/.test(nome))) lnCods.add(c);
    });

    // Compras por PDV no trimestre (SKUs com volume > 0).
    const pdvs = {};
    vendas.forEach((r) => {
      if (num(r.volume_hl) <= 0) return;
      const cod = String(r.cod_pdv || "").trim(); if (!cod) return;
      const e = pdvs[cod] || (pdvs[cod] = { cod_pdv: cod, nome_pdv: String(r.nome_pdv || "").trim(), setor: String(r.setor || "").trim(), comprou: new Set() });
      e.comprou.add(normCod(r.cod_produto));
    });
    const arr = Object.values(pdvs);
    const ordena = (a, b) => String(a.setor).localeCompare(String(b.setor)) || a.nome_pdv.localeCompare(b.nome_pdv);

    // PG600: NÃO comprou 33857 e comprou ≥1 base 600ml.
    const pg600 = arr
      .filter((e) => !e.comprou.has(PG600) && BASE600.some((b) => e.comprou.has(b.cod)))
      .map((e) => ({
        cod_pdv: e.cod_pdv, nome_pdv: e.nome_pdv, setor: e.setor, rn: rnMap[e.setor] || "",
        original: e.comprou.has("2546"), stella: e.comprou.has("20530"), spaten: e.comprou.has("23186"),
      }))
      .sort(ordena);

    // PGLN: NÃO comprou 29580 e comprou qualquer outra LN.
    const pgln = arr
      .filter((e) => !e.comprou.has(PGLN) && [...e.comprou].some((c) => lnCods.has(c)))
      .map((e) => ({
        cod_pdv: e.cod_pdv, nome_pdv: e.nome_pdv, setor: e.setor, rn: rnMap[e.setor] || "",
        qtd_ln: [...e.comprou].filter((c) => lnCods.has(c)).length,
      }))
      .sort(ordena);

    return res.json({
      trimestre: label, meses,
      pg600: { alvo: PG600, base: BASE600, total: pg600.length, pdvs: pg600 },
      pgln: { alvo: PGLN, ln_skus: lnCods.size, total: pgln.length, pdvs: pgln },
    });
  } catch (e) {
    console.error("conversao-pg:", e);
    return res.status(500).json({ error: "Erro ao montar o acompanhamento." });
  }
});

module.exports = router;
