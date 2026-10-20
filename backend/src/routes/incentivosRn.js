// Aba "Incentivos" (menu) — incentivos dos RNs, com meta por mês × setor × KPI.
//  • LIGA CMD (trimestral out→dez/2026): 4 KPIs, TUDO OU NADA por KPI (bateu = pontos cheios),
//    elegível com ≥ 80 pts; pódio por pontos e, no empate, pelo % médio de atingimento.
//    Tri = acumulado: volume soma os meses; distribuição/cobertura = média dos meses (meta e real).
//  • BATEU, LEVOU — Zeros (mensal): cada meta batida = R$ 150. Segmentado (AS) por volume,
//    Rota por cobertura (as metas lançadas definem quem é avaliado em quê).
// Todos veem todos os RNs (competição); a tela destaca o setor de quem está logado.
// Realizado: vendas_cliente_produto (mês) × produtos_base (categorias). Mesma lógica do
// Relatório aberto: distribuição = Σ, por PDV, dos SKUs DISTINTOS da categoria; cobertura = PDVs.
const express = require("express");
const router = express.Router();
const { readSheet, readSheetMonths } = require("../services/sheets");
const { authMiddleware } = require("../middleware/auth");
const { query } = require("../services/db");

router.use(authMiddleware);

const RGB = ["GIRO RGB", "LITRINHO", "TRIMARCA RGB HE (ORIGINAL)", "TRIMARCA RGB HE (STELLA)", "TRIMARCA RGB HE (SPATEN)"];
const PG600 = ["33857", "38172"]; // Stella Pure Gold 600 retornável + one way

// kpi: { key, label, pts?, fonte: { cats|skus, ind: "dist"|"cob"|"vol" } }
const INCENTIVOS = {
  liga: {
    id: "liga", titulo: "LIGA CMD", subtitulo: "Incentivo trimestral · out → dez/2026", meses: ["2026-10", "2026-11", "2026-12"],
    minPts: 80,
    premios: ["Smart TV", "Caixa de Som Bluetooth", "Air Fryer", "R$ 150,00", "R$ 100,00"],
    kpis: [
      { key: "dist_rgb",  label: "Distribuição de RGB",        pts: 30, unidade: "SKU/PDV", cats: RGB,   ind: "dist" },
      { key: "cob_pg",    label: "Cobertura Stella Pure Gold", pts: 30, unidade: "PDVs",    skus: PG600, ind: "cob" },
      { key: "vol_rgb",   label: "Volume de RGB",              pts: 20, unidade: "HL",      cats: RGB,   ind: "vol" },
      { key: "dist_mktp", label: "Distribuição de Marketplace", pts: 20, unidade: "SKU/PDV", cats: ["MKTP"], ind: "dist" },
    ],
  },
  zeros: {
    id: "zeros", titulo: "BATEU, LEVOU · ZEROS", subtitulo: "Incentivo mensal · R$ 150 por meta batida", meses: ["2026-10", "2026-11", "2026-12"],
    valorMeta: 150,
    kpis: [
      { key: "nabz_vol",  label: "NAB Zero · volume",        unidade: "HL",   cats: ["NAB ZERO"],     ind: "vol" },
      { key: "cervz_vol", label: "Cerveja Zero · volume",    unidade: "HL",   cats: ["CERVEJA ZERO"], ind: "vol" },
      { key: "nabz_cob",  label: "NAB Zero · cobertura",     unidade: "PDVs", cats: ["NAB ZERO"],     ind: "cob" },
      { key: "cervz_cob", label: "Cerveja Zero · cobertura", unidade: "PDVs", cats: ["CERVEJA ZERO"], ind: "cob" },
    ],
  },
};

