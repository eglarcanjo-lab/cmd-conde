// Mês de referência da Home (seletor no topo do dashboard).
// Regra: até o 5º DIA ÚTIL do mês a operação ainda está alimentando o mês anterior,
// então a Home abre no MÊS ANTERIOR; depois disso, no mês atual. Dias úteis = seg–sex
// (feriados não entram na conta).

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export const hojeBR = () => new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));

export const ymDe = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

// "2026-09" deslocado n meses
export const somaMes = (ym, n) => {
  const [y, m] = ym.split("-").map(Number);
  return ymDe(new Date(y, m - 1 + n, 1));
};

export const rotuloMes = (ym) => {
  const [y, m] = String(ym).split("-");
  return `${MESES[(Number(m) || 1) - 1]}/${String(y).slice(2)}`;
};

// Data (dia do mês) do N-ésimo dia útil do mês de `d`.
export const diaUtil = (d, n) => {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  let c = 0;
  while (x.getMonth() === d.getMonth()) {
    const w = x.getDay();
    if (w >= 1 && w <= 5 && ++c === n) return x.getDate();
    x.setDate(x.getDate() + 1);
  }
  return 31;
};

// Mês que a Home deve abrir + se estamos na janela de fechamento do mês anterior.
export const mesPadraoHome = () => {
  const hoje = hojeBR();
  const atual = ymDe(hoje);
  const limite = diaUtil(hoje, 5);
  const fechando = hoje.getDate() <= limite;
  return { mes: fechando ? somaMes(atual, -1) : atual, atual, fechando, limite };
};
