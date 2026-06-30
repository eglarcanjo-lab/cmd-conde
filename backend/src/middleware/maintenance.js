const jwt = require("jsonwebtoken");
const { getEstado } = require("../services/configuracoes");

function maintenanceMiddleware(req, res, next) {
  // Rotas sempre isentas — admin precisa conseguir logar e desligar a manutenção
  const exemptPrefixes = ["/health", "/api/status", "/api/manutencao", "/api/auth", "/api/admin"];
  if (exemptPrefixes.some((p) => req.path === p || req.path.startsWith(p + "/"))) return next();

  // Admin tem acesso TOTAL mesmo em manutenção (o frontend já libera a tela do admin;
  // aqui liberamos também as rotas de dados, senão o admin via tudo vazio em manutenção).
  try {
    const auth = req.headers.authorization;
    if (auth && auth.startsWith("Bearer ")) {
      const decoded = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
      if (decoded && decoded.perfil === "admin") return next();
    }
  } catch (e) { /* token inválido/ausente → segue o fluxo normal de manutenção */ }

  // 1) Manutenção manual (toggle do admin)
  const { ativo, mensagem } = getEstado();
  if (ativo) {
    return res.status(503).json({ maintenance: true, message: mensagem });
  }

  // 2) Janela de manutenção por horário (env vars)
  const now = new Date();
  const brazilTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const currentMinutes = brazilTime.getHours() * 60 + brazilTime.getMinutes();

  const [startH, startM] = (process.env.MAINTENANCE_START || "05:00").split(":").map(Number);
  const [endH, endM]     = (process.env.MAINTENANCE_END   || "06:00").split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes   = endH   * 60 + endM;

  if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
    return res.status(503).json({
      maintenance: true,
      message: "Sistema em atualização de dados. Retorne em breve.",
      start: process.env.MAINTENANCE_START,
      end: process.env.MAINTENANCE_END,
    });
  }

  next();
}

module.exports = { maintenanceMiddleware };