// Metas de out/2026 dos prints do Eduardo (19/10) — gravadas na 1ª vez que a tabela é criada.
const SEED = {
  "zeros|2026-10": {
    nabz_vol: { 101: 120, 103: 150 },
    cervz_vol: { 101: 28, 103: 39 },
    cervz_cob: { 104: 53, 105: 40, 106: 31, 107: 30, 108: 37, 109: 42, 110: 30, 111: 41 },
    nabz_cob: { 104: 104, 105: 85, 106: 82, 107: 74, 108: 72, 109: 47, 110: 79, 111: 100 },
  },
  "liga|2026-10": {
    dist_mktp: { 101: 302, 103: 490, 104: 413, 105: 357, 106: 262, 107: 232, 108: 273, 109: 236, 110: 298, 111: 284 },
  },
};

const num = (v) => parseFloat(String(v ?? "0").replace(",", ".")) || 0;
const normCod = (v) => String(v ?? "").trim().replace(/\.0$/, "").replace(/^0+/, "");
const LIXO = new Set(["NAN", "NONE", "NULL", "NAT"]);
const catsDe = (p) => String(p.categorias || p.categoria || "").toUpperCase().split(/\s*[|,;]\s*/).map((c) => c.trim()).filter((c) => c && !LIXO.has(c));
const NOVO_DE = { "301": "107", "302": "108", "303": "109", "304": "110", "305": "111" };
const setorHop = (s) => { const x = String(s || "").trim(); return NOVO_DE[x] || x; };

let _ok = false;
async function ensure() {
  if (_ok) return;
  await query(`CREATE TABLE IF NOT EXISTS incentivos_metas (
    incentivo TEXT, mes TEXT, setor TEXT, kpi TEXT, meta NUMERIC, PRIMARY KEY (incentivo, mes, setor, kpi))`);
  for (const [k, kpis] of Object.entries(SEED)) {
    const [inc, mes] = k.split("|");
    const ja = await query("SELECT 1 FROM incentivos_metas WHERE incentivo = $1 AND mes = $2 LIMIT 1", [inc, mes]);
    if (ja.rows.length) continue;
    for (const [kpi, porSetor] of Object.entries(kpis)) {
      for (const [setor, meta] of Object.entries(porSetor)) {
        await query("INSERT INTO incentivos_metas (incentivo, mes, setor, kpi, meta) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
          [inc, mes, String(setor), kpi, meta]);
      }
    }
  }
  _ok = true;
}

// Fator de tendência (dias úteis seg–sex) do mês: mês corrente projeta, mês fechado = 1.
function fatorMes(mes) {
  const br = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const atual = `${br.getFullYear()}-${String(br.getMonth() + 1).padStart(2, "0")}`;
  if (mes !== atual) return { fator: mes < atual ? 1 : 0, feitos: null, total: null, aberto: mes === atual };
  const yy = br.getFullYear(), mm = br.getMonth();
  const uteis = (ate) => { let c = 0; const d = new Date(yy, mm, 1); while (d.getMonth() === mm && d.getDate() <= ate) { const w = d.getDay(); if (w >= 1 && w <= 5) c++; d.setDate(d.getDate() + 1); } return c; };
  const feitos = Math.max(1, uteis(br.getDate())), total = uteis(31);
  return { fator: total / feitos, feitos, total, aberto: true };
}

