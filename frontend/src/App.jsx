import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import PrivateRoute from "./components/PrivateRoute";
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
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />
          <Route path="/admin" element={<PrivateRoute perfisPermitidos={["admin"]}><Admin /></PrivateRoute>} />
          <Route path="/rv-admin" element={<PrivateRoute perfisPermitidos={["admin","director"]}><RvSimuladorPage /></PrivateRoute>} />
          <Route path="/cobertura" element={<PrivateRoute><Cobertura /></PrivateRoute>} />
          <Route path="/pdvs" element={<PrivateRoute><PDVs /></PrivateRoute>} />
          <Route path="/tasks" element={<PrivateRoute><Tasks /></PrivateRoute>} />
          <Route path="/spo" element={<PrivateRoute><SPO /></PrivateRoute>} />
            <Route path="/rv" element={<PrivateRoute><RV /></PrivateRoute>} />
            <Route path="/incidentes" element={<PrivateRoute><Incidentes /></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
