import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function PrivateRoute({ children, perfisPermitidos }) {
  const { usuario, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0c1410" }}>
        <p style={{ color: "rgba(255,255,255,0.4)" }}>Carregando...</p>
      </div>
    );
  }

  if (!usuario) return <Navigate to="/login" replace />;

  if (perfisPermitidos && !perfisPermitidos.includes(usuario.perfil)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