// Realizado por mês × setor × KPI: { mes: { setor: { kpi: valor } } }
async function realizados(inc, meses) {
  const [base, vendas] = await Promise.all([
    readSheet("produtos_base").catch(() => []),
    readSheetMonths("vendas_cliente_produto", "mes_referencia", meses).catch(() => []),
  ]);
  const skusKpi = {};
  inc.kpis.forEach((k) => {
    skusKpi[k.key] = k.skus ? new Set(k.skus)
      : new Set(base.filter((p) => catsDe(p).some((c) => k.cats.includes(c))).map((p) => normCod(p.cod)));
  });
  const agg = {}; // mes → setor → kpi → { pdvs:Set, hl, sk:Map }
  for (const v of vendas) {
    const mes = String(v.mes_referencia || "").slice(0, 7);
    if (!meses.includes(mes)) continue;
    const hl = num(v.volume_hl); if (hl <= 0) continue;
    const sku = normCod(v.cod_produto), setor = setorHop(v.setor), pdv = normCod(v.cod_pdv);
    if (!setor) continue;
    for (const k of inc.kpis) {
      if (!skusKpi[k.key].has(sku)) continue;
      const c = (((agg[mes] = agg[mes] || {})[setor] = agg[mes][setor] || {})[k.key] =
        agg[mes][setor][k.key] || { pdvs: new Set(), hl: 0, sk: new Map() });
      c.pdvs.add(pdv); c.hl += hl;
      if (!c.sk.has(pdv)) c.sk.set(pdv, new Set());
      c.sk.get(pdv).add(sku);
    }
  }
  const out = {};
  for (const mes of meses) {
    out[mes] = {};
    Object.entries(agg[mes] || {}).forEach(([setor, ks]) => {
      out[mes][setor] = {};
      inc.kpis.forEach((k) => {
        const c = ks[k.key];
        let v = 0;
        if (c) {
          if (k.ind === "cob") v = c.pdvs.size;
          else if (k.ind === "vol") v = Math.round(c.hl * 100) / 100;
          else c.sk.forEach((s) => { v += s.size; });
        }
        out[mes][setor][k.key] = v;
      });
    });
  }
  return out;
}

async function metasDe(incId, meses) {
  await ensure();
  const r = await query("SELECT mes, setor, kpi, meta FROM incentivos_metas WHERE incentivo = $1 AND mes = ANY($2)", [incId, meses]);
  const out = {};
  r.rows.forEach((x) => { if (x.meta != null) ((out[x.mes] = out[x.mes] || {})[x.setor] = out[x.mes][x.setor] || {})[x.kpi] = Number(x.meta); });
  return out;
}

// GET /api/incentivos-rn → lista de incentivos (cards da aba)
router.get("/", (req, res) => res.json(Object.values(INCENTIVOS).map(({ id, titulo, subtitulo, meses }) => ({ id, titulo, subtitulo, meses }))));

