// Farol MATINAL (robô WhatsApp, 8h) — blocos novos do "Escopo do PDF Matinal" (21/10/2026).
// Mesmo formato dos outros faróis: { data, dia, titulo, emoji, legenda, rn:[], gv:[], director }.
// RN recebe só o dele; GV recebe IGUAL à diretoria (consolidado de todos os RNs).
//   GET /ap      — Atendimento Produtivo (painel da operação; no RN a linha dele em destaque)
//   GET /tasks   — Tasks de 1 SKU abertas no mês (KPIs 10·12·14·15·16) + lista do dia do RN
//   GET /score5  — Score 5 (KPI 11): PDVs S5 com visita hoje, meta/faturado/restante, top 3 SKUs
//   GET /pi-he   — Portfólio Ideal (KPI 18): base High End com visita hoje, check por SKU
//   GET /fatbuf  — Faturados + Buffer (PDF separado): diretoria consolidado, RN os PDVs dele
// NÃO REMOVER — consumido pelo robô (cmd-conde-whatsapp/enviar.js).
const express = require("express");
const router = express.Router();
const { readSheet, readSheetMonths } = require("../services/sheets");
const { authMiddleware } = require("../middleware/auth");

router.use(authMiddleware);

const num = (v) => parseFloat(String(v ?? "0").replace(",", ".")) || 0;
const normCod = (v) => String(v ?? "").trim().replace(/\.0$/, "").split("_").pop().replace(/^0+/, "");
const p2 = (n) => String(n).padStart(2, "0");
const f1 = (v) => (v == null || v === "" ? "—" : (Math.round(Number(v) * 10) / 10).toLocaleString("pt-BR"));
const rs = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const DIA_LABEL = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const DIA_COD = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];
const SET_RN = ["101", "103", "104", "105", "106", "107", "108", "109", "110", "111"];
const semAcento = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function agora() {
  const br = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return { br, hojeBR: `${p2(br.getDate())}/${p2(br.getMonth() + 1)}/${br.getFullYear()}`,
    hojeISO: `${br.getFullYear()}-${p2(br.getMonth() + 1)}-${p2(br.getDate())}`,
    mes: `${br.getFullYear()}-${p2(br.getMonth() + 1)}`, diaCod: DIA_COD[br.getDay()], diaLabel: DIA_LABEL[br.getDay()] };
}

// Destinatários: RN por setor (perfil rn), GVs e diretoria (recebem o consolidado).
async function destinos() {
  const usuarios = await readSheet("usuarios").catch(() => []);
  const nome = {}, tel = {};
  usuarios.forEach((u) => {
    const c = String(u.cod || "").trim(); if (!c) return;
    nome[c] = String(u.nome || "").trim();
    if (String(u.perfil || "").toLowerCase() === "rn" && String(u.telefone || "").trim()) tel[c] = String(u.telefone).trim();
  });
  const comTel = (perfis) => usuarios.filter((u) => perfis.includes(String(u.perfil || "").toLowerCase()) && String(u.telefone || "").trim())
    .map((u) => ({ nome: String(u.nome || "").trim(), telefone: String(u.telefone).trim(), perfil: String(u.perfil).toLowerCase() }));
  return { nome, tel, gvs: comTel(["gv1", "gv3"]), diretores: comTel(["director"]) };
}
const primeiro = (n) => String(n || "").trim().split(/\s+/)[0] || "";

// Monta a resposta padrão. blocosRn(setor) → blocos do RN; blocosDir → consolidado.
function resposta(t, d, cab, blocosRn, blocosDir) {
  const rn = SET_RN.filter((s) => d.tel[s]).map((s) => ({ setor: s, nome: d.nome[s] || "", telefone: d.tel[s], blocos: blocosRn(s) }));
  const gv = d.gvs.map((g) => ({ grupo: g.perfil === "gv1" ? "1xx" : "3xx", nome: g.nome, telefone: g.telefone, blocos: blocosDir }));
  const director = d.diretores.length ? { blocos: blocosDir, destinatarios: d.diretores.map((u) => ({ nome: u.nome || "Diretoria", telefone: u.telefone })) } : null;
  return { data: t.hojeBR, dia: t.diaLabel, ...cab, colunas: [], rn, gv, director };
}

