import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import api from "../../services/api";
import styles from "./styles";
import RefrigeradorForm from "./RefrigeradorForm";
import RefrigeradorList from "./RefrigeradorList";
import MaterialLeveForm from "./MaterialLeveForm";
import MaterialLeveList from "./MaterialLeveList";

// Módulo inteiro já é restrito a admin/director (ver App.jsx e HomeClassic.jsx) —
// aqui só decide se mostra o botão de excluir dentro do módulo.
const PERFIS_GESTOR = ["admin", "director"];

export default function Refrigeradores() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const [abaTopo, setAbaTopo] = useState("refrigeradores"); // refrigeradores | material-leve
  const [subAba, setSubAba] = useState("novo"); // novo | lista
  const [pdvBase, setPdvBase] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const podeExcluir = PERFIS_GESTOR.includes(usuario?.perfil);

  useEffect(() => {
    api.get("/api/cobertura/pdv-base").then((res) => setPdvBase(res.data || [])).catch(() => {});
  }, []);

  function aoSalvar() {
    setRefreshKey((k) => k + 1);
    setSubAba("lista");
  }

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <button style={styles.backBtn} onClick={() => navigate("/")}>← Voltar</button>
          <div>
            <h1 style={styles.title}>🧊 Equipamentos</h1>
            <p style={styles.subtitle}>{usuario?.nome}</p>
          </div>
        </div>
        <button style={styles.backBtn} onClick={logout}>Sair</button>
      </div>

      <div style={styles.content}>
        <div style={styles.abasTopo}>
          <button
            style={{ ...styles.abaTopoBtn, ...(abaTopo === "refrigeradores" ? styles.abaTopoBtnAtivo : {}) }}
            onClick={() => { setAbaTopo("refrigeradores"); setSubAba("novo"); }}
          >
            🧊 Refrigeradores
          </button>
          <button
            style={{ ...styles.abaTopoBtn, ...(abaTopo === "material-leve" ? styles.abaTopoBtnAtivo : {}) }}
            onClick={() => { setAbaTopo("material-leve"); setSubAba("novo"); }}
          >
            📦 Material Leve
          </button>
        </div>

        <div style={styles.abas}>
          <button style={{ ...styles.abaBtn, ...(subAba === "novo" ? styles.abaBtnAtivo : {}) }} onClick={() => setSubAba("novo")}>
            📝 Novo Cadastro
          </button>
          <button style={{ ...styles.abaBtn, ...(subAba === "lista" ? styles.abaBtnAtivo : {}) }} onClick={() => setSubAba("lista")}>
            📋 Consultar
          </button>
        </div>

        {abaTopo === "refrigeradores" ? (
          subAba === "novo" ? (
            <RefrigeradorForm pdvBase={pdvBase} onSalvo={aoSalvar} />
          ) : (
            <RefrigeradorList podeExcluir={podeExcluir} refreshKey={refreshKey} />
          )
        ) : (
          subAba === "novo" ? (
            <MaterialLeveForm pdvBase={pdvBase} onSalvo={aoSalvar} />
          ) : (
            <MaterialLeveList podeExcluir={podeExcluir} refreshKey={refreshKey} />
          )
        )}
      </div>
    </div>
  );
}
