// Farol "Queda de Volume" — Top 20 PDVs (com visita hoje) + Top 20 produtos que
// caíram de volume, na MESMA mensagem/foto. Queda = volume do mês anterior − mês
// atual (os 2 meses mais recentes de vendas_cliente_produto). Só quedas > 0.
const express = require("express");
const router = express.Router();
const { readSheet } = require("../services/sheets");
const { authMiddleware } = require("../middleware/auth");
const { filtrarPorPerfil } = require("../utils/perfil");

const normCod = (v) => String(v ?? "").trim().replace(/^0+/, "") || "0";
const num = (v) => parseFloat(String(v ?? "0").replace(",", ".")) || 0;
const ROT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const rotMes = (m) => `${ROT[(Number(String(m).split("-")[1]) || 1) - 1]}/${String(m).slice(2, 4)}`;
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
  return { dataBR, diaKey, diaLabel: DIA_LABEL[diaKey] || diaKey };
}

router.use(authMiddleware);

// GET /api/farol-queda/mensagens?dia=SEG..SAB
router.get("/mensagens", async (req, res) => {
  try {
    const hoje = resolverDia(req.query.dia);
    const [vendasRaw, pdvBaseRaw, usuarios] = await Promise.all([
      readSheet("vendas_cliente_produto").catch(() => []),
      readSheet("pdv_base").catch(() => []),
      readSheet("usuarios").catch(() => []),
    ]);
    const vendas = filtrarPorPerfil(vendasRaw, req.user, "setor");

    // 2 meses mais recentes com dado: m1 (anterior) → m0 (atual)
    const meses = [...new Set(vendas.map((r) => String(r.mes_referencia || "").slice(0, 7)).filter((m) => /^\d{4}-\d{2}$/.test(m)))].sort();
    const m0 = meses[meses.length - 1], m1 = meses[meses.length - 2];
    const base = { data: hoje.dataBR, dia: hoje.diaLabel, titulo: "Queda de Volume", emoji: "📉",
      colunas: [], rn: [], gv: [] };
    if (!m0 || !m1) return res.json(base);

    const diaMap = {};
    pdvBaseRaw.forEach((p) => { const c = normCod(p.cod_pdv || p.cod); if (c) diaMap[c] = String(p.dia_visita || "").trim(); });
    const nomeSetor = {}, telSetor = {};
    usuarios.forEach((u) => { const c = String(u.cod || "").trim(); if (c) { nomeSetor[c] = String(u.nome || "").trim(); telSetor[c] = String(u.telefone || "").trim(); } });

    // Agrega volume por setor×PDV e por setor×produto nos 2 meses.
    const pdvAgg = {}, prodAgg = {};
    vendas.forEach((r) => {
      const m = String(r.mes_referencia || "").slice(0, 7);
      if (m !== m0 && m !== m1) return;
      const setor = String(r.setor || "").trim(); if (!setor) return;
      const v = num(r.volume_hl); if (!v) return;
      const cod = normCod(r.cod_pdv);
      const kp = `${setor}|${cod}`;
      const ep = pdvAgg[kp] || (pdvAgg[kp] = { setor, cod_pdv: cod, nome_pdv: String(r.nome_pdv || "").trim(), v0: 0, v1: 0 });
      if (m === m0) ep.v0 += v; else ep.v1 += v;
      const codp = normCod(r.cod_produto);
      const kq = `${setor}|${codp}`;
      const eq = prodAgg[kq] || (prodAgg[kq] = { setor, cod_produto: codp, nome_produto: String(r.nome_produto || "").trim(), v0: 0, v1: 0 });
      if (m === m0) eq.v0 += v; else eq.v1 += v;
    });

    // Top N por setor (queda = v1 − v0 > 0).
    const topPorSetor = (agg, keyNome, soDia) => {
      const out = {};
      Object.values(agg).forEach((e) => {
        const queda = e.v1 - e.v0;
        if (queda <= 0.001) return;
        if (soDia && normDia(diaMap[e.cod_pdv] || "") !== hoje.diaKey) return;
        (out[e.setor] = out[e.setor] || []).push({
          ...(e.cod_pdv ? { cod_pdv: e.cod_pdv } : {}),
          [keyNome]: e[keyNome], antes: hl(e.v1), agora: hl(e.v0), queda: hl(queda), _q: queda,
        });
      });
      Object.keys(out).forEach((s) => { out[s].sort((a, b) => b._q - a._q); out[s] = out[s].slice(0, TOP).map(({ _q, ...x }) => x); });
      return out;
    };
    const topPdv = topPorSetor(pdvAgg, "nome_pdv", true);
    const topProd = topPorSetor(prodAgg, "nome_produto", false);

    const colPdv = [{ key: "cod_pdv", label: "Cód" }, { key: "nome_pdv", label: "PDV" }, { key: "antes", label: rotMes(m1) }, { key: "agora", label: rotMes(m0) }, { key: "queda", label: "Queda" }];
    const colProd = [{ key: "nome_produto", label: "Produto" }, { key: "antes", label: rotMes(m1) }, { key: "agora", label: rotMes(m0) }, { key: "queda", label: "Queda" }];

    const textoBloco = (titulo, linhas, campoNome) => {
      if (!linhas.length) return `${titulo}: nenhum 👍`;
      const corpo = linhas.slice(0, CAP_TXT).map((l) => `• ${l.cod_pdv ? l.cod_pdv + " " : ""}${l[campoNome]} — ${l.antes}→${l.agora} (−${l.queda})`).join("\n");
      return `${titulo} (${linhas.length}):\n${corpo}${linhas.length > CAP_TXT ? `\n… e mais ${linhas.length - CAP_TXT}` : ""}`;
    };
    const cabecalho = (linha2) => [`📉 *Queda de Volume* ${hoje.dataBR}`, linha2, `Comparativo ${rotMes(m1)} → ${rotMes(m0)}`, ""];

    // ── Mensagens por RN ──
    const setores = [...new Set([...Object.keys(topPdv), ...Object.keys(topProd)])].sort();
    const rn = setores.map((s) => {
      const pdvs = topPdv[s] || [], prods = topProd[s] || [];
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

    // ── Mensagens por GV (agrega a sala; PDVs do dia; recalcula top) ──
    const gvTop = (setoresGV, agg, keyNome, soDia) => {
      const arr = Object.values(agg).filter((e) => setoresGV.includes(e.setor)).map((e) => ({ ...e, queda: e.v1 - e.v0 }))
        .filter((e) => e.queda > 0.001 && (!soDia || normDia(diaMap[e.cod_pdv] || "") === hoje.diaKey))
        .sort((a, b) => b.queda - a.queda).slice(0, TOP)
        .map((e) => ({ ...(e.cod_pdv ? { cod_pdv: e.cod_pdv } : {}), [keyNome]: e[keyNome], setor: e.setor, antes: hl(e.v1), agora: hl(e.v0), queda: hl(e.queda) }));
      return arr;
    };
    const gruposGV = {};
    setores.forEach((s) => { const p = String(s)[0]; (gruposGV[p] = gruposGV[p] || []).push(s); });
    const perfilDoPrefixo = { "1": "gv1", "3": "gv3" };
    const gv = Object.entries(gruposGV).map(([prefixo, sets]) => {
      const uGV = usuarios.find((u) => String(u.perfil || "").toLowerCase() === perfilDoPrefixo[prefixo] && String(u.telefone || "").trim());
      const nomeGV = uGV ? `GV ${uGV.nome}` : `GV ${prefixo}xx`;
      const pdvs = gvTop(sets, pdvAgg, "nome_pdv", true), prods = gvTop(sets, prodAgg, "nome_produto", false);
      const texto = [
        ...cabecalho(`Consolidado ${nomeGV} · Dia ${hoje.diaLabel}`),
        textoBloco("Top PDVs (visita hoje)", pdvs, "nome_pdv"), "",
        textoBloco("Top Produtos", prods, "nome_produto"),
      ].join("\n");
      const colPdvGV = [{ key: "cod_pdv", label: "Cód" }, { key: "setor", label: "Setor" }, { key: "nome_pdv", label: "PDV" }, { key: "queda", label: "Queda" }];
      const colProdGV = [{ key: "nome_produto", label: "Produto" }, { key: "setor", label: "Setor" }, { key: "queda", label: "Queda" }];
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

module.exports = router;
