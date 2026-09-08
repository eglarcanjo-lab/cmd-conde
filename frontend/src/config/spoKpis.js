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

// `n`   – chave INTERNA estável (amarra cálculo do realizado e dados salvos no banco).
//         NÃO muda, mesmo que a numeração oficial do SPO mude.
// `ord`  – NÚMERO/ORDEM OFICIAL do KPI na guia Comercial (Checklist Revendas Q3'26).
//          É o que aparece na tela e define a ordem de exibição.
// pts/peso vêm da guia Comercial (somam 180 pts nos 23 KPIs ativos).
export const SPO_KPIS = [
  { n: 1,  ord: 1,  label: "Visitação GV na Base Foco",         pts: 8,  peso: 4.44,  ativo: true },
  { n: 2,  ord: 2,  label: "Rota Coaching",                      pts: 10, peso: 5.56,  ativo: true }, // início oficial: Agosto
  { n: 3,  ord: 3,  label: "TT Dias com Rotas",                  pts: 6,  peso: 3.33,  ativo: true },
  { n: 4,  ord: 4,  label: "Abertura de Desafios Diários",       pts: 4,  peso: 2.22,  ativo: true },
  { n: 25, ord: 5,  label: "Rotina +",                           pts: 10, peso: 5.56,  ativo: true }, // % Visitas Medianas ou Excelentes (meta 49%)
  { n: 6,  ord: 6,  label: "DTO GC",                             pts: 4,  peso: 2.22,  ativo: true },
  { n: 8,  ord: 7,  label: "Aderência de Política Comercial",    pts: 8,  peso: 4.44,  ativo: true }, // Passo da Rotina 05
  { n: 9,  ord: 8,  label: "Execução Menu de Cerveja",           pts: 8,  peso: 4.44,  ativo: true }, // Passo da Rotina 06
  { n: 10, ord: 9,  label: "Academia Bees RN",                   pts: 8,  peso: 4.44,  ativo: true },
  { n: 11, ord: 10, label: "Tasks Cerveja TT (Portfolio)",       pts: 20, peso: 11.11, ativo: true },
  { n: 12, ord: 11, label: "Tasks Faturamento Score 5",          pts: 6,  peso: 3.33,  ativo: true },
  { n: 13, ord: 12, label: "Tasks NAB TT (Portfolio)",           pts: 10, peso: 5.56,  ativo: true },
  { n: 26, ord: 13, label: "SKU/PDV TT",                         pts: 8,  peso: 4.44,  ativo: true }, // novo — sem cálculo automático ainda
  { n: 15, ord: 14, label: "Tasks de Marketplace",               pts: 6,  peso: 3.33,  ativo: true },
  { n: 16, ord: 15, label: "Tasks de Match (Portfolio)",         pts: 6,  peso: 3.33,  ativo: true },
  { n: 17, ord: 16, label: "Tasks Cerveja Zero (Portfolio)",     pts: 4,  peso: 2.22,  ativo: true },
  { n: 18, ord: 17, label: "Tarefa de Digitalização",            pts: 6,  peso: 3.33,  ativo: true },
  { n: 5,  ord: 18, label: "Atendimento Produtivo",              pts: 26, peso: 14.44, ativo: true },
  { n: 27, ord: 19, label: "+LN",                                pts: 4,  peso: 2.22,  ativo: true }, // novo — sem cálculo automático ainda
  { n: 21, ord: 20, label: "Cupons Digitais - Score 5",          pts: 4,  peso: 2.22,  ativo: true },
  { n: 22, ord: 21, label: "% Lojas Ideais",                     pts: 4,  peso: 2.22,  ativo: true },
  { n: 23, ord: 22, label: "Expansão Scanntech",                 pts: 2,  peso: 1.11,  ativo: true },
  { n: 24, ord: 23, label: "Portfólio Ideal Score 5",            pts: 8,  peso: 4.44,  ativo: true },
  // ── Fora do tri Jul–Set/2026 (código/histórico preservados; sem ord) ──
  { n: 7,  label: "% PDVs abrindo Promoção no BEES",    pts: 10, peso: 5.6,  ativo: false },
  { n: 14, label: "Tasks de Volume",                    pts: 6,  peso: 3.3,  ativo: false },
  { n: 19, label: "PDVs com Compra Independente",       pts: 4,  peso: 2.2,  ativo: false },
  { n: 20, label: "+RGB",                               pts: 6,  peso: 3.3,  ativo: false },
];

// Versão enxuta {n, label, ord} para o Painel SPO e o admin de Metas — SÓ os KPIs
// ativos, JÁ ORDENADOS pela numeração oficial (ord). ativo:false sai do painel mas
// preserva a linha e o código.
export const SPO_KPIS_BASICO = SPO_KPIS
  .filter((k) => k.ativo)
  .sort((a, b) => (a.ord ?? 999) - (b.ord ?? 999))
  .map(({ n, label, ord }) => ({ n, label, ord }));

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
