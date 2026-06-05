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
const normNota = (v) => String(v ?? "").trim().replace(/^0+/, "");

// GET /api/detalhamento/entrega?mes=&setor=&motivo=&pdv=
router.get("/entrega", async (req, res) => {
  try {
    const mes = String(req.query.mes || "").trim();
    const setor = String(req.query.setor || "").trim();
    const motivo = String(req.query.motivo || "").trim();
    const pdv = String(req.query.pdv || "").trim().toLowerCase();

    const [frustradasRaw, efetivadasRaw] = await Promise.all([
      readSheet("entregas_frustradas").catch(() => []),
      readSheet("entregas_efetivadas").catch(() => []),
    ]);

    const frustradas = filtrarPorPerfil(frustradasRaw, req.user);
    const efetivadas = filtrarPorPerfil(efetivadasRaw, req.user);

    const opcoes = {
      meses: uniqSort(frustradas.map((r) => String(r.mes_referencia))),
      setores: uniqSort(frustradas.map((r) => String(r.setor))),
      motivos: uniqSort(frustradas.map((r) => String(r.desc_motivo))),
    };

    const matchPdv = (r) =>
      !pdv ||
      String(r.cod_pdv || "").toLowerCase().includes(pdv) ||
      String(r.nome_pdv || "").toLowerCase().includes(pdv);

    const fFilt = frustradas.filter(
      (r) =>
        (!mes || String(r.mes_referencia) === mes) &&
        (!setor || String(r.setor) === setor) &&
        (!motivo || String(r.desc_motivo) === motivo) &&
        matchPdv(r)
    );
    // Efetivado ignora motivo/pdv (não existem nessa base)
    const eFilt = efetivadas.filter(
      (r) => (!mes || String(r.mes_referencia) === mes) && (!setor || String(r.setor) === setor)
    );

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
      .slice(0, 1500);

    return res.json({
      filtros: { mes, setor, motivo, pdv },
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

// GET /api/detalhamento/nota?nota=123  — itens da nota fiscal frustrada
router.get("/nota", async (req, res) => {
  try {
    const nota = normNota(req.query.nota);
    if (!nota) return res.json({ nota, itens: [] });
    const todos = await readSheet("nota_itens").catch(() => []);
    const itens = todos
      .filter((r) => normNota(r.nota) === nota)
      .map((r) => ({
        cod_produto: r.cod_produto,
        nome_produto: r.nome_produto,
        volume_marcacao_hl: r3(num(r.volume_marcacao_hl)),
        volume_entrega_hl: r3(num(r.volume_entrega_hl)),
      }))
      .sort((a, b) => b.volume_marcacao_hl - a.volume_marcacao_hl);
    return res.json({ nota, itens });
  } catch (err) {
    console.error("detalhamento/nota:", err);
    return res.status(500).json({ error: "Erro ao buscar itens da nota." });
  }
});

// GET /api/detalhamento/ruptura?mes=   (vazio = consolidado do quadrimestre)
router.get("/ruptura", async (req, res) => {
  try {
    const mes = String(req.query.mes || "").trim();
    const detRaw = await readSheet("ruptura_detalhe").catch(() => []);
    const det = filtrarPorPerfil(detRaw, req.user);

    // Chart: total por mês (todos) + média do período
    const mapMes = {};
    det.forEach((r) => {
      const m = String(r.mes);
      if (!mapMes[m]) mapMes[m] = { mes: m, volume_falta_hl: 0, qtd_faltas: 0 };
      mapMes[m].volume_falta_hl += num(r.volume_falta_hl);
      mapMes[m].qtd_faltas += Math.round(num(r.qtd_faltas));
    });
    const meses = uniqSort(Object.keys(mapMes));
    const porMes = meses.map((m) => ({ ...mapMes[m], volume_falta_hl: r3(mapMes[m].volume_falta_hl) }));
    const media = porMes.length ? r3(porMes.reduce((s, m) => s + m.volume_falta_hl, 0) / porMes.length) : 0;

    // Escopo (mês ou consolidado)
    const escopo = det.filter((r) => !mes || String(r.mes) === mes);

    const mapProd = {};
    escopo.forEach((r) => {
      const k = String(r.cod_produto || "").trim();
      if (!mapProd[k]) mapProd[k] = { cod_produto: k, nome_produto: r.nome_produto, categoria: r.categoria || "", qtd_faltas: 0, volume_falta_hl: 0 };
      mapProd[k].qtd_faltas += Math.round(num(r.qtd_faltas));
      mapProd[k].volume_falta_hl += num(r.volume_falta_hl);
    });
    const porProduto = Object.values(mapProd)
      .map((p) => ({ ...p, volume_falta_hl: r3(p.volume_falta_hl) }))
      .sort((a, b) => b.volume_falta_hl - a.volume_falta_hl);

    const mapCli = {};
    escopo.forEach((r) => {
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

    // Detalhe do escopo (para drill-down produto↔cliente↔data no frontend)
    const detalhe = escopo.map((r) => ({
      setor: r.setor, cod_pdv: r.cod_pdv, nome_pdv: r.nome_pdv,
      cod_produto: r.cod_produto, nome_produto: r.nome_produto, categoria: r.categoria,
      data: r.data, mes: r.mes, qtd_faltas: Math.round(num(r.qtd_faltas)),
      volume_falta_hl: r3(num(r.volume_falta_hl)),
    }));

    return res.json({
      filtros: { mes },
      total_volume_falta_hl: totalVolume,
      produtos_afetados: porProduto.length,
      clientes_afetados: porCliente.length,
      por_produto: porProduto,
      por_cliente: porCliente,
      detalhe,
      quadrimestre: { meses, por_mes: porMes, media },
      tem_dados: det.length > 0,
    });
  } catch (err) {
    console.error("detalhamento/ruptura:", err);
    return res.status(500).json({ error: "Erro ao buscar dados de ruptura." });
  }
});

module.exports = router;
