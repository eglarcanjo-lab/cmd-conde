require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { initializeSheets } = require("./services/sheets");
const { maintenanceMiddleware } = require("./middleware/maintenance");

const app = express();
const PORT = process.env.PORT || 3001;

// ─── MIDDLEWARES ─────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || "http://localhost:5173",
    /\.vercel\.app$/,
  ],
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(maintenanceMiddleware);

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get("/health", (req, res) => res.json({ status: "ok" }));

app.get("/api/status", (req, res) => {
  const now = new Date();
  const brazilTime = new Date(
    now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
  );
  return res.json({
    status: "online",
    serverTime: brazilTime.toISOString(),
    maintenance: {
      start: process.env.MAINTENANCE_START,
      end: process.env.MAINTENANCE_END,
    },
  });
});

// ─── ROTAS ────────────────────────────────────────────────────────────────────
app.use("/api/auth", require("./routes/auth"));
app.use("/api/admin", require("./routes/admin"));

// Placeholder das rotas que vêm nas próximas fases
app.use("/api/cobertura", require("./routes/cobertura"));
app.use("/api/tasks", require("./routes/tasks"));
app.use("/api/pdvs", require("./routes/pdvs"));
// app.use("/api/cobertura", require("./routes/cobertura"));
// app.use("/api/tasks", require("./routes/tasks"));
app.use("/api/pdvs", require("./routes/pdvs"));
// app.use("/api/tasks", require("./routes/tasks"));
app.use("/api/arquivos", require("./routes/arquivos"));
// app.use("/api/incidentes", require("./routes/incidentes"));
// app.use("/api/rv", require("./routes/rv"));

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: "Rota não encontrada." });
});

// ─── ERROR HANDLER ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Erro interno do servidor." });
});

// ─── INICIALIZAÇÃO ────────────────────────────────────────────────────────────
async function start() {
  try {
    console.log("🔧 Inicializando planilhas...");
    await initializeSheets();
    app.listen(PORT, () => {
      console.log(`✅ Backend rodando na porta ${PORT}`);
      console.log(`   Ambiente: ${process.env.NODE_ENV || "development"}`);
    });
  } catch (err) {
    console.error("❌ Erro ao iniciar servidor:", err);
    process.exit(1);
  }
}

start();
