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

// ── Estrutura do mês (setor → RN) ───────────────────────────────────────────────
// Os setores (carteiras) ficam, as PESSOAS mudam de setor. A RV de um mês tem que sair com os RNs
// DAQUELE mês — o cadastro de usuários é sempre o atual. rv_estrutura guarda setor → nome por mês;
// meses sem estrutura gravada usam o cadastro atual. Nov/2026: troca de RNs (101 João→Allan,
// 104 Hebert→Eldiny, 106 Eldiny→Hebert, 107 Luan→Ramon, 108 Allan→João, 111 Manoel→Arthur) —
// outubro fica na estrutura antiga (semente abaixo, gravada 1x se o mês não tiver estrutura).
const ESTRUTURA_SEMENTE = {
  "2026-10": {
    "101": "João Victor Barbisa da Silva", "103": "Iger Renan Castro Da Silva",
    "104": "Hebert Henrique Lopes dos Santos", "105": "Eduardo da Silva Alves", "106": "Eldiny Henrique",
    "107": "Luan Marques da Silva", "108": "Allan Fernando Andrade de Souza",
    "109": "Adriano Ferreira Do Nascimento", "110": "Joicilene Alves Da Silva", "111": "Manoel Roseno de Souza Neto",
  },
};
let _okE = false;
async function ensureEstrutura() {
  if (_okE) return;
  await query(`CREATE TABLE IF NOT EXISTS rv_estrutura (mes TEXT, setor TEXT, nome TEXT, PRIMARY KEY (mes, setor))`);
  for (const [mes, mapa] of Object.entries(ESTRUTURA_SEMENTE)) {
    const ja = await query(`SELECT 1 FROM rv_estrutura WHERE mes = $1 LIMIT 1`, [mes]);
    if (ja.rows.length) continue;
    for (const [setor, nome] of Object.entries(mapa)) {
      await query(`INSERT INTO rv_estrutura (mes, setor, nome) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [mes, setor, nome]);
    }
  }
  _okE = true;
}
// { setor: nome } do mês, ou null se o mês não tem estrutura gravada (= usa o cadastro atual)
async function estrutura(mes) {
  await ensureEstrutura();
  const r = await query(`SELECT setor, nome FROM rv_estrutura WHERE mes = $1`, [mes]);
  if (!r.rows.length) return null;
  const m = {}; r.rows.forEach((x) => { m[String(x.setor).trim()] = String(x.nome || "").trim(); });
  return m;
}
// Nomes do mês p/ as telas de RV: fechado → foto; senão estrutura gravada; senão null (cadastro atual)
async function nomesDoMes(mes) {
  return (await nomesCongelados(mes)) || (await estrutura(mes));
}
const normNome = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
// Setor que o RN tinha no mês (pelo nome). null = mês sem estrutura (vale o cod atual);
// "" = o RN não tinha setor naquele mês (não vê RV de ninguém).
async function setorDoRnNoMes(usuario, mes) {
  const nomes = await nomesDoMes(mes).catch(() => null);
  if (!nomes || !Object.keys(nomes).length) return null;
  const alvo = normNome(usuario.nome);
  const hit = Object.entries(nomes).find(([, n]) => normNome(n) === alvo);
  return hit ? hit[0] : "";
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
  Object.assign(snap.nomes, (await estrutura(mes).catch(() => null)) || {}); // estrutura do mês vale sobre o cadastro
  await query(`INSERT INTO rv_fechamentos (mes, fechado_por, linhas, snapshot) VALUES ($1, $2, $3, $4)`,
    [mes, usuario || "", total, JSON.stringify(snap)]);
  return { mes, linhas: total, setores: snap.rv_resultado.length };
}

async function reabrir(mes) {
  await ensureTabela();
  const r = await query(`DELETE FROM rv_fechamentos WHERE mes = $1`, [mes]);
  return r.rowCount > 0;
}

module.exports = { mesValido, status, listar, lerCongelado, nomesCongelados, fechar, reabrir, estrutura, nomesDoMes, setorDoRnNoMes };
