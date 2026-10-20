// Farol "Ruptura de Estoque" (envio WhatsApp, 17:10 todo dia) — faltas de estoque nos pedidos.
//  • DIA: itens com situação FALTA no painel do dia (cora_dia — mesma conta do CORA, data = NF
//    ou entrega − 1). Sem cora_dia do dia, cai no ruptura_detalhe do dia.
//  • MÊS: ruptura_detalhe do mês atual (1 linha por PDV × produto × dia com falta).
// RN recebe o setor dele · GV o consolidado da região · Diretoria o consolidado da operação
// (+ quebra por RN). Blocos: Resumo (hoje × mês) · Produtos afetados · Clientes afetados (dia)
// · Produtos e clientes mais afetados no mês.
const express = require("express");
const router = express.Router();
const { readSheet } = require("../services/sheets");
const { authMiddleware } = require("../middleware/auth");

router.use(authMiddleware);

const num = (v) => parseFloat(String(v ?? "0").replace(",", ".")) || 0;
const normCod = (v) => String(v ?? "").trim().replace(/\.0$/, "").replace(/^0+/, "");
const hl = (n) => (Number(n) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const p2 = (n) => String(n).padStart(2, "0");
const DIA_LABEL = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const TOP_DIA = 25, TOP_MES = 15;

// Agrega linhas de falta { setor, cod_pdv, nome_pdv, cod_produto, nome_produto, hl, data }
function agregar(linhas) {
  const prod = {}, pdv = {};
  linhas.forEach((l) => {
    const kp = l.cod_produto, kc = `${l.setor}|${l.cod_pdv}`;
    const p = (prod[kp] = prod[kp] || { cod_produto: kp, nome_produto: l.nome_produto, hl: 0, pdvs: new Set(), ocorr: 0 });
    p.hl += l.hl; p.pdvs.add(kc); p.ocorr++;
    if (!p.nome_produto && l.nome_produto) p.nome_produto = l.nome_produto;
    const c = (pdv[kc] = pdv[kc] || { setor: l.setor, cod_pdv: l.cod_pdv, nome_pdv: l.nome_pdv, hl: 0, prods: new Set(), dias: new Set() });
    c.hl += l.hl; c.prods.add(kp); if (l.data) c.dias.add(l.data);
  });
  const produtos = Object.values(prod).sort((a, b) => b.hl - a.hl);
  const clientes = Object.values(pdv).sort((a, b) => b.hl - a.hl);
  const tot = linhas.reduce((s, l) => s + l.hl, 0);
  return { produtos, clientes, hl: tot, nPdvs: clientes.length, nProds: produtos.length };
}

router.get("/mensagens", async (req, res) => {
  try {
    const br = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const hojeBR = `${p2(br.getDate())}/${p2(br.getMonth() + 1)}/${br.getFullYear()}`;
    const mesAtual = `${br.getFullYear()}-${p2(br.getMonth() + 1)}`;

    const [coraDia, ruptura, usuarios, prodFull, rpAll, rpBaseAll] = await Promise.all([
      readSheet("cora_dia").catch(() => []),
      readSheet("ruptura_detalhe").catch(() => []),
      readSheet("usuarios").catch(() => []),
      readSheet("produtos_full").catch(() => []),
      readSheet("ruptura_pedidos").catch(() => []),
      readSheet("ruptura_pedidos_base").catch(() => []),
    ]);
    // Ruptura POR PEDIDO (motor = só DIA + MÊS; o quadrimestre fica na HOP)
    const rpMes = rpAll.filter((r) => String(r.mes_referencia || "").startsWith(mesAtual));
    const rpDia = rpMes.filter((r) => r.data === hojeBR);
    const baseMes = rpBaseAll.filter((r) => String(r.mes_referencia || "").startsWith(mesAtual));
    const baseDia = baseMes.filter((r) => r.data === hojeBR);
    const rs = (n) => (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
    function pedStats(lista, base) {
      const tot = lista.filter((r) => r.tipo === "TOTAL"), perd = tot.filter((r) => r.recomprou === "NÃO");
      const nBase = base.reduce((s2, r) => s2 + num(r.pedidos), 0);
      return { com: lista.length, nBase, tot: tot.length, totHl: tot.reduce((s2, r) => s2 + num(r.hl_falta), 0), totVl: tot.reduce((s2, r) => s2 + num(r.valor_falta), 0),
        perd: perd.length, perdVl: perd.reduce((s2, r) => s2 + num(r.valor_falta), 0), totais: tot };
    }
    const nomeProd = {};
    prodFull.forEach((p) => { const c = normCod(p.cod); if (c && p.nome) nomeProd[c] = String(p.nome).trim(); });
    const nomeDe = (cod, nome) => String(nome || "").trim() || nomeProd[cod] || "";

    // DIA
    let dia = coraDia.filter((r) => r.data === hojeBR && String(r.situacao || "").toUpperCase() === "FALTA")
      .map((r) => ({ setor: String(r.setor || "").trim(), cod_pdv: normCod(r.cod_pdv), nome_pdv: String(r.nome_pdv || "").trim(),
        cod_produto: normCod(r.cod_produto), nome_produto: nomeDe(normCod(r.cod_produto), r.nome_produto), hl: num(r.volume_hl), data: r.data }));
    const fonteDia = dia.length || coraDia.some((r) => r.data === hojeBR) ? "CORA (painel do dia)" : "ruptura_detalhe";
    if (!dia.length && !coraDia.some((r) => r.data === hojeBR)) {
      dia = ruptura.filter((r) => r.data === hojeBR).map((r) => ({ setor: String(r.setor || "").trim(), cod_pdv: normCod(r.cod_pdv), nome_pdv: String(r.nome_pdv || "").trim(),
        cod_produto: normCod(r.cod_produto), nome_produto: nomeDe(normCod(r.cod_produto), r.nome_produto), hl: num(r.volume_falta_hl), data: r.data }));
    }
    // MÊS
    const mes = ruptura.filter((r) => String(r.mes || "").startsWith(mesAtual))
      .map((r) => ({ setor: String(r.setor || "").trim(), cod_pdv: normCod(r.cod_pdv), nome_pdv: String(r.nome_pdv || "").trim(),
        cod_produto: normCod(r.cod_produto), nome_produto: nomeDe(normCod(r.cod_produto), r.nome_produto), hl: num(r.volume_falta_hl), data: r.data }));

    const colProd = [{ key: "cod_produto", label: "Cód" }, { key: "nome_produto", label: "Produto" }, { key: "pdvs", label: "PDVs" }, { key: "hl", label: "Falta (HL)" }];
    const colProdMes = [{ key: "cod_produto", label: "Cód" }, { key: "nome_produto", label: "Produto" }, { key: "ocorr", label: "Ocorrências" }, { key: "pdvs", label: "PDVs" }, { key: "hl", label: "Falta (HL)" }];
    const colCli = (comSetor) => [...(comSetor ? [{ key: "setor", label: "Setor" }] : []), { key: "cod_pdv", label: "Cód" }, { key: "nome_pdv", label: "Cliente" }, { key: "itens", label: "Produtos" }, { key: "hl", label: "Falta (HL)" }];
    const colCliMes = (comSetor) => [...(comSetor ? [{ key: "setor", label: "Setor" }] : []), { key: "cod_pdv", label: "Cód" }, { key: "nome_pdv", label: "Cliente" }, { key: "dias", label: "Dias c/ falta" }, { key: "itens", label: "Produtos" }, { key: "hl", label: "Falta (HL)" }];
    const colRes = [{ key: "rn", label: "Indicador" }, { key: "hoje", label: "Hoje" }, { key: "mes", label: "No mês" }];
    const VERM = { hl: "down" };

    function blocosDe(linhasDia, linhasMes, opts = {}) {
      const a = agregar(linhasDia), m = agregar(linhasMes);
      const fs2 = opts.filtro || (() => true), noF = (r) => fs2(String(r.setor || "").trim());
      const pdH = pedStats(rpDia.filter(noF), baseDia.filter(noF)), pdM = pedStats(rpMes.filter(noF), baseMes.filter(noF));
      const pctP = (n, b) => (b ? ` (${(Math.round((n / b) * 1000) / 10).toLocaleString("pt-BR")}%)` : "");
      const blocos = [
        { titulo: `Ruptura de Estoque · ${opts.rotulo}`, subtitulo: "Resumo", colunas: colRes, linhas: [
          { rn: "Volume em falta (HL)", hoje: hl(a.hl), mes: hl(m.hl), _cores: { hoje: a.hl ? "down" : "up", mes: m.hl ? "down" : "up" } },
          { rn: "Clientes afetados", hoje: a.nPdvs, mes: m.nPdvs },
          { rn: "Produtos afetados", hoje: a.nProds, mes: m.nProds },
          ...(rpAll.length ? [
            { rn: "Pedidos com falta", hoje: `${pdH.com}${pctP(pdH.com, pdH.nBase)}`, mes: `${pdM.com}${pctP(pdM.com, pdM.nBase)}` },
            { rn: "Ruptura TOTAL (cliente não levou nada)", hoje: `${pdH.tot} · ${rs(pdH.totVl)}`, mes: `${pdM.tot} · ${rs(pdM.totVl)}`,
              _cores: { hoje: pdH.tot ? "down" : "up", mes: pdM.tot ? "down" : "up" } },
            { rn: "Venda perdida (sem recompra em 7 dias)", hoje: "—", mes: `${pdM.perd} · ${rs(pdM.perdVl)}`, _cores: { mes: pdM.perd ? "down" : "up" } },
          ] : []),
        ] },
      ];
      if (opts.porRn) blocos.push({ titulo: "Ruptura por RN", subtitulo: "Hoje × mês, por setor", colunas: [
        { key: "setor", label: "Setor" }, { key: "rn", label: "RN" }, { key: "hoje", label: "Hoje (HL)" }, { key: "cli_hoje", label: "Clientes hoje" }, { key: "mes", label: "Mês (HL)" }, { key: "cli_mes", label: "Clientes mês" }],
        linhas: opts.porRn });
      blocos.push(
        ...(rpAll.length ? [{ titulo: "Pedidos com ruptura TOTAL · hoje", subtitulo: `${pdH.tot} pedido(s) em que o cliente não levou nada · recompra = comprou em outro pedido`,
          colunas: [...(opts.comSetor ? [{ key: "setor", label: "Setor" }] : []), { key: "cod_pdv", label: "Cód" }, { key: "nome_pdv", label: "Cliente" }, { key: "pedido", label: "Pedido" },
            { key: "itens", label: "Itens em falta" }, { key: "hl", label: "HL" }, { key: "valor", label: "R$" }, { key: "recompra", label: "Recompra" }],
          linhas: pdH.totais.sort((x, y) => num(y.valor_falta) - num(x.valor_falta)).slice(0, TOP_DIA).map((r) => ({
            setor: r.setor, cod_pdv: r.cod_pdv, nome_pdv: r.nome_pdv, pedido: r.num_pedido, itens: r.itens_falta, hl: hl(num(r.hl_falta)), valor: rs(r.valor_falta),
            recompra: r.recomprou === "MESMO DIA" ? "mesmo dia" : r.recomprou === "ATÉ 7 DIAS" ? "até 7 dias" : "ainda não", _cores: { valor: "down", recompra: r.recomprou === "NÃO" ? "down" : "up" } })) }] : []),
        { titulo: "Produtos afetados · hoje", subtitulo: `${a.nProds} produto(s) · ${hl(a.hl)} HL`, colunas: colProd,
          linhas: a.produtos.slice(0, TOP_DIA).map((p) => ({ cod_produto: p.cod_produto, nome_produto: p.nome_produto, pdvs: p.pdvs.size, hl: hl(p.hl), _cores: VERM })) },
        { titulo: "Clientes afetados · hoje", subtitulo: `${a.nPdvs} cliente(s)`, colunas: colCli(opts.comSetor),
          linhas: a.clientes.slice(0, TOP_DIA).map((c) => ({ setor: c.setor, cod_pdv: c.cod_pdv, nome_pdv: c.nome_pdv, itens: c.prods.size, hl: hl(c.hl), _cores: VERM })) },
        { titulo: "Produtos mais em falta · mês", subtitulo: `Top ${TOP_MES} de ${m.nProds}`, colunas: colProdMes,
          linhas: m.produtos.slice(0, TOP_MES).map((p) => ({ cod_produto: p.cod_produto, nome_produto: p.nome_produto, ocorr: p.ocorr, pdvs: p.pdvs.size, hl: hl(p.hl), _cores: VERM })) },
        { titulo: "Clientes mais afetados · mês", subtitulo: `Top ${TOP_MES} de ${m.nPdvs}`, colunas: colCliMes(opts.comSetor),
          linhas: m.clientes.slice(0, TOP_MES).map((c) => ({ setor: c.setor, cod_pdv: c.cod_pdv, nome_pdv: c.nome_pdv, dias: c.dias.size, itens: c.prods.size, hl: hl(c.hl), _cores: VERM })) },
      );
      const texto = [`*📉 Ruptura de Estoque · ${opts.rotulo}*`, `${hojeBR}`, "",
        `Hoje: ${hl(a.hl)} HL · ${a.nPdvs} clientes · ${a.nProds} produtos`, `Mês: ${hl(m.hl)} HL · ${m.nPdvs} clientes · ${m.nProds} produtos`, "",
        ...a.produtos.slice(0, 10).map((p) => `• ${p.nome_produto || p.cod_produto} — ${hl(p.hl)} HL (${p.pdvs.size} PDVs)`)].join("\n");
      return { blocos, texto, a, m };
    }

    const nomeSetor = {}, telSetor = {};
    usuarios.forEach((u) => {
      const c = String(u.cod || "").trim(); if (!c) return;
      nomeSetor[c] = String(u.nome || "").trim();
      if (String(u.perfil || "").toLowerCase() === "rn" && String(u.telefone || "").trim()) telSetor[c] = String(u.telefone).trim();
    });
    const SET_RN = new Set(["101", "102", "103", "104", "105", "106", "107", "108", "109", "110", "111"]);
    const setores = [...new Set([...dia, ...mes].map((l) => l.setor).filter((s) => SET_RN.has(s)))].sort();
    // RN: todos os RNs com telefone recebem (mesmo sem falta → "Nenhum hoje 👍")
    const setoresEnvio = [...new Set([...setores, ...Object.keys(telSetor).filter((s) => SET_RN.has(s))])].sort();

    const rn = setoresEnvio.map((s) => {
      const b = blocosDe(dia.filter((l) => l.setor === s), mes.filter((l) => l.setor === s), { rotulo: `Setor ${s}`, filtro: (x) => x === s });
      return { setor: s, nome: nomeSetor[s] || "", telefone: telSetor[s] || "", texto: b.texto, blocos: b.blocos };
    });

    const porRnDe = (sets) => sets.map((s) => {
      const a = agregar(dia.filter((l) => l.setor === s)), m = agregar(mes.filter((l) => l.setor === s));
      return { setor: s, rn: (nomeSetor[s] || "").split(" ")[0], hoje: hl(a.hl), cli_hoje: a.nPdvs, mes: hl(m.hl), cli_mes: m.nPdvs, _hl: a.hl, _cores: { hoje: a.hl ? "down" : "up" } };
    }).sort((x, y) => y._hl - x._hl);

    const perfilDoPrefixo = { "1": "gv1", "3": "gv3" };
    const gruposGV = {};
    setoresEnvio.forEach((s) => { const p = String(s)[0]; (gruposGV[p] = gruposGV[p] || []).push(s); });
    const gv = Object.entries(gruposGV).map(([prefixo, sets]) => {
      const uGV = usuarios.find((u) => String(u.perfil || "").toLowerCase() === perfilDoPrefixo[prefixo] && String(u.telefone || "").trim());
      if (!uGV) return null;
      const ss = new Set(sets);
      const b = blocosDe(dia.filter((l) => ss.has(l.setor)), mes.filter((l) => ss.has(l.setor)), { rotulo: `GV ${uGV.nome || prefixo + "xx"}`, porRn: porRnDe(sets), comSetor: true, filtro: (x) => ss.has(x) });
      return { grupo: `${prefixo}xx`, nome: uGV.nome || "", telefone: String(uGV.telefone).trim(), texto: b.texto, blocos: b.blocos };
    }).filter(Boolean);

    const diretores = usuarios.filter((u) => String(u.perfil || "").toLowerCase() === "director" && String(u.telefone || "").trim());
    let director = null;
    if (diretores.length) {
      const b = blocosDe(dia, mes, { rotulo: "Operação (consolidado)", porRn: porRnDe(setores), comSetor: true, filtro: () => true });
      director = { texto: b.texto, blocos: b.blocos,
        destinatarios: diretores.map((u) => ({ nome: String(u.nome || "").trim() || "Diretoria", telefone: String(u.telefone).trim() })) };
    }

    const tot = agregar(dia);
    return res.json({
      data: hojeBR, dia: DIA_LABEL[br.getDay()], titulo: "Ruptura de Estoque", emoji: "📉",
      legenda: "Falta = item marcado sem estoque · hoje = painel do dia (CORA) · mês = acumulado",
      fonte_dia: fonteDia, total_hoje_hl: Math.round(tot.hl * 100) / 100,
      colunas: [], rn, gv, director,
    });
  } catch (e) {
    console.error("farol-ruptura/mensagens:", e);
    return res.status(500).json({ error: "Erro ao montar o farol de ruptura." });
  }
});

module.exports = router;
