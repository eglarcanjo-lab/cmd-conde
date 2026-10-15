// No máximo 1 interrupção (janela que se abre sozinha) por dia por usuário — Auditoria out/26.
// Prioridade: popup de arte (comunicado do admin) > Lia. Quem abre "reserva" o dia.
const hoje = () => {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const KEY = () => `interrupcao_${hoje()}`;

export function quemInterrompeuHoje() {
  try { return localStorage.getItem(KEY()) || ""; } catch { return ""; }
}
export function reservarInterrupcao(fonte) {
  try { localStorage.setItem(KEY(), fonte); } catch { /* ignore */ }
}