// Monta o incentivo (tela e farol do motor). mesQ = "2026-10" | "tri" | "" (= mês atual).
async function montar(inc, mesQ, user) {
    const tri = String(mesQ || "") === "tri";
    const br = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const atual = `${br.getFullYear()}-${String(br.getMonth() + 1).padStart(2, "0")}`;
    const mesSel = tri ? null : (inc.meses.includes(String(mesQ)) ? String(mesQ) : (inc.meses.includes(atual) ? atual : inc.meses[0]));
    const mesesCalc = tri ? inc.meses.filter((m) => m <= atual) : [mesSel];

    const [metas, reais, usuarios] = await Promise.all([
      metasDe(inc.id, inc.meses), realizados(inc, mesesCalc), readSheet("usuarios").catch(() => []),
    ]);
    const nomeDe = {};
    usuarios.forEach((u) => { const c = String(u.cod || "").trim(); if (c) nomeDe[c] = String(u.nome || "").trim(); });

    // Setores = quem tem meta em algum mês do incentivo (ordem numérica)
    const setores = [...new Set(Object.values(metas).flatMap((o) => Object.keys(o)))]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const linhas = setores.map((setor) => {
      const kpis = inc.kpis.map((k) => {
        // meses com meta lançada p/ este setor/KPI (no tri: só os já iniciados)
        const ms = mesesCalc.filter((m) => metas[m]?.[setor]?.[k.key] != null);
        if (!ms.length) return { key: k.key, meta: null, real: null, tend: null };
        const media = k.ind !== "vol" && tri; // tri: dist/cob = média dos meses; vol = soma
        let meta = 0, real = 0, tend = 0;
        ms.forEach((m) => {
          const f = fatorMes(m).fator || 1;
          const r = reais[m]?.[setor]?.[k.key] || 0;
          meta += metas[m][setor][k.key]; real += r; tend += r * f;
        });
        if (media) { meta /= ms.length; real /= ms.length; tend /= ms.length; }
        const r2 = (x) => Math.round(x * 100) / 100;
        const ating = meta > 0 ? real / meta : null, atingT = meta > 0 ? tend / meta : null;
        return {
          key: k.key, meta: r2(meta), real: r2(real), tend: r2(tend),
          ating: ating == null ? null : Math.round(ating * 1000) / 10,
          atingTend: atingT == null ? null : Math.round(atingT * 1000) / 10,
          bateu: ating != null && ating >= 1, bateTend: atingT != null && atingT >= 1,
        };
      });
      const comMeta = kpis.filter((k) => k.meta != null && k.meta > 0);
      const linha = { setor, nome: nomeDe[setor] || "", kpis };
      if (inc.id === "liga") {
        const pts = (campo) => inc.kpis.reduce((s, k, i) => s + (kpis[i][campo] ? k.pts : 0), 0);
        linha.pontos = pts("bateu"); linha.pontosTend = pts("bateTend");
        const med = (campo) => (comMeta.length ? Math.round(comMeta.reduce((s, k) => s + (k[campo] || 0), 0) / comMeta.length * 10) / 10 : 0);
        linha.atingMedio = med("ating"); linha.atingMedioTend = med("atingTend");
        linha.elegivel = linha.pontos >= inc.minPts; linha.elegivelTend = linha.pontosTend >= inc.minPts;
      } else {
        linha.metasBatidas = kpis.filter((k) => k.bateu).length;
        linha.metasBatidasTend = kpis.filter((k) => k.bateTend).length;
        linha.valor = linha.metasBatidas * inc.valorMeta; linha.valorTend = linha.metasBatidasTend * inc.valorMeta;
        linha.avaliado = comMeta.map((k) => k.key);
      }
      return linha;
    });

    if (inc.id === "liga") {
      // Pódio: pontos → % médio de atingimento (desempate). Só elegíveis (≥ minPts) levam prêmio.
      const ordenar = (pt, at) => [...linhas].sort((a, b) => b[pt] - a[pt] || b[at] - a[at]);
      ordenar("pontos", "atingMedio").forEach((l, i) => { l.posicao = i + 1; });
      ordenar("pontosTend", "atingMedioTend").forEach((l, i) => { l.posicaoTend = i + 1; });
      const premiar = (campoPos, campoEleg, campoPremio) => {
        let p = 0;
        [...linhas].sort((a, b) => a[campoPos] - b[campoPos]).forEach((l) => {
          l[campoPremio] = l[campoEleg] && p < inc.premios.length ? inc.premios[p++] : null;
        });
      };
      premiar("posicao", "elegivel", "premio"); premiar("posicaoTend", "elegivelTend", "premioTend");
      linhas.sort((a, b) => a.posicaoTend - b.posicaoTend);
    }

    // TOTAL DA OPERAÇÃO: soma meta / real / tendência dos setores com meta em cada KPI
    const r2 = (x) => Math.round(x * 100) / 100;
    const total = {
      kpis: inc.kpis.map((k, i) => {
        const cm = linhas.map((l) => l.kpis[i]).filter((x) => x.meta != null);
        if (!cm.length) return { key: k.key, meta: null, real: null, tend: null };
        const meta = cm.reduce((s, x) => s + x.meta, 0), real = cm.reduce((s, x) => s + x.real, 0), tend = cm.reduce((s, x) => s + x.tend, 0);
        const ating = meta > 0 ? real / meta : null, atingT = meta > 0 ? tend / meta : null;
        return { key: k.key, meta: r2(meta), real: r2(real), tend: r2(tend),
          ating: ating == null ? null : Math.round(ating * 1000) / 10, atingTend: atingT == null ? null : Math.round(atingT * 1000) / 10,
          bateu: ating != null && ating >= 1, bateTend: atingT != null && atingT >= 1 };
      }),
      valor: linhas.reduce((s, l) => s + (l.valor || 0), 0), valorTend: linhas.reduce((s, l) => s + (l.valorTend || 0), 0),
      pontos: null,
    };

    const f = mesSel ? fatorMes(mesSel) : null;
    return {
      incentivo: { id: inc.id, titulo: inc.titulo, subtitulo: inc.subtitulo, meses: inc.meses, minPts: inc.minPts, premios: inc.premios, valorMeta: inc.valorMeta,
        kpis: inc.kpis.map(({ key, label, pts, unidade, ind }) => ({ key, label, pts, unidade, ind })) },
      mes: mesSel || "tri", mesesCalc, diasUteis: f && f.aberto ? { feitos: f.feitos, total: f.total } : null,
      meuSetor: String(user.cod || ""),
      metas, linhas, total,
    };
}

