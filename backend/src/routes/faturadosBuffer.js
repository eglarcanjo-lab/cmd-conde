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
const r1 = (n) => Math.round((Number(n) || 0) * 10) / 10;

// Agrupa o detalhe (linhas por pedido × tipo) por PDV.
// Retorna: { pdvs: [{cod,nome,setor,pedidos:[{num,itens:[{tipo,vol}],total}],porTipo,total,qtdPedidos}],
//            total, qtdPedidos, qtdPdvs, porTipo }
function agrupar(det) {
  const pdvMap = new Map();
  let totalGeral = 0;
  const porTipoGeral = {};
  const pedidosGeral = new Set();

  for (const row of det) {
    const cod = String(row.cod_pdv || "").trim();
    if (!cod) continue;
    const nome = String(row.nome_pdv || "").trim();
    const setor = String(row.setor || "").trim();
    const numPed = String(row.num_pedido || "").trim();
    const tipo = String(row.tipo_operacao || "").trim() || "(sem tipo)";
    const vol = num(row.volume_marcacao);

    if (!pdvMap.has(cod)) pdvMap.set(cod, { cod, nome, setor, pedMap: new Map(), porTipo: {}, total: 0 });
    const pdv = pdvMap.get(cod);
    if (!pdv.pedMap.has(numPed)) pdv.pedMap.set(numPed, { num: numPed, itens: [], total: 0 });
    const ped = pdv.pedMap.get(numPed);
    ped.itens.push({ tipo, vol: r1(vol) });
    ped.total += vol;
    pdv.porTipo[tipo] = (pdv.porTipo[tipo] || 0) + vol;
    pdv.total += vol;

    porTipoGeral[tipo] = (porTipoGeral[tipo] || 0) + vol;
    totalGeral += vol;
    pedidosGeral.add(cod + "|" + numPed);
  }

  const pdvs = [...pdvMap.values()]
    .map((p) => ({
      cod: p.cod, nome: p.nome, setor: p.setor,
      pedidos: [...p.pedMap.values()].map((x) => ({ num: x.num, itens: x.itens, total: r1(x.total) }))
        .sort((a, b) => b.total - a.total),
      porTipo: Object.fromEntries(Object.entries(p.porTipo).map(([k, v]) => [k, r1(v)])),
      total: r1(p.total),
      qtdPedidos: p.pedMap.size,
    }))
    .sort((a, b) => b.total - a.total);

  return {
    pdvs,
    total: r1(totalGeral),
    qtdPedidos: pedidosGeral.size,
    qtdPdvs: pdvs.length,
    porTipo: Object.fromEntries(Object.entries(porTipoGeral).map(([k, v]) => [k, r1(v)])),
  };
}

// GET /api/faturados-buffer?setor=101 — Faturados × Buffer, escopo por perfil.
// admin/director/gv podem passar ?setor=<cod> para "ver por RN"; RN vê só o dele.
router.get("/", async (req, res) => {
  try {
    const [fat, buf] = await Promise.all([
      readSheet("faturados_detalhe").catch(() => []),
      readSheet("buffer_detalhe").catch(() => []),
    ]);
    let detFat = filtrarPorPerfil(fat, req.user, "setor");
    let detBuf = filtrarPorPerfil(buf, req.user, "setor");

    // Setores disponíveis (para o seletor "ver por RN" do admin/diretor/gv)
    const podeEscolher = ["admin", "director", "gv1", "gv3"].includes(req.user.perfil);
    const setores = podeEscolher
      ? [...new Set([...detFat, ...detBuf].map((r) => String(r.setor || "").trim()).filter(Boolean))].sort(
          (a, b) => Number(a) - Number(b)
        )
      : [];

    // Filtro opcional por setor (ver por RN)
    const setorSel = String(req.query.setor || "").trim();
    if (setorSel && podeEscolher) {
      detFat = detFat.filter((r) => String(r.setor).trim() === setorSel);
      detBuf = detBuf.filter((r) => String(r.setor).trim() === setorSel);
    }

    const faturados = agrupar(detFat);
    const buffer = agrupar(detBuf);
    const conversaoHl = faturados.total + buffer.total > 0
      ? Math.round((faturados.total / (faturados.total + buffer.total)) * 100)
      : null;

    return res.json({
      podeEscolher,
      setores,
      setorSelecionado: setorSel || null,
      resumo: {
        faturadoHl: faturados.total, faturadoPedidos: faturados.qtdPedidos,
        bufferHl: buffer.total, bufferPedidos: buffer.qtdPedidos,
        conversaoHl,
      },
      faturados,
      buffer,
    });
  } catch (e) {
    console.error("faturados-buffer:", e);
    return res.status(500).json({ error: "Erro ao montar Faturados × Buffer." });
  }
});

module.exports = router;
