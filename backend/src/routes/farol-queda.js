// Farol "Top 20 Volume" (envio WhatsApp) + tabelas da Home.
// Regra: "Média 3M (HL)" = média do MÊS CHEIO dos 3 meses anteriores (tamanho/ordem).
// GAP/Δ = ritmo do período 01..D-1 (atual − média do MESMO período). Sobe (▲) e cai (▼).
// PDVs no envio: só os com visita hoje. Produtos: gerais. Estoque = saldo da grade.
const express = require("express");
const router = express.Router();
const { readSheet } = require("../services/sheets");
const { authMiddleware } = require("../middleware/auth");
const { filtrarPorPerfil } = require("../utils/perfil");

const normCod = (v) => String(v ?? "").trim().replace(/^0+/, "") || "0";
const num = (v) => parseFloat(String(v ?? "0").replace(",", ".")) || 0;
const ROT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const rotMes = (m) => ROT[(Number(String(m).split("-")[1]) || 1) - 1];
const hl = (n) => (Math.round((Number(n) || 0) * 10) / 10).toFixed(1).replace(".", ",");
const TOP = 20, CAP_TXT = 10;

const DIA_NORM = {
  SEG: "SEG", SEGUNDA: "SEG", "SEGUNDA-FEIRA": "SEG", "2": "SEG",
  TER: "TER", TERCA: "TER", "TERÇA": "TER", "TERCA-FEIRA": "TER", "TERÇA-FEIRA": "TER", "3": "TER",
  QUA: "QUA", QUARTA: "QUA", "QUARTA-FEIRA": "QUA", "4": "QUA",
  QUI: "QUI", QUINTA: "QUI", "QUINTA-FEIRA": "QUI", "5": "QUI",
  SEX: "SEX", SEXTA: "SEX", "SEXTA-FEIRA": "SEX", "6": "SEX",
  SAB: "SAB", SABADO: "SAB", "SÁBADO": "SAB", "7": "SAB",
  DOM: "DOM", DOMINGO: "DOM", "1": "DOM",
};
const normDia = (raw) => { const s = String(raw || "").trim().toUpperCase().split(/[\/,; \-]/)[0].trim(); return DIA_NORM[s] || s; };
const DIA_KEYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];
const DIA_LABEL = { DOM: "Domingo", SEG: "Segunda-feira", TER: "Terça-feira", QUA: "Quarta-feira", QUI: "Quinta-feira", SEX: "Sexta-feira", SAB: "Sábado" };
function resolverDia(diaParam) {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const dataBR = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  const forcado = normDia(diaParam);
  const diaKey = DIA_KEYS.includes(forcado) ? forcado : DIA_KEYS[d.getDay()];
  const mesAtual = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  return { dataBR, diaKey, diaLabel: DIA_LABEL[diaKey] || diaKey, mesAtual, diaNum: d.getDate() };
}
function mesesAnteriores(ym, n = 3) {
  const [y, m] = ym.split("-").map(Number); const out = [];
  for (let k = 1; k <= n; k++) { const d = new Date(y, m - 1 - k, 1); out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); }
  return out;
}

// Agrega volume por chave: full = mês cheio (média 3M "tamanho"); periodoRef/atual = dias 01..D-1.
function agregar(rows, refPresentes, mesAtual, diaCorte, chaveFn, nomeKey, nomeVal, ehProduto) {
  const agg = {};
  rows.forEach((r) => {
    const data = String(r.data || "").slice(0, 10);
    const day = Number(data.slice(8, 10)); if (!day) return;
    const mes = data.slice(0, 7);
    const ehAtual = mes === mesAtual, ehRef = refPresentes.includes(mes);
    if (!ehAtual && !ehRef) return;
    const v = num(r.volume_hl); if (!v) return;
    const k = chaveFn(r);
    const e = agg[k] || (agg[k] = { setor: String(r.setor || "").trim(), [nomeKey]: nomeVal(r), cod_pdv: ehProduto ? undefined : normCod(r.cod_pdv), cod_produto: ehProduto ? normCod(r.cod_produto) : undefined, full: 0, periodoRef: 0, atual: 0 });
    if (ehRef) { e.full += v; if (day < diaCorte) e.periodoRef += v; }
    else if (day < diaCorte) e.atual += v;
  });
  return Object.values(agg).map((e) => {
    const mediaFull = e.full / refPresentes.length, mediaPer = e.periodoRef / refPresentes.length, gap = e.atual - mediaPer;
    return { ...e, mediaFull, gap_hl: gap, gap_pct: mediaPer > 0 ? (gap / mediaPer) * 100 : 0 };
  });
}

router.use(authMiddleware);

