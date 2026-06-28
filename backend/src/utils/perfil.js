// Filtro de dados por perfil/setor do usuário — fonte única (antes copiado em 6 rotas).
// admin/director veem tudo; gv1/gv3 veem os setores que começam com 1/3;
// RN vê apenas o próprio setor (cod).
function filtrarPorPerfil(dados, usuario, campoSetor = "setor") {
  if (["admin", "director"].includes(usuario.perfil)) return dados;
  if (usuario.perfil === "gv1") return dados.filter((r) => String(r[campoSetor]).startsWith("1"));
  if (usuario.perfil === "gv3") return dados.filter((r) => String(r[campoSetor]).startsWith("3"));
  return dados.filter((r) => String(r[campoSetor]) === String(usuario.cod));
}

module.exports = { filtrarPorPerfil };
