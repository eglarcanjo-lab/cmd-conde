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
const pad = (n) => String(n).padStart(2, "0");
const ROT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const DIA_LABEL = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

const CATS = [
  { key: "cerveja", label: "Cerveja", real: "real_cerveja", meta: "meta_cerveja" },
  { key: "nab", label: "NAB", real: "real_nab", meta: "meta_nab" },
  { key: "match", label: "Match", real: "real_match", meta: "meta_match" },
  { key: "mktp", label: "Mktp", real: "real_marketplace", meta: "meta_marketplace" },
];

// % da meta → cor: ≥100 verde (up) · 70–99 âmbar (mid) · <70 vermelho (down).
const sinalPct = (p) => (p == null ? "flat" : p >= 100 ? "up" : p >= 70 ? "mid" : "down");

// Formata um trio meta/real/tendência com os % (real/meta e tend/meta) já coloridos.
function vol(meta, real, tend) {
  const pctR = meta > 0 ? Math.round((real / meta) * 100) : null;
  const pctT = meta > 0 ? Math.round((tend / meta) * 100) : null;
  return {
    meta: hl(meta), real: hl(real), tend: hl(tend),
    pctReal: pctR == null ? "—" : `${pctR}%`, pctTend: pctT == null ? "—" : `${pctT}%`,
    _cores: { pctReal: sinalPct(pctR), pctTend: sinalPct(pctT) },
  };
}

// Colunas do painel. Por RN (diretor/GV) e por categoria (RN).
const colPorRn = [
  { key: "setor", label: "Setor" }, { key: "rn", label: "RN" },
  { key: "meta", label: "Meta (HL)" }, { key: "real", label: "Real (HL)" }, { key: "pctReal", label: "% Meta" },
  { key: "tend", label: "Tend (HL)" }, { key: "pctTend", label: "% Tend" },
];
const colPorCat = [
  { key: "categoria", label: "Categoria" },
  { key: "meta", label: "Meta (HL)" }, { key: "real", label: "Real (HL)" }, { key: "pctReal", label: "% Meta" },
  { key: "tend", label: "Tend (HL)" }, { key: "pctTend", label: "% Tend" },
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

    // Uma tabela "por RN" de uma categoria, para um conjunto de setores + linha total.
    const tabelaCat = (cat, setores, totalLabel) => {
      let tm = 0, tr = 0;
      const linhas = setores.map((s) => {
        const a = aggBySetor[s] || {};
        const meta = num(a[cat.meta]), real = num(a[cat.real]);
        tm += meta; tr += real;
        return { setor: s, rn: nomeSetor[s] || "", ...vol(meta, real, real * fator) };
      });
      return [...linhas, { setor: "", rn: totalLabel, ...vol(tm, tr, tr * fator) }];
    };
    // Uma tabela "por categoria" de um setor (RN) + linha total.
    const tabelaSetor = (s) => {
      let tm = 0, tr = 0;
      const linhas = CATS.map((cat) => {
        const a = aggBySetor[s] || {};
        const meta = num(a[cat.meta]), real = num(a[cat.real]);
        tm += meta; tr += real;
        return { categoria: cat.label, ...vol(meta, real, real * fator) };
      });
      return [...linhas, { categoria: "TOTAL", ...vol(tm, tr, tr * fator) }];
    };

    // Texto (fallback quando não é foto).
    const txtCat = (cat, setores, totalLabel) => {
      const l = setores.map((s) => { const a = aggBySetor[s] || {}; const m = num(a[cat.meta]), r = num(a[cat.real]); const p = m > 0 ? Math.round(r / m * 100) : "—"; return `• ${s} ${nomeSetor[s] || ""}: ${hl(r)}/${hl(m)} (${p}%)`; });
      const tm = setores.reduce((x, s) => x + num((aggBySetor[s] || {})[cat.meta]), 0);
      const tr = setores.reduce((x, s) => x + num((aggBySetor[s] || {})[cat.real]), 0);
      const tp = tm > 0 ? Math.round(tr / tm * 100) : "—";
      return `*${cat.label}*\n${l.join("\n")}\n▸ ${totalLabel}: ${hl(tr)}/${hl(tm)} (${tp}%)`;
    };
    const cab = (l2) => [`📊 *Volumes* ${dataBR}`, l2, legenda, ""].join("\n");

    // ── Por RN ── (1 foto: as categorias do seu setor)
    const rn = setoresTodos.map((s) => ({
      setor: s, nome: nomeSetor[s] || "", telefone: telSetor[s] || "",
      texto: [cab(`Setor ${s}${nomeSetor[s] ? " · " + nomeSetor[s] : ""} · ${diaLabel}`),
        ...CATS.map((cat) => { const a = aggBySetor[s] || {}; const m = num(a[cat.meta]), r = num(a[cat.real]); const p = m > 0 ? Math.round(r / m * 100) : "—"; return `• ${cat.label}: ${hl(r)}/${hl(m)} (${p}%) · tend ${hl(r * fator)}`; })].join("\n"),
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
        blocos: CATS.map((cat) => ({ titulo: `Volumes · ${cat.label}`, subtitulo: `Por RN · GV ${prefixo}xx · ${diaLabel}`, colunas: colPorRn, linhas: tabelaCat(cat, sets, regLabel) })),
      };
    });

    // ── Diretoria ── (4 fotos: 1 por categoria, todos os RNs + linha OPERAÇÃO)
    const diretores = usuarios.filter((u) => String(u.perfil || "").toLowerCase() === "director" && String(u.telefone || "").trim());
    let director = null;
    if (diretores.length) {
      director = {
        texto: [cab(`Consolidado Diretoria · ${diaLabel}`), ...CATS.map((cat) => txtCat(cat, setoresTodos, "OPERAÇÃO"))].join("\n\n"),
        blocos: CATS.map((cat) => ({ titulo: `Volumes · ${cat.label}`, subtitulo: `Por RN · Operação · ${diaLabel}`, colunas: colPorRn, linhas: tabelaCat(cat, setoresTodos, "OPERAÇÃO") })),
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
