import { useState } from "react";
import api from "../../services/api";
import styles from "./styles";
import PdvPicker from "./PdvPicker";
import FotoPicker from "./FotoPicker";
import { comprimirFoto } from "./imageUtils";

const SUGESTOES_TIPO = ["Cartaz", "Adesivo", "Hack Expositor", "Banner", "Faixa", "Móbile"];

const VAZIO = { tipo: "", quantidade: "1", dataRegistro: new Date().toISOString().split("T")[0] };

export default function MaterialLeveForm({ pdvBase, onSalvo }) {
  const [campos, setCampos] = useState(VAZIO);
  const [pdv, setPdv] = useState(null);
  const [foto, setFoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  function setCampo(nome, valor) {
    setCampos((c) => ({ ...c, [nome]: valor }));
  }

  async function selecionarFoto(file) {
    if (!file) return;
    const comprimida = await comprimirFoto(file);
    setFoto(comprimida);
    setPreview(URL.createObjectURL(comprimida));
  }

  async function enviar() {
    setErro("");
    if (!campos.tipo.trim()) return setErro("Informe o tipo de material (ex: Cartaz, Adesivo).");
    if (!foto) return setErro("Anexe a foto do material.");

    setEnviando(true);
    try {
      const form = new FormData();
      form.append("tipo", campos.tipo);
      form.append("quantidade", campos.quantidade || "1");
      form.append("data_registro", campos.dataRegistro);
      if (pdv) {
        form.append("cod_pdv", pdv.cod_pdv);
        form.append("nome_fantasia", pdv.nome_fantasia);
      }
      form.append("foto", foto);

      await api.post("/api/material-leve", form, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 60000,
      });

      setSucesso("Material leve cadastrado com sucesso!");
      setCampos(VAZIO);
      setPdv(null);
      setFoto(null); setPreview(null);
      setTimeout(() => setSucesso(""), 4000);
      onSalvo?.();
    } catch (err) {
      setErro(err.response?.data?.error || "Erro ao cadastrar. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div style={styles.formCard}>
      <h3 style={styles.formTitle}>🎯 Novo Material Leve</h3>

      <div style={styles.field}>
        <label style={styles.label}>Tipo *</label>
        <input style={styles.input} list="tipos-material-leve" placeholder="Ex: Cartaz, Adesivo, Hack Expositor" value={campos.tipo} onChange={(e) => setCampo("tipo", e.target.value)} />
        <datalist id="tipos-material-leve">
          {SUGESTOES_TIPO.map((t) => <option key={t} value={t} />)}
        </datalist>
      </div>

      <div style={styles.linha}>
        <div style={styles.field}>
          <label style={styles.label}>Quantidade</label>
          <input style={styles.input} type="number" min="0" value={campos.quantidade} onChange={(e) => setCampo("quantidade", e.target.value)} />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Data</label>
          <input style={styles.input} type="date" value={campos.dataRegistro} onChange={(e) => setCampo("dataRegistro", e.target.value)} />
        </div>
      </div>

      <div style={styles.field}>
        <label style={styles.label}>PDV (opcional)</label>
        <PdvPicker pdvBase={pdvBase} value={pdv} onChange={setPdv} />
      </div>

      <div style={styles.field}>
        <label style={styles.label}>Foto do material *</label>
        <FotoPicker
          label="Tirar foto do material"
          iconeAtivo="🎯"
          foto={foto}
          preview={preview}
          onFile={selecionarFoto}
        />
      </div>

      {erro && <p style={styles.erro}>{erro}</p>}
      {sucesso && <p style={styles.sucesso}>{sucesso}</p>}

      <button style={{ ...styles.btnEnviar, opacity: enviando ? 0.7 : 1 }} onClick={enviar} disabled={enviando}>
        {enviando ? "Enviando..." : "💾 Cadastrar Material"}
      </button>
    </div>
  );
}
