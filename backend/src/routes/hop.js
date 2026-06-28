// Hop — assistente. /insights = destaques automáticos (sem IA).
// /chat = perguntas livres via IA (Google Gemini, tier grátis).
const express = require("express");
const router = express.Router();
const axios = require("axios");
const { readSheet } = require("../services/sheets");
const { authMiddleware } = require("../middleware/auth");

const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const HOP_MODEL = process.env.HOP_MODEL || "gemini-2.0-flash";

router.use(authMiddleware);

const { SET_OFF, podeVer } = require("../utils/visibilidade");

function normCod(v) { const s = String(v || "").trim(); return s.replace(/^0+/, "") || s; }
function isTrue(v) { const s = String(v).trim().toLowerCase(); return s === "true" || s === "1" || s === "sim"; }
function parseDataISO(s) {
  if (!s || !/^\d{4}-\d{2}-\d{2}/.test(String(s))) return null;
  const [y, m, d] = String(s).slice(0, 10).split("-");
  const dt = new Date(Number(y), Number(m) - 1, Number(d));
  return isNaN(dt.getTime()) ? null : dt;
}
function parseDataBR(s) {
  if (!s || !String(s).includes("/")) return null;
  const [dd, mm, yyyy] = String(s).split("/");
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  return isNaN(d.getTime()) ? null : d;
}
function hojeBR() {
  const now = new Date();
  const br = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return new Date(br.getFullYear(), br.getMonth(), br.getDate());
}
function dataStr(d) {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}
// podeVer agora vem de utils/visibilidade

// GET /api/hop/insights — destaques personalizados para o usuário logado
router.get("/insights", async (req, res) => {
  const user = req.user;
  const setor = String(user.cod || "").trim();
  const primeiroNome = String(user.nome || "").trim().split(" ")[0] || "RN";
  const insights = [];

  // Lê tudo que precisa em paralelo (tolerante a falhas)
  const [volumeDiario, rvAp, incentivos, incResultados, tasks, usuarios] = await Promise.all([
    readSheet("volume_diario").catch(() => []),
    readSheet("rv_ap").catch(() => []),
    readSheet("incentivos").catch(() => []),
    readSheet("incentivos_resultados").catch(() => []),
    readSheet("tasks").catch(() => []),
    readSheet("usuarios").catch(() => []),
  ]);

  const nomeMap = {};
  usuarios.forEach((u) => { if (u.cod) nomeMap[String(u.cod).trim()] = String(u.nome || "").trim(); });

  const hoje = hojeBR();
  const hojeStr = dataStr(hoje);
  const mesRef = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;

  // ── 1) Volume de hoje (RN) ───────────────────────────────────────────────
  try {
    if (setor) {
      const volHoje = volumeDiario
        .filter((r) => String(r.setor || "").trim() === setor && r.data === hojeStr)
        .reduce((s, r) => s + (parseFloat(r.volume_hl) || 0), 0);
      if (volHoje > 0) {
        insights.push({
          tipo: "destaque", icone: "🍺",
          titulo: "Volume de hoje",
          texto: `Você já movimentou ${volHoje.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} HL hoje. Bora subir esse número! 💚`,
        });
      }
    }
  } catch { /* ignora */ }

  // ── 2) Atendimento Produtivo (gate da RV) ────────────────────────────────
  try {
    const ap = rvAp.find((r) => String(r.setor || "").trim() === setor);
    if (ap) {
      const apOk = String(ap.ap_ok || "").trim().toUpperCase() === "OK";
      if (apOk) {
        insights.push({ tipo: "destaque", icone: "✅", titulo: "Atendimento Produtivo OK", texto: "Seu AP está em dia — sua RV está liberada. Mandou bem! 👏" });
      } else {
        insights.push({ tipo: "alerta", icone: "⚠️", titulo: "Atenção: AP NOK", texto: "Seu Atendimento Produtivo está NOK e isso bloqueia sua RV. Corre pra regularizar os indicadores!" });
      }
    }
  } catch { /* ignora */ }

  // ── 3) Incentivos: sua posição no ranking ────────────────────────────────
  try {
    const ativos = incentivos.filter((i) => {
      if (!isTrue(i.ativo)) return false;
      const ini = parseDataISO(i.data_inicio), fim = parseDataISO(i.data_fim);
      if (ini && hoje < ini) return false;
      if (fim && hoje > fim) return false;
      return podeVer(user, i.publico_alvo);
    });

    for (const inc of ativos) {
      let ranking = [];
      const tipo = String(inc.tipo || "").trim().toLowerCase();
      if (tipo === "volume_sku") {
        const skuAlvo = normCod(inc.sku_codigo);
        const ini = parseDataISO(inc.data_inicio), fim = parseDataISO(inc.data_fim);
        const acc = {};
        volumeDiario.forEach((r) => {
          if (normCod(r.cod_produto) !== skuAlvo) return;
          const d = parseDataBR(r.data);
          if (ini && d && d < ini) return;
          if (fim && d && d > fim) return;
          const s = String(r.setor || "").trim();
          if (s) acc[s] = (acc[s] || 0) + (parseFloat(r.volume_hl) || 0);
        });
        ranking = Object.entries(acc).map(([s, v]) => ({ setor: s, valor: v })).sort((a, b) => b.valor - a.valor);
      } else {
        ranking = incResultados
          .filter((r) => String(r.id_incentivo).trim() === String(inc.id).trim())
          .map((r) => ({ setor: String(r.setor || "").trim(), valor: parseFloat(String(r.valor || "0").replace(",", ".")) || 0 }))
          .sort((a, b) => b.valor - a.valor);
      }
      const idx = ranking.findIndex((r) => r.setor === setor);
      if (idx >= 0) {
        const pos = idx + 1;
        const medalha = pos === 1 ? "🥇" : pos === 2 ? "🥈" : pos === 3 ? "🥉" : "🏆";
        const top = pos <= 3;
        const premioTop = inc.premio ? `Prêmio: ${inc.premio}. ` : "";
        const premioSub = inc.premio ? `o prêmio é ${inc.premio}. ` : "";
        const texto = top
          ? `Você está em ${pos}º lugar! Tá voando. ${premioTop}Segura essa posição! 🚀`
          : `Você está em ${pos}º lugar de ${ranking.length}. Dá pra subir — ${premioSub}bora! 💪`;
        insights.push({
          tipo: top ? "destaque" : "info", icone: medalha,
          titulo: `Incentivo: ${inc.titulo}`,
          texto,
        });
      }
    }
  } catch { /* ignora */ }

  // ── 4) Tasks em aberto ────────────────────────────────────────────────────
  try {
    if (setor) {
      const minhas = tasks.filter((t) => String(t.setor || "").trim() === setor);
      const abertas = minhas.filter((t) => String(t.status || "").trim().toUpperCase() !== "VALID").length;
      if (abertas > 0) {
        insights.push({
          tipo: "info", icone: "✅",
          titulo: "Tasks em aberto",
          texto: `Você tem ${abertas} task${abertas > 1 ? "s" : ""} pra fechar. Cada uma validada vira ponto pra você. 😉`,
        });
      }
    }
  } catch { /* ignora */ }

  // Ordena: alertas primeiro, depois destaques, depois info
  const ordem = { alerta: 0, destaque: 1, info: 2 };
  insights.sort((a, b) => (ordem[a.tipo] ?? 9) - (ordem[b.tipo] ?? 9));

  const saudacao = insights.length > 0
    ? `Olá, ${primeiroNome}! 👋 Dei uma olhada nos seus números — aqui vão seus destaques:`
    : `Olá, ${primeiroNome}! 👋 Por enquanto não tenho destaques novos. Assim que rolar movimento, eu te aviso por aqui! 💚`;

  return res.json({ saudacao, insights, mes_referencia: mesRef });
});

