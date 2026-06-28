// Detalhamento HOP — relatórios admin (Entrega + Ruptura de Estoque)
const express = require("express");
const router = express.Router();
const { readSheet } = require("../services/sheets");
const { authMiddleware } = require("../middleware/auth");

router.use(authMiddleware);

const { filtrarPorPerfil } = require("../utils/perfil");

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
    const dia = String(req.query.dia || "").trim(); // dd/mm/yyyy

    const [frustradasRaw, efetivadasRaw, notaItensRaw] = await Promise.all([
      readSheet("entregas_frustradas").catch(() => []),
      readSheet("entregas_efetivadas").catch(() => []),
      readSheet("nota_itens").catch(() => []),
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
        (!dia || String(r.data).trim() === dia) &&
        matchPdv(r)
    );
    // Efetivado ignora motivo/pdv (não existem nessa base); é mensal (sem dia)
    const eFilt = efetivadas.filter(
      (r) => (!mes || String(r.mes_referencia) === mes) && (!setor || String(r.setor) === setor)
    );

    // Com filtro de DIA, o efetivado/taxa não se aplicam (a base de efetivadas é mensal)
    const volEfetivado = dia ? null : r3(eFilt.reduce((s, r) => s + num(r.volume_entregue_hl), 0));
    const volFrustrado = r3(fFilt.reduce((s, r) => s + num(r.volume_hl), 0));
    const valorFrustrado = r2(fFilt.reduce((s, r) => s + num(r.valor), 0));
    const base = (volEfetivado || 0) + volFrustrado;
    const taxa = dia ? null : (base > 0 ? Math.round((volFrustrado / base) * 1000) / 10 : null);

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
    const porCaminhao = agrupar(fFilt, "placa", "placa");
    const porDia = agrupar(fFilt, "data", "data").sort((a, b) => {
      const ms = (s) => { const p = String(s.data || "").split("/"); return p.length === 3 ? new Date(+p[2], +p[1] - 1, +p[0]).getTime() : 0; };
      return ms(a) - ms(b);
    });

    // Dia da semana (padrão de quando mais devolve)
    const SEM = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    const mapSem = {};
    fFilt.forEach((r) => {
      const p = String(r.data || "").split("/");
      if (p.length !== 3) return;
      const wd = new Date(+p[2], +p[1] - 1, +p[0]).getDay();
      const k = SEM[wd];
      if (!mapSem[k]) mapSem[k] = { dia_semana: k, _wd: wd, qtd: 0, volume_hl: 0, valor: 0 };
      mapSem[k].qtd += 1; mapSem[k].volume_hl += num(r.volume_hl); mapSem[k].valor += num(r.valor);
    });
    const porDiaSemana = Object.values(mapSem).map((x) => ({ dia_semana: x.dia_semana, _wd: x._wd, qtd: x.qtd, volume_hl: r3(x.volume_hl), valor: r2(x.valor) })).sort((a, b) => a._wd - b._wd);

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

    // Por produto — itens das notas frustradas (via nota_itens)
    const notasFiltradas = new Set(fFilt.map((r) => normNota(r.nota)));
    const mapProd = {};
    notaItensRaw.forEach((it) => {
      if (!notasFiltradas.has(normNota(it.nota))) return;
      const k = String(it.cod_produto || "").trim();
      if (!mapProd[k]) mapProd[k] = { cod_produto: k, nome_produto: it.nome_produto, volume_hl: 0, notas: new Set() };
      mapProd[k].volume_hl += num(it.volume_marcacao_hl);
      mapProd[k].notas.add(normNota(it.nota));
    });
    const porProduto = Object.values(mapProd)
      .map((p) => ({ cod_produto: p.cod_produto, nome_produto: p.nome_produto, volume_hl: r3(p.volume_hl), notas: p.notas.size }))
      .sort((a, b) => b.volume_hl - a.volume_hl);

    const detalhe = fFilt
      .map((r) => ({
        setor: r.setor, data: r.data, nota: r.nota, placa: r.placa, cod_pdv: r.cod_pdv, nome_pdv: r.nome_pdv,
        desc_motivo: r.desc_motivo, volume_hl: r3(num(r.volume_hl)), valor: r2(num(r.valor)),
      }))
      .sort((a, b) => b.volume_hl - a.volume_hl)
      .slice(0, 5000);

    return res.json({
      filtros: { mes, setor, motivo, pdv, dia },
      opcoes,
      volume_efetivado_hl: volEfetivado,
      volume_frustrado_hl: volFrustrado,
      valor_frustrado: valorFrustrado,
      qtd_frustradas: fFilt.length,
      taxa_frustracao_pct: taxa,
      por_motivo: porMotivo,
      por_setor: porSetor,
      por_caminhao: porCaminhao,
      por_dia: porDia,
      por_dia_semana: porDiaSemana,
      por_produto: porProduto,
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
    const dia = String(req.query.dia || "").trim(); // dd/mm/yyyy
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

    // Escopo: dia (se houver), senão mês, senão consolidado
    const escopo = det.filter((r) =>
      (!dia || String(r.data).trim() === dia) && (!mes || String(r.mes) === mes)
    );

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
      filtros: { mes, dia },
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