// Último mês com dado numa tabela (o mês atual se já houver).
const ultimoMes = (rows, col = "mes_referencia") => rows.map((r) => String(r[col] || "").slice(0, 7)).filter(Boolean).sort().pop() || "";

// Metas do SPO cadastradas (spo_metas: item = nº interno do KPI, mes = AAAA-MM)
async function metaSpo(item, mes) {
  const rows = await readSheet("spo_metas").catch(() => []);
  const r = rows.find((x) => String(x.item) === String(item) && String(x.mes || "").slice(0, 7) === mes);
  return r && r.meta !== "" && r.meta != null ? num(r.meta) : null;
}

// ─── 1) ATENDIMENTO PRODUTIVO ──────────────────────────────────────────────────
router.get("/ap", async (req, res) => {
  try {
    const t = agora();
    const [det, apRes, pol, rot, d] = await Promise.all([
      readSheet("spo_ap_detalhe").catch(() => []), readSheet("spo_ap_resumo").catch(() => []),
      readSheet("spo_politica_resumo").catch(() => []), readSheet("spo_rotina_mais_resumo").catch(() => []), destinos(),
    ]);
    const mes = ultimoMes(det);
    const linhasAp = det.filter((r) => String(r.mes_referencia || "").slice(0, 7) === mes && SET_RN.includes(String(r.setor).trim()));
    const polM = ultimoMes(pol), rotM = ultimoMes(rot);
    const polDe = (s) => pol.find((r) => String(r.setor).trim() === s && String(r.mes_referencia || "").slice(0, 7) === polM);
    const rotDe = (s) => rot.find((r) => String(r.setor).trim() === s && String(r.mes_referencia || "").slice(0, 7) === rotM);
    // Meta da OPERAÇÃO vale p/ todos (Aderência = KPI 8 · Rotina+ = KPI 25)
    const metaPol = (await metaSpo(8, t.mes)) ?? (num(polDe("OPERACAO")?.meta) || null);
    const metaRot = (await metaSpo(25, t.mes)) ?? (num(rotDe("OPERACAO")?.meta) || null);
    const opAp = apRes.find((r) => String(r.setor).trim() === "OPERACAO" && String(r.mes_referencia || "").slice(0, 7) === ultimoMes(apRes));
    const cor = (real, meta) => (real == null || meta == null ? null : real >= meta ? "up" : "down");
    const pct = (real, meta) => (meta ? Math.round((real / meta) * 1000) / 10 : null);

    const linhas = linhasAp.map((r) => {
      const s = String(r.setor).trim();
      const pm = num(r.positiv_meta), pr = num(r.positiv_real), cm = num(r.carteira_meta), cr = num(r.carteira_real);
      const rm = num(r.rota_meta), rr = num(r.rota_real), gm = num(r.gps_meta), gr = num(r.gps_real);
      const ad = polDe(s) ? num(polDe(s).pct) : null, ro = rotDe(s) ? num(rotDe(s).pct_med_exc) : null;
      const ok = String(r.ap_ok || "").toUpperCase().startsWith("S");
      return {
        setor: s, rn: primeiro(d.nome[s]),
        pos_meta: f1(pm), pos_real: f1(pr), pos_pct: `${f1(pct(pr, pm))}%`,
        com_meta: f1(cm), com_real: f1(cr), com_pct: `${f1(pct(cr, cm))}%`,
        re_meta: `${f1(rm)}%`, re_real: `${f1(rr)}%`, gps_meta: `${f1(gm)}%`, gps_real: `${f1(gr)}%`,
        ad_meta: metaPol != null ? `${f1(metaPol)}%` : "—", ad_real: ad != null ? `${f1(ad)}%` : "—",
        ro_meta: metaRot != null ? `${f1(metaRot)}%` : "—", ro_real: ro != null ? `${f1(ro)}%` : "—",
        ap: ok ? "✅ OK" : "❌ NOK",
        _cores: { pos_pct: cor(pr, pm), com_pct: cor(cr, cm), re_real: cor(rr, rm), gps_real: cor(gr, gm),
          ad_real: cor(ad, metaPol), ro_real: cor(ro, metaRot), ap: ok ? "up" : "down" },
      };
    }).sort((a, b) => a.setor.localeCompare(b.setor));

    const nOk = linhas.filter((l) => l.ap.includes("OK") && !l.ap.includes("NOK")).length;
    const metaAp = opAp && opAp.meta !== "" ? num(opAp.meta) : null;
    const pctOk = linhas.length ? Math.round((nOk / linhas.length) * 1000) / 10 : 0;
    const resumo = {
      titulo: "Atendimento Produtivo · Operação", subtitulo: `Mês ${mes ? mes.slice(5, 7) + "/" + mes.slice(0, 4) : "—"}`,
      colunas: [{ key: "rn", label: "Indicador" }, { key: "v", label: "Valor" }],
      linhas: [
        { rn: "Meta da operação (% de RNs com AP OK)", v: metaAp != null ? `${f1(metaAp)}%` : "—" },
        { rn: "RNs com Atendimento Produtivo OK", v: `${nOk} de ${linhas.length} · ${f1(pctOk)}%`, _cores: { v: metaAp != null ? (pctOk >= metaAp ? "up" : "down") : null } },
      ],
    };
    const colunas = [
      { key: "setor", label: "Setor" }, { key: "rn", label: "RN" },
      { key: "pos_meta", label: "Posit. Meta" }, { key: "pos_real", label: "Posit. Real" }, { key: "pos_pct", label: "Posit. %" },
      { key: "com_meta", label: "Compr. Meta" }, { key: "com_real", label: "Compr. Real" }, { key: "com_pct", label: "Compr. %" },
      { key: "re_meta", label: "RE Meta" }, { key: "re_real", label: "RE Real" },
      { key: "gps_meta", label: "GPS Meta" }, { key: "gps_real", label: "GPS Real" },
      { key: "ad_meta", label: "Aderência Meta" }, { key: "ad_real", label: "Aderência Real" },
      { key: "ro_meta", label: "Rotina+ Meta" }, { key: "ro_real", label: "Rotina+ Real" }, { key: "ap", label: "AP" },
    ];
    const tabela = (destaque) => ({ titulo: "Atendimento Produtivo · por RN", subtitulo: "Aderência à Política e Rotina+: meta da operação p/ todos", colunas,
      linhas: linhas.map((l) => ({ ...l, _destaque: destaque && l.setor === destaque })), _largo: true });
    const blocosDir = [{ ...resumo, _largo: true }, tabela(null)];
    return res.json(resposta(t, d, { titulo: "Atendimento Produtivo", emoji: "🎯", legenda: "verde = bateu a meta · vermelho = abaixo" },
      (s) => [{ ...resumo, _largo: true }, tabela(s)], blocosDir));
  } catch (e) {
    console.error("farol-matinal/ap:", e);
    return res.status(500).json({ error: "Erro ao montar o Atendimento Produtivo." });
  }
});

