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

const num = (v) => parseFloat(String(v ?? "0").replace(",", ".")) || 0;
const r2 = (n) => Math.round(n * 100) / 100;
const r3 = (n) => Math.round(n * 1000) / 1000;
const uniqSort = (arr) => [...new Set(arr.filter(Boolean))].sort();

// GET /api/detalhamento/entrega?mes=&setor=&motivo=   (todos opcionais; vazio = consolidado)
router.get("/entrega", async (req, res) => {
  try {
    const mes = String(req.query.mes || "").trim();
    const setor = String(req.query.setor || "").trim();
    const motivo = String(req.query.motivo || "").trim();

    const [frustradasRaw, efetivadasRaw] = await Promise.all([
      readSheet("entregas_frustradas").catch(() => []),
      readSheet("entregas_efetivadas").catch(() => []),
    ]);

    const frustradas = filtrarPorPerfil(frustradasRaw, req.user);
    const efetivadas = filtrarPorPerfil(efetivadasRaw, req.user);

    // Opções de filtro (a partir do universo visível)
    const opcoes = {
      meses: uniqSort(frustradas.map((r) => String(r.mes_referencia))),
      setores: uniqSort(frustradas.map((r) => String(r.setor))),
      motivos: uniqSort(frustradas.map((r) => String(r.desc_motivo))),
    };

    const matchMes = (r, campo = "mes_referencia") => !mes || String(r[campo]) === mes;
    const matchSetor = (r) => !setor || String(r.setor) === setor;
    const matchMotivo = (r) => !motivo || String(r.desc_motivo) === motivo;

    const fFilt = frustradas.filter((r) => matchMes(r) && matchSetor(r) && matchMotivo(r));
    // Efetivado ignora o filtro de motivo (motivo só existe na frustrada)
    const eFilt = efetivadas.filter((r) => matchMes(r) && matchSetor(r));

    const volEfetivado = r3(eFilt.reduce((s, r) => s + num(r.volume_entregue_hl), 0));
    const volFrustrado = r3(fFilt.reduce((s, r) => s + num(r.volume_hl), 0));
    const valorFrustrado = r2(fFilt.reduce((s, r) => s + num(r.valor), 0));
    const base = volEfetivado + volFrustrado;
    const taxa = base > 0 ? Math.round((volFrustrado / base) * 1000) / 10 : null;

    const agrupar = (lista, chave, rotulo) => {
      const m = {};
      lista.forEach((r) => {
        const k = String(r[chave] || "—").trim() || "—";
        if (!m[k]) m[k] = { [rotulo]: k, qtd: 0, volume_hl: 0, valor: 0 };
        m[k].qtd += 1;
        m[k].volume_hl += num(r.volume_hl);
        m[k].valor += num(r.valor);
      });
      return Object.values(m)
        .map((x) => ({ ...x, volume_hl: r3(x.volume_hl), valor: r2(x.valor) }))
        .sort((a, b) => b.volume_hl - a.volume_hl);
    };

    const porMotivo = agrupar(fFilt, "desc_motivo", "desc_motivo");
    const porSetor = agrupar(fFilt, "setor", "setor");

    // Por PDV
    const mapPdv = {};
    fFilt.forEach((r) => {
      const k = String(r.cod_pdv || "—");
      if (!mapPdv[k]) mapPdv[k] = { cod_pdv: k, nome_pdv: r.nome_pdv, setor: r.setor, qtd: 0, volume_hl: 0, valor: 0 };
      mapPdv[k].qtd += 1;
      mapPdv[k].volume_hl += num(r.volume_hl);
      mapPdv[k].valor += num(r.valor);
    });
    const porPdv = Object.values(mapPdv)
      .map((x) => ({ ...x, volume_hl: r3(x.volume_hl), valor: r2(x.valor) }))
      .sort((a, b) => b.volume_hl - a.volume_hl)
      .slice(0, 101);

    const detalhe = fFilt
      .map((r) => ({
        setor: r.setor, data: r.data, nota: r.nota, cod_pdv: r.cod_pdv, nome_pdv: r.nome_pdv,
        desc_motivo: r.desc_motivo, volume_hl: r3(num(r.volume_hl)), valor: r2(num(r.valor)),
      }))
      .sort((a, b) => b.volume_hl - a.volume_hl)
      .slice(0, 800);

    return res.json({
      filtros: { mes, setor, motivo },
      opcoes,
      volume_efetivado_hl: volEfetivado,
      volume_frustrado_hl: volFrustrado,
      valor_frustrado: valorFrustrado,
      qtd_frustradas: fFilt.length,
      taxa_frustracao_pct: taxa,
      por_motivo: porMotivo,
      por_setor: porSetor,
      por_pdv: porPdv,
      detalhe,
      tem_dados: frustradas.length > 0 || efetivadas.length > 0,
    });
  } catch (err) {
    console.error("detalhamento/entrega:", err);
    return res.status(500).json({ error: "Erro ao buscar dados de entrega." });
  }
});

