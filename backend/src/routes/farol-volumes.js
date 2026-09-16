// Farol "Report Volumes" (envio WhatsApp) — relatório único estilo planilha.
// Ordem: Consolidado Operação → Por GV (GV1/GV3) → Por RN (primeiro nome).
// Categorias: Cerveja, Cerveja Zero, NAB, NAB Zero, Match, Mktp. Sub-colunas por
// categoria: Meta · Real · % · Tend. Tendência = real projetado pelo ritmo de dias úteis.
// Fonte: rv_resultado (metas/real das 4 principais) + rv_volume (volume das "zero").
// Todo mundo com telefone recebe o relatório INTEIRO (não é escopado por RN).
const express = require("express");
const router = express.Router();
const { readSheet } = require("../services/sheets");
const { authMiddleware } = require("../middleware/auth");

const num = (v) => parseFloat(String(v ?? "0").replace(",", ".")) || 0;
const pad = (n) => String(n).padStart(2, "0");
const fmtN = (n) => (Math.round(Number(n) || 0)).toLocaleString("pt-BR"); // inteiro c/ separador de milhar
const DIA_LABEL = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

// tipo "rv" = meta/real vêm do rv_resultado; "zero" = real do rv_volume, meta = 15% da base.
const CATS = [
  { key: "cerveja", label: "Cerveja", tipo: "rv", real: "real_cerveja", meta: "meta_cerveja" },
  { key: "cervejaZero", label: "Cerv. Zero", tipo: "zero", volCat: "CERVEJA ZERO", base: "cerveja" },
  { key: "nab", label: "NAB", tipo: "rv", real: "real_nab", meta: "meta_nab" },
  { key: "nabZero", label: "NAB Zero", tipo: "zero", volCat: "NAB ZERO", base: "nab" },
  { key: "match", label: "Match", tipo: "rv", real: "real_match", meta: "meta_match" },
  { key: "mktp", label: "Mktp", tipo: "rv", real: "real_marketplace", meta: "meta_marketplace" },
];
const SUBCOLS = [{ key: "meta", label: "Meta" }, { key: "real", label: "Real" }, { key: "pct", label: "%" }, { key: "tend", label: "Tend" }, { key: "pctT", label: "%T" }];
const primeiroNome = (nome) => String(nome || "").trim().split(/\s+/)[0] || "";

router.use(authMiddleware);

// GET /api/farol-volumes/mensagens  (mês corrente; relatório consolidado p/ todos)
router.get("/mensagens", async (req, res) => {
  try {
    const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const mes = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    const dataBR = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    const diaLabel = DIA_LABEL[d.getDay()];

    // Tendência: projeta o real do mês pelo ritmo de dias úteis (seg–sex).
    const uteis = (ate) => { let c = 0; const x = new Date(d.getFullYear(), d.getMonth(), 1); while (x.getMonth() === d.getMonth() && x.getDate() <= ate) { const w = x.getDay(); if (w >= 1 && w <= 5) c++; x.setDate(x.getDate() + 1); } return c; };
    const fator = uteis(31) / Math.max(1, uteis(d.getDate()));

    const [rvAll, volAll, usuarios] = await Promise.all([
      readSheet("rv_resultado").catch(() => []),
      readSheet("rv_volume").catch(() => []),
      readSheet("usuarios").catch(() => []),
    ]);
    const doMes = (r) => !r.mes_referencia && !r.mes_ref ? true : String(r.mes_ref || r.mes_referencia || "").startsWith(mes);
    const rv = rvAll.filter((r) => !r.mes_referencia || String(r.mes_referencia).startsWith(mes));

    // raw[setor][catKey] = { meta, real } (valores brutos por setor).
    const raw = {};
    const initSetor = (s) => { if (!raw[s]) { raw[s] = {}; CATS.forEach((c) => raw[s][c.key] = { meta: 0, real: 0 }); } };
    rv.forEach((r) => {
      const s = String(r.setor || "").trim(); if (!s) return; initSetor(s);
      CATS.filter((c) => c.tipo === "rv").forEach((c) => { raw[s][c.key].meta += num(r[c.meta]); raw[s][c.key].real += num(r[c.real]); });
    });
    // "zero": real do rv_volume por setor+categoria; meta = 15% do real da base (monitoramento).
    const volSetor = {};
    volAll.filter(doMes).forEach((r) => {
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
    if (!setores.length) return res.json({ data: dataBR, dia: diaLabel, titulo: "Report Volumes", emoji: "📊", report: null, rn: [], gv: [], director: null, destinatarios: [] });

    const nomeSetor = {};
    usuarios.forEach((u) => { const c = String(u.cod || "").trim(); if (c) nomeSetor[c] = String(u.nome || "").trim(); });

    // Agrega um conjunto de setores → { catKey: {meta,real,pct,tend,_cor} } formatado.
    const sinal = (p) => (p == null ? "flat" : p >= 100 ? "up" : p >= 70 ? "mid" : "down");
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

    const gvPrefixos = [["1", "GV 1"], ["3", "GV 3"]];
    const gvLinhas = gvPrefixos
      .map(([px, lbl]) => ({ px, lbl, sets: setores.filter((s) => String(s)[0] === px) }))
      .filter((g) => g.sets.length)
      .map((g) => ({ rotulo: g.lbl, cats: aggCats(g.sets) }));

    const rnLinhas = setores.map((s) => ({ setor: s, rotulo: primeiroNome(nomeSetor[s]) || s, cats: aggCats([s]) }));

    const report = {
      categorias: CATS.map((c) => ({ key: c.key, label: c.label })),
      subcols: SUBCOLS,
      secoes: [
        { titulo: "Consolidado Operação", colLabel: "Operação", linhas: [{ rotulo: "Operação", cats: aggCats(setores) }] },
        { titulo: "Por GV", colLabel: "GV", linhas: gvLinhas },
        { titulo: "Por RN", colLabel: "RN", setorCol: true, linhas: rnLinhas },
      ],
    };

    // Destinatários: todos com telefone (perfis de campo). Recebem o relatório INTEIRO.
    const perfisEnvio = new Set(["director", "gv1", "gv3", "rn"]);
    const vistos = new Set();
    const destinatarios = [];
    usuarios.forEach((u) => {
      const tel = String(u.telefone || "").replace(/\D/g, "");
      if (!tel || !perfisEnvio.has(String(u.perfil || "").toLowerCase())) return;
      if (vistos.has(tel)) return; vistos.add(tel);
      destinatarios.push({ nome: String(u.nome || "").trim() || "HOP", telefone: String(u.telefone).trim() });
    });

    return res.json({ data: dataBR, dia: diaLabel, titulo: "Report Volumes", emoji: "📊", report, destinatarios, rn: [], gv: [], director: null });
  } catch (e) {
    console.error("farol-volumes/mensagens:", e);
    return res.status(500).json({ error: "Erro ao gerar o Report Volumes." });
  }
});

module.exports = router;