// GET /api/incentivos-rn/:id/farol — tabela pronta p/ o motor de WhatsApp (vira FOTO, enviada
// à parte, como o Deck). TEMPORÁRIO. `ativo` = hoje é dia de envio (DIAS_ENVIO: 1=seg 3=qua 5=sex).
// Cabeçalho em 2 linhas: `grupos` (KPI com span 3) e `colunas` (Meta · Real · %).
// Só o GARANTIDO (real de hoje ÷ meta) — sem tendência. Célula: { v, cls: "ok" (bateu) | "nao" | "" }.
const DIAS_ENVIO = { zeros: [1, 3, 5], liga: [1, 3, 5] };
const DIA_LABEL = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
router.get("/:id/farol", async (req, res) => {
  try {
    const inc = INCENTIVOS[req.params.id];
    if (!inc) return res.status(404).json({ error: "Incentivo não encontrado." });
    const br = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const p2 = (n) => String(n).padStart(2, "0");
    const ativo = (DIAS_ENVIO[inc.id] || []).includes(br.getDay()) || req.query.forcar === "1";
    const d = await montar(inc, "", req.user);
    const f1 = (v) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 }));
    const liga = inc.id === "liga";
    const finais = liga ? ["Pontos", "Prêmio"] : ["Garantido"];
    const grupos = [{ v: "Setor · RN", span: 1, rows: 2 }, ...inc.kpis.map((k) => ({ v: `${k.label} (${k.unidade})`, span: 3 })),
      ...finais.map((v) => ({ v, span: 1, rows: 2 }))];
    const colunas = inc.kpis.flatMap(() => ["Meta", "Real", "%"]);
    const ordem = liga ? [...d.linhas].sort((a, b) => a.posicao - b.posicao) : d.linhas;
    const linhas = ordem.map((l) => [
      { v: `${l.setor}${l.nome ? ` · ${String(l.nome).trim().split(" ").filter(Boolean)[0]}` : ""}`, cls: "lbl" }, // setor + 1º nome do RN
      ...l.kpis.flatMap((k) => (k.meta == null ? [{ v: "—", cls: "" }, { v: "—", cls: "" }, { v: "—", cls: "" }] : [
        { v: f1(k.meta), cls: "meta" }, { v: f1(k.real), cls: "" }, { v: `${f1(k.ating)}%`, cls: k.bateu ? "ok" : "nao" },
      ])),
      ...(liga
        ? [{ v: String(l.pontos), cls: l.elegivel ? "ok" : "" }, { v: l.premio || "—", cls: l.premio ? "ok" : "" }]
        : [{ v: `R$ ${f1(l.valor)}`, cls: l.valor ? "ok" : "" }]),
    ]);
    // linha final: TOTAL DA OPERAÇÃO
    linhas.push([
      { v: "Total operação", cls: "lbl tot" },
      ...d.total.kpis.flatMap((k) => (k.meta == null ? [{ v: "—", cls: "tot" }, { v: "—", cls: "tot" }, { v: "—", cls: "tot" }] : [
        { v: f1(k.meta), cls: "tot" }, { v: f1(k.real), cls: "tot" }, { v: `${f1(k.ating)}%`, cls: `tot ${k.bateu ? "ok" : "nao"}` },
      ])),
      ...(liga ? [{ v: "", cls: "tot" }, { v: "", cls: "tot" }] : [{ v: `R$ ${f1(d.total.valor)}`, cls: "tot" }]),
    ]);
    const tot = inc.id === "zeros" ? d.linhas.reduce((s, l) => s + l.valor, 0) : null;
    // Destinatários (envio só-incentivo do motor): todos com telefone — mesma regra do Report Volumes
    const perfisEnvio = new Set(["director", "gv1", "gv3", "rn"]);
    const vistos = new Set(), destinatarios = [];
    (await readSheet("usuarios").catch(() => [])).forEach((u) => {
      const tel = String(u.telefone || "").replace(/\D/g, "");
      if (!tel || !perfisEnvio.has(String(u.perfil || "").toLowerCase()) || vistos.has(tel)) return;
      vistos.add(tel);
      destinatarios.push({ nome: String(u.nome || "").trim() || "HOP", telefone: String(u.telefone).trim() });
    });
    return res.json({
      destinatarios,
      id: inc.id, emoji: inc.id === "liga" ? "🏆" : "💰", ativo, titulo: inc.titulo, subtitulo: inc.subtitulo,
      data: `${p2(br.getDate())}/${p2(br.getMonth() + 1)}/${br.getFullYear()}`, dia: DIA_LABEL[br.getDay()],
      mes: d.mes, diasUteis: d.diasUteis, grupos, colunas, linhas,
      rodape: inc.id === "zeros"
        ? `R$ ${f1(inc.valorMeta)} por meta batida · % = realizado até hoje ÷ meta · total garantido: R$ ${f1(tot)}`
        : `Tudo ou nada por KPI · elegível com ${inc.minPts} pts · % = realizado até hoje ÷ meta`,
    });
  } catch (e) {
    console.error("incentivos-rn farol:", e);
    return res.status(500).json({ error: "Erro ao montar o farol do incentivo." });
  }
});

