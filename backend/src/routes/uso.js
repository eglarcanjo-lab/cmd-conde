// Uso / engajamento — registra quantas vezes cada usuário abre o app (por dia)
// e gera um relatório para o admin. Agrega por (cod, dia) para não inchar a planilha.
const express = require("express");
const router = express.Router();
const { readSheet, appendRow, updateRow, ensureTab } = require("../services/sheets");
const { authMiddleware, adminOnly } = require("../middleware/auth");

router.use(authMiddleware);

const COLS = ["cod", "nome", "perfil", "data", "aberturas", "ultimo_acesso"];

function agoraBR() {
  const now = new Date();
  const br = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const dd = String(br.getDate()).padStart(2, "0");
  const mm = String(br.getMonth() + 1).padStart(2, "0");
  const data = `${dd}/${mm}/${br.getFullYear()}`;
  const hora = `${String(br.getHours()).padStart(2, "0")}:${String(br.getMinutes()).padStart(2, "0")}`;
  return { data, hora, mes: `${br.getFullYear()}-${mm}` };
}
const mesDe = (dataBR) => {
  const p = String(dataBR || "").split("/");
  return p.length === 3 ? `${p[2]}-${p[1]}` : "";
};

// POST /api/uso/registrar — soma +1 abertura no dia de hoje para o usuário logado
router.post("/registrar", async (req, res) => {
  try {
    await ensureTab("uso_app");
    const { data, hora } = agoraBR();
    const cod = String(req.user.cod || "").trim();
    const todos = await readSheet("uso_app").catch(() => []);
    const idx = todos.findIndex((r) => String(r.cod) === cod && String(r.data) === data);
    if (idx === -1) {
      await appendRow("uso_app", [cod, req.user.nome || "", req.user.perfil || "", data, "1", hora]);
    } else {
      const n = (parseInt(todos[idx].aberturas) || 0) + 1;
      await updateRow("uso_app", idx + 1, [cod, todos[idx].nome || req.user.nome || "", todos[idx].perfil || req.user.perfil || "", data, String(n), hora]);
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error("uso/registrar:", err);
    return res.json({ ok: false }); // silencioso, não atrapalha o app
  }
});

// POST /api/uso/telas — soma visitas por tela no mês (recebe um lote {tela: n})
// Agrega num único JSON por usuário/mês (1 linha) — não incha a planilha.
router.post("/telas", async (req, res) => {
  try {
    const telas = req.body?.telas;
    if (!telas || typeof telas !== "object" || !Object.keys(telas).length) return res.json({ ok: true });
    await ensureTab("uso_telas");
    const { mes, hora } = agoraBR();
    const cod = String(req.user.cod || "").trim();
    const todos = await readSheet("uso_telas").catch(() => []);
    const idx = todos.findIndex((r) => String(r.cod) === cod && String(r.mes) === mes);
    let mapa = {};
    if (idx !== -1) { try { mapa = JSON.parse(todos[idx].telas_json || "{}"); } catch { mapa = {}; } }
    Object.entries(telas).forEach(([t, n]) => { mapa[t] = (mapa[t] || 0) + (parseInt(n) || 0); });
    const row = [cod, req.user.nome || "", mes, JSON.stringify(mapa), hora];
    if (idx === -1) await appendRow("uso_telas", row);
    else await updateRow("uso_telas", idx + 1, row);
    return res.json({ ok: true });
  } catch (err) {
    console.error("uso/telas:", err);
    return res.json({ ok: false });
  }
});

// GET /api/uso/relatorio?mes=YYYY-MM&perfil=rn — relatório de engajamento (admin)
router.get("/relatorio", adminOnly, async (req, res) => {
  try {
    await ensureTab("uso_app");
    const mes = String(req.query.mes || agoraBR().mes).trim();
    const soPerfil = String(req.query.perfil || "rn").trim().toLowerCase(); // rn | todos

    const [usoRaw, usuarios, telasRaw] = await Promise.all([
      readSheet("uso_app").catch(() => []),
      readSheet("usuarios").catch(() => []),
      readSheet("uso_telas").catch(() => []),
    ]);

    const uso = usoRaw.filter((r) => mesDe(r.data) === mes);

    // Perfil por cod (para filtrar as telas por RN)
    const perfilDe = {};
    usuarios.forEach((u) => { perfilDe[String(u.cod).trim()] = String(u.perfil || "").toLowerCase(); });

    // Agrega visitas por tela no mês (do uso_telas)
    const porTelaMap = {};
    telasRaw.filter((r) => String(r.mes) === mes).forEach((r) => {
      if (soPerfil !== "todos" && perfilDe[String(r.cod).trim()] !== soPerfil) return;
      let mapa = {};
      try { mapa = JSON.parse(r.telas_json || "{}"); } catch { mapa = {}; }
      Object.entries(mapa).forEach(([t, n]) => {
        if (!porTelaMap[t]) porTelaMap[t] = { tela: t, visitas: 0, usuarios: new Set() };
        porTelaMap[t].visitas += parseInt(n) || 0;
        porTelaMap[t].usuarios.add(String(r.cod));
      });
    });
    const porTela = Object.values(porTelaMap)
      .map((x) => ({ tela: x.tela, visitas: x.visitas, usuarios: x.usuarios.size }))
      .sort((a, b) => b.visitas - a.visitas);

    // Agrega por cod no mês
    const agg = {};
    uso.forEach((r) => {
      const cod = String(r.cod || "").trim();
      if (!agg[cod]) agg[cod] = { cod, nome: r.nome, perfil: r.perfil, aberturas: 0, dias: new Set(), ultimo: "" };
      agg[cod].aberturas += parseInt(r.aberturas) || 0;
      agg[cod].dias.add(String(r.data));
      const carimbo = `${r.data} ${r.ultimo_acesso || ""}`.trim();
      if (carimbo > agg[cod].ultimo) agg[cod].ultimo = carimbo;
    });

    // Universo de usuários alvo (inclui quem NUNCA acessou)
    const alvo = usuarios.filter((u) => {
      if (String(u.ativo).toLowerCase() !== "true") return false;
      if (soPerfil === "todos") return true;
      return String(u.perfil || "").toLowerCase() === soPerfil;
    });

    const linhas = alvo.map((u) => {
      const cod = String(u.cod || "").trim();
      const a = agg[cod];
      return {
        cod,
        nome: u.nome || (a && a.nome) || "",
        perfil: u.perfil || "",
        aberturas: a ? a.aberturas : 0,
        dias_ativos: a ? a.dias.size : 0,
        ultimo_acesso: a ? a.ultimo : "",
      };
    }).sort((x, y) => y.aberturas - x.aberturas);

    const totalAberturas = linhas.reduce((s, l) => s + l.aberturas, 0);
    const acessaram = linhas.filter((l) => l.aberturas > 0).length;

    return res.json({
      mes,
      perfil: soPerfil,
      total_usuarios: linhas.length,
      acessaram,
      nao_acessaram: linhas.length - acessaram,
      total_aberturas: totalAberturas,
      media_por_usuario: linhas.length ? Math.round((totalAberturas / linhas.length) * 10) / 10 : 0,
      linhas,
      por_tela: porTela,
    });
  } catch (err) {
    console.error("uso/relatorio:", err);
    return res.status(500).json({ error: "Erro ao gerar o relatório de uso." });
  }
});

module.exports = router;
