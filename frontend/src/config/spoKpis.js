// ─────────────────────────────────────────────────────────────────────────────
// REGISTRO ÚNICO DOS KPIs DO SPO — fonte de verdade do app.
//
// Fase 1 da refatoração (ver Auditoria_Final_SPO_KPIs.pdf): antes a lista de KPIs
// estava DUPLICADA em 3 lugares (SPO_ITEMS na tela SPO, o Painel SPO e o ITENS do
// SpoMetas), com rótulos divergindo entre eles. Agora todos leem desta lista.
//
// COMO INCLUIR/EXCLUIR UM KPI DO TRIMESTRE:
//   • Incluir  → adicione um objeto aqui (n, label, pts, peso, ativo).
//   • Excluir  → marque ativo:false (sai da tela e do total, preserva o histórico)
//                ou remova o objeto. Edite SOMENTE este arquivo.
//
// Campos:
//   n     – número oficial do item no SPO
//   label – nome exibido (único, usado em tela, painel e metas)
//   pts   – pontos do item (compõem o total do SPO)
//   peso  – peso percentual do item
//   ativo – false esconde o card e mantém a aba/histórico
// ─────────────────────────────────────────────────────────────────────────────

export const SPO_KPIS = [
  { n: 1,  label: "Visitação GV na Base Foco",         pts: 14, peso: 7.8,  ativo: true },
  { n: 2,  label: "Rota Coaching",                      pts: 10, peso: 5.6,  ativo: true },
  { n: 3,  label: "TT Dias com Rotas",                  pts: 6,  peso: 3.3,  ativo: true },
  { n: 4,  label: "Abertura de Desafios Diários",       pts: 4,  peso: 2.2,  ativo: true },
  { n: 5,  label: "Atendimento Produtivo",              pts: 14, peso: 7.8,  ativo: true },
  { n: 6,  label: "DTO GC",                             pts: 6,  peso: 3.3,  ativo: true },
  { n: 7,  label: "% PDVs abrindo Promoção no BEES",    pts: 10, peso: 5.6,  ativo: true },
  { n: 8,  label: "Aderência de Política Comercial",    pts: 8,  peso: 4.4,  ativo: true },
  { n: 9,  label: "Execução Menu de Cerveja",           pts: 10, peso: 5.6,  ativo: true },
  { n: 10, label: "Academia Bees RN",                   pts: 14, peso: 7.8,  ativo: false },
  { n: 11, label: "Tasks Cerveja TT (Portfolio)",       pts: 10, peso: 5.6,  ativo: true },
  { n: 12, label: "Tasks Faturamento Score 5",          pts: 6,  peso: 3.3,  ativo: true },
  { n: 13, label: "Tasks NAB TT (Portfolio)",           pts: 10, peso: 5.6,  ativo: true },
  { n: 14, label: "Tasks de Volume",                    pts: 6,  peso: 3.3,  ativo: true },
  { n: 15, label: "Tasks de Marketplace",               pts: 8,  peso: 4.4,  ativo: true },
  { n: 16, label: "Tasks de Match (Portfolio)",         pts: 8,  peso: 4.4,  ativo: true },
  { n: 17, label: "Tasks Cerveja Zero (Portfolio)",     pts: 6,  peso: 3.3,  ativo: true },
  { n: 18, label: "Tarefa de Digitalização",            pts: 4,  peso: 2.2,  ativo: true },
  { n: 19, label: "PDVs com Compra Independente",       pts: 4,  peso: 2.2,  ativo: true },
  { n: 20, label: "+RGB",                               pts: 6,  peso: 3.3,  ativo: true },
  { n: 21, label: "Cupons Digitais - Score 5",          pts: 6,  peso: 3.3,  ativo: true },
  { n: 22, label: "% Lojas Ideais",                     pts: 4,  peso: 2.2,  ativo: true },
  { n: 23, label: "Expansão Scanntech",                 pts: 2,  peso: 1.1,  ativo: true },
  { n: 24, label: "Portfólio Ideal Score 5",            pts: 8,  peso: 4.4,  ativo: true },
];

// Versão enxuta {n, label} para o Painel SPO e o admin de Metas.
export const SPO_KPIS_BASICO = SPO_KPIS.map(({ n, label }) => ({ n, label }));

// ─────────────────────────────────────────────────────────────────────────────
// REALIZADO POR KPI (Fase 2) — fonte única da regra "qual coluna do resumo é o
// realizado". Vale para os KPIs de padrão simples: pega a linha OPERACAO do mês
// na aba `aba` e usa o 1º `campos` preenchido (equivale a d.a || d.b || 0).
//
// Os KPIs 1,2,3,4,6,7 NÃO entram aqui: têm cálculo próprio (somatório por GV,
// percentual etc.) e continuam tratados caso a caso na tela e no backend.
//
// IMPORTANTE: o backend espelha este mapa em backend/src/config/spoKpis.js.
// Ao incluir/ajustar um KPI simples, edite os DOIS (front e back) — ou, a partir
// da Fase 3, o backend passará a expor isto por endpoint e some a duplicação.
// ─────────────────────────────────────────────────────────────────────────────
export const SPO_REAL = {
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

// Extrai o realizado de uma linha-resumo (OPERACAO do mês) conforme SPO_REAL[n].
// `d` = linha já filtrada; retorna número ou null. Replica parseFloat(d.a||d.b||0).
export function realDaLinha(n, d) {
  const rc = SPO_REAL[n];
  if (!rc || !d) return null;
  let raw = 0;
  for (const c of rc.campos) { if (d[c]) { raw = d[c]; break; } }
  return parseFloat(raw || 0);
}
