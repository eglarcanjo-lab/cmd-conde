// Detalhamento HOP — relatórios admin (Entrega + Ruptura de Estoque)
const express = require("express");
const router = express.Router();
const { readSheet } = require("../services/sheets");
const { authMiddleware } = require("../middleware/auth");

router.use(authMiddleware);

function filtrarPorPerfil(dados, usuario, campoSetor = "setor") {
  if (["admin", "director"].includes(usuario.perfil)) return dados;
  if (usuario.perfil === "gv1") return dados.filter((r) => String(r[campoSetor]).startsWith("1"));
  if (usuario.perfil === "gv3") return dados.filter((r) => String(r[campoSetor]).startsWith("3"));
  return dados.filter((r) => String(r[campoSetor]) === String(usuario.cod));
}

function mesAtual() {
  const now = new Date();
  const br = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return `${br.getFullYear()}-${String(br.getMonth() + 1).padStart(2, "0")}`;
}

const num = (v) => parseFloat(String(v ?? "0").replace(",", ".")) || 0;
const r2 = (n) => Math.round(n * 100) / 100;
const r3 = (n) => Math.round(n * 1000) / 1000;

// GET /api/detalhamento/entrega?mes=YYYY-MM
router.get("/entrega", async (req, res) => {
  try {
    const mes = String(req.query.mes || mesAtual()).trim();
    const [frustradas, resumo, efetivadas] = await Promise.all([
      readSheet("entregas_frustradas").catch(() => []),
      readSheet("entregas_resumo_motivo").catch(() => []),
      readSheet("entregas_efetivadas").catch(() => []),
    ]);

    const fMes = filtrarPorPerfil(frustradas, req.user).filter((r) => String(r.mes_referencia) === mes);
    const rMes = filtrarPorPerfil(resumo, req.user).filter((r) => String(r.mes_referencia) === mes);
    const eMes = filtrarPorPerfil(efetivadas, req.user).filter((r) => String(r.mes_referencia) === mes);

    const volEfetivado = r3(eMes.reduce((s, r) => s + num(r.volume_entregue_hl), 0));
    const volFrustrado = r3(fMes.reduce((s, r) => s + num(r.volume_hl), 0));
    const valorFrustrado = r2(fMes.reduce((s, r) => s + num(r.valor), 0));
    const base = volEfetivado + volFrustrado;
    const taxa = base > 0 ? Math.round((volFrustrado / base) * 1000) / 10 : null;

    // Resumo por motivo (agrega setores)
    const mapMotivo = {};
    rMes.forEach((r) => {
      const m = String(r.desc_motivo || "—").trim() || "—";
      if (!mapMotivo[m]) mapMotivo[m] = { desc_motivo: m, qtd: 0, volume_hl: 0, valor: 0 };
      mapMotivo[m].qtd += Math.round(num(r.qtd));
      mapMotivo[m].volume_hl += num(r.volume_hl);
      mapMotivo[m].valor += num(r.valor);
    });
    const porMotivo = Object.values(mapMotivo)
      .map((m) => ({ ...m, volume_hl: r3(m.volume_hl), valor: r2(m.valor) }))
      .sort((a, b) => b.volume_hl - a.volume_hl);

    // Detalhe (notas) — ordenado por volume desc, limitado
    const detalhe = fMes
      .map((r) => ({
        setor: r.setor, data: r.data, nota: r.nota, cod_pdv: r.cod_pdv, nome_pdv: r.nome_pdv,
        desc_motivo: r.desc_motivo, volume_hl: r3(num(r.volume_hl)), valor: r2(num(r.valor)),
      }))
      .sort((a, b) => b.volume_hl - a.volume_hl)
      .slice(0, 500);

    return res.json({
      mes,
      volume_efetivado_hl: volEfetivado,
      volume_frustrado_hl: volFrustrado,
      valor_frustrado: valorFrustrado,
      qtd_frustradas: fMes.length,
      taxa_frustracao_pct: taxa,
      por_motivo: porMotivo,
      detalhe,
      tem_dados: frustradas.length > 0 || efetivadas.length > 0,
    });
  } catch (err) {
    console.error("detalhamento/entrega:", err);
    return res.status(500).json({ error: "Erro ao buscar dados de entrega." });
  }
});

// GET /api/detalhamento/ruptura?mes=YYYY-MM
router.get("/ruptura", async (req, res) => {
  try {
    const mes = String(req.query.mes || mesAtual()).trim();
    const [rupturaMes, quad] = await Promise.all([
      readSheet("ruptura_mes").catch(() => []),
      readSheet("ruptura_quadrimestre").catch(() => []),
    ]);

    const rmFiltrada = filtrarPorPerfil(rupturaMes, req.user).filter((r) => String(r.mes_referencia) === mes);

    // Por produto (agrega setores do mês)
    const mapProd = {};
    rmFiltrada.forEach((r) => {
      const cod = String(r.cod_produto || "").trim();
      if (!mapProd[cod]) {
        mapProd[cod] = { cod_produto: cod, nome_produto: r.nome_produto, categoria: r.categoria || "", qtd_faltas: 0, volume_falta_hl: 0 };
      }
      mapProd[cod].qtd_faltas += Math.round(num(r.qtd_faltas));
      mapProd[cod].volume_falta_hl += num(r.volume_falta_hl);
    });
    const porProduto = Object.values(mapProd)
      .map((p) => ({ ...p, volume_falta_hl: r3(p.volume_falta_hl) }))
      .sort((a, b) => b.volume_falta_hl - a.volume_falta_hl);

    const totalVolume = r3(porProduto.reduce((s, p) => s + p.volume_falta_hl, 0));

    // Comparativo quadrimestre (não filtra por setor — visão geral; quad não tem setor)
    const mesesSet = [...new Set(quad.map((r) => String(r.mes)).filter(Boolean))].sort();
    const porMesMap = {};
    quad.forEach((r) => {
      const m = String(r.mes);
      if (!porMesMap[m]) porMesMap[m] = { mes: m, volume_falta_hl: 0, qtd_faltas: 0 };
      porMesMap[m].volume_falta_hl += num(r.volume_falta_hl);
      porMesMap[m].qtd_faltas += Math.round(num(r.qtd_faltas));
    });
    const porMes = mesesSet.map((m) => ({ ...porMesMap[m], volume_falta_hl: r3(porMesMap[m].volume_falta_hl) }));

    return res.json({
      mes,
      total_volume_falta_hl: totalVolume,
      produtos_afetados: porProduto.length,
      por_produto: porProduto,
      quadrimestre: { meses: mesesSet, por_mes: porMes },
      tem_dados: rupturaMes.length > 0 || quad.length > 0,
    });
  } catch (err) {
    console.error("detalhamento/ruptura:", err);
    return res.status(500).json({ error: "Erro ao buscar dados de ruptura." });
  }
});

module.exports = router;