// GET /api/farol-queda/mensagens?dia=SEG..SAB
router.get("/mensagens", async (req, res) => {
  try {
    const hoje = resolverDia(req.query.dia);
    const diaCorte = hoje.diaNum, mesAtual = hoje.mesAtual;
    const mesesRef = mesesAnteriores(mesAtual, 3);

    const [vdPdvRaw, vdProdRaw, gradeRaw, pdvBaseRaw, usuarios] = await Promise.all([
      readSheet("vd_pdv").catch(() => []),
      readSheet("vd_produto").catch(() => []),
      readSheet("grade_estoque").catch(() => []),
      readSheet("pdv_base").catch(() => []),
      readSheet("usuarios").catch(() => []),
    ]);
    const vdPdv = filtrarPorPerfil(vdPdvRaw, req.user, "setor");
    const vdProd = filtrarPorPerfil(vdProdRaw, req.user, "setor");
    const saldoMap = {};
    gradeRaw.forEach((g) => { const c = normCod(g.cod); if (c) saldoMap[c] = (saldoMap[c] || 0) + (parseInt(g.saldo) || 0); });

    const diaMap = {};
    pdvBaseRaw.forEach((p) => { const c = normCod(p.cod_pdv || p.cod); if (c) diaMap[c] = String(p.dia_visita || "").trim(); });
    const nomeSetor = {}, telSetor = {};
    usuarios.forEach((u) => { const c = String(u.cod || "").trim(); if (c) { nomeSetor[c] = String(u.nome || "").trim(); telSetor[c] = String(u.telefone || "").trim(); } });

    const mesesData = new Set();
    [...vdPdv, ...vdProd].forEach((r) => { const m = String(r.data || "").slice(0, 7); if (m) mesesData.add(m); });
    const refPresentes = mesesRef.filter((m) => mesesData.has(m));
    const periodo = `01–${String(diaCorte - 1).padStart(2, "0")}/${mesAtual.split("-")[1]}`;
    const refLabel = refPresentes.length ? `${rotMes(refPresentes[refPresentes.length - 1])}–${rotMes(refPresentes[0])}` : "";

    const base = { data: hoje.dataBR, dia: hoje.diaLabel, titulo: "Top 20 Volume", emoji: "📊", colunas: [], rn: [], gv: [], director: [] };
    if (!refPresentes.length) return res.json(base);

    const linhasPdv = agregar(vdPdv, refPresentes, mesAtual, diaCorte, (r) => `${String(r.setor).trim()}|${normCod(r.cod_pdv)}`, "nome_pdv", (r) => String(r.nome_pdv || "").trim(), false);
    const linhasProd = agregar(vdProd, refPresentes, mesAtual, diaCorte, (r) => `${String(r.setor).trim()}|${normCod(r.cod_produto)}`, "nome_produto", (r) => String(r.nome_produto || "").trim(), true);

    // Formatação com cores: _cor up/down/flat · GAP com sinal · Δ com seta.
    const sinal = (n) => (n > 0.001 ? "up" : n < -0.001 ? "down" : "flat");
    const gapStr = (n) => `${n > 0 ? "+" : ""}${hl(n)}`;
    const deltaStr = (n, p) => `${n > 0.001 ? "▲" : n < -0.001 ? "▼" : "—"} ${Math.abs(Math.round(p))}%`;
    const fmtBase = (e) => ({ setor: e.setor, media: hl(e.mediaFull), atual: hl(e.atual), gap: gapStr(e.gap_hl), delta: deltaStr(e.gap_hl, e.gap_pct), _cor: sinal(e.gap_hl) });
    const fmtPdv = (e) => ({ cod_pdv: e.cod_pdv, nome_pdv: e.nome_pdv, ...fmtBase(e) });
    const fmtProd = (e) => ({ nome_produto: e.nome_produto, estoque: saldoMap[e.cod_produto] == null ? "—" : saldoMap[e.cod_produto].toLocaleString("pt-BR"), ...fmtBase(e) });

    // Colunas (formato do painel). *S = com Setor (GV/Diretoria).
    const colPdv = [{ key: "cod_pdv", label: "Cód" }, { key: "nome_pdv", label: "PDV" }, { key: "media", label: "Média 3M (HL)" }, { key: "atual", label: "Mês atual (HL)" }, { key: "gap", label: "GAP (HL)" }, { key: "delta", label: "Δ" }];
    const colPdvS = [{ key: "cod_pdv", label: "Cód" }, { key: "setor", label: "Setor" }, { key: "nome_pdv", label: "PDV" }, { key: "media", label: "Média 3M (HL)" }, { key: "atual", label: "Mês atual (HL)" }, { key: "gap", label: "GAP (HL)" }, { key: "delta", label: "Δ" }];
    const colProd = [{ key: "nome_produto", label: "Produto" }, { key: "media", label: "Média 3M (HL)" }, { key: "atual", label: "Mês atual (HL)" }, { key: "estoque", label: "Estoque" }, { key: "gap", label: "GAP (HL)" }, { key: "delta", label: "Δ" }];
    const colProdS = [{ key: "nome_produto", label: "Produto" }, { key: "setor", label: "Setor" }, { key: "media", label: "Média 3M (HL)" }, { key: "atual", label: "Mês atual (HL)" }, { key: "estoque", label: "Estoque" }, { key: "gap", label: "GAP (HL)" }, { key: "delta", label: "Δ" }];

    const textoBloco = (titulo, linhas, campoNome) => {
      if (!linhas.length) return `${titulo}: —`;
      const corpo = linhas.slice(0, CAP_TXT).map((l) => `• ${l.cod_pdv ? l.cod_pdv + " " : ""}${l[campoNome]} — ${l.media}→${l.atual} (${l.gap} · ${l.delta})`).join("\n");
      return `${titulo} (${linhas.length}):\n${corpo}${linhas.length > CAP_TXT ? `\n… e mais ${linhas.length - CAP_TXT}` : ""}`;
    };
    const cabecalho = (l2) => [`📊 *Top 20 Volume* ${hoje.dataBR}`, l2, `média ${refLabel} · GAP ${periodo}`, ""];

    // Ordena por MÉDIA cheia; inclui quem subiu e caiu. PDVs: só visita hoje.
    const ehHoje = (cod) => normDia(diaMap[cod] || "") === hoje.diaKey;
    const topPdv = (filtro) => linhasPdv.filter((e) => filtro(e) && ehHoje(e.cod_pdv)).sort((a, b) => b.mediaFull - a.mediaFull).slice(0, TOP);
    const topProd = (filtro) => linhasProd.filter(filtro).sort((a, b) => b.mediaFull - a.mediaFull).slice(0, TOP);

    const setores = [...new Set([...linhasPdv, ...linhasProd].map((e) => e.setor).filter(Boolean))].sort();

    // ── Por RN ──
    const rn = setores.map((s) => {
      const pdvs = topPdv((e) => e.setor === s).map(fmtPdv);
      const prods = topProd((e) => e.setor === s).map(fmtProd);
      const texto = [
        ...cabecalho(`Setor ${s}${nomeSetor[s] ? " · " + nomeSetor[s] : ""} · ${hoje.diaLabel}`),
        textoBloco("Top 20 PDVs (visita hoje)", pdvs, "nome_pdv"), "",
        textoBloco("Top 20 produtos", prods, "nome_produto"),
      ].join("\n");
      return {
        setor: s, nome: nomeSetor[s] || "", telefone: telSetor[s] || "", texto,
        blocos: [
          { subtitulo: `Top 20 PDVs · visita hoje (${pdvs.length})`, colunas: colPdv, linhas: pdvs },
          { subtitulo: `Top 20 produtos (${prods.length})`, colunas: colProd, linhas: prods },
        ],
      };
    });

    // ── Por GV (sala) ──
    const gruposGV = {};
    setores.forEach((s) => { const p = String(s)[0]; (gruposGV[p] = gruposGV[p] || []).push(s); });
    const perfilDoPrefixo = { "1": "gv1", "3": "gv3" };
    const gv = Object.entries(gruposGV).map(([prefixo, sets]) => {
      const uGV = usuarios.find((u) => String(u.perfil || "").toLowerCase() === perfilDoPrefixo[prefixo] && String(u.telefone || "").trim());
      const nomeGV = uGV ? `GV ${uGV.nome}` : `GV ${prefixo}xx`;
      const setSet = new Set(sets);
      const pdvs = topPdv((e) => setSet.has(e.setor)).map(fmtPdv);
      const prods = topProd((e) => setSet.has(e.setor)).map(fmtProd);
      const texto = [
        ...cabecalho(`Consolidado ${nomeGV} · ${hoje.diaLabel}`),
        textoBloco("Top 20 PDVs (visita hoje)", pdvs, "nome_pdv"), "",
        textoBloco("Top 20 produtos", prods, "nome_produto"),
      ].join("\n");
      return {
        grupo: `${prefixo}xx`, nome: uGV?.nome || "", telefone: String(uGV?.telefone || "").trim(), texto,
        blocos: [
          { subtitulo: `Top 20 PDVs · visita hoje (${pdvs.length})`, colunas: colPdvS, linhas: pdvs },
          { subtitulo: `Top 20 produtos (${prods.length})`, colunas: colProdS, linhas: prods },
        ],
      };
    });

    // ── Diretoria: consolidado AS (101–103) × ROTA (demais) + produtos gerais ──
    const AS_SET = new Set(["101", "102", "103"]);
    const diretores = usuarios.filter((u) => String(u.perfil || "").toLowerCase() === "director" && String(u.telefone || "").trim());
    let director = null;
    if (diretores.length) {
      // Conteúdo consolidado ÚNICO — o robô gera as imagens 1x e distribui a todos.
      const as = topPdv((e) => AS_SET.has(e.setor)).map(fmtPdv);
      const rota = topPdv((e) => !AS_SET.has(e.setor)).map(fmtPdv);
      const prods = topProd(() => true).map(fmtProd);
      const texto = [
        ...cabecalho(`Consolidado Diretoria · ${hoje.diaLabel}`),
        textoBloco("Top clientes AS (101–103) · visita hoje", as, "nome_pdv"), "",
        textoBloco("Top clientes ROTA · visita hoje", rota, "nome_pdv"), "",
        textoBloco("Top produtos (geral)", prods, "nome_produto"),
      ].join("\n");
      director = {
        texto,
        blocos: [
          { subtitulo: `AS (101–103) · visita hoje (${as.length})`, colunas: colPdvS, linhas: as },
          { subtitulo: `ROTA (demais) · visita hoje (${rota.length})`, colunas: colPdvS, linhas: rota },
          { subtitulo: `Top produtos geral (${prods.length})`, colunas: colProdS, linhas: prods },
        ],
        destinatarios: diretores.map((u) => ({ nome: String(u.nome || "").trim() || "Diretoria", telefone: String(u.telefone).trim() })),
      };
    }

    return res.json({ ...base, rn, gv, director });
  } catch (e) {
    console.error("farol-queda/mensagens:", e);
    return res.status(500).json({ error: "Erro ao gerar farol de queda." });
  }
});

