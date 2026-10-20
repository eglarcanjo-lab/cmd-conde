import React from "react";
import "./index.css";
import "./mobile.css";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ativarTabelasMobile } from "./utils/tabelasMobile";

// Celular: tabelas simples viram lista de cartões no app inteiro (ver utils/tabelasMobile.js)
ativarTabelasMobile();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
