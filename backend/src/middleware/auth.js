const jwt = require("jsonwebtoken");

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token não fornecido." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { cod, nome, perfil, gv, telefone }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token inválido ou expirado." });
  }
}

// Middleware para rotas exclusivas do admin
function adminOnly(req, res, next) {
  if (req.user?.perfil !== "admin") {
    return res.status(403).json({ error: "Acesso restrito ao administrador." });
  }
  next();
}

// Middleware para rotas de gestão (admin + director + gv1 + gv3)
function gestorOnly(req, res, next) {
  const perfisGestor = ["admin", "director", "gv1", "gv3"];
  if (!perfisGestor.includes(req.user?.perfil)) {
    return res.status(403).json({ error: "Acesso restrito a gestores." });
  }
  next();
}

// Middleware para rotas exclusivas de admin + director (ex: Equipamentos)
function adminDiretorOnly(req, res, next) {
  if (!["admin", "director"].includes(req.user?.perfil)) {
    return res.status(403).json({ error: "Acesso restrito a admin/diretor." });
  }
  next();
}

module.exports = { authMiddleware, adminOnly, gestorOnly, adminDiretorOnly };
