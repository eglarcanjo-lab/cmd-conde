const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();
const { readSheet, appendRow, updateRow } = require("../services/sheets");
const { generateOTP, sendOTP } = require("../services/whatsapp");

// Cache simples em memória para OTPs (telefone → { codigo, expira_em })
const otpCache = new Map();

// POST /api/auth/request-otp
// Recebe o número de telefone, valida se está cadastrado e envia OTP
router.post("/request-otp", async (req, res) => {
  try {
    const { telefone } = req.body;

    if (!telefone) {
      return res.status(400).json({ error: "Telefone obrigatório." });
    }

    // Normaliza o número (remove espaços, +, -)
    const tel = telefone.replace(/\D/g, "");

    // Busca usuário na planilha
    const usuarios = await readSheet("usuarios");
    const usuario = usuarios.find(
      (u) => u.telefone?.replace(/\D/g, "") === tel && u.ativo === "true"
    );

    if (!usuario) {
      return res.status(404).json({ error: "Número não cadastrado ou inativo." });
    }

    // Gera OTP e guarda em cache por 10 minutos
    const codigo = generateOTP();
    const expira = Date.now() + 10 * 60 * 1000;
    otpCache.set(tel, { codigo, expira, usuario });

    // Envia via WhatsApp
    const result = await sendOTP(tel, codigo);

    if (!result.success) {
      return res.status(500).json({ error: "Erro ao enviar OTP. Tente novamente." });
    }

    console.log(`OTP enviado para ${tel} — cód: ${codigo}`);

    return res.json({
      success: true,
      message: "Código enviado para seu WhatsApp.",
      nome: usuario.nome, // Exibe o nome na tela de login para feedback
    });
  } catch (err) {
    console.error("Erro em request-otp:", err);
    return res.status(500).json({ error: "Erro interno." });
  }
});

// POST /api/auth/verify-otp
// Valida o código e retorna o JWT
router.post("/verify-otp", async (req, res) => {
  try {
    const { telefone, codigo } = req.body;

    if (!telefone || !codigo) {
      return res.status(400).json({ error: "Telefone e código obrigatórios." });
    }

    const tel = telefone.replace(/\D/g, "");
    const cached = otpCache.get(tel);

    if (!cached) {
      return res.status(400).json({ error: "Nenhum código solicitado para este número." });
    }

    if (Date.now() > cached.expira) {
      otpCache.delete(tel);
      return res.status(400).json({ error: "Código expirado. Solicite um novo." });
    }

    if (cached.codigo !== codigo.toString()) {
      return res.status(400).json({ error: "Código incorreto." });
    }

    // OTP válido — limpa cache e gera JWT (7 dias)
    otpCache.delete(tel);

    const { usuario } = cached;
    const token = jwt.sign(
      {
        cod: usuario.cod,
        nome: usuario.nome,
        perfil: usuario.perfil,
        gv: usuario.gv,
        telefone: tel,
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
    console.error("Erro em verify-otp:", err);
    return res.status(500).json({ error: "Erro interno." });
  }
});

// GET /api/auth/me — retorna dados do usuário logado
router.get("/me", require("../middleware/auth").authMiddleware, (req, res) => {
  return res.json({ usuario: req.user });
});

// GET /api/auth/debug-usuarios — TEMPORÁRIO, remover após teste
router.get("/debug-usuarios", async (req, res) => {
  const usuarios = await readSheet("usuarios");
  return res.json(usuarios);
});

module.exports = router;
