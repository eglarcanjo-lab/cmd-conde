// Outros relatórios › "Anomalia de Volume" — PDVs dos setores que NÃO podem ter pedido
// (102 = sem RN; 995/997 = PDVs sem RN) com venda no MÊS ATUAL (zera todo mês).
// Traz TUDO da venda (pedido, NF, datas, situação, canal, quem digitou, vendedor, itens, valor,
// HL, placa…) e SUGERE o melhor RN e dia de visita pela base de clientes dos RNs:
//   RN = quem tem mais PDVs no MESMO BAIRRO (desempate: mesma cidade, depois base menor);
//   dia = o dia de visita mais comum desse RN naquele bairro/cidade (desempate: dia mais leve).
// Fontes: anomalia_pedidos (CORA), pdv_fora (base de clientes 102/995/997), pdv_base (RNs).
// Só gestores (admin, director, gv1, gv3).
const express = require("express");
const router = express.Router();
const { readSheet } = require("../services/sheets");
const { authMiddleware } = require("../middleware/auth");

router.use(authMiddleware);

const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
const normCod = (v) => String(v ?? "").trim().replace(/\.0$/, "").replace(/^0+/, "");
const numBR = (v) => {
  let s = String(v ?? "").trim(); if (!s) return 0;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  return parseFloat(s) || 0;
};
const DIAS = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB"];
const diaDe = (v) => { const d = norm(v).split(/[/,\s]+/)[0]; return DIAS.find((x) => d.startsWith(x)) || ""; };

// Chave de "visto" de um PDV anômalo: muda quando entra pedido novo → o sininho avisa de novo.
const chaveAnomalia = (setor, cod, nPed) => `${setor}|${cod}|${nPed}`;
const ehInterno = (nome, hl) => /^AMBEV\b/i.test(String(nome || "")) || hl === 0;

// GET /api/anomalia-volume/sininho → { pendentes, chaves } — leve (só anomalia_pedidos), p/ o
// sininho (consulta a cada 60s). O front compara as chaves com as já vistas (localStorage).
router.get("/sininho", async (req, res) => {
  try {
    if (!["admin", "director", "gv1", "gv3"].includes(req.user.perfil)) return res.json({ pendentes: 0, chaves: [] });
    const linhas = await readSheet("anomalia_pedidos").catch(() => []);
    const p = {};
    linhas.forEach((r) => {
      const k = `${String(r.setor || "").trim()}|${normCod(r.cod_pdv)}`;
      const e = (p[k] = p[k] || { nome: r.nome_pdv, hl: 0, peds: new Set() });
      e.hl += parseFloat(r.volume_hl) || 0; e.peds.add(String(r.num_pedido || ""));
    });
    const chaves = Object.entries(p).filter(([, e]) => !ehInterno(e.nome, e.hl))
      .map(([k, e]) => { const [s, c] = k.split("|"); return chaveAnomalia(s, c, e.peds.size); });
    return res.json({ pendentes: chaves.length, chaves });
  } catch { return res.json({ pendentes: 0, chaves: [] }); }
});

