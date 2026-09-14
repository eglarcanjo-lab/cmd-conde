// Farol "PDVs sem visita registrada" — mesmo padrão do Conversão Pure Gold.
// Fonte: pdv_base (ativos) × rota_efetiva_pdv (visita efetiva no mês). Um PDV é
// "furo" quando não teve visita efetiva no mês (sem visita = nem apareceu na rota;
// não validada = planejada mas Efetiva≠1). Mensagem DIÁRIA por RN, filtrando os
// PDVs cujo dia de visita é o dia escolhido (hoje por padrão).
const express = require("express");
const router = express.Router();
const { readSheet } = require("../services/sheets");
const { authMiddleware } = require("../middleware/auth");
const { filtrarPorPerfil } = require("../utils/perfil");

const normCod = (v) => String(v ?? "").trim().replace(/^0+/, "") || "0";
const num = (v) => parseFloat(String(v ?? "0").replace(",", ".")) || 0;
const CAP = 40;

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
  return { dataBR, diaKey, diaLabel: DIA_LABEL[diaKey] || diaKey, mesAtual };
}

router.use(authMiddleware);

// PDVs ativos sem visita efetiva no mês, no escopo do usuário.
async function computeSemVisita(user, mesAtual) {
  const [pdvRaw, pdvBaseRaw, usuarios] = await Promise.all([
    readSheet("rota_efetiva_pdv").catch(() => []),
    readSheet("pdv_base").catch(() => []),
    readSheet("usuarios").catch(() => []),
  ]);
  const nomeSetor = {}, telSetor = {};
  usuarios.forEach((u) => { const c = String(u.cod || "").trim(); if (c) { nomeSetor[c] = String(u.nome || "").trim(); telSetor[c] = String(u.telefone || "").trim(); } });

  const doMes = filtrarPorPerfil(pdvRaw.filter((r) => String(r.mes_referencia || "").slice(0, 7) === mesAtual), user, "setor");
  const rota = {};
  doMes.forEach((r) => { rota[normCod(r.cod_pdv)] = { efetivas: Math.round(num(r.efetivas)) }; });

  const pdvBase = filtrarPorPerfil(pdvBaseRaw, user, "setor");
  const furos = [];
  pdvBase.forEach((p) => {
    const cod = normCod(p.cod_pdv || p.cod);
    if (!cod || cod === "0") return;
    const r = rota[cod];
    if (r && r.efetivas > 0) return; // visitado
    furos.push({
      cod_pdv: cod, nome_pdv: String(p.nome_fantasia || p.nome || "").trim(),
      setor: String(p.setor || "").trim(), dia_visita: String(p.dia_visita || "").trim(),
      situacao: r ? "não validada" : "sem visita",
    });
  });
  furos.sort((a, b) => String(a.setor).localeCompare(String(b.setor)) || a.nome_pdv.localeCompare(b.nome_pdv));
  return { furos, nomeSetor, telSetor };
}

function textoRN(setor, lista, hoje) {
  const linha = (p) => `• ${p.cod_pdv} ${p.nome_pdv} — ${p.situacao}`;
  const corpo = lista.length
    ? `PDVs (${lista.length}):\n${lista.slice(0, CAP).map(linha).join("\n")}${lista.length > CAP ? `\n… e mais ${lista.length - CAP}` : ""}`
    : "PDVs: nenhum hoje 👍";
  return [
    `🚦 *PDVs sem visita registrada* ${hoje.dataBR}`,
    `Setor ${setor}`,
    `Dia de visita ${hoje.diaLabel}`,
    "",
    "PDVs ativos ainda sem visita efetiva no mês, com visita prevista para hoje:",
    corpo,
  ].join("\n");
}

function textoGV(setores, nomeGV, porSetor, nomePorSetor, hoje) {
  const linhas = setores
    .map((s) => ({ s, n: (porSetor[s] || []).length }))
    .filter((x) => x.n)
    .sort((a, b) => b.n - a.n)
    .map((x) => `• ${x.s} ${nomePorSetor[x.s] || ""} — ${x.n}`.replace("  ", " "));
  const tot = setores.reduce((a, s) => a + (porSetor[s] || []).length, 0);
  return [
    `🚦 *PDVs sem visita registrada* ${hoje.dataBR}`,
    `Consolidado ${nomeGV || "GV"} · ${hoje.diaLabel}`,
    `Total sem visita hoje: *${tot}*`,
    "",
    "Por RN:",
    linhas.length ? linhas.join("\n") : "• (sem PDVs no dia de hoje)",
  ].join("\n");
}

