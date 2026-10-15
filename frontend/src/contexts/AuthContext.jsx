import { createContext, useContext, useState, useEffect } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

// Setores 301–305 viraram 107–111 (mesmos RNs): sessão salva com o código antigo vira o novo,
// senão a tela não "casa" com os dados (tasks, PDVs…), que já vêm 107–111.
const NOVO_SETOR = { "301": "107", "302": "108", "303": "109", "304": "110", "305": "111" };
const comCodNovo = (u) => (u && NOVO_SETOR[String(u.cod)] ? { ...u, cod: NOVO_SETOR[String(u.cod)] } : u);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("cmd_token");
    const saved = localStorage.getItem("cmd_usuario");
    if (token && saved) {
      setUsuario(comCodNovo(JSON.parse(saved)));
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    }
    setLoading(false);
  }, []);

  function login(token, userData) {
    localStorage.setItem("cmd_token", token);
    localStorage.setItem("cmd_usuario", JSON.stringify(userData));
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    setUsuario(comCodNovo(userData));
  }

  function logout() {
    localStorage.removeItem("cmd_token");
    localStorage.removeItem("cmd_usuario");
    delete api.defaults.headers.common["Authorization"];
    setUsuario(null);
  }

  const isAdmin = usuario?.perfil === "admin";
  const isGestor = ["admin", "director", "gv1", "gv3"].includes(usuario?.perfil);

  return (
    <AuthContext.Provider value={{ usuario, login, logout, loading, isAdmin, isGestor }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
