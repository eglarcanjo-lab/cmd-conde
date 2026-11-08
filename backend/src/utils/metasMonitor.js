// Metas de MONITORAMENTO (não entram na RV): Cerveja Zero, Match, NAB Zero e RGB TT — meta da
// OPERAÇÃO em HL por mês, lançada pelo admin no bloco Volumes da Home. Usadas no painel da
// Home (barras + Analítico) e no Report Volumes do motor de WhatsApp.
// Sem meta lançada, vale o de antes: zeros = 15% do realizado da categoria regular; Match = RV.
// Por RN/GV: a meta da operação é rateada pelo peso de cada setor na meta da categoria-base
// (Cerveja Zero, Match e RGB TT → meta de Cerveja; NAB Zero → meta de NAB) no rv_resultado do mês.
// Desde v3.139.0: se a meta veio da Distribuição pelo tri (Admin › Metas), cada setor tem a sua
// (metas_monitor_setor) e ela vale no lugar do rateio proporcional.
const { query } = require("../services/db");

const CATS_MONITOR = [
  { key: "cervejaZero", label: "Cerveja Zero", base: "meta_cerveja", baseReal: "real_cerveja" },
  { key: "match",       label: "Match",        base: "meta_cerveja", baseReal: "real_cerveja" },
  { key: "nabZero",     label: "NAB Zero",     base: "meta_nab",     baseReal: "real_nab" },
  { key: "rgb",         label: "RGB TT",       base: "meta_cerveja", baseReal: "real_cerveja" }, // Giro RGB + Litrinho + Trimarcas
];
const num = (v) => parseFloat(String(v ?? "0").replace(",", ".")) || 0;

let _ok = false;
async function ensure() {
  if (_ok) return;
  await query(`CREATE TABLE IF NOT EXISTS metas_monitor (
    mes TEXT, categoria TEXT, meta_hl NUMERIC, PRIMARY KEY (mes, categoria))`);
  await query(`CREATE TABLE IF NOT EXISTS metas_monitor_setor (
    mes TEXT, categoria TEXT, setor TEXT, meta_hl NUMERIC, PRIMARY KEY (mes, categoria, setor))`);
  _ok = true;
}

// { cervejaZero: 100, match: 40, nabZero: 500 } do mês (só as lançadas). Nunca lança erro.
async function lerMetasMonitor(mes) {
  try {
    await ensure();
    const r = await query("SELECT categoria, meta_hl FROM metas_monitor WHERE mes = $1", [mes]);
    const out = {};
    r.rows.forEach((x) => { if (x.meta_hl != null) out[x.categoria] = Number(x.meta_hl); });
    // metas por setor (Distribuição pelo tri) — propriedade não enumerável p/ não aparecer
    // como categoria nas telas que listam o objeto.
    const ps = await query("SELECT categoria, setor, meta_hl FROM metas_monitor_setor WHERE mes = $1", [mes]);
    const porSetor = {};
    ps.rows.forEach((x) => { if (x.meta_hl != null) (porSetor[x.categoria] = porSetor[x.categoria] || {})[String(x.setor).trim()] = Number(x.meta_hl); });
    Object.defineProperty(out, "_porSetor", { value: porSetor, enumerable: false });
    return out;
  } catch (e) { console.error("metas_monitor:", e.message); return {}; }
}

async function salvarMetasMonitor(mes, metas) {
  await ensure();
  // meta da operação mudou na Home → a distribuição por setor daquela categoria fica velha: apaga
  // (volta ao rateio proporcional). Mantém a da categoria cujo total não mudou.
  const antes = await lerMetasMonitor(mes);
  for (const c of CATS_MONITOR) {
    const v = metas?.[c.key];
    const n = v === "" || v == null ? null : Number(String(v).replace(",", "."));
    if (antes._porSetor?.[c.key] && (n == null || Math.abs(n - (antes[c.key] ?? NaN)) > 0.001 || isNaN(n))) {
      await query("DELETE FROM metas_monitor_setor WHERE mes = $1 AND categoria = $2", [mes, c.key]);
    }
  }
  await query("DELETE FROM metas_monitor WHERE mes = $1", [mes]);
  for (const c of CATS_MONITOR) {
    const v = metas?.[c.key];
    const n = v === "" || v == null ? null : Number(String(v).replace(",", "."));
    if (n == null || isNaN(n)) continue;
    await query("INSERT INTO metas_monitor (mes, categoria, meta_hl) VALUES ($1,$2,$3)", [mes, c.key, n]);
  }
}

// Meta por setor de UMA categoria (Distribuição pelo tri): grava os setores e a meta da operação
// (= soma). porSetor = { setor: metaHL }.
async function salvarMetasMonitorSetor(mes, key, porSetor) {
  await ensure();
  if (!CATS_MONITOR.some((c) => c.key === key)) throw new Error(`categoria de monitoramento inválida: ${key}`);
  await query("DELETE FROM metas_monitor_setor WHERE mes = $1 AND categoria = $2", [mes, key]);
  let tot = 0;
  for (const [setor, v] of Object.entries(porSetor || {})) {
    const n = Number(v); if (!Number.isFinite(n)) continue;
    tot += n;
    await query("INSERT INTO metas_monitor_setor (mes, categoria, setor, meta_hl) VALUES ($1,$2,$3,$4)", [mes, key, String(setor), n]);
  }
  await query(`INSERT INTO metas_monitor (mes, categoria, meta_hl) VALUES ($1,$2,$3)
    ON CONFLICT (mes, categoria) DO UPDATE SET meta_hl = EXCLUDED.meta_hl`, [mes, key, Math.round(tot * 1000) / 1000]);
}

// Rateio da meta da operação por setor. rvMesTodos = rv_resultado do mês SEM filtro de perfil
// (o peso é sempre sobre a operação inteira). Retorna { key: { setor: metaHL } }.
function ratearMetasMonitor(metasOp, rvMesTodos) {
  const out = {};
  CATS_MONITOR.forEach((c) => {
    if (metasOp?.[c.key] == null) return;
    const fixo = metasOp?._porSetor?.[c.key];
    if (fixo && Object.keys(fixo).length) { out[c.key] = { ...fixo }; return; } // distribuída pelo tri
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

module.exports = { CATS_MONITOR, lerMetasMonitor, salvarMetasMonitor, salvarMetasMonitorSetor, ratearMetasMonitor };
