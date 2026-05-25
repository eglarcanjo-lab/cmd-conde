import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import PrivateRoute from "./components/PrivateRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Admin from "./pages/Admin";
import RvSimuladorPage from "./pages/Admin/RvSimuladorPage";
import Cobertura from "./pages/Cobertura";
import PDVs from "./pages/PDVs";
import Tasks from "./pages/Tasks";
import Incidentes from "./pages/Incidentes";
import RV from "./pages/RV";
import SPO from "./pages/SPO";

export default function App() {
  return (
    <AuthProvider>
      <span className="assinatura">Desenvolvido por Eduardo Arcanjo</span>
      <BrowserRouter>
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
          <Route path="/incidentes" element={<PrivateRoute><ErrorBoundary><Incidentes /></ErrorBoundary></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
