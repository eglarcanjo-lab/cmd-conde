// Monta o "Report Volumes" (planilha): Operação → GV → RN × 6 categorias × Meta/Real/%/Tend/%T.
// Fonte: rv_resultado (metas/real das 4 principais) + rv_volume (volume das "zero").
// Usado pelo farol WhatsApp (farol-volumes) e pela Home (resumo/volumes, aba Analítico).
const num = (v) => parseFloat(String(v ?? "0").replace(",", ".")) || 0;
const fmtN = (n) => (Math.round(Number(n) || 0)).toLocaleString("pt-BR"); // inteiro c/ separador de milhar

// tipo "rv" = meta/real do rv_resultado; "zero" = real do rv_volume, meta = 15% da base.
// Ordem: Cerveja · NAB · Match · Mktp · Cerv. Zero · NAB Zero (zeros por último).
const CATS = [
  { key: "cerveja", label: "Cerveja", tipo: "rv", real: "real_cerveja", meta: "meta_cerveja" },
  { key: "nab", label: "NAB", tipo: "rv", real: "real_nab", meta: "meta_nab" },
  { key: "match", label: "Match", tipo: "rv", real: "real_match", meta: "meta_match" },
  { key: "mktp", label: "Mktp", tipo: "rv", real: "real_marketplace", meta: "meta_marketplace" },
  { key: "cervejaZero", label: "Cerv. Zero", tipo: "zero", volCat: "CERVEJA ZERO", base: "cerveja" },
  { key: "nabZero", label: "NAB Zero", tipo: "zero", volCat: "NAB ZERO", base: "nab" },
];
// Sem a coluna "%" (Real vs Meta) — fica só o "%T" (Tendência vs Meta).
const SUBCOLS = [{ key: "meta", label: "Meta" }, { key: "real", label: "Real" }, { key: "tend", label: "Tend" }, { key: "pctT", label: "%T" }];
const primeiroNome = (nome) => String(nome || "").trim().split(/\s+/)[0] || "";
const sinal = (p) => (p == null ? "flat" : p >= 100 ? "up" : p >= 70 ? "mid" : "down");

// rvRows: rv_resultado (já do mês atual). volRows: rv_volume do mês atual. nomeSetor: {cod->nome}.
// fator: projeção do mês (tend = real × fator). Retorna { categorias, subcols, secoes } ou null.
function montarReport(rvRows, volRows, nomeSetor, fator) {
  const raw = {}; // setor -> { catKey: {meta, real} }
  const initSetor = (s) => { if (!raw[s]) { raw[s] = {}; CATS.forEach((c) => raw[s][c.key] = { meta: 0, real: 0 }); } };
  rvRows.forEach((r) => {
    const s = String(r.setor || "").trim(); if (!s) return; initSetor(s);
    CATS.filter((c) => c.tipo === "rv").forEach((c) => { raw[s][c.key].meta += num(r[c.meta]); raw[s][c.key].real += num(r[c.real]); });
  });
  const volSetor = {};
  (volRows || []).forEach((r) => {
    const s = String(r.setor || "").trim(); if (!s) return;
    const cat = String(r.categoria || "").trim().toUpperCase();
    (volSetor[s] = volSetor[s] || {})[cat] = (volSetor[s]?.[cat] || 0) + num(r.volume);
  });
  Object.keys(raw).forEach((s) => {
    CATS.filter((c) => c.tipo === "zero").forEach((c) => {
      raw[s][c.key] = { meta: 0.15 * (raw[s][c.base]?.real || 0), real: volSetor[s]?.[c.volCat] || 0 };
    });
  });

  const setores = Object.keys(raw).sort();
  if (!setores.length) return null;

  const aggCats = (lista) => {
    const out = {};
    CATS.forEach((c) => {
      let m = 0, r = 0;
      lista.forEach((s) => { const cel = raw[s]?.[c.key]; if (cel) { m += cel.meta; r += cel.real; } });
      const tend = r * fator;
      const p = m > 0 ? Math.round((r / m) * 100) : null;
      const pT = m > 0 ? Math.round((tend / m) * 100) : null;
      out[c.key] = { meta: fmtN(m), real: fmtN(r), pct: p == null ? "—" : `${p}%`, tend: fmtN(tend), pctT: pT == null ? "—" : `${pT}%`, _cor: sinal(p), _corT: sinal(pT) };
    });
    return out;
  };

  const gvLinhas = [["1", "GV 1"], ["3", "GV 3"]]
    .map(([px, lbl]) => ({ lbl, sets: setores.filter((s) => String(s)[0] === px) }))
    .filter((g) => g.sets.length)
    .map((g) => ({ rotulo: g.lbl, cats: aggCats(g.sets) }));
  const rnLinhas = setores.map((s) => ({ setor: s, rotulo: primeiroNome(nomeSetor[s]) || s, cats: aggCats([s]) }));

  return {
    categorias: CATS.map((c) => ({ key: c.key, label: c.label })),
    subcols: SUBCOLS,
    secoes: [
      { titulo: "Consolidado Operação", colLabel: "Operação", linhas: [{ rotulo: "Operação", cats: aggCats(setores) }] },
      { titulo: "Por GV", colLabel: "GV", linhas: gvLinhas },
      { titulo: "Por RN", colLabel: "RN", setorCol: true, linhas: rnLinhas },
    ],
  };
}

module.exports = { montarReport };