// GET /api/incentivos-rn/:id?mes=2026-10|tri
router.get("/:id", async (req, res) => {
  try {
    const inc = INCENTIVOS[req.params.id];
    if (!inc) return res.status(404).json({ error: "Incentivo não encontrado." });
    return res.json(await montar(inc, req.query.mes, req.user));
  } catch (e) {
    console.error("incentivos-rn:", e);
    return res.status(500).json({ error: "Erro ao montar o incentivo." });
  }
});

// PUT /api/incentivos-rn/:id/metas { mes, metas: { setor: { kpi: valor } } } — admin. Substitui o mês.
router.put("/:id/metas", async (req, res) => {
  try {
    if (req.user.perfil !== "admin") return res.status(403).json({ error: "Só o admin lança metas." });
    const inc = INCENTIVOS[req.params.id];
    if (!inc) return res.status(404).json({ error: "Incentivo não encontrado." });
    const { mes, metas } = req.body || {};
    if (!inc.meses.includes(String(mes))) return res.status(400).json({ error: "Mês fora do incentivo." });
    await ensure();
    const kpisOk = new Set(inc.kpis.map((k) => k.key));
    await query("DELETE FROM incentivos_metas WHERE incentivo = $1 AND mes = $2", [inc.id, mes]);
    let n = 0;
    for (const [setor, ks] of Object.entries(metas || {})) {
      for (const [kpi, v] of Object.entries(ks || {})) {
        const val = v === "" || v == null ? null : Number(String(v).replace(",", "."));
        if (!kpisOk.has(kpi) || val == null || isNaN(val)) continue;
        await query("INSERT INTO incentivos_metas (incentivo, mes, setor, kpi, meta) VALUES ($1,$2,$3,$4,$5)", [inc.id, mes, String(setor).trim(), kpi, val]);
        n++;
      }
    }
    return res.json({ ok: true, metas: n });
  } catch (e) {
    console.error("incentivos-rn PUT:", e);
    return res.status(500).json({ error: "Erro ao salvar metas." });
  }
});

module.exports = router;