router.get("/", async (req, res) => {
  try {
    if (!["admin", "director", "gv1", "gv3"].includes(req.user.perfil)) return res.status(403).json({ error: "Só gestores." });
    const [linhas, fora, base, prodFull, usuarios, statusArq] = await Promise.all([
      readSheet("anomalia_pedidos").catch(() => []),
      readSheet("pdv_fora").catch(() => []),
      readSheet("pdv_base").catch(() => []),
      readSheet("produtos_full").catch(() => []),
      readSheet("usuarios").catch(() => []),
      readSheet("status_arquivos").catch(() => []),
    ]);
    const nomeProd = {};
    prodFull.forEach((p) => { const c = normCod(p.cod); if (c && p.nome) nomeProd[c] = String(p.nome).trim(); });
    const nomeRn = {};
    usuarios.forEach((u) => { const c = String(u.cod || "").trim(); if (c) nomeRn[c] = String(u.nome || "").trim(); });
    const foraDe = {};
    fora.forEach((f) => { foraDe[normCod(f.cod_pdv)] = f; });

    // Base dos RNs (sem o 102, que não tem RN)
    const baseRn = base.map((p) => ({ setor: String(p.setor || "").trim(), cidade: norm(p.cidade), bairro: norm(p.bairro), dia: diaDe(p.dia_visita) }))
      .filter((p) => p.setor && p.setor !== "102");
    const setoresRn = [...new Set(baseRn.map((p) => p.setor))].sort();
    const totalRn = {};
    baseRn.forEach((p) => { totalRn[p.setor] = (totalRn[p.setor] || 0) + 1; });

    function sugerir(cidade, bairro) {
      const C = norm(cidade), B = norm(bairro);
      if (!C && !B) return { motivo: "PDV sem cidade/bairro (reimporte a base de clientes 0105070402)", opcoes: [] };
      const opcoes = setoresRn.map((s) => {
        const doRn = baseRn.filter((p) => p.setor === s);
        const noBairro = B ? doRn.filter((p) => p.bairro === B && (!C || p.cidade === C)) : [];
        const naCidade = C ? doRn.filter((p) => p.cidade === C) : [];
        const ref = noBairro.length ? noBairro : naCidade;
        const cont = {};
        ref.forEach((p) => { if (p.dia) cont[p.dia] = (cont[p.dia] || 0) + 1; });
        const carga = {};
        doRn.forEach((p) => { if (p.dia) carga[p.dia] = (carga[p.dia] || 0) + 1; });
        const dia = Object.keys(cont).sort((a, b) => cont[b] - cont[a] || (carga[a] || 0) - (carga[b] || 0))[0] || "";
        return { setor: s, rn: nomeRn[s] || "", pdvs_bairro: noBairro.length, pdvs_cidade: naCidade.length, base_total: totalRn[s] || 0,
          dia, pdvs_no_dia: dia ? cont[dia] : 0, carga_dia: dia ? (carga[dia] || 0) : 0, por_dia: cont };
      }).filter((o) => o.pdvs_bairro > 0 || o.pdvs_cidade > 0)
        .sort((a, b) => b.pdvs_bairro - a.pdvs_bairro || b.pdvs_cidade - a.pdvs_cidade || a.base_total - b.base_total);
      const top = opcoes[0];
      const motivo = !top ? `Nenhum RN atende ${cidade || bairro}`
        : top.pdvs_bairro > 0 ? `${top.pdvs_bairro} PDV(s) do setor ${top.setor} no bairro ${bairro}; ${top.pdvs_no_dia} deles visitados ${top.dia}`
          : `Nenhum RN no bairro; setor ${top.setor} tem ${top.pdvs_cidade} PDV(s) em ${cidade} (${top.pdvs_no_dia} visitados ${top.dia})`;
      return { motivo, opcoes: opcoes.slice(0, 3) };
    }

    // Agrupa PDV → pedidos → itens
    const pdvs = {};
    linhas.forEach((r) => {
      const cod = normCod(r.cod_pdv), setor = String(r.setor || "").trim();
      const k = `${setor}|${cod}`;
      const p = (pdvs[k] = pdvs[k] || {
        setor, cod_pdv: cod, nome_pdv: r.nome_pdv, nome_fantasia: r.nome_fantasia, cnpj: r.cnpj, municipio: r.municipio,
        pedidos: {}, hl: 0, hl_venda: 0, valor: 0, itens: 0, datas: new Set(), canais: new Set(), digitadores: new Set(), vendedores: new Set(),
      });
      const hl = parseFloat(r.volume_hl) || 0, valor = numBR(r.valor_item);
      p.hl += hl; if (r.venda === "SIM") p.hl_venda += hl; p.valor += valor; p.itens++;
      if (r.data) p.datas.add(r.data);
      if (r.canal_origem) p.canais.add(r.canal_origem);
      if (r.usuario_digitacao) p.digitadores.add(r.usuario_digitacao);
      if (r.vendedor) p.vendedores.add(r.vendedor);
      const kp = String(r.num_pedido || "");
      const ped = (p.pedidos[kp] = p.pedidos[kp] || {
        num_pedido: kp, pedido_cliente: r.pedido_cliente, id_pedido: r.id_pedido, tipo_pedido: r.tipo_pedido,
        data: r.data, data_entrada: r.data_entrada, data_entrega: r.data_entrega, data_nf: r.data_nf, nf: r.nf, valor_total_nf: r.valor_total_nf,
        situacao_pedido: r.situacao_pedido, situacao_atend_pedido: r.situacao_atend_pedido,
        canal_origem: r.canal_origem, canal_marcacao: r.canal_marcacao, usuario_digitacao: r.usuario_digitacao, motivo_digitacao: r.motivo_digitacao,
        operacao: [r.cod_operacao, r.operacao].filter(Boolean).join(" · "), tipo_movimento: r.tipo_movimento,
        setor_cora: [r.setor_cora, r.desc_setor].filter(Boolean).join(" · "), vendedor: [r.cod_vendedor, r.vendedor].filter(Boolean).join(" · "),
        pagamento: [r.forma_pagamento, r.condicao_pagamento].filter(Boolean).join(" · "), placa: r.placa, itinerario: r.itinerario,
        motivo_cancelamento: r.motivo_cancelamento, hl: 0, valor: 0, itens: [],
      });
      ped.hl += hl; ped.valor += valor;
      ped.itens.push({
        cod_produto: normCod(r.cod_produto), nome_produto: r.nome_produto || nomeProd[normCod(r.cod_produto)] || "",
        quantidade: r.quantidade, unidade: r.unidade, valor_unitario: r.valor_unitario, valor_item: r.valor_item,
        volume_hl: Math.round(hl * 10000) / 10000, situacao_item: r.situacao_item, situacao_atend_item: r.situacao_atend_item,
        motivo_corte: r.motivo_corte, venda: r.venda,
      });
    });

    const r2 = (n) => Math.round(n * 1000) / 1000;
    const lista = Object.values(pdvs).map((p) => {
      const f = foraDe[p.cod_pdv] || {};
      const cidade = f.cidade || p.municipio || "", bairro = f.bairro || "";
      const interno = ehInterno(p.nome_pdv, p.hl);
      return {
        setor: p.setor, cod_pdv: p.cod_pdv, nome_pdv: p.nome_pdv, nome_fantasia: f.nome_fantasia || p.nome_fantasia, cnpj: p.cnpj,
        cidade, bairro, endereco: f.endereco || "", segmento: f.segmento || "", status_base: f.status || "", dia_visita_atual: f.dia_visita || "",
        na_base: !!foraDe[p.cod_pdv], interno, chave: chaveAnomalia(p.setor, p.cod_pdv, Object.keys(p.pedidos).length),
        hl: r2(p.hl), hl_venda: r2(p.hl_venda), valor: Math.round(p.valor * 100) / 100, itens: p.itens,
        n_pedidos: Object.keys(p.pedidos).length, datas: [...p.datas].sort((a, b) => a.split("/").reverse().join("").localeCompare(b.split("/").reverse().join(""))),
        canais: [...p.canais], digitadores: [...p.digitadores], vendedores: [...p.vendedores],
        pedidos: Object.values(p.pedidos).map((x) => ({ ...x, hl: r2(x.hl), valor: Math.round(x.valor * 100) / 100 }))
          .sort((a, b) => String(a.data).split("/").reverse().join("").localeCompare(String(b.data).split("/").reverse().join(""))),
        sugestao: interno ? { motivo: "Cadastro interno AMBEV / sem volume (remessa de vasilhame, tratamento, material) — não é PDV de rota", opcoes: [] } : sugerir(cidade, bairro),
      };
    }).sort((a, b) => Number(a.interno) - Number(b.interno) || b.hl - a.hl);

    const st = statusArq.find((r) => /cora|consulta/i.test(String(r.arquivo || "")));
    return res.json({
      mes: (linhas[0] && linhas[0].mes_referencia) || "",
      atualizado_em: st ? String(st.atualizado_em || "") : "",
      base_fora_importada: fora.length > 0,
      // Resumo SÓ das anomalias reais. Os internos (AMBEV S.A. — remessa de vasilhame/material,
      // 0 HL, ~R$ 1 mi/mês) ficam à parte: antes entravam no card "Valor" e inflavam tudo.
      resumo: (() => {
        const reais = lista.filter((p) => !p.interno), int = lista.filter((p) => p.interno);
        return { pdvs: reais.length, pedidos: reais.reduce((s, p) => s + p.n_pedidos, 0), hl: r2(reais.reduce((s, p) => s + p.hl, 0)),
          valor: Math.round(reais.reduce((s, p) => s + p.valor, 0) * 100) / 100,
          por_setor: reais.reduce((o, p) => { o[p.setor] = (o[p.setor] || 0) + 1; return o; }, {}),
          internos: { pdvs: int.length, pedidos: int.reduce((s, p) => s + p.n_pedidos, 0), valor: Math.round(int.reduce((s, p) => s + p.valor, 0) * 100) / 100 } };
      })(),
      pdvs: lista,
    });
  } catch (e) {
    console.error("anomalia-volume:", e);
    return res.status(500).json({ error: "Erro ao montar a Anomalia de Volume." });
  }
});

module.exports = router;
