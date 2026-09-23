// Lia (mascote) — insights do dia p/ o popup: categorias abaixo da tendência + shelf urgente.
// Escopo por perfil: RN vê a tendência dele; diretor/GV vê o consolidado. Shelf é geral (armazém).
const express = require("express");
const router = express.Router();
const { readSheet } = require("../services/sheets");
const { authMiddleware } = require("../middleware/auth");
const { filtrarPorPerfil } = require("../utils/perfil");

router.use(authMiddleware);

const num = (v) => parseFloat(String(v ?? "0").replace(",", ".")) || 0;
const r1 = (n) => Math.round(n * 10) / 10;
const int = (v) => Math.round(num(v));
const pct = (r, m) => (m > 0 ? Math.round((r / m) * 100) : null);
// Dias corridos até a validade (dd/mm/aaaa) — cai a cada dia, sem esperar o próximo import.
function diasAte(ddmmaaaa) {
  const m = String(ddmmaaaa || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const alvo = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const hojeBR = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  hojeBR.setHours(0, 0, 0, 0);
  return Math.round((alvo - hojeBR) / 86400000);
}

// GET /api/lia
router.get("/", async (req, res) => {
  try {
    const [rvAll, volAll, shelf] = await Promise.all([
      readSheet("rv_resultado").catch(() => []),
      readSheet("rv_volume").catch(() => []),
      readSheet("shelf").catch(() => []),
    ]);

    const brNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const mes = `${brNow.getFullYear()}-${String(brNow.getMonth() + 1).padStart(2, "0")}`;
    const mref = (r) => String(r.mes_ref || r.mes_referencia || "");

    const rv = filtrarPorPerfil(rvAll, req.user, "setor")
      .filter((r) => !r.mes_referencia || String(r.mes_referencia).startsWith(mes));
    const vol = filtrarPorPerfil(volAll, req.user, "setor");

    // Fator de tendência: projeta o realizado do mês pelo ritmo de dias úteis (seg-sex).
    const yy = brNow.getFullYear(), mm = brNow.getMonth(), hoje = brNow.getDate();
    const uteis = (ate) => { let c = 0; const d = new Date(yy, mm, 1); while (d.getMonth() === mm && d.getDate() <= ate) { const w = d.getDay(); if (w >= 1 && w <= 5) c++; d.setDate(d.getDate() + 1); } return c; };
    const fator = uteis(31) / Math.max(1, uteis(hoje));

    // 6 categorias (meta × real × tendência) no escopo do usuário — igual à Home.
    const soma = (campo) => rv.reduce((s, r) => s + num(r[campo]), 0);
    const volCat = (cat) => {
      const c = cat.toUpperCase();
      const sel = vol.filter((r) => String(r.categoria || "").trim().toUpperCase() === c);
      const doMes = sel.filter((r) => mref(r).startsWith(mes));
      return (doMes.length ? doMes : sel).reduce((s, r) => s + num(r.volume), 0);
    };
    const mk = (label, real, meta) => ({ label, real: r1(real), meta: r1(meta), pctTend: pct(real * fator, meta) });
    const realCerveja = soma("real_cerveja"), realNab = soma("real_nab");
    const bars = [
      mk("Cerveja", realCerveja, soma("meta_cerveja")),
      mk("NAB", realNab, soma("meta_nab")),
      mk("Match", soma("real_match"), soma("meta_match")),
      mk("Mktp", soma("real_marketplace"), soma("meta_marketplace")),
      mk("Cerveja Zero", volCat("CERVEJA ZERO"), 0.15 * realCerveja),
      mk("NAB Zero", volCat("NAB ZERO"), 0.15 * realNab),
    ];

    // Categorias em alerta: %T (tendência vs meta) < 70%, as 2 piores.
    const categorias = bars
      .filter((b) => b.pctTend != null && b.meta > 0 && b.pctTend < 70)
      .sort((a, b) => a.pctTend - b.pctTend)
      .slice(0, 2)
      .map((b) => ({ categoria: b.label, pctTend: b.pctTend }));

    // Shelf: os 5 mais próximos do vencimento (menos dias p/ vencer), pulando os já vencidos.
    const shelfValidos = shelf
      .map((r) => {
        const dLive = diasAte(String(r.validade || "").trim());
        return {
          cod: String(r.cod_produto || "").trim(),
          descricao: String(r.descricao || "").trim(),
          qtd_cx: int(r.qtd_cx),
          dias_vencer: dLive != null ? dLive : int(r.dias_vencer),
          valor_shelf: num(r.valor_shelf),
        };
      })
      .filter((r) => r.dias_vencer >= 0); // pula os já vencidos
    const shelfTop = shelfValidos.sort((a, b) => a.dias_vencer - b.dias_vencer).slice(0, 5);

    return res.json({
      mes,
      categorias,
      shelf: shelfTop,
      shelf_total: shelfValidos.length,
    });
  } catch (e) {
    console.error("lia:", e);
    return res.status(500).json({ error: "Erro ao montar os insights da Lia." });
  }
});

module.exports = router;
