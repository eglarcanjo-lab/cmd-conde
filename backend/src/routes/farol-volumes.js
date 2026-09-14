// Farol "Volumes — Meta × Real × Tendência" (envio WhatsApp).
// Fonte: rv_resultado (meta/real por setor, por categoria: Cerveja/NAB/Match/Mktp).
// Tendência = realizado do mês projetado pelo ritmo de dias úteis (seg–sex).
//   • Diretor: 1 foto por categoria — linhas por RN + linha OPERAÇÃO (total).
//   • GV: idem, escopo da sala + linha REGIÃO.
//   • RN: 1 foto — as categorias do seu setor + linha TOTAL.
const express = require("express");
const router = express.Router();
const { readSheet } = require("../services/sheets");
const { authMiddleware } = require("../middleware/auth");
const { filtrarPorPerfil } = require("../utils/perfil");

const num = (v) => parseFloat(String(v ?? "0").replace(",", ".")) || 0;
const hl = (n) => (Math.round((Number(n) || 0) * 10) / 10).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const brl = (n) => "R$ " + (Math.round((Number(n) || 0) * 100) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Formata conforme a unidade da categoria: HL (volume) ou R$ (marketplace = faturamento).
const fmtU = (n, unit) => (unit === "R$" ? brl(n) : hl(n));
const pad = (n) => String(n).padStart(2, "0");
const ROT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const DIA_LABEL = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

// Mktp (marketplace) é FATURAMENTO em R$; as demais são VOLUME em HL.
const CATS = [
  { key: "cerveja", label: "Cerveja", real: "real_cerveja", meta: "meta_cerveja", unit: "HL" },
  { key: "nab", label: "NAB", real: "real_nab", meta: "meta_nab", unit: "HL" },
  { key: "match", label: "Match", real: "real_match", meta: "meta_match", unit: "HL" },
  { key: "mktp", label: "Mktp", real: "real_marketplace", meta: "meta_marketplace", unit: "R$" },
];

// % da meta → cor: ≥100 verde (up) · 70–99 âmbar (mid) · <70 vermelho (down).
const sinalPct = (p) => (p == null ? "flat" : p >= 100 ? "up" : p >= 70 ? "mid" : "down");

// Formata um trio meta/real/tendência (na unidade dada) com os % já coloridos.
function vol(meta, real, tend, unit = "HL") {
  const pctR = meta > 0 ? Math.round((real / meta) * 100) : null;
  const pctT = meta > 0 ? Math.round((tend / meta) * 100) : null;
  return {
    meta: fmtU(meta, unit), real: fmtU(real, unit), tend: fmtU(tend, unit),
    pctReal: pctR == null ? "—" : `${pctR}%`, pctTend: pctT == null ? "—" : `${pctT}%`,
    _cores: { pctReal: sinalPct(pctR), pctTend: sinalPct(pctT) },
  };
}

// Colunas do painel. Por RN (diretor/GV) — unidade da categoria no rótulo.
const colPorRn = (unit) => [
  { key: "setor", label: "Setor" }, { key: "rn", label: "RN" },
  { key: "meta", label: `Meta (${unit})` }, { key: "real", label: `Real (${unit})` }, { key: "pctReal", label: "% Meta" },
  { key: "tend", label: `Tend (${unit})` }, { key: "pctTend", label: "% Tend" },
];
// Por categoria (RN) — cada linha traz a unidade no nome; cabeçalho fica genérico.
const colPorCat = [
  { key: "categoria", label: "Categoria" },
  { key: "meta", label: "Meta" }, { key: "real", label: "Real" }, { key: "pctReal", label: "% Meta" },
  { key: "tend", label: "Tend" }, { key: "pctTend", label: "% Tend" },
];

router.use(authMiddleware);

// GET /api/farol-volumes/mensagens  (mês corrente; escopo por perfil do requisitante)
router.get("/mensagens", async (req, res) => {
  try {
    const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const mes = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    const dataBR = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    const diaLabel = DIA_LABEL[d.getDay()];

    // Tendência: projeta o real do mês pelo ritmo de dias úteis (seg–sex).
    const uteis = (ate) => { let c = 0; const x = new Date(d.getFullYear(), d.getMonth(), 1); while (x.getMonth() === d.getMonth() && x.getDate() <= ate) { const w = x.getDay(); if (w >= 1 && w <= 5) c++; x.setDate(x.getDate() + 1); } return c; };
    const fator = uteis(31) / Math.max(1, uteis(d.getDate()));

    const [rvAll, usuarios] = await Promise.all([
      readSheet("rv_resultado").catch(() => []),
      readSheet("usuarios").catch(() => []),
    ]);
    // rv_resultado acumula meses — usa só o mês corrente (linhas antigas sem mês contam).
    const rv = filtrarPorPerfil(rvAll, req.user, "setor").filter((r) => !r.mes_referencia || String(r.mes_referencia).startsWith(mes));

    const aggBySetor = {};
    rv.forEach((r) => {
      const s = String(r.setor || "").trim(); if (!s) return;
      const e = aggBySetor[s] || (aggBySetor[s] = {});
      CATS.forEach((c) => { e[c.meta] = (e[c.meta] || 0) + num(r[c.meta]); e[c.real] = (e[c.real] || 0) + num(r[c.real]); });
    });
    const setoresTodos = Object.keys(aggBySetor).sort();

    const nomeSetor = {}, telSetor = {};
    usuarios.forEach((u) => { const c = String(u.cod || "").trim(); if (c) { nomeSetor[c] = String(u.nome || "").trim(); telSetor[c] = String(u.telefone || "").trim(); } });

    const mesLabel = `${ROT[d.getMonth()]}/${d.getFullYear()}`;
    const legenda = `Meta × Real × Tendência · ${mesLabel} · Tend = projeção dias úteis`;
    const base = { data: dataBR, dia: diaLabel, titulo: "Volumes", emoji: "📊", legenda, colunas: [], rn: [], gv: [], director: null };
    if (!setoresTodos.length) return res.json(base);

    // Uma tabela "por RN" de UMA categoria (uma unidade só), para um conjunto de setores + total.
    const tabelaCat = (cat, setores, totalLabel) => {
      let tm = 0, tr = 0;
      const linhas = setores.map((s) => {
        const a = aggBySetor[s] || {};
        const meta = num(a[cat.meta]), real = num(a[cat.real]);
        tm += meta; tr += real;
        return { setor: s, rn: nomeSetor[s] || "", ...vol(meta, real, real * fator, cat.unit) };
      });
      return [...linhas, { setor: "", rn: totalLabel, ...vol(tm, tr, tr * fator, cat.unit) }];
    };
    // Uma tabela "por categoria" de um setor (RN). Cada linha na sua unidade; o TOTAL
    // soma só as categorias em HL (Mktp é R$, não entra no volume total).
    const tabelaSetor = (s) => {
      const a = aggBySetor[s] || {};
      const linhas = CATS.map((cat) => {
        const meta = num(a[cat.meta]), real = num(a[cat.real]);
        return { categoria: `${cat.label} (${cat.unit})`, ...vol(meta, real, real * fator, cat.unit) };
      });
      let tm = 0, tr = 0;
      CATS.filter((c) => c.unit === "HL").forEach((c) => { tm += num(a[c.meta]); tr += num(a[c.real]); });
      return [...linhas, { categoria: "TOTAL (HL)", ...vol(tm, tr, tr * fator, "HL") }];
    };

    // Texto (fallback quando não é foto).
    const txtCat = (cat, setores, totalLabel) => {
      const l = setores.map((s) => { const a = aggBySetor[s] || {}; const m = num(a[cat.meta]), r = num(a[cat.real]); const p = m > 0 ? Math.round(r / m * 100) : "—"; return `• ${s} ${nomeSetor[s] || ""}: ${fmtU(r, cat.unit)}/${fmtU(m, cat.unit)} (${p}%)`; });
      const tm = setores.reduce((x, s) => x + num((aggBySetor[s] || {})[cat.meta]), 0);
      const tr = setores.reduce((x, s) => x + num((aggBySetor[s] || {})[cat.real]), 0);
      const tp = tm > 0 ? Math.round(tr / tm * 100) : "—";
      return `*${cat.label}*\n${l.join("\n")}\n▸ ${totalLabel}: ${fmtU(tr, cat.unit)}/${fmtU(tm, cat.unit)} (${tp}%)`;
    };
    const cab = (l2) => [`📊 *Volumes* ${dataBR}`, l2, legenda, ""].join("\n");

    // ── Por RN ── (1 foto: as categorias do seu setor)
    const rn = setoresTodos.map((s) => ({
      setor: s, nome: nomeSetor[s] || "", telefone: telSetor[s] || "",
      texto: [cab(`Setor ${s}${nomeSetor[s] ? " · " + nomeSetor[s] : ""} · ${diaLabel}`),
        ...CATS.map((cat) => { const a = aggBySetor[s] || {}; const m = num(a[cat.meta]), r = num(a[cat.real]); const p = m > 0 ? Math.round(r / m * 100) : "—"; return `• ${cat.label}: ${fmtU(r, cat.unit)}/${fmtU(m, cat.unit)} (${p}%) · tend ${fmtU(r * fator, cat.unit)}`; })].join("\n"),
      blocos: [{ titulo: "Volumes", subtitulo: `Setor ${s}${nomeSetor[s] ? " · " + nomeSetor[s] : ""} · ${diaLabel}`, colunas: colPorCat, linhas: tabelaSetor(s) }],
    }));

    // ── Por GV (sala) ── (4 fotos: 1 por categoria, escopo da região + linha REGIÃO)
    const gruposGV = {};
    setoresTodos.forEach((s) => { const p = String(s)[0]; (gruposGV[p] = gruposGV[p] || []).push(s); });
    const perfilDoPrefixo = { "1": "gv1", "3": "gv3" };
    const gv = Object.entries(gruposGV).map(([prefixo, sets]) => {
      const uGV = usuarios.find((u) => String(u.perfil || "").toLowerCase() === perfilDoPrefixo[prefixo] && String(u.telefone || "").trim());
      const regLabel = `REGIÃO ${prefixo}xx`;
      return {
        grupo: `${prefixo}xx`, nome: uGV?.nome || "", telefone: String(uGV?.telefone || "").trim(),
        texto: [cab(`Consolidado GV ${uGV?.nome || prefixo + "xx"} · ${diaLabel}`), ...CATS.map((cat) => txtCat(cat, sets, regLabel))].join("\n\n"),
        blocos: CATS.map((cat) => ({ titulo: `Volumes · ${cat.label}`, subtitulo: `Por RN · GV ${prefixo}xx · ${diaLabel}`, colunas: colPorRn(cat.unit), linhas: tabelaCat(cat, sets, regLabel) })),
      };
    });

    // ── Diretoria ── (4 fotos: 1 por categoria, todos os RNs + linha OPERAÇÃO)
    const diretores = usuarios.filter((u) => String(u.perfil || "").toLowerCase() === "director" && String(u.telefone || "").trim());
    let director = null;
    if (diretores.length) {
      director = {
        texto: [cab(`Consolidado Diretoria · ${diaLabel}`), ...CATS.map((cat) => txtCat(cat, setoresTodos, "OPERAÇÃO"))].join("\n\n"),
        blocos: CATS.map((cat) => ({ titulo: `Volumes · ${cat.label}`, subtitulo: `Por RN · Operação · ${diaLabel}`, colunas: colPorRn(cat.unit), linhas: tabelaCat(cat, setoresTodos, "OPERAÇÃO") })),
        destinatarios: diretores.map((u) => ({ nome: String(u.nome || "").trim() || "Diretoria", telefone: String(u.telefone).trim() })),
      };
    }

    return res.json({ ...base, rn, gv, director });
  } catch (e) {
    console.error("farol-volumes/mensagens:", e);
    return res.status(500).json({ error: "Erro ao gerar farol de volumes." });
  }
});

module.exports = router;
