// O Postgres devolve colunas DATE como ISO completo ("2026-07-09T00:00:00.000Z") depois
// de passar por JSON.stringify — essas funções normalizam pra exibição e pra <input type="date">.

export function paraInputDate(valor) {
  if (!valor) return "";
  return String(valor).slice(0, 10); // "YYYY-MM-DD"
}

export function formatarDataBR(valor) {
  const iso = paraInputDate(valor);
  if (!iso) return "";
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}
