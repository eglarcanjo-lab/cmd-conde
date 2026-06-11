import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import PrivateRoute from "./components/PrivateRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import ManutencaoScreen from "./components/ManutencaoScreen";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Admin from "./pages/Admin";
import RvSimuladorPage from "./pages/Admin/RvSimuladorPage";
import Cobertura from "./pages/Cobertura";
import PDVs from "./pages/PDVs";
import Tasks from "./pages/Tasks";
import Incidentes from "./pages/Incidentes";
import RV from "./pages/RV";
import RVRelatorio from "./pages/RV/Relatorio";
import SPO from "./pages/SPO";
import VolumeDiario from "./pages/VolumeDiario";
import Incentivos from "./pages/Incentivos";
import Detalhamento from "./pages/Detalhamento";
import Produtos from "./pages/Produtos";
import CoberturaSku from "./pages/CoberturaSku";
import PopupDiario from "./components/PopupDiario";
import AtualizacaoApp from "./components/AtualizacaoApp";
import HopAssistente from "./components/HopAssistente";
import BotaoAjuda from "./components/BotaoAjuda";
import { HOP_ATIVA } from "./theme";
import api from "./services/api";

// Componente interno — tem acesso ao BrowserRouter e AuthContext
function AppContent() {
  const { usuario, loading: authLoading } = useAuth();
  const location = useLocation();
  const [manu, setManu] = useState(null); // null = verificando

  useEffect(() => {
    api.get("/api/manutencao/status")
      .then((r) => setManu(r.data))
      .catch(() => setManu({ ativo: false }));
  }, []);

  // Aguarda auth E status de manutenção — evita race condition admin vs manu
  if (manu === null || authLoading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0c1410", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: "32px", height: "32px", border: "3px solid rgba(125,186,61,0.2)", borderTopColor: "#7DBA3D", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Manutenção ativa: bloqueia todos exceto admin logado e a própria /login
  if (manu.ativo && usuario?.perfil !== "admin" && location.pathname !== "/login") {
    return <ManutencaoScreen mensagem={manu.mensagem} />;
  }

  return (
    <>
      {usuario && location.pathname !== "/login" && <PopupDiario />}
      {HOP_ATIVA && usuario && location.pathname !== "/login" && <HopAssistente />}
      {usuario && location.pathname !== "/login" && <BotaoAjuda />}
      <Routes>
      <Route path="/login" element={<ErrorBoundary><Login /></ErrorBoundary>} />
      <Route path="/" element={<PrivateRoute><ErrorBoundary><Home /></ErrorBoundary></PrivateRoute>} />
      <Route path="/admin" element={<PrivateRoute perfisPermitidos={["admin"]}><ErrorBoundary><Admin /></ErrorBoundary></PrivateRoute>} />
      <Route path="/rv-admin" element={<PrivateRoute perfisPermitidos={["admin","director"]}><ErrorBoundary><RvSimuladorPage /></ErrorBoundary></PrivateRoute>} />
      <Route path="/cobertura" element={<PrivateRoute><ErrorBoundary><Cobertura /></ErrorBoundary></PrivateRoute>} />
      <Route path="/pdvs" element={<PrivateRoute><ErrorBoundary><PDVs /></ErrorBoundary></PrivateRoute>} />
      <Route path="/tasks" element={<PrivateRoute><ErrorBoundary><Tasks /></ErrorBoundary></PrivateRoute>} />
      <Route path="/spo" element={<PrivateRoute><ErrorBoundary><SPO /></ErrorBoundary></PrivateRoute>} />
      <Route path="/rv" element={<PrivateRoute><ErrorBoundary><RV /></ErrorBoundary></PrivateRoute>} />
      <Route path="/rv-relatorio" element={<PrivateRoute perfisPermitidos={["admin","director"]}><ErrorBoundary><RVRelatorio /></ErrorBoundary></PrivateRoute>} />
      <Route path="/incidentes" element={<PrivateRoute><ErrorBoundary><Incidentes /></ErrorBoundary></PrivateRoute>} />
      <Route path="/volume-diario" element={<PrivateRoute><ErrorBoundary><VolumeDiario /></ErrorBoundary></PrivateRoute>} />
      <Route path="/incentivos" element={<PrivateRoute><ErrorBoundary><Incentivos /></ErrorBoundary></PrivateRoute>} />
      <Route path="/detalhamento" element={<PrivateRoute><ErrorBoundary><Detalhamento /></ErrorBoundary></PrivateRoute>} />
      <Route path="/produtos" element={<PrivateRoute><ErrorBoundary><Produtos /></ErrorBoundary></PrivateRoute>} />
      <Route path="/cobertura-sku" element={<PrivateRoute perfisPermitidos={["admin","director","gv1","gv3"]}><ErrorBoundary><CoberturaSku /></ErrorBoundary></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}

// Versão do app — ver CHANGELOG.md para o esquema (vMAJOR.MINOR.PATCH)
export const APP_VERSION = "v3.14.0";

export default function App() {
  return (
    <AuthProvider>
      <AtualizacaoApp />
      <span className="assinatura">Desenvolvido por Eduardo Arcanjo · {APP_VERSION}</span>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}
