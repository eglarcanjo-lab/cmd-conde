// Verifica se o sistema está em janela de manutenção
function maintenanceMiddleware(req, res, next) {
  // Rotas que nunca ficam em manutenção
  const exemptRoutes = ["/health", "/api/status"];
  if (exemptRoutes.includes(req.path)) return next();

  const now = new Date();
  const brazilTime = new Date(
    now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
  );

  const currentMinutes =
    brazilTime.getHours() * 60 + brazilTime.getMinutes();

  const [startH, startM] = (process.env.MAINTENANCE_START || "05:00")
    .split(":")
    .map(Number);
  const [endH, endM] = (process.env.MAINTENANCE_END || "06:00")
    .split(":")
    .map(Number);

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

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