// ─── 2) TASKS (1 SKU, abertas) ─────────────────────────────────────────────────
const RE_LN = /long\s*necks?|\+\s*ln\b|\bln\b/;
const RE_LN_ZERO = /\bzero\b|\bcero\b|\b0[.,]0\b/;
const RE_LN_HE = /\bhe\b|high\s*end|\+\s*ln\b|corona|stella|spaten|michelob|beck'?s|leffe|hoegaarden|patagonia|colorado|goose/;
// Categorias do SPO Q4 (mesmas regras do processador — proc_spo_tasks.py)
function categoriasDaTask(x) {
  const clu = semAcento(x.cluster_primario), cat = semAcento(x.categoria), desc = semAcento(x.descricao);
  const semCat = ["", "nan", "none"].includes(cat), port = clu === "desenvolvimento de portfolio";
  const out = [];
  if (port && cat === "beer") out.push("cerveja");
  if (port && cat === "nab") out.push("nab");
  if (clu === "marketplace") out.push("mktp");
  if (port && (cat === "match" || (semCat && /\bmatch\b/.test(desc)))) out.push("match");
  if ((clu.includes("portfolio") || clu.includes("volume")) && RE_LN.test(desc) && (RE_LN_ZERO.test(desc) || RE_LN_HE.test(desc))) out.push("ln");
  return out;
}
const CATS_T = [["cerveja", "Cerveja (KPI 10)"], ["nab", "NAB (KPI 12)"], ["mktp", "Marketplace (KPI 14)"], ["match", "Match (KPI 15)"], ["ln", "Long Neck (KPI 16)"]];

