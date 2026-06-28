const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();
const { readSheet, appendRow, updateRow } = require("../services/sheets");
const { authMiddleware, adminOnly } = require("../middleware/auth");
const { SENHA_PADRAO, ehHash, ehSenhaPadrao, hashSenha, conferirSenha } = require("../utils/senha");

const USUARIO_COLS = ["cod", "nome", "cpf", "telefone", "perfil", "gv", "ativo", "senha", "criado_em"];
const rowUsuario = (u) => USUARIO_COLS.map((c) => u[c] ?? "");

function gerarToken(usuario) {
  return jwt.sign(
    { cod: usuario.cod, nome: usuario.nome, telefone: usuario.telefone, perfil: usuario.perfil, gv: usuario.gv },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { cpf, senha } = req.body;
    if (!cpf || !senha) return res.status(400).json({ error: "CPF e senha obrigatórios." });

    const cpfLimpo = cpf.replace(/\D/g, "");
    if (cpfLimpo.length !== 11) return res.status(400).json({ error: "CPF inválido." });

    const usuarios = await readSheet("usuarios");
    const idx = usuarios.findIndex(
      (u) => u.cpf?.replace(/\D/g, "") === cpfLimpo && u.ativo?.toLowerCase() === "true"
    );
    if (idx === -1) return res.status(404).json({ error: "CPF não cadastrado ou inativo." });
    const usuario = usuarios[idx];

    const ok = await conferirSenha(senha, usuario.senha, cpfLimpo);
    if (!ok) return res.status(401).json({ error: "Senha incorreta." });

    // Migração suave: senha real ainda em texto puro → re-hasheia no 1º login certo.
    // (Senhas-padrão ficam como sentinela em texto para o app pedir a troca.)
    if (!ehHash(usuario.senha) && !ehSenhaPadrao(usuario.senha, cpfLimpo)) {
      try {
        await updateRow("usuarios", idx + 1, rowUsuario({ ...usuario, senha: await hashSenha(senha) }));
      } catch (e) { console.error("rehash login:", e.message); }
    }

    const token = gerarToken(usuario);
    return res.json({
      success: true,
      token,
      precisa_trocar_senha: ehSenhaPadrao(usuario.senha, cpfLimpo),
      usuario: { cod: usuario.cod, nome: usuario.nome, perfil: usuario.perfil, gv: usuario.gv },
    });
  } catch (err) {
    console.error("Erro no login:", err);
    // TEMPORÁRIO (debug migração SQL): expõe o erro real. REVERTER depois.
    return res.status(500).json({ error: "DBG: " + (err && err.message ? err.message : String(err)) });
  }
});

// POST /api/auth/trocar-senha — usuário logado define sua senha individual
router.post("/trocar-senha", authMiddleware, async (req, res) => {
  try {
    const nova = String(req.body?.nova_senha || "").trim();
    if (nova.length < 4) return res.status(400).json({ error: "A nova senha deve ter pelo menos 4 caracteres." });
    if (nova === SENHA_PADRAO) return res.status(400).json({ error: "Escolha uma senha diferente da padrão (1234)." });

    const usuarios = await readSheet("usuarios");
    const idx = usuarios.findIndex((u) => String(u.cod) === String(req.user.cod));
    if (idx === -1) return res.status(404).json({ error: "Usuário não encontrado." });

    const atualizado = { ...usuarios[idx], senha: await hashSenha(nova) };
    await updateRow("usuarios", idx + 1, rowUsuario(atualizado));
    return res.json({ success: true, message: "Senha atualizada com sucesso." });
  } catch (err) {
    console.error("trocar-senha:", err);
    return res.status(500).json({ error: "Erro ao atualizar a senha." });
  }
});

