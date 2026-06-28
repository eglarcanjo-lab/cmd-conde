// ─────────────────────────────────────────────────────────────────────────────
// sqlRepo — implementação PostgreSQL do "encaixe" de dados, com a MESMA assinatura
// de services/sheets.js. Ativado por DATA_BACKEND=sql (ver sheets.js).
//
// Princípios:
//   • Leitura: SELECT * ORDER BY ctid → devolve objetos com valores em STRING
//     (igual ao readSheet do Sheets: número/bool/data viram texto; null → "").
//   • Escrita: manda os valores como STRING ("" → NULL); o Postgres converte para o
//     tipo da coluna (numeric/boolean/date/jsonb) automaticamente. Objetos → JSON.
//   • appendRow/updateRow são POSICIONAIS (como no Sheets): a ordem do array casa
//     com a ordem das colunas da tabela (information_schema.ordinal_position) — que
//     foi criada na mesma ordem dos cabeçalhos. updateRow/deleteRow usam o ctid na
//     MESMA ordem do readSheet (ORDER BY ctid) para casar "linha N".
//   • Sem cota/limite: não há cache (lê sempre fresco; cacheClearAll é no-op).
// ─────────────────────────────────────────────────────────────────────────────
const { query } = require("./db");

// Tabelas de cadastro (schema.sql, tipadas). As demais são TEXT (criadas pelo ETL).
const CADASTRO = new Set([
  "usuarios", "reset_solicitacoes", "incidentes", "avisos", "popups", "incentivos",
  "incentivos_resultados", "sku_foco", "metas", "spo_metas", "spo_desafios",
  "configuracoes", "uso_app", "uso_telas", "inadimplencia_real",
]);

const qIdent = (s) => '"' + String(s).replace(/"/g, "").trim() + '"';
const qIdentL = (s) => '"' + String(s).replace(/"/g, "").trim().toLowerCase() + '"';

// valor → parâmetro pro INSERT/UPDATE: "" / null → NULL; objeto → JSON; resto → String
function param(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "object") return JSON.stringify(v);
  const s = String(v);
  return s === "" ? null : s;
}

// valor do banco → string (igual readSheet do Sheets)
function toStr(v) {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

const _colsCache = new Map();
async function colunas(tab) {
  if (_colsCache.has(tab)) return _colsCache.get(tab);
  const r = await query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
    [tab]
  );
  const cols = r.rows.map((x) => x.column_name);
  _colsCache.set(tab, cols);
  return cols;
}

// Lê a aba inteira → array de objetos com valores em string (ordem estável por ctid)
async function readSheet(tab) {
  let r;
  try {
    r = await query(`SELECT * FROM ${qIdent(tab)} ORDER BY ctid`);
  } catch (e) {
    // tabela inexistente → vazio (igual ao Sheets quando a aba não existe)
    if (e && e.code === "42P01") return [];
    throw e;
  }
  return r.rows.map((row) => {
    const o = {};
    for (const k of Object.keys(row)) o[k] = toStr(row[k]);
    return o;
  });
}

// Insere uma linha (valores posicionais na ordem das colunas da tabela)
async function appendRow(tab, values) {
  const cols = await colunas(tab);
  if (!cols.length) throw new Error(`Tabela ${tab} não existe no banco.`);
  const ph = cols.map((_, i) => `$${i + 1}`).join(", ");
  const sql = `INSERT INTO ${qIdent(tab)} (${cols.map(qIdent).join(", ")}) VALUES (${ph})`;
  await query(sql, cols.map((_, i) => param(values[i])));
}

// Insere várias linhas (cada uma posicional)
async function appendRows(tab, rowsArray) {
  if (!rowsArray || rowsArray.length === 0) return;
  const cols = await colunas(tab);
  if (!cols.length) throw new Error(`Tabela ${tab} não existe no banco.`);
  const tuples = [];
  const flat = [];
  let n = 0;
  for (const linha of rowsArray) {
    const ph = cols.map(() => `$${++n}`);
    tuples.push(`(${ph.join(", ")})`);
    cols.forEach((_, i) => flat.push(param(linha[i])));
  }
  const sql = `INSERT INTO ${qIdent(tab)} (${cols.map(qIdent).join(", ")}) VALUES ${tuples.join(", ")}`;
  await query(sql, flat);
}

// Atualiza a linha na posição rowIndex (1-based, na ordem do readSheet/ctid)
async function updateRow(tab, rowIndex, values) {
  const cols = await colunas(tab);
  if (!cols.length) throw new Error(`Tabela ${tab} não existe no banco.`);
  const set = cols.map((c, i) => `${qIdent(c)}=$${i + 1}`).join(", ");
  const sql =
    `UPDATE ${qIdent(tab)} SET ${set} ` +
    `WHERE ctid = (SELECT ctid FROM ${qIdent(tab)} ORDER BY ctid OFFSET ${Math.max(0, rowIndex - 1)} LIMIT 1)`;
  await query(sql, cols.map((_, i) => param(values[i])));
}

// Remove a linha de dados na posição dataRowIdx (0-based, ordem do readSheet/ctid)
async function deleteRow(tab, dataRowIdx) {
  const sql =
    `DELETE FROM ${qIdent(tab)} ` +
    `WHERE ctid = (SELECT ctid FROM ${qIdent(tab)} ORDER BY ctid OFFSET ${Math.max(0, dataRowIdx)} LIMIT 1)`;
  await query(sql);
}

// Substitui a aba inteira. rows[0] = cabeçalho. Cadastro: TRUNCATE+INSERT (mantém o
// schema tipado). Computada: DROP+CREATE(TEXT)+INSERT (auto-ajusta colunas, como o ETL).
async function sobrescreverAba(tab, rows) {
  _colsCache.delete(tab);
  const header = (rows && rows[0]) ? rows[0].map((h) => String(h).trim()).filter((h) => h !== "") : [];
  const dados = (rows || []).slice(1);

  if (CADASTRO.has(tab)) {
    if (header.length === 0) return;
    await query(`TRUNCATE TABLE ${qIdent(tab)}`);
    if (dados.length) {
      await appendRows(tab, dados); // usa a ordem real das colunas (information_schema)
    }
    return;
  }

  // Computada: recria como TEXT a partir do cabeçalho
  if (header.length === 0) { await query(`DROP TABLE IF EXISTS ${qIdent(tab)}`); return; }
  await query(`DROP TABLE IF EXISTS ${qIdent(tab)}`);
  const defs = header.map((c) => `${qIdentL(c)} TEXT`).join(", ");
  await query(`CREATE TABLE ${qIdent(tab)} (${defs})`);
  if (dados.length) {
    const colsSql = header.map(qIdentL).join(", ");
    const tuples = [];
    const flat = [];
    let n = 0;
    for (const linha of dados) {
      const ph = header.map(() => `$${++n}`);
      tuples.push(`(${ph.join(", ")})`);
      header.forEach((_, i) => flat.push(param(linha[i])));
    }
    await query(`INSERT INTO ${qIdent(tab)} (${colsSql}) VALUES ${tuples.join(", ")}`, flat);
  }
}

// No SQL as tabelas já existem (schema.sql + ETL). No-ops compatíveis com o Sheets.
async function ensureTab() { /* tabelas geridas pelo schema/ETL/sobrescreverAba */ }
async function initializeSheets() { console.log("DATA_BACKEND=sql: tabelas já existem (schema.sql/ETL)."); }
function cacheClearAll() { _colsCache.clear(); }

module.exports = {
  readSheet, appendRow, appendRows, updateRow, deleteRow,
  sobrescreverAba, ensureTab, initializeSheets, cacheClearAll,
};
