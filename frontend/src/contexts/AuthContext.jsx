import { createContext, useContext, useState, useEffect } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

// Setores 301–305 viraram 107–111 (mesmos RNs): sessão salva com o código antigo vira o novo,
// senão a tela não "casa" com os dados (tasks, PDVs…), que já vêm 107–111.
const NOVO_SETOR = { "301": "107", "302": "108", "303": "109", "304": "110", "305": "111" };
const comCodNovo = (u) => (u && NOVO_SETOR[String(u.cod)] ? { ...u, cod: NOVO_SETOR[String(u.cod)] } : u);

// "Ver como setor" (só ADMIN): o app inteiro passa a se comportar como o RN daquele setor —
// as telas recebem `usuario` como RN e o backend recebe o cabeçalho X-Ver-Como e escopa os dados
// como RN (middleware/auth). `usuarioReal` continua sendo o admin. Fica salvo no navegador.
const VER_COMO_KEY = "hop_ver_como";
const lerVerComo = () => { try { return localStorage.getItem(VER_COMO_KEY) || ""; } catch { return ""; } };
function aplicarCabecalho(setor) {
  if (setor) api.defaults.headers.common["X-Ver-Como"] = setor;
  else delete api.defaults.headers.common["X-Ver-Como"];
}

export function AuthProvider({ children }) {
  const [usuarioReal, setUsuarioReal] = useState(null);
  const [verComo, setVerComoState] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("cmd_token");
    const saved = localStorage.getItem("cmd_usuario");
    if (token && saved) {
      const u = comCodNovo(JSON.parse(saved));
      setUsuarioReal(u);
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      if (u?.perfil === "admin") { const v = lerVerComo(); setVerComoState(v); aplicarCabecalho(v); }
    }
    setLoading(false);
  }, []);

  function login(token, userData) {
    localStorage.setItem("cmd_token", token);
    localStorage.setItem("cmd_usuario", JSON.stringify(userData));
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    setUsuarioReal(comCodNovo(userData));
    setVerComo("");
  }

  function logout() {
    localStorage.removeItem("cmd_token");
    localStorage.removeItem("cmd_usuario");
    delete api.defaults.headers.common["Authorization"];
    setVerComo("");
    setUsuarioReal(null);
  }

  function setVerComo(setor) {
    const s = String(setor || "").trim();
    try { if (s) localStorage.setItem(VER_COMO_KEY, s); else localStorage.removeItem(VER_COMO_KEY); } catch { /* sem storage */ }
    aplicarCabecalho(s);
    setVerComoState(s);
  }

  const adminReal = usuarioReal?.perfil === "admin";
  const vendoComo = adminReal && verComo ? verComo : "";
  // Usuário "efetivo" que as telas usam: o RN do setor escolhido, ou o próprio usuário.
  const usuario = vendoComo
    ? { ...usuarioReal, perfil: "rn", cod: vendoComo, nome: `Setor ${vendoComo} (visão do admin)`, _verComo: true }
    : usuarioReal;

  const isAdmin = usuario?.perfil === "admin";
  const isGestor = ["admin", "director", "gv1", "gv3"].includes(usuario?.perfil);

  return (
    <AuthContext.Provider value={{ usuario, usuarioReal, adminReal, verComo: vendoComo, setVerComo, login, logout, loading, isAdmin, isGestor }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
