// Farol "Queda de Volume" — Top 20 PDVs (com visita hoje) + Top 20 produtos que
// caíram de volume, na MESMA mensagem/foto.
// Regra: compara o volume do MÊS ATUAL no período 01..D-1 (hoje 14 → 01..13) com a
// MÉDIA dos 3 meses anteriores no MESMO período (01..D-1). Gap em HL e em %.
// Fonte: vd_pdv / vd_produto (volume diário). Só quedas > 0.
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
const pct = (n) => `${Math.round(Number(n) || 0)}%`;
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
// 3 meses anteriores a "YYYY-MM" → [m-1, m-2, m-3]
function mesesAnteriores(ym, n = 3) {
  const [y, m] = ym.split("-").map(Number); const out = [];
  for (let k = 1; k <= n; k++) { const d = new Date(y, m - 1 - k, 1); out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); }
  return out;
}

router.use(authMiddleware);

// GET /api/farol-queda/mensagens?dia=SEG..SAB
router.get("/mensagens", async (req, res) => {
  try {
    const hoje = resolverDia(req.query.dia);
    const diaCorte = hoje.diaNum;                 // hoje 14 → considera dias 01..13
    const mesAtual = hoje.mesAtual;
    const mesesRef = mesesAnteriores(mesAtual, 3);

    const [vdPdvRaw, vdProdRaw, pdvBaseRaw, usuarios] = await Promise.all([
      readSheet("vd_pdv").catch(() => []),
      readSheet("vd_produto").catch(() => []),
      readSheet("pdv_base").catch(() => []),
      readSheet("usuarios").catch(() => []),
    ]);
    const vdPdv = filtrarPorPerfil(vdPdvRaw, req.user, "setor");
    const vdProd = filtrarPorPerfil(vdProdRaw, req.user, "setor");

    const diaMap = {};
    pdvBaseRaw.forEach((p) => { const c = normCod(p.cod_pdv || p.cod); if (c) diaMap[c] = String(p.dia_visita || "").trim(); });
    const nomeSetor = {}, telSetor = {};
    usuarios.forEach((u) => { const c = String(u.cod || "").trim(); if (c) { nomeSetor[c] = String(u.nome || "").trim(); telSetor[c] = String(u.telefone || "").trim(); } });

    // Quais meses de referência realmente existem nos dados (p/ dividir a média certo).
    const mesesData = new Set();
    [...vdPdv, ...vdProd].forEach((r) => { const m = String(r.data || "").slice(0, 7); if (m) mesesData.add(m); });
    const refPresentes = mesesRef.filter((m) => mesesData.has(m));

    const base = { data: hoje.dataBR, dia: hoje.diaLabel, titulo: "Queda de Volume", emoji: "📉", colunas: [], rn: [], gv: [] };
    if (!refPresentes.length) return res.json(base); // sem histórico p/ comparar

    // Agrega atual e refs por chave, só nos dias 01..diaCorte-1.
    function agregar(rows, chaveFn, nomeKey, nomeVal) {
      const agg = {};
      rows.forEach((r) => {
        const data = String(r.data || "").slice(0, 10);
        const day = Number(data.slice(8, 10)); if (!day || day >= diaCorte) return;
        const mes = data.slice(0, 7);
        const ehAtual = mes === mesAtual, ehRef = refPresentes.includes(mes);
        if (!ehAtual && !ehRef) return;
        const v = num(r.volume_hl); if (!v) return;
        const k = chaveFn(r);
        const e = agg[k] || (agg[k] = { setor: String(r.setor || "").trim(), chave: k, [nomeKey]: nomeVal(r), cod_pdv: r.cod_pdv ? normCod(r.cod_pdv) : undefined, atual: 0, ref: 0 });
        if (ehAtual) e.atual += v; else e.ref += v;
      });
      return Object.values(agg).map((e) => {
        const media = e.ref / refPresentes.length;
        const gap = media - e.atual;
        return { ...e, media, gap_hl: gap, gap_pct: media > 0 ? (gap / media) * 100 : 0 };
      });
    }

    const linhasPdv = agregar(vdPdv, (r) => `${String(r.setor).trim()}|${normCod(r.cod_pdv)}`, "nome_pdv", (r) => String(r.nome_pdv || "").trim());
    const linhasProd = agregar(vdProd, (r) => `${String(r.setor).trim()}|${normCod(r.cod_produto)}`, "nome_produto", (r) => String(r.nome_produto || "").trim());

    const fmtLinha = (e, campoNome) => ({
      ...(e.cod_pdv ? { cod_pdv: e.cod_pdv } : {}),
      [campoNome]: e[campoNome], setor: e.setor,
      media: hl(e.media), atual: hl(e.atual), gap_hl: hl(e.gap_hl), gap_pct: pct(e.gap_pct),
    });
    const colPdv = [{ key: "cod_pdv", label: "Cód" }, { key: "nome_pdv", label: "PDV" }, { key: "media", label: "Méd 3M" }, { key: "atual", label: "Atual" }, { key: "gap_hl", label: "Gap HL" }, { key: "gap_pct", label: "Gap %" }];
    const colProd = [{ key: "nome_produto", label: "Produto" }, { key: "media", label: "Méd 3M" }, { key: "atual", label: "Atual" }, { key: "gap_hl", label: "Gap HL" }, { key: "gap_pct", label: "Gap %" }];

    const periodo = `01–${String(diaCorte - 1).padStart(2, "0")}/${mesAtual.split("-")[1]}`;
    const refLabel = refPresentes.map(rotMes).join("·");
    const textoBloco = (titulo, linhas, campoNome) => {
      if (!linhas.length) return `${titulo}: nenhum 👍`;
      const corpo = linhas.slice(0, CAP_TXT).map((l) => `• ${l.cod_pdv ? l.cod_pdv + " " : ""}${l[campoNome]} — méd ${l.media} → ${l.atual} (−${l.gap_hl} HL / −${l.gap_pct})`).join("\n");
      return `${titulo} (${linhas.length}):\n${corpo}${linhas.length > CAP_TXT ? `\n… e mais ${linhas.length - CAP_TXT}` : ""}`;
    };
    const cabecalho = (linha2) => [`📉 *Queda de Volume* ${hoje.dataBR}`, linha2, `Período ${periodo} · vs média 3M (${refLabel}) no mesmo período`, ""];

    // Top por setor (queda_hl > 0). PDVs: só visita hoje. Produtos: todos.
    const topSetor = (linhas, soDia) => {
      const out = {};
      linhas.forEach((e) => {
        if (e.gap_hl <= 0.001) return;
        if (soDia && normDia(diaMap[e.cod_pdv] || "") !== hoje.diaKey) return;
        (out[e.setor] = out[e.setor] || []).push(e);
      });
      Object.keys(out).forEach((s) => { out[s].sort((a, b) => b.media - a.media); out[s] = out[s].slice(0, TOP); });
      return out;
    };
    const topPdv = topSetor(linhasPdv, true);
    const topProd = topSetor(linhasProd, false);

    // ── Mensagens por RN ──
    const setores = [...new Set([...Object.keys(topPdv), ...Object.keys(topProd)])].sort();
    const rn = setores.map((s) => {
      const pdvs = (topPdv[s] || []).map((e) => fmtLinha(e, "nome_pdv"));
      const prods = (topProd[s] || []).map((e) => fmtLinha(e, "nome_produto"));
      const texto = [
        ...cabecalho(`Setor ${s}${nomeSetor[s] ? " · " + nomeSetor[s] : ""} · Dia ${hoje.diaLabel}`),
        textoBloco("Top PDVs (visita hoje)", pdvs, "nome_pdv"), "",
        textoBloco("Top Produtos", prods, "nome_produto"),
      ].join("\n");
      return {
        setor: s, nome: nomeSetor[s] || "", telefone: telSetor[s] || "", texto,
        blocos: [
          { subtitulo: `Top PDVs com queda · visita hoje (${pdvs.length})`, colunas: colPdv, linhas: pdvs },
          { subtitulo: `Top Produtos com queda (${prods.length})`, colunas: colProd, linhas: prods },
        ],
      };
    });

    // ── Mensagens por GV (agrega a sala; recalcula o top) ──
    const topSala = (linhas, setoresGV, soDia) => linhas
      .filter((e) => setoresGV.includes(e.setor) && e.gap_hl > 0.001 && (!soDia || normDia(diaMap[e.cod_pdv] || "") === hoje.diaKey))
      .sort((a, b) => b.media - a.media).slice(0, TOP);
    const gruposGV = {};
    setores.forEach((s) => { const p = String(s)[0]; (gruposGV[p] = gruposGV[p] || []).push(s); });
    const perfilDoPrefixo = { "1": "gv1", "3": "gv3" };
    const colPdvGV = [{ key: "cod_pdv", label: "Cód" }, { key: "setor", label: "Setor" }, { key: "nome_pdv", label: "PDV" }, { key: "gap_hl", label: "Gap HL" }, { key: "gap_pct", label: "Gap %" }];
    const colProdGV = [{ key: "nome_produto", label: "Produto" }, { key: "setor", label: "Setor" }, { key: "gap_hl", label: "Gap HL" }, { key: "gap_pct", label: "Gap %" }];
    const gv = Object.entries(gruposGV).map(([prefixo, sets]) => {
      const uGV = usuarios.find((u) => String(u.perfil || "").toLowerCase() === perfilDoPrefixo[prefixo] && String(u.telefone || "").trim());
      const nomeGV = uGV ? `GV ${uGV.nome}` : `GV ${prefixo}xx`;
      const pdvs = topSala(linhasPdv, sets, true).map((e) => fmtLinha(e, "nome_pdv"));
      const prods = topSala(linhasProd, sets, false).map((e) => fmtLinha(e, "nome_produto"));
      const texto = [
        ...cabecalho(`Consolidado ${nomeGV} · Dia ${hoje.diaLabel}`),
        textoBloco("Top PDVs (visita hoje)", pdvs, "nome_pdv"), "",
        textoBloco("Top Produtos", prods, "nome_produto"),
      ].join("\n");
      return {
        grupo: `${prefixo}xx`, nome: uGV?.nome || "", telefone: String(uGV?.telefone || "").trim(), texto,
        blocos: [
          { subtitulo: `Top PDVs com queda · visita hoje (${pdvs.length})`, colunas: colPdvGV, linhas: pdvs },
          { subtitulo: `Top Produtos com queda (${prods.length})`, colunas: colProdGV, linhas: prods },
        ],
      };
    });

    return res.json({ ...base, rn, gv });
  } catch (e) {
    console.error("farol-queda/mensagens:", e);
    return res.status(500).json({ error: "Erro ao gerar farol de queda." });
  }
});

