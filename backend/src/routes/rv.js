const express = require("express");
const router = express.Router();
const axios = require("axios");
const { readSheet, appendRow, sobrescreverAba, cacheClearAll } = require("../services/sheets");
const { authMiddleware, adminOnly } = require("../middleware/auth");

const PROCESSOR_URL = process.env.PROCESSOR_URL;
const PROCESSOR_TOKEN = process.env.PROCESSOR_TOKEN;

router.use(authMiddleware);

const { filtrarPorPerfil } = require("../utils/perfil");
const rvf = require("../services/rvFechamento");

const mesAtualBR = () => {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

// Linhas de uma tabela de RV no mês: mês FECHADO → foto congelada; aberto → tabela viva.
async function linhasRv(tabela, mes, doMes) {
  const congelado = await rvf.lerCongelado(mes, tabela).catch(() => null);
  if (congelado) return congelado;
  const dados = await readSheet(tabela);
  return dados.filter(doMes);
}

const msgFechado = (st) =>
  `A RV de ${st.mes} está FECHADA (em ${new Date(st.fechado_em).toLocaleDateString("pt-BR")}` +
  `${st.fechado_por ? ` por ${st.fechado_por}` : ""}). Reabra o mês para alterar.`;

// GET /api/rv?mes=YYYY-MM — volumes/resultado do mês selecionado.
// rv_resultado agora ACUMULA meses; sem ?mes, usa o mês corrente (comportamento antigo).
router.get("/", async (req, res) => {
  try {
    const mes = req.query.mes || mesAtualBR();
    const filtrado = await linhasRv("rv_resultado", mes, (r) => String(r.mes_referencia) === mes);
    return res.json(filtrarPorPerfil(filtrado, req.user));
  } catch {
    return res.json([]);
  }
});

// GET /api/rv/pontos?mes=YYYY-MM (tabela acumula meses; sem ?mes = mês corrente)
router.get("/pontos", async (req, res) => {
  try {
    const mes = req.query.mes || mesAtualBR();
    const filtrado = await linhasRv("rv_pontos_bees", mes, (r) => !r.mes_referencia || String(r.mes_referencia) === mes);
    return res.json(filtrarPorPerfil(filtrado, req.user));
  } catch {
    return res.json([]);
  }
});

// GET /api/rv/ap (tabela acumula meses; sem ?mes = mês corrente)
router.get("/ap", async (req, res) => {
  try {
    const mes = req.query.mes || mesAtualBR();
    const filtrado = await linhasRv("rv_ap", mes, (r) => !r.mes_referencia || String(r.mes_referencia) === mes);
    return res.json(filtrarPorPerfil(filtrado, req.user));
  } catch {
    return res.json([]);
  }
});

// POST /api/rv/ap — salva atendimento produtivo
router.post("/ap", adminOnly, async (req, res) => {
  try {
    const { linhas } = req.body;
    if (!Array.isArray(linhas)) return res.status(400).json({ error: "Envie array de linhas." });

    const mesAp = String(linhas[0]?.mes_referencia || "").slice(0, 7);
    const stAp = mesAp ? await rvf.status(mesAp) : null;
    if (stAp) return res.status(409).json({ error: msgFechado(stAp) });

    const headers = ["setor","mes_referencia","tasks_compra_real","tasks_compra_meta","compradores_real","compradores_meta","rota_efetiva_real","rota_efetiva_meta","gps_real","gps_meta","ap_ok"];

    // Lê existentes, remove do mesmo mês, reinsere
    const todos = await readSheet("rv_ap");
    const mesRef = linhas[0]?.mes_referencia;
    const outros = todos.filter((r) => r.mes_referencia !== mesRef);
    const novos = [...outros, ...linhas];

    // Reconstrói a aba pelo encaixe único (services/sheets) — antes ia direto no
    // googleapis. sobrescreverAba usa RAW, então não converte "2026-04" em serial.
    const rows = [headers, ...novos.map((l) => headers.map((h) => l[h] ?? ""))];
    await sobrescreverAba("rv_ap", rows);

    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao salvar AP." });
  }
});

// GET /api/rv/relatorio — dados completos para o relatório PDF (admin + director)
router.get("/relatorio", async (req, res) => {
  if (!["admin","director"].includes(req.user?.perfil)) {
    return res.status(403).json({ error: "Acesso negado." });
  }
  try {
    // rv_resultado/rv_ap acumulam meses — filtra pelo mês pedido (default: corrente).
    const mes = req.query.mes || mesAtualBR();
    const doMes = (r) => !r.mes_referencia || String(r.mes_referencia) === mes;
    const [rvData, apData, usuarios, nomesCong] = await Promise.all([
      linhasRv("rv_resultado", mes, doMes),
      linhasRv("rv_ap", mes, doMes),
      readSheet("usuarios").catch(() => []),
      rvf.nomesCongelados(mes).catch(() => null),
    ]);

    // Mês fechado: usa os nomes do dia do fechamento (setor renomeado não "troca" de RN).
    const nomeMap = { ...(nomesCong || {}) };
    if (!nomesCong) usuarios.forEach(u => { if (u.cod) nomeMap[String(u.cod).trim()] = String(u.nome || "").trim(); });

    const apMap = {};
    apData.forEach(a => { if (a.setor) apMap[String(a.setor).trim()] = a; });

    const resultado = rvData
      .filter(r => r.setor)
      .sort((a, b) => String(a.setor).localeCompare(String(b.setor)))
      .map(r => ({
        ...r,
        nome_rn: nomeMap[String(r.setor).trim()] || `Setor ${r.setor}`,
        ap_detalhe: apMap[String(r.setor).trim()] || null,
      }));

    return res.json(resultado);
  } catch (err) {
    console.error("rv/relatorio:", err);
    return res.status(500).json({ error: "Erro ao gerar relatório." });
  }
});

// POST /api/rv/calcular { mes? } — recalcula a RV do mês informado (default: corrente)
router.post("/calcular", adminOnly, async (req, res) => {
  try {
    const mes = String(req.body?.mes || "").trim();
    const stCalc = await rvf.status(mes || mesAtualBR());
    if (stCalc) return res.status(409).json({ error: msgFechado(stCalc) });
    // 180s: o processador no plano grátis pode levar ~50s só pra acordar (cold start).
    const response = await axios.post(
      `${PROCESSOR_URL}/api/rv/calcular`,
      mes ? { mes } : {},
      { headers: { "X-Processor-Token": PROCESSOR_TOKEN }, timeout: 180000 }
    );
    // O processador reescreveu rv_resultado/rv_volume no SQL — limpa o cache de leitura
    // do backend p/ o simulador e a home refletirem na hora (senão espera o TTL).
    try { cacheClearAll(); } catch { /* no-op */ }
    return res.json(response.data);
  } catch (err) {
    console.error("rv/calcular:", err.message, "| body:", JSON.stringify(err.response?.data || "").slice(0, 200));
    const detalhe = err.response?.data?.error || (err.code === "ECONNABORTED" ? "tempo esgotado (processador acordando?) — tente de novo" : err.message);
    return res.status(500).json({ error: `Erro ao calcular RV: ${detalhe}` });
  }
});

// ─── Fechamento da RV ─────────────────────────────────────────────────────────
// GET /api/rv/fechamento?mes=YYYY-MM → { fechado, mes, fechado_em, fechado_por, linhas }
router.get("/fechamento", async (req, res) => {
  try {
    const mes = req.query.mes || mesAtualBR();
    const st = await rvf.status(mes);
    return res.json(st ? { fechado: true, ...st } : { fechado: false, mes });
  } catch (e) {
    console.error("rv/fechamento:", e);
    return res.json({ fechado: false });
  }
});

// GET /api/rv/fechamentos — meses fechados (admin/diretor)
router.get("/fechamentos", async (req, res) => {
  if (!["admin", "director"].includes(req.user?.perfil)) return res.status(403).json({ error: "Acesso negado." });
  try { return res.json(await rvf.listar()); } catch { return res.json([]); }
});

// POST /api/rv/fechar { mes, confirmacao } — confirmacao tem que ser igual ao mês (dupla checagem)
router.post("/fechar", adminOnly, async (req, res) => {
  try {
    const mes = String(req.body?.mes || "").trim();
    if (!rvf.mesValido(mes)) return res.status(400).json({ error: "Mês inválido." });
    if (String(req.body?.confirmacao || "").trim() !== mes) return res.status(400).json({ error: "Confirmação não confere com o mês." });
    const r = await rvf.fechar(mes, req.user?.nome);
    return res.json({ success: true, ...r });
  } catch (e) {
    console.error("rv/fechar:", e.message);
    return res.status(e.http || 500).json({ error: e.http ? e.message : "Erro ao fechar a RV." });
  }
});

// POST /api/rv/reabrir { mes, confirmacao } — descarta a foto; o mês volta a ser recalculável
router.post("/reabrir", adminOnly, async (req, res) => {
  try {
    const mes = String(req.body?.mes || "").trim();
    if (!rvf.mesValido(mes)) return res.status(400).json({ error: "Mês inválido." });
    if (String(req.body?.confirmacao || "").trim() !== mes) return res.status(400).json({ error: "Confirmação não confere com o mês." });
    const ok = await rvf.reabrir(mes);
    return ok ? res.json({ success: true }) : res.status(404).json({ error: "Esse mês não estava fechado." });
  } catch (e) {
    console.error("rv/reabrir:", e.message);
    return res.status(500).json({ error: "Erro ao reabrir a RV." });
  }
});

module.exports = router;
