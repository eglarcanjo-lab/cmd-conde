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
  const [itemEditando, setItemEditando] = useState(null);

  const podeExcluir = PERFIS_GESTOR.includes(usuario?.perfil);

  useEffect(() => {
    api.get("/api/cobertura/pdv-base").then((res) => setPdvBase(res.data || [])).catch(() => {});
  }, []);

  function trocarAbaTopo(aba) {
    setAbaTopo(aba);
    setSubAba("novo");
    setItemEditando(null);
  }

  function trocarSubAba(aba) {
    setSubAba(aba);
    setItemEditando(null);
  }

  function editar(item) {
    setItemEditando(item);
    setSubAba("novo");
  }

  function aoSalvar() {
    setRefreshKey((k) => k + 1);
    setItemEditando(null);
    setSubAba("lista");
  }

  return (
    <div style={styles.root} className="eq-page">
      <style>{`
        @media (max-width: 600px) {
          .eq-export-label { display: none; }
        }
        @media print {
          .eq-no-print { display: none !important; }
          html, body {
            height: auto !important;
            overflow: visible !important;
            background: #fff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .eq-page { background: #fff !important; color: #111 !important; }
          .eq-card, .eq-card * { background: #fff !important; color: #111 !important; }
          .eq-card { border: 1px solid #ccc !important; break-inside: avoid; page-break-inside: avoid; }
          .eq-thumb { width: 220px !important; height: 220px !important; }
          /* Flex/Grid não pagina no Chrome — o que passa da 1ª página some em vez de
             continuar. Vira bloco simples com margem no lugar do gap pra fluir entre páginas. */
          .eq-lista { display: block !important; }
          .eq-lista > div { margin: 0 0 12px !important; }

          /* Refrigeradores: 1 item por página, foto da etiqueta bem maior pra dar
             pra ler os dados dela impressa (Material Leve não entra nessa regra). */
          .eq-card-refrigerador {
            page-break-after: always;
            break-after: page;
            display: flex !important;
            flex-direction: column !important;
          }
          .eq-lista > .eq-card-refrigerador:last-child { page-break-after: auto; break-after: auto; }
          .eq-thumbs-refrigerador { flex-direction: column !important; align-items: center !important; gap: 20px !important; margin-top: 12px; }
          .eq-thumb-etiqueta { width: auto !important; height: auto !important; max-width: 100% !important; max-height: 480px !important; object-fit: contain !important; }
          .eq-thumb-equipamento { width: auto !important; height: auto !important; max-width: 100% !important; max-height: 320px !important; object-fit: contain !important; }

          @page { size: A4; margin: 12mm 14mm; }
        }
      `}</style>

      <div style={styles.header} className="eq-no-print">
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
        <div style={styles.abasTopo} className="eq-no-print">
          <button
            style={{ ...styles.abaTopoBtn, ...(abaTopo === "refrigeradores" ? styles.abaTopoBtnAtivo : {}) }}
            onClick={() => trocarAbaTopo("refrigeradores")}
          >
            🧊 Refrigeradores
          </button>
          <button
            style={{ ...styles.abaTopoBtn, ...(abaTopo === "material-leve" ? styles.abaTopoBtnAtivo : {}) }}
            onClick={() => trocarAbaTopo("material-leve")}
          >
            📦 Material Leve
          </button>
        </div>

        <div style={styles.abas} className="eq-no-print">
          <button style={{ ...styles.abaBtn, ...(subAba === "novo" ? styles.abaBtnAtivo : {}) }} onClick={() => trocarSubAba("novo")}>
            {itemEditando ? "✏️ Editando" : "📝 Novo Cadastro"}
          </button>
          <button style={{ ...styles.abaBtn, ...(subAba === "lista" ? styles.abaBtnAtivo : {}) }} onClick={() => trocarSubAba("lista")}>
            📋 Consultar
          </button>
        </div>

        {abaTopo === "refrigeradores" ? (
          subAba === "novo" ? (
            <RefrigeradorForm pdvBase={pdvBase} itemEditando={itemEditando} onSalvo={aoSalvar} onCancelar={() => trocarSubAba("lista")} />
          ) : (
            <RefrigeradorList podeExcluir={podeExcluir} refreshKey={refreshKey} onEditar={editar} />
          )
        ) : (
          subAba === "novo" ? (
            <MaterialLeveForm pdvBase={pdvBase} itemEditando={itemEditando} onSalvo={aoSalvar} onCancelar={() => trocarSubAba("lista")} />
          ) : (
            <MaterialLeveList podeExcluir={podeExcluir} refreshKey={refreshKey} onEditar={editar} />
          )
        )}
      </div>
    </div>
  );
}
