// Metas de MONITORAMENTO (não entram na RV): Cerveja Zero, Match e NAB Zero — meta da
// OPERAÇÃO em HL por mês, lançada pelo admin no bloco Volumes da Home. Usadas no painel da
// Home (barras + Analítico) e no Report Volumes do motor de WhatsApp.
// Sem meta lançada, vale o de antes: zeros = 15% do realizado da categoria regular; Match = RV.
// Por RN/GV: a meta da operação é rateada pelo peso de cada setor na meta da categoria-base
// (Cerveja Zero e Match → meta de Cerveja; NAB Zero → meta de NAB) no rv_resultado do mês.
const { query } = require("../services/db");

const CATS_MONITOR = [
  { key: "cervejaZero", label: "Cerveja Zero", base: "meta_cerveja", baseReal: "real_cerveja" },
  { key: "match",       label: "Match",        base: "meta_cerveja", baseReal: "real_cerveja" },
  { key: "nabZero",     label: "NAB Zero",     base: "meta_nab",     baseReal: "real_nab" },
];
const num = (v) => parseFloat(String(v ?? "0").replace(",", ".")) || 0;

let _ok = false;
async function ensure() {
  if (_ok) return;
  await query(`CREATE TABLE IF NOT EXISTS metas_monitor (
    mes TEXT, categoria TEXT, meta_hl NUMERIC, PRIMARY KEY (mes, categoria))`);
  _ok = true;
}

// { cervejaZero: 100, match: 40, nabZero: 500 } do mês (só as lançadas). Nunca lança erro.
async function lerMetasMonitor(mes) {
  try {
    await ensure();
    const r = await query("SELECT categoria, meta_hl FROM metas_monitor WHERE mes = $1", [mes]);
    const out = {};
    r.rows.forEach((x) => { if (x.meta_hl != null) out[x.categoria] = Number(x.meta_hl); });
    return out;
  } catch (e) { console.error("metas_monitor:", e.message); return {}; }
}

async function salvarMetasMonitor(mes, metas) {
  await ensure();
  await query("DELETE FROM metas_monitor WHERE mes = $1", [mes]);
  for (const c of CATS_MONITOR) {
    const v = metas?.[c.key];
    const n = v === "" || v == null ? null : Number(String(v).replace(",", "."));
    if (n == null || isNaN(n)) continue;
    await query("INSERT INTO metas_monitor (mes, categoria, meta_hl) VALUES ($1,$2,$3)", [mes, c.key, n]);
  }
}

// Rateio da meta da operação por setor. rvMesTodos = rv_resultado do mês SEM filtro de perfil
// (o peso é sempre sobre a operação inteira). Retorna { key: { setor: metaHL } }.
function ratearMetasMonitor(metasOp, rvMesTodos) {
  const out = {};
  CATS_MONITOR.forEach((c) => {
    if (metasOp?.[c.key] == null) return;
    const peso = {};
    rvMesTodos.forEach((r) => { const s = String(r.setor || "").trim(); if (s) peso[s] = (peso[s] || 0) + num(r[c.base]); });
    let tot = Object.values(peso).reduce((a, b) => a + b, 0);
    if (tot <= 0) { // sem meta-base: rateia pelo realizado da base
      Object.keys(peso).forEach((s) => { peso[s] = 0; });
      rvMesTodos.forEach((r) => { const s = String(r.setor || "").trim(); if (s) peso[s] += num(r[c.baseReal]); });
      tot = Object.values(peso).reduce((a, b) => a + b, 0);
    }
    out[c.key] = {};
    Object.keys(peso).forEach((s) => { out[c.key][s] = tot > 0 ? metasOp[c.key] * peso[s] / tot : 0; });
  });
  return out;
}

module.exports = { CATS_MONITOR, lerMetasMonitor, salvarMetasMonitor, ratearMetasMonitor };
