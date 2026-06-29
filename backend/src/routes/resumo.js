const express = require("express");
const router = express.Router();
const { readSheet } = require("../services/sheets");
const { authMiddleware } = require("../middleware/auth");
const { filtrarPorPerfil } = require("../utils/perfil");

router.use(authMiddleware);

const num = (v) => {
  if (v === null || v === undefined || v === "") return 0;
  const n = parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? 0 : n;
};

// GET /api/resumo/volumes?mes=YYYY-MM — bloco "Volumes" da home (meta × realizado).
// Escopo: admin/director = operação (soma dos setores); GV = sua região; RN = seu setor.
// Cerveja/NAB/Match/Mktp vêm de rv_resultado (a RV já soma "cerveja = tudo exceto
// MKTP/NAB/NAB Zero/Match", incluindo o zero). As "zero" não têm meta oficial:
// monitoramento com meta derivada = 15% do realizado da categoria regular.
router.get("/volumes", async (req, res) => {
  try {
    const mes = req.query.mes || new Date().toISOString().slice(0, 7);
    const [rvResultAll, rvVolAll] = await Promise.all([
      readSheet("rv_resultado").catch(() => []),
      readSheet("rv_volume").catch(() => []),
    ]);
    const rv = filtrarPorPerfil(rvResultAll, req.user, "setor");
    const vol = filtrarPorPerfil(rvVolAll, req.user, "setor");

    const soma = (campo) => rv.reduce((s, r) => s + num(r[campo]), 0);
    const mref = (r) => String(r.mes_ref || r.mes_referencia || "");
    const volCat = (cat) => {
      const c = cat.toUpperCase();
      const sel = vol.filter((r) => String(r.categoria || "").trim().toUpperCase() === c);
      const doMes = sel.filter((r) => mref(r).startsWith(mes));
      return (doMes.length ? doMes : sel).reduce((s, r) => s + num(r.volume), 0);
    };

    const realCerveja = soma("real_cerveja");
    const realNab = soma("real_nab");
    const r1 = (n) => Math.round(n * 10) / 10;
    const pct = (r, m) => (m > 0 ? Math.round((r / m) * 100) : null);
    const mk = (label, real, meta, monit) => ({
      label, real: r1(real), meta: r1(meta), pct: pct(real, meta), monitoramento: !!monit,
    });

    const bars = [
      mk("Cerveja", realCerveja, soma("meta_cerveja")),
      mk("NAB", realNab, soma("meta_nab")),
      mk("Match", soma("real_match"), soma("meta_match")),
      mk("Mktp", soma("real_marketplace"), soma("meta_marketplace")),
      mk("Cerveja Zero", volCat("CERVEJA ZERO"), 0.15 * realCerveja, true),
      mk("NAB Zero", volCat("NAB ZERO"), 0.15 * realNab, true),
    ];
    return res.json({ mes, bars });
  } catch (e) {
    console.error("resumo/volumes:", e);
    return res.status(500).json({ error: "Erro ao montar resumo de volumes." });
  }
});

module.exports = router;