router.get("/tasks", async (req, res) => {
  try {
    const t = agora();
    const [tasks, base, d] = await Promise.all([readSheet("tasks").catch(() => []), readSheet("pdv_base").catch(() => []), destinos()]);
    const nomePdv = {};
    base.forEach((p) => { nomePdv[normCod(p.cod_pdv)] = String(p.nome_fantasia || p.razao_social || "").trim(); });
    // abertas = não validadas · 1 SKU = QTD Solicitada 1 · mês = data da visita no mês atual
    const ab = [];
    tasks.forEach((x) => {
      if (String(x.status || "").toUpperCase() === "VALID") return;
      if (num(x.qtd_solicitada) !== 1) return;
      const dv = String(x.data_visita || "").slice(0, 10);
      if (dv.slice(0, 7) !== t.mes) return;
      const s = String(x.setor || "").trim(); if (!SET_RN.includes(s)) return;
      const cats = categoriasDaTask(x); if (!cats.length) return;
      ab.push({ setor: s, cod: normCod(x.cod_pdv), desc: String(x.descricao || "").trim(), dv, cats });
    });
    const cont = {};
    SET_RN.forEach((s) => { cont[s] = { cerveja: 0, nab: 0, mktp: 0, match: 0, ln: 0 }; });
    ab.forEach((a) => a.cats.forEach((c) => { cont[a.setor][c]++; }));
    const tot = { cerveja: 0, nab: 0, mktp: 0, match: 0, ln: 0 };
    const colunas = [{ key: "setor", label: "Setor" }, { key: "rn", label: "RN" }, ...CATS_T.map(([k, l]) => ({ key: k, label: l })), { key: "total", label: "Total" }];
    const linhaDe = (s) => { const c = cont[s]; const total = CATS_T.reduce((a, [k]) => a + c[k], 0); return { setor: s, rn: primeiro(d.nome[s]), ...c, total }; };
    const linhas = SET_RN.map(linhaDe).filter((l) => l.total > 0 || d.tel[l.setor]);
    linhas.forEach((l) => CATS_T.forEach(([k]) => { tot[k] += l[k]; }));
    const totLinha = { setor: "", rn: "Total", ...tot, total: CATS_T.reduce((a, [k]) => a + tot[k], 0), _destaque: true };
    const sub = "Tasks de 1 SKU (QTD solicitada = 1) ainda não validadas no mês · tasks de volume fora (saíram do SPO)";
    const blocosDir = [{ titulo: "Tasks abertas por RN", subtitulo: sub, colunas, linhas: [...linhas, totLinha] }];

    const blocosRn = (s) => {
      const doDia = ab.filter((a) => a.setor === s && a.dv === t.hojeISO);
      const blocos = [{ titulo: `Tasks abertas · Setor ${s}`, subtitulo: sub, colunas: colunas.filter((c) => c.key !== "rn"), linhas: [linhaDe(s)] }];
      CATS_T.forEach(([k, l]) => {
        const ls = doDia.filter((a) => a.cats.includes(k));
        if (!ls.length) return;
        blocos.push({ titulo: `${l} · tasks de 1 SKU de hoje`, subtitulo: `${ls.length} task(s) nos PDVs com visita hoje`,
          colunas: [{ key: "cod_pdv", label: "Cód" }, { key: "nome_pdv", label: "PDV" }, { key: "nome_produto", label: "Task" }],
          linhas: ls.map((a) => ({ cod_pdv: a.cod, nome_pdv: nomePdv[a.cod] || "", nome_produto: a.desc })) });
      });
      if (blocos.length === 1) blocos.push({ titulo: "Tasks de 1 SKU de hoje", subtitulo: "Nenhuma task aberta de 1 SKU com visita hoje", colunas: [{ key: "cod_pdv", label: "Cód" }], linhas: [] });
      return blocos;
    };
    return res.json(resposta(t, d, { titulo: "Tasks do SPO", emoji: "📝", legenda: "abertas = não validadas · 1 SKU" }, blocosRn, blocosDir));
  } catch (e) {
    console.error("farol-matinal/tasks:", e);
    return res.status(500).json({ error: "Erro ao montar as tasks." });
  }
});

