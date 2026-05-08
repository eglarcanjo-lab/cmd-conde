import { createContext, useContext, useState, useEffect } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("cmd_token");
    const saved = localStorage.getItem("cmd_usuario");
    if (token && saved) {
      setUsuario(JSON.parse(saved));
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    }
    setLoading(false);
  }, []);

  function login(token, userData) {
    localStorage.setItem("cmd_token", token);
    localStorage.setItem("cmd_usuario", JSON.stringify(userData));
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    setUsuario(userData);
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
