// Motivo de devolução resolvido NA LEITURA. O CORA só manda o código; o processador grava a
// descrição no import (entregas_frustradas.desc_motivo e pedido_bees.motivo). Código sem
// cadastro vira "MOTIVO 30 (NÃO CADASTRADO)" e ficava assim mesmo depois de cadastrado em
// Admin › Arquivos (só o próximo import, e só os meses do arquivo, corrigiam). Aqui a
// descrição vem da tabela motivos_devolucao atual — cadastrou, aparece na hora em todos os meses.
const { query } = require("../services/db");

const normC = (v) => String(v ?? "").trim().replace(/\.0$/, "").replace(/^0+/, "");
const RE_PEND = /^MOTIVO\s+(\d+)\s+\(N[ÃA]O CADASTRADO\)$/i;

async function mapaMotivos() {
  try {
    const r = await query("SELECT cod, descricao FROM motivos_devolucao");
    const m = {};
    r.rows.forEach((x) => { const c = normC(x.cod); const d = String(x.descricao || "").trim(); if (c && d) m[c] = d; });
    return m;
  } catch {
    return {}; // tabela ainda não criada (nenhum motivo cadastrado)
  }
}

// Descrição atual p/ (código, descrição gravada). Mantém a gravada se não houver cadastro.
function resolverMotivo(mapa, cod, desc) {
  const d = String(desc || "").trim();
  const c = normC(cod) || (d.match(RE_PEND) || [])[1] || "";
  return (c && mapa[c]) || d;
}

// Aplica em linhas: { campoCod, campoDesc } (campoCod opcional — sem ele, lê o código do texto pendente).
function aplicarMotivos(rows, mapa, campoDesc = "desc_motivo", campoCod = "cod_motivo") {
  if (!Object.keys(mapa).length) return rows;
  return rows.map((r) => {
    const novo = resolverMotivo(mapa, campoCod ? r[campoCod] : "", r[campoDesc]);
    return novo === r[campoDesc] ? r : { ...r, [campoDesc]: novo };
  });
}

module.exports = { mapaMotivos, resolverMotivo, aplicarMotivos };