// ─── 3) SCORE 5 (KPI 11) ───────────────────────────────────────────────────────
// Últimos 3 meses de compras por PDV×produto → top 3 por HL e dias desde a última compra.
async function topProdutos(t) {
  const meses = [2, 1, 0].map((k) => { const x = new Date(t.br.getFullYear(), t.br.getMonth() - k, 1); return `${x.getFullYear()}-${p2(x.getMonth() + 1)}`; });
  const vendas = await readSheetMonths("vendas_cliente_produto", "mes_referencia", meses).catch(() => []);
  const por = {};
  vendas.forEach((v) => {
    const c = normCod(v.cod_pdv), p = String(v.cod_produto || "").trim();
    const m = (por[c] = por[c] || {});
    const e = (m[p] = m[p] || { nome: String(v.nome_produto || "").trim(), hl: 0, ult: null });
    e.hl += num(v.volume_hl);
    // data da última compra (coluna nova); mês antigo sem ela → último dia daquele mês
    let dt = null;
    const u = String(v.ultima_compra || "").trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(u)) dt = new Date(+u.slice(6), +u.slice(3, 5) - 1, +u.slice(0, 2));
    else if (v.mes_referencia) { const [a, mm] = String(v.mes_referencia).split("-").map(Number); dt = new Date(a, mm, 0); }
    if (dt && (!e.ult || dt > e.ult)) e.ult = dt;
  });
  return (cod) => Object.values(por[cod] || {}).sort((a, b) => b.hl - a.hl).slice(0, 3).map((e) => {
    const dias = e.ult ? Math.max(0, Math.round((t.br - e.ult) / 86400000)) : null;
    return `${e.nome} (${dias == null ? "?" : dias + "d"})`;
  }).join(" · ");
}

router.get("/score5", async (req, res) => {
  try {
    const t = agora();
    const [det, base, d] = await Promise.all([readSheet("spo_score5_detalhe").catch(() => []), readSheet("pdv_base").catch(() => []), destinos()]);
    const top = await topProdutos(t);
    const diaDe = {};
    base.forEach((p) => { diaDe[normCod(p.cod_pdv)] = String(p.dia_visita || "").trim().toUpperCase().slice(0, 3); });
    const mes = ultimoMes(det);
    const hoje = det.filter((r) => String(r.mes_referencia || "").slice(0, 7) === mes && diaDe[normCod(r.cod_pdv)] === t.diaCod)
      .map((r) => {
        const meta = num(r.meta_task), real = num(r.real_task), bateu = String(r.bateu || "").toLowerCase().startsWith("s");
        return { setor: String(r.setor).trim(), cod_pdv: normCod(r.cod_pdv), nome_pdv: String(r.nome_pdv || "").trim(),
          meta: rs(meta), fat: rs(real), rest: bateu ? "✅ bateu" : rs(Math.max(0, meta - real)),
          nome_produto: top(normCod(r.cod_pdv)) || "—", _cores: { rest: bateu ? "up" : "down" } };
      });
    const colunas = (comSetor) => [...(comSetor ? [{ key: "setor", label: "Setor" }] : []), { key: "cod_pdv", label: "Cód" }, { key: "nome_pdv", label: "PDV" },
      { key: "meta", label: "Meta task" }, { key: "fat", label: "Faturado" }, { key: "rest", label: "Restante" }, { key: "nome_produto", label: "Mais compra (dias sem comprar)" }];
    const sub = "PDVs Score 5 com task de faturamento e visita hoje · top 3 SKUs dos últimos 3 meses";
    const blocosRn = (s) => [{ titulo: `Score 5 (KPI 11) · visitas de hoje · Setor ${s}`, subtitulo: sub, colunas: colunas(false), linhas: hoje.filter((h) => h.setor === s) }];
    const blocosDir = [{ titulo: "Score 5 (KPI 11) · visitas de hoje", subtitulo: sub, colunas: colunas(true), linhas: hoje.sort((a, b) => a.setor.localeCompare(b.setor)) }];
    return res.json(resposta(t, d, { titulo: "Score 5", emoji: "⭐", legenda: "restante = meta − faturado" }, blocosRn, blocosDir));
  } catch (e) {
    console.error("farol-matinal/score5:", e);
    return res.status(500).json({ error: "Erro ao montar o Score 5." });
  }
});