// GET /api/detalhamento/ruptura?mes=   (vazio = consolidado do quadrimestre)
router.get("/ruptura", async (req, res) => {
  try {
    const mes = String(req.query.mes || "").trim();
    const [produtoRaw, clienteRaw] = await Promise.all([
      readSheet("ruptura_produto").catch(() => []),
      readSheet("ruptura_cliente").catch(() => []),
    ]);

    const cliente = filtrarPorPerfil(clienteRaw, req.user);
    const produto = produtoRaw; // produto não tem setor (visão admin)

    // Chart: total por mês (sempre todos os meses)
    const mapMes = {};
    produto.forEach((r) => {
      const m = String(r.mes);
      if (!mapMes[m]) mapMes[m] = { mes: m, volume_falta_hl: 0, qtd_faltas: 0 };
      mapMes[m].volume_falta_hl += num(r.volume_falta_hl);
      mapMes[m].qtd_faltas += Math.round(num(r.qtd_faltas));
    });
    const meses = uniqSort(Object.keys(mapMes));
    const porMes = meses.map((m) => ({ ...mapMes[m], volume_falta_hl: r3(mapMes[m].volume_falta_hl) }));

    const matchMes = (r) => !mes || String(r.mes) === mes;

    // Produtos (consolida meses do escopo)
    const mapProd = {};
    produto.filter(matchMes).forEach((r) => {
      const k = String(r.cod_produto || "").trim();
      if (!mapProd[k]) mapProd[k] = { cod_produto: k, nome_produto: r.nome_produto, categoria: r.categoria || "", qtd_faltas: 0, volume_falta_hl: 0 };
      mapProd[k].qtd_faltas += Math.round(num(r.qtd_faltas));
      mapProd[k].volume_falta_hl += num(r.volume_falta_hl);
    });
    const porProduto = Object.values(mapProd)
      .map((p) => ({ ...p, volume_falta_hl: r3(p.volume_falta_hl) }))
      .sort((a, b) => b.volume_falta_hl - a.volume_falta_hl);

    // Clientes (consolida meses do escopo) — top 101
    const mapCli = {};
    cliente.filter(matchMes).forEach((r) => {
      const k = String(r.cod_pdv || "").trim();
      if (!mapCli[k]) mapCli[k] = { cod_pdv: k, nome_pdv: r.nome_pdv, setor: r.setor, qtd_faltas: 0, volume_falta_hl: 0 };
      mapCli[k].qtd_faltas += Math.round(num(r.qtd_faltas));
      mapCli[k].volume_falta_hl += num(r.volume_falta_hl);
    });
    const porCliente = Object.values(mapCli)
      .map((c) => ({ ...c, volume_falta_hl: r3(c.volume_falta_hl) }))
      .sort((a, b) => b.volume_falta_hl - a.volume_falta_hl)
      .slice(0, 101);

    const totalVolume = r3(porProduto.reduce((s, p) => s + p.volume_falta_hl, 0));

    return res.json({
      filtros: { mes },
      total_volume_falta_hl: totalVolume,
      produtos_afetados: porProduto.length,
      clientes_afetados: porCliente.length,
      por_produto: porProduto,
      por_cliente: porCliente,
      quadrimestre: { meses, por_mes: porMes },
      tem_dados: produto.length > 0 || cliente.length > 0,
    });
  } catch (err) {
    console.error("detalhamento/ruptura:", err);
    return res.status(500).json({ error: "Erro ao buscar dados de ruptura." });
  }
});

module.exports = router;