// POST /api/hop/chat — pergunta livre, respondida pela IA com base nos dados do RN
router.post("/chat", async (req, res) => {
  const user = req.user;
  const setor = String(user.cod || "").trim();
  const pergunta = String(req.body?.pergunta || "").trim();
  if (!pergunta) return res.status(400).json({ error: "Pergunta vazia." });

  if (!GEMINI_KEY) {
    return res.json({
      resposta: "O chat com IA ainda não está ligado (falta configurar a chave). Por enquanto, toque no balão pra ver seus destaques automáticos! 💚",
      sem_chave: true,
    });
  }

  try {
    // ── Monta o contexto de dados do RN ──────────────────────────────────────
    const [vendas, rvAp, tasks, volumeDiario, pdvBase] = await Promise.all([
      readSheet("vendas_cliente_produto").catch(() => []),
      readSheet("rv_ap").catch(() => []),
      readSheet("tasks").catch(() => []),
      readSheet("volume_diario").catch(() => []),
      readSheet("pdv_base").catch(() => []),
    ]);
    const doSetor = (r) => String(r.setor || "").trim() === setor;

    // Vendas do mês (cliente x produto)
    const minhasVendas = vendas.filter(doSetor).slice(0, 1500);
    let tabela = "PDV(cliente)\tProduto\tVolume(HL)\n";
    minhasVendas.forEach((r) => {
      tabela += `${r.nome_pdv || r.cod_pdv}\t${r.nome_produto || r.cod_produto}\t${r.volume_hl}\n`;
    });

    // AP / volume
    const ap = rvAp.find(doSetor);
    const apTxt = ap ? (String(ap.ap_ok).toUpperCase() === "OK" ? "OK (RV liberada)" : "NOK (RV bloqueada)") : "sem dado";
    const hoje = hojeBR();
    const hojeStr = dataStr(hoje);
    const volHoje = volumeDiario
      .filter((r) => doSetor(r) && r.data === hojeStr)
      .reduce((s, r) => s + (parseFloat(r.volume_hl) || 0), 0);
    const mesNome = hoje.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
    const diasSemana = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
    const codSemana  = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];
    const dow = new Date(hoje.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })).getDay();

    // Tasks em aberto (status != VALID) — agregados por categoria/cluster/tipo
    const tasksAbertas = tasks.filter((t) => doSetor(t) && String(t.status || "").toUpperCase() !== "VALID");
    const contarPor = (arr, campo) => {
      const m = {};
      arr.forEach((t) => { const k = String(t[campo] || "").trim() || "(sem)"; m[k] = (m[k] || 0) + 1; });
      return Object.entries(m).sort((a, b) => b[1] - a[1]);
    };
    const fmtCont = (pares, max = 25) => pares.slice(0, max).map(([k, v]) => `${k}: ${v}`).join(" · ") || "—";
    const tasksHoje = tasksAbertas.filter((t) => t.data_visita === hojeStr);

    // PDVs do RN (dia de visita, segmento, dias sem compra)
    const meusPdvs = pdvBase.filter(doSetor);
    let tabelaPdv = "Cliente\tDiaVisita\tSegmento\tDiasSemCompra\n";
    meusPdvs.slice(0, 700).forEach((p) => {
      tabelaPdv += `${p.nome_fantasia || p.cod_pdv}\t${p.dia_visita || "?"}\t${p.segmento || ""}\t${p.dias_sem_compra ?? ""}\n`;
    });
    const visitasHoje = meusPdvs.filter((p) => String(p.visita_hoje) === "1" || String(p.dia_visita || "").toUpperCase() === codSemana[dow]);

    const prompt = [
      "Você é a Hop, assistente de resultados do app \"Hop Follow-up\", falando com um RN (vendedor) de cervejaria.",
      "Responda em português do Brasil, de forma CURTA, amigável e direta. No máximo 4 linhas.",
      "Baseie-se SOMENTE nos dados abaixo. Se a informação não estiver nos dados, diga que ainda não tem esse dado (não invente).",
      "Volumes estão em HL. 'Tasks' são tarefas de execução no PDV. Pode usar emoji 💚🍺🏆 quando fizer sentido.",
      "",
      `RN: ${user.nome} — Setor ${setor}. Hoje é ${diasSemana[dow]}, ${hojeStr}. Mês de referência: ${mesNome}.`,
      `Atendimento Produtivo (AP): ${apTxt}. Volume de hoje: ${volHoje.toFixed(1)} HL.`,
      "",
      `TASKS EM ABERTO: ${tasksAbertas.length} no total · ${tasksHoje.length} com visita hoje.`,
      `Tasks abertas por categoria: ${fmtCont(contarPor(tasksAbertas, "categoria"))}`,
      `Tasks abertas por cluster: ${fmtCont(contarPor(tasksAbertas, "cluster_primario"))}`,
      `Tasks abertas por tipo: ${fmtCont(contarPor(tasksAbertas, "tipo"))}`,
      `Tasks de HOJE por categoria: ${fmtCont(contarPor(tasksHoje, "categoria"))}`,
      "",
      `MEUS PDVs (${meusPdvs.length}; ${visitasHoje.length} com visita hoje) — Cliente, dia de visita, segmento, dias sem compra:`,
      tabelaPdv.slice(0, 30000),
      "",
      `VENDAS DO MÊS por cliente x produto (${minhasVendas.length} registros):`,
      tabela.slice(0, 70000),
      "",
      `PERGUNTA DO RN: ${pergunta}`,
      "RESPOSTA DA HOP:",
    ].join("\n");

    // Tenta vários modelos. Cada modelo tem cota PRÓPRIA no tier grátis — então em
    // caso de "quota exceeded" (429) seguimos para o próximo (não desistimos).
    // Os "-lite" têm limites grátis mais altos; deixados como rede de segurança.
    const modelos = [...new Set([HOP_MODEL,
      "gemini-2.0-flash", "gemini-2.5-flash",
      "gemini-2.5-flash-lite", "gemini-2.0-flash-lite",
      "gemini-flash-latest", "gemini-1.5-flash"].filter(Boolean))];
    let resposta = null;
    let ultimoErro = "";
    let quota = false;
    for (const modelo of modelos) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${GEMINI_KEY}`;
        const r = await axios.post(url, {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
        }, { timeout: 30000 });
        const txt = r.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (txt) { resposta = txt; break; }
        ultimoErro = `${modelo}: sem texto (finishReason=${r.data?.candidates?.[0]?.finishReason || "?"})`;
      } catch (e) {
        const code = e.response?.status;
        ultimoErro = `${modelo}: ${e.response?.data?.error?.message || e.message}`;
        if (code === 429) { quota = true; continue; }      // cota do modelo: tenta o próximo
        if ([400, 401, 403].includes(code)) break;          // chave/permissão: não adianta trocar
      }
    }

    if (resposta) return res.json({ resposta });
    console.error("hop/chat:", ultimoErro);
    if (quota) {
      return res.status(429).json({ error: "A Hop usou todo o limite grátis da IA por agora 😅 O limite renova sozinho — tenta de novo daqui a pouco (ou amanhã)! 💚" });
    }
    return res.status(500).json({ error: `A Hop teve um problema pra pensar agora 💚 (${String(ultimoErro).slice(0, 150)})` });
  } catch (err) {
    console.error("hop/chat:", err.response?.data || err.message);
    return res.status(500).json({ error: `A Hop teve um problema 💚 (${String(err.message).slice(0, 120)})` });
  }
});

module.exports = router;