// ─── 4) PORTFÓLIO IDEAL HIGH END (KPI 18) ──────────────────────────────────────
// SKUs (colunas de real) da base High End por categoria — iguais ao relatório ON_TRADE.
const PI_HE = [
  ["600", ["SPT 600", "STL 600", "STL PG 600", "BUD 600", "COR 600", "ORI 600", "OUTROS 600"]],
  ["LN", ["BUD LN", "COR LN", "STL LN", "STL PG LN", "SPT LN", "MIC LN", "OUTROS LN"]],
  ["LN ZERO", ["BUD LN ZERO", "COR LN ZERO"]],
];
router.get("/pi-he", async (req, res) => {
  try {
    const t = agora();
    const [det, base, d] = await Promise.all([readSheet("spo_portfolio_ideal_detalhe").catch(() => []), readSheet("pdv_base").catch(() => []), destinos()]);
    const diaDe = {};
    base.forEach((p) => { diaDe[normCod(p.cod_pdv)] = String(p.dia_visita || "").trim().toUpperCase().slice(0, 3); });
    const mes = ultimoMes(det);
    const he = det.filter((r) => String(r.mes_referencia || "").slice(0, 7) === mes && /HIGH END/i.test(String(r.base || ""))
      && (String(r.dia_visita || "").toUpperCase().slice(0, 3) || diaDe[normCod(r.cod_pdv)]) === t.diaCod);
    const temSkus = he.some((r) => String(r.skus_comprados || r.categorias_meta || "").trim());
    const colunas = (comSetor) => {
      const c = [...(comSetor ? [{ key: "setor", label: "Setor" }] : []), { key: "cod_pdv", label: "Cód" }, { key: "nome_pdv", label: "PDV" }, { key: "pi", label: "PI" }];
      if (temSkus) PI_HE.forEach(([cat, skus]) => skus.forEach((s) => c.push({ key: `k_${s}`, label: s.replace(" ZERO", " 0") })));
      c.push({ key: "falta", label: "Falta" });
      return c;
    };
    const linhas = he.map((r) => {
      const metas = new Set(String(r.categorias_meta || "").split("|").filter(Boolean));
      const comp = new Set(String(r.skus_comprados || "").split("|").filter(Boolean));
      const l = { setor: String(r.setor).trim(), cod_pdv: normCod(r.cod_pdv), nome_pdv: String(r.nome_pdv || "").trim(),
        pi: String(r.portfolio_ideal || "").toUpperCase() === "SIM" ? "✅" : "❌", falta: String(r.itens_faltantes || "—"), _cores: {} };
      l._cores.pi = l.pi === "✅" ? "up" : "down";
      PI_HE.forEach(([cat, skus]) => skus.forEach((s) => {
        const k = `k_${s}`;
        if (comp.has(s)) { l[k] = "✓"; l._cores[k] = "up"; }
        else { l[k] = metas.has(cat) ? "✗" : "·"; if (metas.has(cat)) l._cores[k] = "down"; }
      }));
      return l;
    }).sort((a, b) => a.setor.localeCompare(b.setor) || a.nome_pdv.localeCompare(b.nome_pdv));
    const sub = "Base High End com visita hoje · ✓ já comprou · ✗ categoria da meta sem compra · · fora da meta";
    const blocosRn = (s) => [{ titulo: `Portfólio Ideal Score 5 (KPI 18) · High End · Setor ${s}`, subtitulo: sub, colunas: colunas(false), linhas: linhas.filter((l) => l.setor === s), _largo: true }];
    const blocosDir = [{ titulo: "Portfólio Ideal Score 5 (KPI 18) · High End · visitas de hoje", subtitulo: sub, colunas: colunas(true), linhas, _largo: true }];
    return res.json(resposta(t, d, { titulo: "Portfólio Ideal HE", emoji: "🍾", legenda: "✓ comprou · ✗ falta" }, blocosRn, blocosDir));
  } catch (e) {
    console.error("farol-matinal/pi-he:", e);
    return res.status(500).json({ error: "Erro ao montar o Portfólio Ideal." });
  }
});

