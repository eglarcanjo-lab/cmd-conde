// Status de cobertura por PDV × categoria (processador: _processar_cobertura, v3.109).
// Mês atual (M) + os 3 meses ANTERIORES corridos (M-3, M-2, M-1).
// Cores pedidas pelo Eduardo: OK verde · EST amarelo · IST amarelo com letra vermelha · NOK vermelho.
// PEND (pendente) em laranja. "PENDENTE" é o nome antigo — tratado como PEND.
export const STATUS_COB = {
  OK:   { sigla: "OK",   nome: "OK",        desc: "comprou no mês atual",                                        bg: "rgba(34,197,94,0.18)",  color: "#4ade80", borda: "rgba(34,197,94,0.35)" },
  EST:  { sigla: "EST",  nome: "Estável",   desc: "comprou nos 3 meses anteriores, falta o mês atual",           bg: "rgba(245,196,81,0.22)", color: "#f5c451", borda: "rgba(245,196,81,0.4)" },
  PEND: { sigla: "PEND", nome: "Pendente",  desc: "comprou no mês passado, falta o mês atual",                   bg: "rgba(251,146,60,0.18)", color: "#fb923c", borda: "rgba(251,146,60,0.4)" },
  IST:  { sigla: "IST",  nome: "Instável",  desc: "comprou em algum dos 3 anteriores, mas não no mês passado (ou mês sim, mês não)", bg: "rgba(245,196,81,0.22)", color: "#f87171", borda: "rgba(245,196,81,0.4)" },
  NOK:  { sigla: "NOK",  nome: "NOK",       desc: "não comprou nos 3 meses anteriores nem no atual",             bg: "rgba(239,68,68,0.18)",  color: "#f87171", borda: "rgba(239,68,68,0.4)" },
  "—":  { sigla: "—",    nome: "—",         desc: "",                                                             bg: "transparent",           color: "rgba(255,255,255,0.15)", borda: "transparent" },
};
export const ORDEM_STATUS = ["OK", "EST", "PEND", "IST", "NOK"];
export const normStatus = (s) => (s === "PENDENTE" ? "PEND" : (STATUS_COB[s] ? s : "—"));
export const corStatus = (s) => STATUS_COB[normStatus(s)];
