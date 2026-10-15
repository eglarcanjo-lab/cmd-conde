// Comparação de setor tolerante: texto × número, espaços, zero à esquerda e os códigos
// antigos 301–305 (= 107–111). Use sempre que a tela comparar o setor do dado com o do usuário.
const NOVO_SETOR = { "301": "107", "302": "108", "303": "109", "304": "110", "305": "111" };

export function normSetor(v) {
  const s = String(v ?? "").trim().replace(/\.0$/, "").replace(/^0+(?=\d)/, "");
  return NOVO_SETOR[s] || s;
}

export const mesmoSetor = (a, b) => normSetor(a) === normSetor(b);