// ─── 5) FATURADOS + BUFFER (PDF separado) ──────────────────────────────────────
router.get("/fatbuf", async (req, res) => {
  try {
    const t = agora();
    const [fat, buf, d] = await Promise.all([readSheet("faturados_detalhe").catch(() => []), readSheet("buffer_detalhe").catch(() => []), destinos()]);
    const porPdv = (rows) => {
      const m = {};
      rows.forEach((r) => {
        const s = String(r.setor || "").trim(), c = normCod(r.cod_pdv); if (!c) return;
        const e = (m[`${s}|${c}`] = m[`${s}|${c}`] || { setor: s, cod_pdv: c, nome_pdv: String(r.nome_pdv || "").trim(), ped: new Set(), hl: 0 });
        e.ped.add(String(r.num_pedido || "")); e.hl += num(r.volume_marcacao);
      });
      return Object.values(m).sort((a, b) => b.hl - a.hl);
    };
    const F = porPdv(fat), B = porPdv(buf);
    const somaHl = (l) => l.reduce((a, x) => a + x.hl, 0), somaPed = (l) => l.reduce((a, x) => a + x.ped.size, 0);
    const resumoDe = (f, b) => {
      const hf = somaHl(f), hb = somaHl(b), conv = hf + hb > 0 ? Math.round((hf / (hf + hb)) * 100) : null;
      return { titulo: "Faturados × Buffer · resumo", subtitulo: "Faturados = NFs do último dia de emissão · Buffer = aguardando roteirização",
        colunas: [{ key: "rn", label: "Indicador" }, { key: "fat", label: "Faturados" }, { key: "buf", label: "Buffer" }],
        linhas: [{ rn: "Volume (HL)", fat: f1(hf), buf: f1(hb), _cores: { buf: hb ? "down" : "up" } },
          { rn: "Pedidos", fat: somaPed(f), buf: somaPed(b) }, { rn: "PDVs", fat: f.length, buf: b.length },
          { rn: "% faturado (HL)", fat: conv == null ? "—" : `${conv}%`, buf: "" }] };
    };
    const colPdv = (comSetor) => [...(comSetor ? [{ key: "setor", label: "Setor" }] : []), { key: "cod_pdv", label: "Cód" }, { key: "nome_pdv", label: "PDV" }, { key: "ped", label: "Pedidos" }, { key: "hl", label: "HL" }];
    const linhaPdv = (x) => ({ setor: x.setor, cod_pdv: x.cod_pdv, nome_pdv: x.nome_pdv, ped: x.ped.size, hl: f1(x.hl) });
    const porRn = SET_RN.map((s) => { const f = F.filter((x) => x.setor === s), b = B.filter((x) => x.setor === s);
      return { setor: s, rn: primeiro(d.nome[s]), fat: f1(somaHl(f)), buf: f1(somaHl(b)), pdv_buf: b.length, _hb: somaHl(b), _cores: { buf: somaHl(b) ? "down" : "up" } }; })
      .filter((l) => l.fat !== "0" || l._hb).sort((a, b) => b._hb - a._hb);
    const blocosDir = [resumoDe(F, B),
      { titulo: "Por RN", subtitulo: "HL faturado × HL em buffer", colunas: [{ key: "setor", label: "Setor" }, { key: "rn", label: "RN" }, { key: "fat", label: "Faturado (HL)" }, { key: "buf", label: "Buffer (HL)" }, { key: "pdv_buf", label: "PDVs no buffer" }], linhas: porRn },
      { titulo: "Buffer · PDVs", subtitulo: `${B.length} PDV(s) aguardando roteirização`, colunas: colPdv(true), linhas: B.map(linhaPdv) }];
    const blocosRn = (s) => {
      const f = F.filter((x) => x.setor === s), b = B.filter((x) => x.setor === s);
      return [resumoDe(f, b),
        { titulo: `Buffer · PDVs · Setor ${s}`, subtitulo: `${b.length} PDV(s) aguardando roteirização`, colunas: colPdv(false), linhas: b.map(linhaPdv) },
        { titulo: `Faturados · PDVs · Setor ${s}`, subtitulo: `${f.length} PDV(s) faturados`, colunas: colPdv(false), linhas: f.map(linhaPdv) }];
    };
    return res.json(resposta(t, d, { titulo: "Faturados + Buffer", emoji: "🚚", legenda: "buffer = pedido parado aguardando roteirização" }, blocosRn, blocosDir));
  } catch (e) {
    console.error("farol-matinal/fatbuf:", e);
    return res.status(500).json({ error: "Erro ao montar Faturados + Buffer." });
  }
});

module.exports = router;
