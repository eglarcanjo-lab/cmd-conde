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

// O mapa do "realizado" por KPI (SPO_REAL) agora é fonte ÚNICA no backend
// (backend/src/config/spoKpis.js) e chega ao front via GET /api/spo/config —
// some a duplicação front/back (Fase 3b). A extração de valor (realDaLinha) virou
// helper genérico abaixo, recebendo a regra `rc` = { aba, campos }.

// Extrai o realizado de uma linha-resumo (OPERACAO do mês) conforme a regra `rc`.
// `d` = linha já filtrada; retorna número ou null. Replica parseFloat(d.a||d.b||0).
export function realDaLinha(rc, d) {
  if (!rc || !d) return null;
  let raw = 0;
  for (const c of rc.campos) { if (d[c]) { raw = d[c]; break; } }
  return parseFloat(raw || 0);
}