// GET /api/farol-visita/mensagens?dia=SEG..SAB
router.get("/mensagens", async (req, res) => {
  try {
    const hoje = resolverDia(req.query.dia);
    const { furos, nomeSetor, telSetor } = await computeSemVisita(req.user, hoje.mesAtual);

    // Só os PDVs cujo dia de visita é o dia escolhido.
    const doDia = furos.filter((f) => normDia(f.dia_visita) === hoje.diaKey);
    const porSetor = {};
    doDia.forEach((f) => { (porSetor[f.setor] = porSetor[f.setor] || []).push(f); });
    const setores = Object.keys(porSetor).sort();

    const rn = setores.map((s) => ({
      setor: s, nome: nomeSetor[s] || "", telefone: telSetor[s] || "",
      texto: textoRN(s, porSetor[s], hoje),
      pdvs: porSetor[s].map((p) => ({ cod_pdv: p.cod_pdv, nome_pdv: p.nome_pdv, situacao: p.situacao })),
    }));

    // GV: agrupa por prefixo do setor (1xx = GV1, 3xx = GV3).
    const usuarios = await readSheet("usuarios").catch(() => []);
    const gruposGV = {};
    setores.forEach((s) => { const p = String(s)[0]; (gruposGV[p] = gruposGV[p] || []).push(s); });
    const perfilDoPrefixo = { "1": "gv1", "3": "gv3" };
    const gv = Object.entries(gruposGV).map(([prefixo, sets]) => {
      const uGV = usuarios.find((u) => String(u.perfil || "").toLowerCase() === perfilDoPrefixo[prefixo] && String(u.telefone || "").trim());
      const nomeGV = uGV ? `GV ${uGV.nome}` : `GV ${prefixo}xx`;
      return {
        grupo: `${prefixo}xx`, nome: uGV?.nome || "", telefone: String(uGV?.telefone || "").trim(),
        texto: textoGV(sets, nomeGV, porSetor, nomeSetor, hoje),
        total: sets.reduce((a, s) => a + (porSetor[s] || []).length, 0),
        linhas: sets.map((s) => ({ setor: s, nome: nomeSetor[s] || "", pg: (porSetor[s] || []).length })).filter((x) => x.pg).sort((a, b) => b.pg - a.pg),
      };
    });

    // ── Diretoria: consolidado (operação + por RN + detalhe). Vai p/ perfil=director. ──
    const diretores = usuarios.filter((u) => String(u.perfil || "").toLowerCase() === "director" && String(u.telefone || "").trim());
    let director = null;
    if (diretores.length && doDia.length) {
      const totalOp = doDia.length;
      const resumoRn = setores
        .map((s) => ({ setor: s, rn: nomeSetor[s] || "", qtd: (porSetor[s] || []).length }))
        .filter((x) => x.qtd).sort((a, b) => b.qtd - a.qtd);
      const linhasResumo = [...resumoRn, { setor: "", rn: "OPERAÇÃO", qtd: totalOp }];
      const detalhe = doDia.map((f) => ({ setor: f.setor, cod_pdv: f.cod_pdv, nome_pdv: f.nome_pdv, situacao: f.situacao }));
      const colResumo = [{ key: "setor", label: "Setor" }, { key: "rn", label: "RN" }, { key: "qtd", label: "PDVs s/ visita" }];
      const colDetalhe = [{ key: "setor", label: "Setor" }, { key: "cod_pdv", label: "Cód" }, { key: "nome_pdv", label: "PDV" }, { key: "situacao", label: "Situação" }];
      director = {
        texto: [
          `🚦 *PDVs sem visita registrada* ${hoje.dataBR}`,
          `Consolidado Diretoria · ${hoje.diaLabel}`,
          `Total sem visita hoje: *${totalOp}*`, "", "Por RN:",
          resumoRn.length ? resumoRn.map((x) => `• ${x.setor} ${x.rn} — ${x.qtd}`).join("\n") : "• (sem PDVs hoje)",
        ].join("\n"),
        blocos: [
          { titulo: "Sem visita · por RN", subtitulo: `${hoje.diaLabel} · total ${totalOp}`, colunas: colResumo, linhas: linhasResumo },
          { titulo: "Sem visita · detalhe", subtitulo: `PDVs sem visita hoje (${totalOp})`, colunas: colDetalhe, linhas: detalhe },
        ],
        destinatarios: diretores.map((u) => ({ nome: String(u.nome || "").trim() || "Diretoria", telefone: String(u.telefone).trim() })),
      };
    }

    return res.json({
      data: hoje.dataBR, dia: hoje.diaLabel,
      titulo: "PDVs sem visita registrada", emoji: "🚦",
      colunas: [{ key: "cod_pdv", label: "Cód" }, { key: "nome_pdv", label: "PDV" }, { key: "situacao", label: "Situação" }],
      rn, gv, director,
    });
  } catch (e) {
    console.error("farol-visita/mensagens:", e);
    return res.status(500).json({ error: "Erro ao gerar mensagens de visita." });
  }
});

module.exports = router;
