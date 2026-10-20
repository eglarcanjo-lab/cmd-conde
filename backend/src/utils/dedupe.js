// Remove linhas repetidas pela chave (fica a ÚLTIMA). Tabelas que acumulam por mês podem
// ficar com o mês em dobro se dois imports do CORA rodarem ao mesmo tempo (o backend
// reenvia o arquivo quando o processador demora) — a leitura se protege.
function dedupe(rows, chaveFn) {
  const m = new Map();
  (rows || []).forEach((r) => m.set(chaveFn(r), r));
  return [...m.values()];
}
module.exports = { dedupe };
