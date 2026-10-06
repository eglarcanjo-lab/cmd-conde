// Fechamento (congelamento) da RV por mês.
// Ao fechar um mês, guardamos uma FOTO das tabelas que as telas de RV leem (rv_resultado,
// rv_ap, rv_pontos_bees + nome do RN por setor). Daí em diante as rotas de RV respondem a
// foto, e recalcular/salvar AP daquele mês fica bloqueado — mudanças posteriores na base
// (carteira, setores renomeados, ajustes de volume…) não alteram o que foi pago.
// O processador também consulta `rv_fechamentos` e não recalcula mês fechado.
const { query } = require("./db");
const { readSheet } = require("./sheets");

const TABELAS = ["rv_resultado", "rv_ap", "rv_pontos_bees"];

let _ok = false;
async function ensureTabela() {
  if (_ok) return;
  await query(`CREATE TABLE IF NOT EXISTS rv_fechamentos (
    mes TEXT PRIMARY KEY, fechado_em TIMESTAMPTZ DEFAULT now(), fechado_por TEXT,
    linhas INT, snapshot JSONB)`);
  _ok = true;
}

const mesValido = (m) => /^\d{4}-\d{2}$/.test(String(m || ""));

// { mes, fechado_em, fechado_por, linhas } | null — sem o snapshot (leve).
async function status(mes) {
  await ensureTabela();
  const r = await query(`SELECT mes, fechado_em, fechado_por, linhas FROM rv_fechamentos WHERE mes = $1`, [mes]);
  return r.rows[0] || null;
}

async function listar() {
  await ensureTabela();
  const r = await query(`SELECT mes, fechado_em, fechado_por, linhas FROM rv_fechamentos ORDER BY mes DESC`);
  return r.rows;
}

// Linhas congeladas de uma tabela no mês fechado, ou null se o mês está aberto.
async function lerCongelado(mes, tabela) {
  await ensureTabela();
  const r = await query(`SELECT snapshot -> $2 AS dados FROM rv_fechamentos WHERE mes = $1`, [mes, tabela]);
  if (!r.rows.length) return null;
  return Array.isArray(r.rows[0].dados) ? r.rows[0].dados : [];
}

async function nomesCongelados(mes) {
  await ensureTabela();
  const r = await query(`SELECT snapshot -> 'nomes' AS nomes FROM rv_fechamentos WHERE mes = $1`, [mes]);
  return r.rows.length ? r.rows[0].nomes || {} : null;
}

async function fechar(mes, usuario) {
  await ensureTabela();
  if (await status(mes)) throw Object.assign(new Error(`A RV de ${mes} já está fechada.`), { http: 409 });
  const snap = {};
  let total = 0;
  for (const t of TABELAS) {
    const rows = await readSheet(t).catch(() => []);
    snap[t] = rows.filter((r) => String(r.mes_referencia || "").slice(0, 7) === mes);
    total += snap[t].length;
  }
  if (!snap.rv_resultado.length) {
    throw Object.assign(new Error(`Não há RV calculada para ${mes} — recalcule antes de fechar.`), { http: 400 });
  }
  const usuarios = await readSheet("usuarios").catch(() => []);
  snap.nomes = {};
  usuarios.forEach((u) => { const c = String(u.cod || "").trim(); if (c) snap.nomes[c] = String(u.nome || "").trim(); });
  await query(`INSERT INTO rv_fechamentos (mes, fechado_por, linhas, snapshot) VALUES ($1, $2, $3, $4)`,
    [mes, usuario || "", total, JSON.stringify(snap)]);
  return { mes, linhas: total, setores: snap.rv_resultado.length };
}

async function reabrir(mes) {
  await ensureTabela();
  const r = await query(`DELETE FROM rv_fechamentos WHERE mes = $1`, [mes]);
  return r.rowCount > 0;
}

module.exports = { mesValido, status, listar, lerCongelado, nomesCongelados, fechar, reabrir };
