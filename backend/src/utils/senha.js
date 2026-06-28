// Hash e verificação de senha (D1 da Auditoria 2) — fonte única.
// Migração suave: senhas escolhidas pelo usuário viram hash bcrypt; as senhas-padrão
// (vazia / "1234" / o antigo Cmd@xxxx) continuam como sentinela em texto, para o app
// detectar "precisa trocar". Senhas reais antigas em texto são re-hasheadas no
// próximo login bem-sucedido (ver auth.js). Tudo isto migra direto para SQL: o hash
// é só uma coluna de texto.
const bcrypt = require("bcryptjs");

const SENHA_PADRAO = "1234";

// Um hash bcrypt começa com $2a$ / $2b$ / $2y$.
function ehHash(s) {
  return /^\$2[aby]\$/.test(String(s || ""));
}

// Senha "padrão" (precisa trocar): vazia, 1234, ou o antigo Cmd@xxxx.
// Uma senha hasheada nunca é padrão (foi escolhida pelo usuário).
function ehSenhaPadrao(stored, cpfLimpo) {
  const s = String(stored || "");
  if (ehHash(s)) return false;
  return s === "" || s === SENHA_PADRAO || s === `Cmd@${String(cpfLimpo || "").slice(0, 4)}`;
}

async function hashSenha(plain) {
  return bcrypt.hash(String(plain), 10);
}

// Confere a senha digitada contra o armazenado (hash OU texto legado/sentinela).
// Mantém o fallback histórico Cmd@xxxx quando o campo está vazio.
async function conferirSenha(plain, stored, cpfLimpo) {
  const s = String(stored || "");
  if (ehHash(s)) return bcrypt.compare(String(plain), s);
  const esperado = s || `Cmd@${String(cpfLimpo || "").slice(0, 4)}`;
  return String(plain) === esperado;
}

module.exports = { SENHA_PADRAO, ehHash, ehSenhaPadrao, hashSenha, conferirSenha };
