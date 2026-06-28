// Visibilidade de conteúdo por público-alvo (avisos, popups, incentivos, hop) —
// fonte única (antes copiado em 4 rotas). admin/director/gv veem tudo; RN vê
// "todos", o próprio cod numa lista, ou conforme on/off-trade.
const SET_OFF = new Set(["101", "102", "103"]); // setores ON_TRADE/OFF — base do alvo "off"/"on"

function podeVer(user, alvo) {
  const perfil = String(user.perfil || "").toLowerCase();
  if (["admin", "director", "gv1", "gv3"].includes(perfil)) return true;
  const cod = String(user.cod || "").trim();
  const a = String(alvo || "todos").trim().toLowerCase();
  if (a === "" || a === "todos") return true;
  if (a === "off") return SET_OFF.has(cod);
  if (a === "on") return !SET_OFF.has(cod);
  return a.split(",").map((s) => s.trim()).includes(cod);
}

module.exports = { SET_OFF, podeVer };