// GET /api/farol-queda/top-produtos — Top 20 produtos por volume (média 3M) com a
// variação vs o mês atual no mesmo período (01..D-1). INCLUI quem SUBIU (para a Home).
router.get("/top-produtos", async (req, res) => {
  try {
    const hoje = resolverDia();
    const diaCorte = hoje.diaNum, mesAtual = hoje.mesAtual;
    const mesesRef = mesesAnteriores(mesAtual, 3);
    const [vdProdRaw, gradeRaw] = await Promise.all([
      readSheet("vd_produto").catch(() => []),
      readSheet("grade_estoque").catch(() => []),
    ]);
    const vdProd = filtrarPorPerfil(vdProdRaw, req.user, "setor");
    // Estoque (saldo em unidades) por produto — grade_estoque é o saldo do CDD (não por setor).
    const saldoMap = {};
    gradeRaw.forEach((g) => { const c = normCod(g.cod); if (c) saldoMap[c] = (saldoMap[c] || 0) + (parseInt(g.saldo) || 0); });

    const mesesData = new Set();
    vdProd.forEach((r) => { const m = String(r.data || "").slice(0, 7); if (m) mesesData.add(m); });
    const refPresentes = mesesRef.filter((m) => mesesData.has(m));
    const periodo = `01–${String(diaCorte - 1).padStart(2, "0")}/${mesAtual.split("-")[1]}`;
    const refLabel = refPresentes.length ? `${rotMes(refPresentes[refPresentes.length - 1])}–${rotMes(refPresentes[0])}` : "";
    if (!refPresentes.length) return res.json({ periodo, ref_label: refLabel, produtos: [] });

    // full = volume do MÊS CHEIO (média 3M "tamanho"); periodoRef/atual = dias 01..D-1.
    const agg = {};
    vdProd.forEach((r) => {
      const data = String(r.data || "").slice(0, 10);
      const day = Number(data.slice(8, 10)); if (!day) return;
      const mes = data.slice(0, 7);
      const ehAtual = mes === mesAtual, ehRef = refPresentes.includes(mes);
      if (!ehAtual && !ehRef) return;
      const v = num(r.volume_hl); if (!v) return;
      const cod = normCod(r.cod_produto);
      const e = agg[cod] || (agg[cod] = { cod_produto: cod, nome_produto: String(r.nome_produto || "").trim(), full: 0, periodoRef: 0, atual: 0 });
      if (ehRef) { e.full += v; if (day < diaCorte) e.periodoRef += v; }
      else if (day < diaCorte) e.atual += v;
    });
    const r1 = (n) => Math.round(n * 10) / 10;
    const produtos = Object.values(agg).map((e) => {
      const mediaFull = e.full / refPresentes.length;    // média cheia (ranking/tamanho)
      const mediaPer = e.periodoRef / refPresentes.length; // média no mesmo período
      const gap = e.atual - mediaPer;                     // + subiu · − caiu
      return {
        cod_produto: e.cod_produto, nome_produto: e.nome_produto,
        media: r1(mediaFull), atual: r1(e.atual),
        estoque: saldoMap[e.cod_produto] ?? null,
        gap_hl: r1(gap), gap_pct: mediaPer > 0 ? Math.round((gap / mediaPer) * 100) : 0,
      };
    }).sort((a, b) => b.media - a.media).slice(0, 20);

    return res.json({ periodo, ref_label: refLabel, produtos });
  } catch (e) {
    console.error("farol-queda/top-produtos:", e);
    return res.status(500).json({ error: "Erro ao montar top produtos." });
  }
});

module.exports = router;
