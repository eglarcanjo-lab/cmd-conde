// Não compradores do mês × Novos cadastros — cálculo único usado por Outros relatórios
// (relatorios.js) e pelo farol do WhatsApp das 17:10 (farol-matinal.js), p/ os dois baterem.
// Compra = qualquer linha em vendas_cliente_produto (venda/bonificação entregue, inclusive itens
// de 0 HL — v3.121–3.123). Base = pdv_base (PDVs ATIVOS); setores 301–305 entram como 107–111.
const NOVO_DE = { "301": "107", "302": "108", "303": "109", "304": "110", "305": "111" };
const LIXO = new Set(["NAN", "NONE", "NULL", "NAT"]);
const limpo = (v) => { const t = String(v ?? "").trim(); return LIXO.has(t.toUpperCase()) ? "" : t; };
const num = (v) => parseFloat(String(v ?? "0").replace(",", ".")) || 0;
const normCod = (v) => String(v ?? "").trim().replace(/\.0$/, "").replace(/^0+/, "");
const setorHop = (s) => { const x = String(s || "").trim(); return NOVO_DE[x] || x; };
const mesMenos = (ym, k) => { const d = new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 1 - k, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const ymDeData = (s) => { const m = String(s || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? `${m[3]}-${m[2].padStart(2, "0")}` : ""; };
const ordSetor = (a, b) => a.setor.localeCompare(b.setor, undefined, { numeric: true });

// Tri anterior ao mês (M-3..M-1) e os meses a ler p/ cada relatório
const triDe = (mes) => [mesMenos(mes, 3), mesMenos(mes, 2), mesMenos(mes, 1)];
const mesesNovos = (mes, atual) => { const out = []; for (let m = mes; m <= atual; m = mesMenos(m, -1)) out.push(m); return out; };

// pdv_base (já com setor normalizado) → linhas únicas por PDV
function pdvsDaBase(base, usuarios) {
  const rnDe = {}; (usuarios || []).forEach((u) => { const c = String(u.cod || "").trim(); if (c) rnDe[c] = String(u.nome || "").trim(); });
  const vistos = new Set(), out = [];
  base.forEach((p) => {
    const cod = normCod(p.cod_pdv || p.cod);
    if (!cod || vistos.has(cod)) return;
    vistos.add(cod);
    const setor = setorHop(p.setor);
    out.push({ cod_pdv: cod, nome: limpo(p.nome_fantasia) || limpo(p.razao_social), razao: limpo(p.razao_social), setor, rn: rnDe[setor] || "",
      cidade: limpo(p.cidade).toUpperCase(), bairro: limpo(p.bairro), dia_visita: limpo(p.dia_visita).toUpperCase().slice(0, 3),
      ultima_compra: limpo(p.ultima_compra), data_cadastro: limpo(p.data_cadastro) });
  });
  return out;
}

// PDVs sem compra no mês + o SKU que o PDV mais comprou no tri (HL; empate → mais meses)
function naoCompradores(pdvs, vendas, nomeProd, mes) {
  const tri = triDe(mes);
  const comprouMes = new Set();
  const triPdv = {};
  vendas.forEach((v) => {
    const m = String(v.mes_referencia || "").slice(0, 7), pdv = normCod(v.cod_pdv), sku = normCod(v.cod_produto);
    if (!pdv || num(v.volume_hl) < 0) return;
    if (m === mes) { comprouMes.add(pdv); return; }
    if (!tri.includes(m) || !sku) return;
    const e = ((triPdv[pdv] = triPdv[pdv] || {})[sku] = triPdv[pdv][sku] || { hl: 0, meses: new Set(), nome: limpo(v.nome_produto) });
    e.hl += num(v.volume_hl); e.meses.add(m);
  });
  const linhas = pdvs.filter((p) => !comprouMes.has(p.cod_pdv)).map((p) => {
    const skus = Object.entries(triPdv[p.cod_pdv] || {});
    let top = null;
    skus.forEach(([sku, e]) => { if (!top || e.hl > top.hl || (e.hl === top.hl && e.meses.size > top.meses)) top = { sku, hl: e.hl, meses: e.meses.size, nome: e.nome }; });
    return { ...p, sku_cod: top ? top.sku : "", sku_nome: top ? ((nomeProd || {})[top.sku] || top.nome || top.sku) : "",
      sku_hl_tri: top ? Math.round(top.hl * 1000) / 1000 : null, sku_meses: top ? top.meses : 0 };
  }).sort((a, b) => ordSetor(a, b) || (b.sku_hl_tri || 0) - (a.sku_hl_tri || 0));
  return { tri, compraram: pdvs.filter((p) => comprouMes.has(p.cod_pdv)).length, linhas };
}

// Cadastrados no mês sem compra registrada desde o cadastro (vendas dos meses lidos + última compra da base)
function novosCadastros(pdvs, vendas, mes) {
  const comprou = new Set(vendas.filter((v) => num(v.volume_hl) >= 0).map((v) => normCod(v.cod_pdv)));
  const novos = pdvs.filter((p) => ymDeData(p.data_cadastro) === mes);
  const dataKey = (s) => String(s).split("/").reverse().join("");
  const linhas = novos.filter((p) => !comprou.has(p.cod_pdv) && !/\d/.test(p.ultima_compra))
    .sort((a, b) => ordSetor(a, b) || dataKey(a.data_cadastro).localeCompare(dataKey(b.data_cadastro)));
  return { tem_data_cadastro: pdvs.some((p) => p.data_cadastro), novos: novos.length, linhas };
}

module.exports = { pdvsDaBase, naoCompradores, novosCadastros, triDe, mesesNovos, setorHop, normCod, limpo };