// GET /api/farol-queda/top-produtos — Top 20 produtos por média 3M (sobe e cai). Home.
// Agrega por produto ACROSS os setores do escopo. Média 3M = mês cheio; GAP = período.
router.get("/top-produtos", async (req, res) => {
  try {
    const hoje = resolverDia();
    const diaCorte = hoje.diaNum, mesAtual = hoje.mesAtual;
    const mesesRef = mesesAnteriores(mesAtual, 3);
    const [vdProdRaw, gradeRaw] = await Promise.all([readSheet("vd_produto").catch(() => []), readSheet("grade_estoque").catch(() => [])]);
    const vdProd = filtrarPorPerfil(vdProdRaw, req.user, "setor");
    const saldoMap = {}; gradeRaw.forEach((g) => { const c = normCod(g.cod); if (c) saldoMap[c] = (saldoMap[c] || 0) + (parseInt(g.saldo) || 0); });
    const refPresentes = mesesRef.filter((m) => new Set(vdProd.map((r) => String(r.data || "").slice(0, 7))).has(m));
    const periodo = `01–${String(diaCorte - 1).padStart(2, "0")}/${mesAtual.split("-")[1]}`;
    const refLabel = refPresentes.length ? `${rotMes(refPresentes[refPresentes.length - 1])}–${rotMes(refPresentes[0])}` : "";
    if (!refPresentes.length) return res.json({ periodo, ref_label: refLabel, produtos: [] });

    const agg = {};
    vdProd.forEach((r) => {
      const data = String(r.data || "").slice(0, 10); const day = Number(data.slice(8, 10)); if (!day) return;
      const mes = data.slice(0, 7); const ehAtual = mes === mesAtual, ehRef = refPresentes.includes(mes); if (!ehAtual && !ehRef) return;
      const v = num(r.volume_hl); if (!v) return;
      const cod = normCod(r.cod_produto);
      const e = agg[cod] || (agg[cod] = { cod_produto: cod, nome_produto: String(r.nome_produto || "").trim(), full: 0, periodoRef: 0, atual: 0 });
      if (ehRef) { e.full += v; if (day < diaCorte) e.periodoRef += v; } else if (day < diaCorte) e.atual += v;
    });
    const r1 = (n) => Math.round(n * 10) / 10;
    const produtos = Object.values(agg).map((e) => {
      const mediaFull = e.full / refPresentes.length, mediaPer = e.periodoRef / refPresentes.length, gap = e.atual - mediaPer;
      return { cod_produto: e.cod_produto, nome_produto: e.nome_produto, media: r1(mediaFull), atual: r1(e.atual), estoque: saldoMap[e.cod_produto] ?? null, gap_hl: r1(gap), gap_pct: mediaPer > 0 ? Math.round((gap / mediaPer) * 100) : 0 };
    }).sort((a, b) => b.media - a.media).slice(0, 20);
    return res.json({ periodo, ref_label: refLabel, produtos });
  } catch (e) { console.error("farol-queda/top-produtos:", e); return res.status(500).json({ error: "Erro ao montar top produtos." }); }
});

module.exports = router;
