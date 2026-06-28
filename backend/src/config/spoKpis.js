// ─────────────────────────────────────────────────────────────────────────────
// REALIZADO POR KPI (Fase 2) — espelho de frontend/src/config/spoKpis.js (SPO_REAL).
//
// Define, para os KPIs de padrão simples, qual coluna da linha OPERACAO do resumo
// é o "realizado". Mantido em sincronia com o front (deploys separados: Vercel x
// Render não compartilham arquivo em runtime). A partir da Fase 3 o backend passa
// a expor isto por endpoint e a duplicação some.
//
// KPIs 1,2,3,4,6,7 NÃO entram aqui (cálculo próprio — somatório/percentual).
// ─────────────────────────────────────────────────────────────────────────────
const SPO_REAL = {
  5:  { aba: "spo_ap_resumo",              campos: ["rns_ap_ok"] },
  8:  { aba: "spo_politica_resumo",        campos: ["pdvs_execucao"] },
  9:  { aba: "spo_menu_resumo",            campos: ["tasks_validas"] },
  11: { aba: "spo_tasks_cerveja_resumo",   campos: ["tasks_validas", "pdvs_ok"] },
  12: { aba: "spo_score5_resumo",          campos: ["pdvs_ok"] },
  13: { aba: "spo_tasks_nab_resumo",       campos: ["tasks_validas"] },
  14: { aba: "spo_tasks_volume_resumo",    campos: ["tasks_validas"] },
  15: { aba: "spo_tasks_marketplace_resumo", campos: ["tasks_validas"] },
  16: { aba: "spo_tasks_match_resumo",     campos: ["tasks_validas"] },
  17: { aba: "spo_tasks_cerv_zero_resumo", campos: ["tasks_validas"] },
  18: { aba: "spo_tasks_digit_resumo",     campos: ["tasks_validas"] },
  19: { aba: "spo_pedido_alone_resumo",    campos: ["pdvs_alone"] },
  20: { aba: "spo_rgb_total",              campos: ["pdvs_bateu_meta"] },
  21: { aba: "spo_cupons_resumo",          campos: ["cupons_mes"] },
  22: { aba: "spo_loja_ideal_resumo",      campos: ["pdvs_ideais"] },
  23: { aba: "spo_scanntech_resumo",       campos: ["pdvs_ativos", "ativos"] },
  24: { aba: "spo_portfolio_ideal_resumo", campos: ["pdvs_ideais"] },
};

// Extrai o realizado de uma linha-resumo (OPERACAO do mês). Replica parseFloat(d.a||d.b||0).
function realDaLinha(n, d) {
  const rc = SPO_REAL[n];
  if (!rc || !d) return null;
  let raw = 0;
  for (const c of rc.campos) { if (d[c]) { raw = d[c]; break; } }
  return parseFloat(raw || 0);
}

module.exports = { SPO_REAL, realDaLinha };
