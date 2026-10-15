const jwt = require("jsonwebtoken");

// Usuário desativado no Admin perde o acesso NA HORA (antes o token valia 7 dias).
// Lê a tabela de usuários (cache de 60s do sqlRepo); se a leitura falhar, deixa passar
// (não derruba todo mundo por um soluço do banco).
// Setores 301–305 viraram 107–111 (mesmos RNs). Usuário ainda cadastrado com o código
// antigo funciona como o novo — senão não "casa" com os dados (tasks, PDVs…), que já vêm 107–111.
const NOVO_SETOR = { "301": "107", "302": "108", "303": "109", "304": "110", "305": "111" };
const codHop = (c) => { const s = String(c ?? "").trim(); return NOVO_SETOR[s] || s; };

async function usuarioAtivo(cod) {
  try {
    const { readSheet } = require("../services/sheets");
    const us = await readSheet("usuarios");
    const u = us.find((x) => String(x.cod).trim() === String(cod).trim())
           || us.find((x) => codHop(x.cod) === codHop(cod));
    return !u ? false : String(u.ativo).toLowerCase() === "true";
  } catch { return true; }
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token não fornecido." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Token de "troca de senha" (login com senha-padrão): só serve p/ trocar a senha.
    if (decoded.troca && !req.originalUrl.startsWith("/api/auth/trocar-senha")) {
      return res.status(403).json({ error: "Troque a senha-padrão para continuar." });
    }
    req.user = decoded; // { cod, nome, perfil, gv, telefone }
  } catch (err) {
    return res.status(401).json({ error: "Token inválido ou expirado." });
  }
  usuarioAtivo(req.user.cod).then((ok) => {
    if (!ok) return res.status(401).json({ error: "Usuário desativado. Fale com o administrador." });
    req.user = { ...req.user, cod: codHop(req.user.cod) };
    next();
  });
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

module.exports = { authMiddleware, adminOnly, gestorOnly, adminDiretorOnly, codHop };
