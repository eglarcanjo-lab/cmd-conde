// Distribuição da meta da operação entre os RNs pelo PESO DO TRI (Admin › Metas).
// Peso do setor = média mensal dos 3 últimos meses fechados do que os PDVs da CARTEIRA
// ATUAL dele (pdv_base) compraram ÷ a mesma média da operação. Meta do RN = meta da
// operação × peso. Cerveja/NAB/Match em HL (vendas_cliente_produto × produtos_base);
// Marketplace em R$ (vendas_cliente_produto.valor, gravado pelo processador desde o
// v3.138.0 — mês sem esse valor cai no faturamento Mktp do SETOR, rv_faturamento_mktp).
// Também as metas de MONITORAMENTO (fora da RV): Cerveja Zero, NAB Zero e RGB TT → gravadas por
// setor em metas_monitor_setor (Home, Volume Diário, Report do WhatsApp usam a do setor).
const { readSheet, readSheetMonths } = require("../services/sheets");
const { lerMetasMonitor } = require("./metasMonitor");
const { CATS_RGB } = require("./rgbVolume");

const normCod = (v) => String(v ?? "").trim().replace(/\.0$/, "").replace(/^0+/, "");
const num = (v) => { const n = parseFloat(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
const temNum = (v) => v !== null && v !== undefined && String(v).trim() !== "" && Number.isFinite(parseFloat(String(v).replace(",", ".")));
const catsDe = (p) => String(p.categorias || p.categoria || "").toUpperCase().split(/\s*[|,;]\s*/).map((c) => c.trim()).filter(Boolean);

const SETORES_RV = ["101", "102", "103", "104", "105", "106", "107", "108", "109", "110", "111"];
const SETORES_OFF = new Set(["101", "102", "103"]); // Match só tem meta no OFF (AS/Rota/Sub)

// Mesmos grupos do cálculo da RV (proc_rv: Cerveja inclui RGB, HE, Balanced Choice…)
const GRUPOS = {
  cerveja: new Set(["CERVEJA", "CERVEJA ZERO", "CERVEJA MULTIPACK", "GIRO RGB", "HE", "HE RGB", "LITRINHO",
    "BALANCED CHOICE", "TRIMARCA RGB HE (ORIGINAL)", "TRIMARCA RGB HE (STELLA)", "TRIMARCA RGB HE (SPATEN)"]),
  nab: new Set(["NAB", "NAB ZERO"]),
  match: new Set(["MATCH"]),
  mktp: new Set(["MKTP"]),
  cervejaZero: new Set(["CERVEJA ZERO"]),
  nabZero: new Set(["NAB ZERO"]),
  rgb: CATS_RGB,
};

// tipo "rv" = metas da RV (tabela metas); "monitor" = metas fora da RV (metas_monitor_setor)
const CATEGORIAS = [
  { key: "cerveja", categoria: "CERVEJA (VOLUME)", label: "Cerveja", unidade: "HL", tipo: "rv" },
  { key: "nab", categoria: "NAB (VOLUME)", label: "NAB", unidade: "HL", tipo: "rv" },
  { key: "match", categoria: "MATCH (VOLUME)", label: "Match", unidade: "HL", so_off: true, tipo: "rv" },
  { key: "mktp", categoria: "MARKETPLACE (FATURAMENTO)", label: "Marketplace", unidade: "R$", tipo: "rv" },
  { key: "cervejaZero", categoria: "cervejaZero", label: "Cerveja Zero", unidade: "HL", tipo: "monitor" },
  { key: "nabZero", categoria: "nabZero", label: "NAB Zero", unidade: "HL", tipo: "monitor" },
  { key: "rgb", categoria: "rgb", label: "RGB TT", unidade: "HL", tipo: "monitor" },
];

// "2026-12" → ["2026-09","2026-10","2026-11"] (3 meses fechados antes do mês da meta)
function mesesTri(mes) {
  const [a, m] = mes.split("-").map(Number);
  const out = [];
  for (let k = 3; k >= 1; k--) {
    const d = new Date(Date.UTC(a, m - 1 - k, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}
const mesAnterior = (mes) => mesesTri(mes)[2];

async function calcularDistribuicao(mes) {
  const meses = mesesTri(mes);
  const [base, pdvBase, vendas, fatMktp, metas, usuarios, monMes, monAnt] = await Promise.all([
    readSheet("produtos_base").catch(() => []),
    readSheet("pdv_base").catch(() => []),
    readSheetMonths("vendas_cliente_produto", "mes_referencia", meses).catch(() => []),
    readSheet("rv_faturamento_mktp").catch(() => []),
    readSheet("metas").catch(() => []),
    readSheet("usuarios").catch(() => []),
    lerMetasMonitor(mes), lerMetasMonitor(mesAnterior(mes)),
  ]);

  // produto → grupos (um produto conta 1x por grupo, mesmo com várias categorias)
  const grupoDe = new Map();
  base.forEach((p) => {
    const cs = catsDe(p);
    const gs = Object.keys(GRUPOS).filter((g) => cs.some((c) => GRUPOS[g].has(c)));
    if (gs.length) grupoDe.set(normCod(p.cod), gs);
  });

  // carteira atual: PDV → setor
  const carteira = new Map();
  const nPdvs = {};
  pdvBase.forEach((p) => {
    const s = String(p.setor || "").trim();
    const c = normCod(p.cod_pdv);
    if (!c || !SETORES_RV.includes(s)) return;
    carteira.set(c, s);
    nPdvs[s] = (nPdvs[s] || 0) + 1;
  });

  // soma por setor × mês × grupo (HL; Mktp em R$ quando o mês tem valor por cliente)
  const soma = {};          // soma[setor][grupo] = total dos 3 meses
  const mesComValor = {};   // mes → true se alguma linha tem valor
  vendas.forEach((r) => { if (temNum(r.valor)) mesComValor[String(r.mes_referencia).slice(0, 7)] = true; });
  vendas.forEach((r) => {
    const m = String(r.mes_referencia || "").slice(0, 7);
    if (!meses.includes(m)) return;
    const s = carteira.get(normCod(r.cod_pdv));
    if (!s) return;
    const gs = grupoDe.get(normCod(r.cod_produto));
    if (!gs) return;
    soma[s] = soma[s] || {};
    gs.forEach((g) => {
      if (g === "mktp") {
        if (mesComValor[m]) soma[s].mktp = (soma[s].mktp || 0) + num(r.valor);
      } else soma[s][g] = (soma[s][g] || 0) + num(r.volume_hl);
    });
  });
  // Mktp dos meses SEM valor por cliente → faturamento do setor (carteira da época)
  const mesesMktpSetor = meses.filter((m) => !mesComValor[m]);
  fatMktp.forEach((r) => {
    const m = String(r.mes_referencia || "").slice(0, 7);
    if (!mesesMktpSetor.includes(m)) return;
    const s = String(r.setor || "").trim();
    if (!SETORES_RV.includes(s)) return;
    soma[s] = soma[s] || {};
    soma[s].mktp = (soma[s].mktp || 0) + num(r.faturamento_mktp_real);
  });

  // meta da operação sugerida = soma das metas já lançadas p/ o mês (senão, do mês anterior)
  const metaOp = (m) => {
    const mon = m === mes ? monMes : monAnt;
    const o = {};
    CATEGORIAS.filter((c) => c.tipo === "monitor").forEach((c) => { if (mon[c.key] != null) o[c.key] = mon[c.key]; });
    metas.forEach((x) => {
      if (String(x.mes_referencia || "").slice(0, 7) !== m) return;
      const c = CATEGORIAS.find((k) => k.categoria === String(x.categoria || "").trim().toUpperCase());
      if (c) o[c.key] = (o[c.key] || 0) + num(x.meta_aplicada || x.meta_volume);
    });
    return o;
  };
  let metaSug = metaOp(mes); let metaFonte = mes;
  if (!Object.keys(metaSug).length) { metaSug = metaOp(mesAnterior(mes)); metaFonte = mesAnterior(mes); }

  const atuais = {};
  metas.forEach((x) => {
    if (String(x.mes_referencia || "").slice(0, 7) !== mes) return;
    const s = String(x.setor || "").trim();
    (atuais[s] = atuais[s] || {})[String(x.categoria || "").trim().toUpperCase()] = num(x.meta_aplicada || x.meta_volume);
  });
  Object.entries(monMes._porSetor || {}).forEach(([k, por]) => Object.entries(por).forEach(([s, v]) => { (atuais[s] = atuais[s] || {})[k] = v; }));

  const nome = {};
  usuarios.forEach((u) => { if (String(u.ativo) !== "false" && u.cod) nome[String(u.cod).trim()] = u.nome; });

  const setores = SETORES_RV.filter((s) => nPdvs[s] || soma[s]).map((s) => {
    const tri = {};
    CATEGORIAS.forEach((c) => {
      tri[c.key] = (c.so_off && !SETORES_OFF.has(s)) ? 0 : Math.round(((soma[s]?.[c.key] || 0) / 3) * 100) / 100;
    });
    return { setor: s, nome: nome[s] || "", pdvs: nPdvs[s] || 0, tri, metas_atuais: atuais[s] || {} };
  });

  return {
    mes, meses, categorias: CATEGORIAS,
    mktp_fonte: mesesMktpSetor.length === 0 ? "carteira" : (mesesMktpSetor.length === 3 ? "setor" : "misto"),
    mktp_meses_setor: mesesMktpSetor,
    meta_operacao: metaSug, meta_operacao_mes: metaFonte,
    setores,
  };
}

module.exports = { calcularDistribuicao, mesesTri, CATEGORIAS, SETORES_OFF };
