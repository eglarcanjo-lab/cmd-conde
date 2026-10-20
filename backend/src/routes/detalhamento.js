// Detalhamento HOP — relatórios admin (Entrega + Ruptura de Estoque)
const express = require("express");
const router = express.Router();
const { readSheet, readSheetMonths } = require("../services/sheets");
const { authMiddleware } = require("../middleware/auth");

router.use(authMiddleware);

const { filtrarPorPerfil } = require("../utils/perfil");

const num = (v) => parseFloat(String(v ?? "0").replace(",", ".")) || 0;
const r2 = (n) => Math.round(n * 100) / 100;
const r3 = (n) => Math.round(n * 1000) / 1000;
const uniqSort = (arr) => [...new Set(arr.filter(Boolean))].sort();
const normNota = (v) => String(v ?? "").trim().replace(/^0+/, "");

// Nome de produto "nan"/"None"/vazio (item do CORA sem "Desc. produto", gravado antes da
// correção no processador) → troca pelo nome do cadastro (produtos_full → produtos_base →
// grade_estoque). Vale p/ TODA resposta desta rota: varre o JSON antes de enviar e só lê o
// cadastro se achar algum nome ruim.
const LIXO = new Set(["", "NAN", "NONE", "NULL", "NAT"]);
const nomeRuim = (v) => LIXO.has(String(v ?? "").trim().toUpperCase());
const normCodP = (v) => String(v ?? "").trim().replace(/\.0$/, "").replace(/^0+/, "");
async function corrigirNomes(body) {
  const ruins = [];
  const varrer = (o) => {
    if (Array.isArray(o)) return o.forEach(varrer);
    if (!o || typeof o !== "object") return;
    if ("cod_produto" in o && "nome_produto" in o && nomeRuim(o.nome_produto)) ruins.push(o);
    Object.values(o).forEach((v) => { if (v && typeof v === "object") varrer(v); });
  };
  varrer(body);
  if (!ruins.length) return body;
  const [full, base, grade] = await Promise.all([
    readSheet("produtos_full").catch(() => []), readSheet("produtos_base").catch(() => []), readSheet("grade_estoque").catch(() => []),
  ]);
  const nomes = {};
  [...grade.map((g) => [g.cod, g.nome || g.descricao]), ...base.map((p) => [p.cod, p.nome]), ...full.map((p) => [p.cod, p.nome])]
    .forEach(([c, n]) => { if (normCodP(c) && !nomeRuim(n)) nomes[normCodP(c)] = String(n).trim(); });
  ruins.forEach((o) => { o.nome_produto = nomes[normCodP(o.cod_produto)] || ""; });
  return body;
}
router.use((req, res, next) => {
  const enviar = res.json.bind(res);
  res.json = (body) => { corrigirNomes(body).then(enviar, () => enviar(body)); return res; };
  next();
});

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
      .sort((a, b) => b.volume_hl - a.volume_hl); // lista completa (antes cortava em 101)

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
    const detRaw = require("../utils/dedupe").dedupe(await readSheet("ruptura_detalhe").catch(() => []),
      (r) => `${r.setor}|${r.cod_pdv}|${r.cod_produto}|${r.data}`); // 1 linha por PDV×produto×dia
    const det = filtrarPorPerfil(detRaw, req.user);

    // Chart: total por mês (todos) + média do período
    const mapMes = {};
    det.forEach((r) => {
      const m = String(r.mes);
      if (!mapMes[m]) mapMes[m] = { mes: m, volume_falta_hl: 0, qtd_faltas: 0 };
      mapMes[m].volume_falta_hl += num(r.volume_falta_hl);
      mapMes[m].qtd_faltas += Math.round(num(r.qtd_faltas));
    });
    // ruptura_detalhe ACUMULA por mês (v3.103.1) → o quadrimestre = os 4 meses mais recentes
    const meses = uniqSort(Object.keys(mapMes)).slice(-4);
    const porMes = meses.map((m) => ({ ...mapMes[m], volume_falta_hl: r3(mapMes[m].volume_falta_hl) }));
    const media = porMes.length ? r3(porMes.reduce((s, m) => s + m.volume_falta_hl, 0) / porMes.length) : 0;

    // Escopo: dia (se houver), senão mês, senão consolidado (só os meses do quadrimestre)
    const mesesSet = new Set(meses);
    const escopo = det.filter((r) =>
      (!dia || String(r.data).trim() === dia) && (mes ? String(r.mes) === mes : (dia || mesesSet.has(String(r.mes))))
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
    // Lista COMPLETA (antes cortava em 101 e o card "Clientes afetados" contava a lista cortada:
    // dava sempre 101 em qualquer escopo com mais clientes — corrigido em v3.101.1).
    const porCliente = Object.values(mapCli)
      .map((c) => ({ ...c, volume_falta_hl: r3(c.volume_falta_hl) }))
      .sort((a, b) => b.volume_falta_hl - a.volume_falta_hl);

    const totalVolume = r3(porProduto.reduce((s, p) => s + p.volume_falta_hl, 0));

    // Detalhe do escopo (para drill-down produto↔cliente↔data no frontend)
    const detalhe = escopo.map((r) => ({
      setor: r.setor, cod_pdv: r.cod_pdv, nome_pdv: r.nome_pdv,
      cod_produto: r.cod_produto, nome_produto: r.nome_produto, categoria: r.categoria,
      data: r.data, mes: r.mes, qtd_faltas: Math.round(num(r.qtd_faltas)),
      volume_falta_hl: r3(num(r.volume_falta_hl)),
    }));

    // ── Ruptura POR PEDIDO (CORA): TOTAL = nenhum item atendido (cliente não levou nada naquele
    // pedido) × PARCIAL = faltou parte. Recompra: MESMO DIA (pedido dividido) · ATÉ 7 DIAS · NÃO.
    const [rpRaw, baseRaw, stArq] = await Promise.all([
      readSheet("ruptura_pedidos").catch(() => []),
      readSheet("ruptura_pedidos_base").catch(() => []),
      readSheet("status_arquivos").catch(() => []),
    ]);
    // 1 linha por pedido / por dia×setor (imports simultâneos podem ter gravado o mês em dobro)
    const { dedupe } = require("../utils/dedupe");
    const rpU = dedupe(rpRaw, (r) => String(r.num_pedido || ""));
    const baseU = dedupe(baseRaw, (r) => `${r.mes_referencia}|${r.data}|${r.setor}`);
    const stRp = stArq.find((r) => /ruptura por pedido/i.test(String(r.arquivo || "")));
    const noEscopo = (r) => (!dia || String(r.data).trim() === dia) && (!mes || String(r.mes_referencia) === mes);
    const rpEsc = filtrarPorPerfil(rpU, req.user).filter(noEscopo);
    const totalPedidos = filtrarPorPerfil(baseU, req.user).filter(noEscopo).reduce((s, r) => s + num(r.pedidos), 0);
    const somaDe = (arr, k) => r3(arr.reduce((s, r) => s + num(r[k]), 0));
    const tot = rpEsc.filter((r) => r.tipo === "TOTAL"), par = rpEsc.filter((r) => r.tipo !== "TOTAL");
    const rec = (v) => tot.filter((r) => r.recomprou === v);
    const pctP = (n) => (totalPedidos > 0 ? Math.round((n / totalPedidos) * 1000) / 10 : null);
    const pedidos = rpRaw.length ? {
      total_pedidos: totalPedidos, com_falta: rpEsc.length, pct_com_falta: pctP(rpEsc.length),
      total: { pedidos: tot.length, pct: pctP(tot.length), hl: somaDe(tot, "hl_falta"), valor: r2(tot.reduce((s, r) => s + num(r.valor_falta), 0)),
        clientes: new Set(tot.map((r) => r.cod_pdv)).size,
        mesmo_dia: rec("MESMO DIA").length, ate_7_dias: rec("ATÉ 7 DIAS").length, nao_comprou: rec("NÃO").length,
        hl_perdido: somaDe(rec("NÃO"), "hl_falta"), valor_perdido: r2(rec("NÃO").reduce((s, r) => s + num(r.valor_falta), 0)) },
      parcial: { pedidos: par.length, pct: pctP(par.length), hl: somaDe(par, "hl_falta"), valor: r2(par.reduce((s, r) => s + num(r.valor_falta), 0)),
        clientes: new Set(par.map((r) => r.cod_pdv)).size },
      lista: rpEsc.map((r) => ({
        data: r.data, setor: r.setor, cod_pdv: r.cod_pdv, nome_pdv: r.nome_pdv, num_pedido: r.num_pedido, pedido_cliente: r.pedido_cliente,
        situacao_pedido: r.situacao_pedido, tipo: r.tipo, itens: num(r.itens), itens_falta: num(r.itens_falta),
        hl_falta: r3(num(r.hl_falta)), valor_falta: r2(num(r.valor_falta)), recomprou: r.recomprou,
        dias_ate_recompra: r.dias_ate_recompra, produtos_falta: r.produtos_falta,
      })).sort((a, b) => (a.tipo === b.tipo ? b.hl_falta - a.hl_falta : a.tipo === "TOTAL" ? -1 : 1)),
    } : null;

    return res.json({
      filtros: { mes, dia },
      pedidos,
      pedidos_status: stRp ? { status: stRp.status, detalhes: stRp.detalhes, atualizado_em: stRp.atualizado_em } : null,
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

// Monta o "documento" de rastreabilidade de 1 pedido: dados do pedido (pedido_bees),
// valor da NF (faturado_nf) e, se devolvido, os dados da devolução (entregas_frustradas).
function montarDocPedido(ped, faturadoNf, devolucoes) {
  const nf = normNota(ped.nf);
  const fat = nf ? faturadoNf.find((f) => normNota(f.nf) === nf) || null : null;
  const dev = nf ? devolucoes.find((d) => normNota(d.nota) === nf) || null : null;

  const hlMarc = r3(num(ped.hl_marcacao));
  const hlEntr = r3(num(ped.hl_entrega));
  const devolvido = !!dev || (String(ped.motivo || "").trim() !== "");
  const status = devolvido ? "DEVOLVIDO" : (hlEntr > 0 || ped.entrega_real ? "ENTREGUE" : "FATURADO");

  return {
    encontrado: true,
    pedido: {
      bees: ped.bees, pedido: ped.pedido, nf,
      setor: ped.setor, nome_setor: ped.nome_setor,
      cod_pdv: ped.cod_pdv, nome_pdv: ped.nome_pdv,
      data_pedido: ped.data_pedido, mapa: ped.mapa || (fat && fat.mapa) || "",
      entrega_real: ped.entrega_real,
      hl_marcacao: hlMarc, hl_entrega: hlEntr,
      hl_diferenca: r3(hlMarc - hlEntr),
      valor_nf: fat ? r2(num(fat.valor)) : null,
      itens_nf: fat ? parseInt(fat.itens || 0) : null,
      status,
      motivo: ped.motivo || (dev && dev.desc_motivo) || "",
    },
    devolucao: dev ? {
      placa: dev.placa || "", desc_motivo: dev.desc_motivo || "", cod_motivo: dev.cod_motivo || "",
      valor: r2(num(dev.valor)), volume_hl: r3(num(dev.volume_hl)),
      data_devol: dev.data_devol || "", data: dev.data || "",
    } : null,
  };
}

// Data do pedido → chave ordenável (aceita dd/mm/aaaa e aaaa-mm-dd).
const chaveData = (v) => {
  const s = String(v || "").trim();
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  return s.slice(0, 10);
};

// Itens (produtos) dos pedidos BEES informados, agrupados por pedido. readSheetMonths
// filtra por qualquer coluna (WHERE col = ANY) — aqui, só os pedidos que vão na tela.
async function itensDosPedidos(bees) {
  const lista = [...new Set(bees.map(normNota).filter(Boolean))];
  if (!lista.length) return {};
  const rows = await readSheetMonths("pedido_bees_itens", "bees", lista).catch(() => []);
  const por = {};
  for (const r of rows) {
    const k = normNota(r.bees);
    (por[k] = por[k] || []).push({
      cod_produto: r.cod_produto, nome_produto: r.nome_produto,
      hl_marcacao: r3(num(r.hl_marcacao)), hl_entrega: r3(num(r.hl_entrega)),
    });
  }
  for (const k of Object.keys(por)) por[k].sort((a, b) => b.hl_marcacao - a.hl_marcacao);
  return por;
}

const lerBasesPedido = () => Promise.all([
  readSheet("pedido_bees").catch(() => []),
  readSheet("faturado_nf").catch(() => []),
  readSheet("entregas_frustradas").catch(() => []),
]);

// GET /api/detalhamento/pedido-bees?q=<pedido BEES | NF | nº pedido>
router.get("/pedido-bees", async (req, res) => {
  try {
    const q = normNota(req.query.q || "");
    if (!q) return res.status(400).json({ error: "Informe o pedido BEES, a NF ou o nº do pedido." });

    const [pedidosRaw, faturadoNf, devolucoes] = await lerBasesPedido();
    // Escopo por perfil (setor): admin/diretor tudo; GV a sala; RN o próprio.
    const pedidos = filtrarPorPerfil(pedidosRaw, req.user, "setor");

    // Casa por pedido BEES, senão por NF, senão pelo nº do pedido interno.
    const ped = pedidos.find((p) => normNota(p.bees) === q)
             || pedidos.find((p) => normNota(p.nf) === q)
             || pedidos.find((p) => normNota(p.pedido) === q);
    if (!ped) return res.json({ encontrado: false, q });

    const doc = montarDocPedido(ped, faturadoNf, devolucoes);
    doc.itens = (await itensDosPedidos([ped.bees]))[normNota(ped.bees)] || [];
    return res.json(doc);
  } catch (e) {
    console.error("pedido-bees:", e);
    return res.status(500).json({ error: "Erro ao buscar o pedido." });
  }
});

// GET /api/detalhamento/pedidos-pdv?q=<código do PDV | parte do nome>
// Lista TODOS os pedidos do PDV (mais recente primeiro), cada um com o mesmo resumo
// do documento (status, NF, valor, HL, ruptura, devolução).
router.get("/pedidos-pdv", async (req, res) => {
  try {
    const bruto = String(req.query.q || "").trim();
    if (!bruto) return res.status(400).json({ error: "Informe o código ou o nome do PDV." });

    const [pedidosRaw, faturadoNf, devolucoes] = await lerBasesPedido();
    const pedidos = filtrarPorPerfil(pedidosRaw, req.user, "setor");

    const porCodigo = /^\d+$/.test(bruto);
    const cod = normNota(bruto);
    const nome = bruto.toLowerCase();
    const achados = pedidos.filter((p) => porCodigo
      ? normNota(p.cod_pdv) === cod
      : String(p.nome_pdv || "").toLowerCase().includes(nome));
    if (!achados.length) return res.json({ encontrado: false, q: bruto, pedidos: [] });

    const itens = await itensDosPedidos(achados.map((p) => p.bees));
    const docs = achados
      .map((p) => montarDocPedido(p, faturadoNf, devolucoes))
      .sort((a, b) => chaveData(b.pedido.data_pedido).localeCompare(chaveData(a.pedido.data_pedido)));
    const pdvs = [...new Set(docs.map((d) => `${d.pedido.cod_pdv} · ${d.pedido.nome_pdv}`))];

    return res.json({
      encontrado: true, q: bruto, pdvs,
      pedidos: docs.map((d) => ({ ...d.pedido, devolucao: d.devolucao, itens: itens[normNota(d.pedido.bees)] || [] })),
      totais: {
        pedidos: docs.length,
        devolvidos: docs.filter((d) => d.pedido.status === "DEVOLVIDO").length,
        com_ruptura: docs.filter((d) => d.pedido.hl_diferenca > 0.001).length,
        valor_nf: r2(docs.reduce((s, d) => s + (d.pedido.valor_nf || 0), 0)),
        hl_marcacao: r3(docs.reduce((s, d) => s + d.pedido.hl_marcacao, 0)),
        hl_entrega: r3(docs.reduce((s, d) => s + d.pedido.hl_entrega, 0)),
      },
    });
  } catch (e) {
    console.error("pedidos-pdv:", e);
    return res.status(500).json({ error: "Erro ao buscar os pedidos do PDV." });
  }
});

module.exports = router;
