import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3001",
  timeout: 15000,
});

// Interceptor para tratar erros globais
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("cmd_token");
      localStorage.removeItem("cmd_usuario");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default api;