// POST /api/auth/redefinir-senha — usuário solicita reset (chega no admin)
router.post("/redefinir-senha", async (req, res) => {
  try {
    const cpfLimpo = String(req.body?.cpf || "").replace(/\D/g, "");
    if (cpfLimpo.length !== 11) return res.status(400).json({ error: "Digite seu CPF (11 dígitos) para solicitar." });

    const usuarios = await readSheet("usuarios");
    const usuario = usuarios.find((u) => u.cpf?.replace(/\D/g, "") === cpfLimpo);
    if (!usuario) return res.status(404).json({ error: "CPF não cadastrado." });

    const sols = await readSheet("reset_solicitacoes").catch(() => []);
    const jaPendente = sols.find((s) => String(s.cod) === String(usuario.cod) && String(s.status) === "pendente");
    if (jaPendente) {
      return res.json({ success: true, message: "Você já tem uma solicitação pendente. Aguarde o admin autorizar." });
    }

    const agora = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    // colunas: id, cod, nome, cpf, telefone, status, solicitado_em, resolvido_em, resolvido_por
    await appendRow("reset_solicitacoes", [
      String(Date.now()), usuario.cod, usuario.nome, cpfLimpo, usuario.telefone || "", "pendente", agora, "", "",
    ]);
    return res.json({ success: true, message: "Solicitação enviada! O admin vai autorizar e sua senha volta a ser 1234." });
  } catch (err) {
    console.error("redefinir-senha:", err);
    return res.status(500).json({ error: "Erro ao enviar a solicitação." });
  }
});

// GET /api/auth/reset-solicitacoes — admin lista pendentes
router.get("/reset-solicitacoes", authMiddleware, adminOnly, async (req, res) => {
  try {
    const sols = await readSheet("reset_solicitacoes").catch(() => []);
    const pendentes = sols
      .filter((s) => String(s.status) === "pendente")
      .map((s) => ({ id: s.id, cod: s.cod, nome: s.nome, telefone: s.telefone, solicitado_em: s.solicitado_em }))
      .reverse();
    return res.json(pendentes);
  } catch (err) {
    console.error("reset-solicitacoes:", err);
    return res.status(500).json({ error: "Erro ao listar solicitações." });
  }
});

// POST /api/auth/reset-solicitacoes/:id/resolver — admin autoriza/rejeita
const RESET_COLS = ["id", "cod", "nome", "cpf", "telefone", "status", "solicitado_em", "resolvido_em", "resolvido_por"];
router.post("/reset-solicitacoes/:id/resolver", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const acao = String(req.body?.acao || "autorizar"); // autorizar | rejeitar

    const sols = await readSheet("reset_solicitacoes");
    const sIdx = sols.findIndex((s) => String(s.id) === String(id));
    if (sIdx === -1) return res.status(404).json({ error: "Solicitação não encontrada." });
    const sol = sols[sIdx];
    if (String(sol.status) !== "pendente") return res.status(400).json({ error: "Solicitação já resolvida." });

    if (acao === "autorizar") {
      const usuarios = await readSheet("usuarios");
      const uIdx = usuarios.findIndex((u) => String(u.cod) === String(sol.cod));
      if (uIdx === -1) return res.status(404).json({ error: "Usuário da solicitação não encontrado." });
      const atualizado = { ...usuarios[uIdx], senha: SENHA_PADRAO };
      await updateRow("usuarios", uIdx + 1, rowUsuario(atualizado));
    }

    const agora = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const novoStatus = acao === "rejeitar" ? "rejeitada" : "autorizada";
    const solAtual = { ...sol, status: novoStatus, resolvido_em: agora, resolvido_por: req.user.nome || req.user.cod };
    await updateRow("reset_solicitacoes", sIdx + 1, RESET_COLS.map((c) => solAtual[c] ?? ""));

    return res.json({
      success: true,
      message: acao === "rejeitar"
        ? "Solicitação rejeitada."
        : `Senha de ${sol.nome} redefinida para 1234. Ele vai criar uma nova ao entrar.`,
    });
  } catch (err) {
    console.error("resolver reset:", err);
    return res.status(500).json({ error: "Erro ao resolver a solicitação." });
  }
});

// GET /api/auth/me
router.get("/me", authMiddleware, (req, res) => res.json({ usuario: req.user }));

module.exports = router;
