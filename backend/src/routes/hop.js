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

const SET_OFF = new Set(["101", "102", "103"]);

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
function podeVer(user, alvo) {
  const perfil = String(user.perfil || "").toLowerCase();
  if (["admin", "director", "gv1", "gv3"].includes(perfil)) return true;
  const cod = String(user.cod || "").trim();
  const a = String(alvo || "todos").trim().toLowerCase();
  if (a === "" || a === "todos") return true;
  if (a === "off") return SET_OFF.has(cod);
  if (a === "on") return !SET_OFF.has(cod);
  return a.split(",").map((s) => s.trim()).includes(cod);
}

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
    const [vendas, rvAp, tasks, volumeDiario] = await Promise.all([
      readSheet("vendas_cliente_produto").catch(() => []),
      readSheet("rv_ap").catch(() => []),
      readSheet("tasks").catch(() => []),
      readSheet("volume_diario").catch(() => []),
    ]);

    const minhasVendas = vendas
      .filter((r) => String(r.setor || "").trim() === setor)
      .slice(0, 4000);

    let tabela = "PDV (cliente)\tProduto\tVolume(HL)\n";
    minhasVendas.forEach((r) => {
      tabela += `${r.nome_pdv || r.cod_pdv}\t${r.nome_produto || r.cod_produto}\t${r.volume_hl}\n`;
    });

    const ap = rvAp.find((r) => String(r.setor || "").trim() === setor);
    const apTxt = ap ? (String(ap.ap_ok).toUpperCase() === "OK" ? "OK (RV liberada)" : "NOK (RV bloqueada)") : "sem dado";
    const tasksAbertas = tasks.filter((t) => String(t.setor || "").trim() === setor && String(t.status || "").toUpperCase() !== "VALID").length;

    const hoje = hojeBR();
    const volHoje = volumeDiario
      .filter((r) => String(r.setor || "").trim() === setor && r.data === dataStr(hoje))
      .reduce((s, r) => s + (parseFloat(r.volume_hl) || 0), 0);

    const mesNome = hoje.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });

    const prompt = [
      "Você é a Hop, assistente de resultados do app \"Hop Follow-up\", falando com um RN (vendedor) de cervejaria.",
      "Responda em português do Brasil, de forma CURTA, amigável e direta. Use no máximo 4 linhas.",
      "Baseie-se SOMENTE nos dados abaixo. Se a informação não estiver nos dados, diga que ainda não tem esse dado (não invente).",
      "Volumes estão em HL (hectolitros). Pode usar um emoji 💚🍺🏆 quando fizer sentido.",
      "",
      `RN: ${user.nome} — Setor ${setor}. Mês de referência: ${mesNome}.`,
      `Atendimento Produtivo (AP): ${apTxt}. Tasks em aberto: ${tasksAbertas}. Volume de hoje: ${volHoje.toFixed(1)} HL.`,
      "",
      `VENDAS DO MÊS por cliente x produto (${minhasVendas.length} registros):`,
      tabela.slice(0, 120000), // hard cap de segurança
      "",
      `PERGUNTA DO RN: ${pergunta}`,
      "RESPOSTA DA HOP:",
    ].join("\n");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${HOP_MODEL}:generateContent?key=${GEMINI_KEY}`;
    const r = await axios.post(url, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 600 },
    }, { timeout: 30000 });

    const resposta = r.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
      || "Não consegui formular uma resposta agora. Tenta reformular a pergunta? 💚";
    return res.json({ resposta });
  } catch (err) {
    console.error("hop/chat:", err.response?.data || err.message);
    return res.status(500).json({ error: "A Hop teve um problema pra pensar agora. Tenta de novo em instantes! 💚" });
  }
});

module.exports = router;
