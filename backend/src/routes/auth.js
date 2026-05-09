const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();
const { readSheet, appendRow, updateRow } = require("../services/sheets");

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { cpf, senha } = req.body;

    if (!cpf || !senha) {
      return res.status(400).json({ error: "CPF e senha obrigatórios." });
    }

    // Normaliza CPF (remove pontos e traço)
    const cpfLimpo = cpf.replace(/\D/g, "");

    if (cpfLimpo.length !== 11) {
      return res.status(400).json({ error: "CPF inválido." });
    }

    // Busca usuário na planilha
    const usuarios = await readSheet("usuarios");
    const usuario = usuarios.find(
      (u) => u.cpf?.replace(/\D/g, "") === cpfLimpo && u.ativo === "true"
    );

    if (!usuario) {
      return res.status(404).json({ error: "CPF não cadastrado ou inativo." });
    }

    // Senha padrão: Cmd@ + 4 primeiros dígitos do CPF
    const senhaPadrao = `Cmd@${cpfLimpo.slice(0, 4)}`;
    const senhaCorreta = usuario.senha || senhaPadrao;

    if (senha !== senhaCorreta) {
      return res.status(401).json({ error: "Senha incorreta." });
    }

    // Gera JWT (7 dias)
    const token = jwt.sign(
      {
        cod: usuario.cod,
        nome: usuario.nome,
        telefone: usuario.telefone,
        perfil: usuario.perfil,
        gv: usuario.gv,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      success: true,
      token,
      usuario: {
        cod: usuario.cod,
        nome: usuario.nome,
        perfil: usuario.perfil,
        gv: usuario.gv,
      },
    });
  } catch (err) {
    console.error("Erro no login:", err);
    return res.status(500).json({ error: "Erro interno." });
  }
});

// GET /api/auth/me
router.get("/me", require("../middleware/auth").authMiddleware, (req, res) => {
  return res.json({ usuario: req.user });
});

// GET /api/auth/debug-usuarios — TEMPORÁRIO
router.get("/debug-usuarios", async (req, res) => {
  const usuarios = await readSheet("usuarios");
  return res.json(usuarios);
});

module.exports = router;
