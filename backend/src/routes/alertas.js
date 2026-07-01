const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth");
const alertas = require("../services/alertas");

router.use(authMiddleware);
router.use((req, res, next) => {
  if (req.user?.perfil !== "admin") return res.status(403).json({ error: "Acesso restrito ao admin." });
  next();
});

// GET /api/alertas — estado (config + lista + se o Brevo está configurado)
router.get("/", async (req, res) => {
  try {
    const [config, destinatarios] = await Promise.all([alertas.getConfig(), alertas.listarDestinatarios()]);
    res.json({
      config, destinatarios,
      brevoOk: !!process.env.BREVO_API_KEY,
      remetente: process.env.ALERTA_FROM || null,
    });
  } catch (e) { console.error("alertas GET:", e); res.status(500).json({ error: e.message }); }
});

// GET /api/alertas/preview — o que seria alertado agora (sem enviar)
router.get("/preview", async (req, res) => {
  try { res.json(await alertas.computar()); }
  catch (e) { console.error("alertas preview:", e); res.status(500).json({ error: e.message }); }
});

router.post("/destinatarios", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: "E-mail inválido." });
    await alertas.addDestinatario(email);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete("/destinatarios", async (req, res) => {
  try {
    await alertas.removerDestinatario(String(req.body?.email || req.query?.email || "").trim().toLowerCase());
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/toggle", async (req, res) => {
  try { await alertas.setAtivo(!!req.body?.ativo); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/alertas/rodar { teste } — dispara agora. teste=true ignora o dedupe.
router.post("/rodar", async (req, res) => {
  try { res.json(await alertas.rodar({ forcar: !!req.body?.teste })); }
  catch (e) { console.error("alertas rodar:", e); res.status(500).json({ error: e.message }); }
});

module.exports = router;
