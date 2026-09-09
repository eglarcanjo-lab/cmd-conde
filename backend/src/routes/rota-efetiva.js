// Rota Efetiva — produtividade de visitas + furos de cobertura.
// resumo: RE% e GPS% por setor/GV (rota_efetiva_resumo).
// furos: PDVs ativos (pdv_base) SEM visita efetiva no mês — separando "sem visita"
//        (não apareceu na rota) de "não validada" (planejada mas Efetiva≠1).
const express = require("express");
const router = express.Router();
const { readSheet } = require("../services/sheets");
const { authMiddleware } = require("../middleware/auth");
const { filtrarPorPerfil } = require("../utils/perfil");

const num = (v) => parseFloat(String(v ?? "0").replace(",", ".")) || 0;
const r1 = (n) => Math.round(n * 10) / 10;
const normCod = (v) => String(v ?? "").trim().replace(/^0+/, "") || "0";
const ROT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const rotMes = (m) => `${ROT[(Number(String(m).split("-")[1]) || 1) - 1]}/${String(m).slice(2, 4)}`;
const mesAtualBR = () => { const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };

router.use(authMiddleware);
router.use((req, res, next) => {
  if (["admin", "director", "gv1", "gv3"].includes(req.user?.perfil)) return next();
  return res.status(403).json({ error: "Acesso restrito a gestores." });
});

// GET /api/rota-efetiva/meses
router.get("/meses", async (req, res) => {
  try {
    const resumo = await readSheet("rota_efetiva_resumo").catch(() => []);
    const set = new Set();
    resumo.forEach((r) => { const m = String(r.mes_referencia || "").slice(0, 7); if (/^\d{4}-\d{2}$/.test(m)) set.add(m); });
    return res.json([...set].sort().reverse());
  } catch { return res.json([]); }
});

// GET /api/rota-efetiva/resumo?mes=YYYY-MM
router.get("/resumo", async (req, res) => {
  try {
    const mes = /^\d{4}-\d{2}$/.test(String(req.query.mes || "")) ? req.query.mes : mesAtualBR();
    const [resumoRaw, usuarios] = await Promise.all([
      readSheet("rota_efetiva_resumo").catch(() => []),
      readSheet("usuarios").catch(() => []),
    ]);
    const nomeSetor = {};
    usuarios.forEach((u) => { if (u.cod) nomeSetor[String(u.cod).trim()] = String(u.nome || "").trim(); });
    const doMes = resumoRaw.filter((r) => String(r.mes_referencia || "").slice(0, 7) === mes);
    const setores = filtrarPorPerfil(doMes.filter((r) => String(r.setor) !== "OPERACAO"), req.user, "setor")
      .map((r) => ({
        setor: String(r.setor).trim(), rn: nomeSetor[String(r.setor).trim()] || "",
        planejadas: Math.round(num(r.planejadas)), efetivas: Math.round(num(r.efetivas)),
        re_pct: r1(num(r.re_pct)), gps_pct: r1(num(r.gps_pct)), supervisitas: Math.round(num(r.supervisitas)),
      }))
      .sort((a, b) => b.re_pct - a.re_pct);

    // Consolidado do escopo (recalcula pra respeitar o perfil — não usa a linha OPERACAO)
    const tot = setores.reduce((a, s) => { a.plan += s.planejadas; a.ef += s.efetivas; a.gpsOk += s.gps_pct * s.planejadas / 100; a.sup += s.supervisitas; return a; }, { plan: 0, ef: 0, gpsOk: 0, sup: 0 });
    const consolidado = {
      planejadas: tot.plan, efetivas: tot.ef,
      re_pct: tot.plan ? r1(tot.ef / tot.plan * 100) : 0,
      gps_pct: tot.plan ? r1(tot.gpsOk / tot.plan * 100) : 0,
      supervisitas: tot.sup,
    };
    // % setores < 30% GPS (glossário)
    const setoresBaixoGps = setores.filter((s) => s.gps_pct < 30).length;
    return res.json({
      mes, mes_label: rotMes(mes),
      consolidado, setores,
      setores_baixo_gps: setoresBaixoGps,
      pct_setores_baixo_gps: setores.length ? r1(setoresBaixoGps / setores.length * 100) : 0,
    });
  } catch (e) { console.error("rota-efetiva/resumo:", e); return res.status(500).json({ error: "Erro ao montar resumo." }); }
});

// GET /api/rota-efetiva/furos?mes=YYYY-MM — PDVs ativos sem visita efetiva no mês
router.get("/furos", async (req, res) => {
  try {
    const mes = /^\d{4}-\d{2}$/.test(String(req.query.mes || "")) ? req.query.mes : mesAtualBR();
    const [pdvRaw, pdvBaseRaw, usuarios] = await Promise.all([
      readSheet("rota_efetiva_pdv").catch(() => []),
      readSheet("pdv_base").catch(() => []),
      readSheet("usuarios").catch(() => []),
    ]);
    const nomeSetor = {};
    usuarios.forEach((u) => { if (u.cod) nomeSetor[String(u.cod).trim()] = String(u.nome || "").trim(); });

    // Mapa cod_pdv -> {planejadas, efetivas, ult} no mês (escopo do perfil)
    const doMes = filtrarPorPerfil(pdvRaw.filter((r) => String(r.mes_referencia || "").slice(0, 7) === mes), req.user, "setor");
    const rota = {};
    doMes.forEach((r) => { rota[normCod(r.cod_pdv)] = { planejadas: Math.round(num(r.planejadas)), efetivas: Math.round(num(r.efetivas)), ult: String(r.ult_visita || "").trim() }; });

    const pdvBase = filtrarPorPerfil(pdvBaseRaw, req.user);
    const furos = [];
    let ok = 0, totalAtivos = 0;
    pdvBase.forEach((p) => {
      const cod = normCod(p.cod_pdv || p.cod);
      if (!cod || cod === "0") return;
      totalAtivos++;
      const r = rota[cod];
      if (r && r.efetivas > 0) { ok++; return; }
      furos.push({
        cod_pdv: cod, nome_pdv: String(p.nome_fantasia || p.nome || "").trim(),
        setor: String(p.setor || "").trim(), dia_visita: String(p.dia_visita || "").trim(),
        rn: nomeSetor[String(p.setor || "").trim()] || "",
        categoria: r ? "nao_validada" : "sem_visita",
        planejadas: r ? r.planejadas : 0,
      });
    });
    furos.sort((a, b) => String(a.setor).localeCompare(String(b.setor)) || a.nome_pdv.localeCompare(b.nome_pdv));

    return res.json({
      mes, mes_label: rotMes(mes),
      total_ativos: totalAtivos, visitados_ok: ok, furos_total: furos.length,
      cobertura_pct: totalAtivos ? r1(ok / totalAtivos * 100) : 0,
      sem_visita: furos.filter((f) => f.categoria === "sem_visita").length,
      nao_validada: furos.filter((f) => f.categoria === "nao_validada").length,
      furos,
    });
  } catch (e) { console.error("rota-efetiva/furos:", e); return res.status(500).json({ error: "Erro ao montar furos." }); }
});

module.exports = router;
