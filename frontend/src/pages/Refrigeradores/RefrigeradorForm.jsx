import { useState } from "react";
import api from "../../services/api";
import styles from "./styles";
import PdvPicker from "./PdvPicker";
import FotoPicker from "./FotoPicker";
import { comprimirFoto } from "./imageUtils";

const CATEGORIAS = ["SOPI", "VISA"];
const STATUS_OPCOES = ["Estoque", "Comodatado", "Quebrado"];

const VAZIO = {
  item: "", modelo: "", serial: "", rg: "", categoria: "", status: "Estoque",
  numeroControleInterno: "", dataChegada: new Date().toISOString().split("T")[0],
};

export default function RefrigeradorForm({ pdvBase, onSalvo }) {
  const [campos, setCampos] = useState(VAZIO);
  const [pdv, setPdv] = useState(null);
  const [fotoEtiqueta, setFotoEtiqueta] = useState(null);
  const [previewEtiqueta, setPreviewEtiqueta] = useState(null);
  const [fotoEquipamento, setFotoEquipamento] = useState(null);
  const [previewEquipamento, setPreviewEquipamento] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  function setCampo(nome, valor) {
    setCampos((c) => ({ ...c, [nome]: valor }));
  }

  async function selecionarFoto(file, setFile, setPreview) {
    if (!file) return;
    const comprimida = await comprimirFoto(file);
    setFile(comprimida);
    setPreview(URL.createObjectURL(comprimida));
  }

  async function enviar() {
    setErro("");
    if (!campos.item.trim()) return setErro("Informe o item (ex: Refrigerador Spaten).");
    if (!fotoEtiqueta) return setErro("Anexe a foto da etiqueta.");
    if (!fotoEquipamento) return setErro("Anexe a foto do refrigerador.");

    setEnviando(true);
    try {
      const form = new FormData();
      form.append("item", campos.item);
      form.append("modelo", campos.modelo);
      form.append("serial", campos.serial);
      form.append("rg", campos.rg);
      form.append("categoria", campos.categoria);
      form.append("status", campos.status);
      form.append("numero_controle_interno", campos.numeroControleInterno);
      form.append("data_chegada", campos.dataChegada);
      if (pdv) {
        form.append("cod_pdv", pdv.cod_pdv);
        form.append("nome_fantasia", pdv.nome_fantasia);
      }
      form.append("foto_etiqueta", fotoEtiqueta);
      form.append("foto_equipamento", fotoEquipamento);

      await api.post("/api/refrigeradores", form, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 60000,
      });

      setSucesso("Refrigerador cadastrado com sucesso!");
      setCampos(VAZIO);
      setPdv(null);
      setFotoEtiqueta(null); setPreviewEtiqueta(null);
      setFotoEquipamento(null); setPreviewEquipamento(null);
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
      <h3 style={styles.formTitle}>🧊 Novo Refrigerador</h3>

      <div style={styles.field}>
        <label style={styles.label}>Item *</label>
        <input style={styles.input} placeholder="Ex: Refrigerador Spaten" value={campos.item} onChange={(e) => setCampo("item", e.target.value)} />
      </div>

      <div style={styles.linha}>
        <div style={styles.field}>
          <label style={styles.label}>Modelo</label>
          <input style={styles.input} placeholder="Ex: VN50A FDI42" value={campos.modelo} onChange={(e) => setCampo("modelo", e.target.value)} />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Serial</label>
          <input style={styles.input} value={campos.serial} onChange={(e) => setCampo("serial", e.target.value)} />
        </div>
      </div>

      <div style={styles.linha}>
        <div style={styles.field}>
          <label style={styles.label}>R.G.</label>
          <input style={styles.input} value={campos.rg} onChange={(e) => setCampo("rg", e.target.value)} />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Número de controle interno</label>
          <input style={styles.input} value={campos.numeroControleInterno} onChange={(e) => setCampo("numeroControleInterno", e.target.value)} />
        </div>
      </div>

      <div style={styles.linha}>
        <div style={styles.field}>
          <label style={styles.label}>Categoria</label>
          <select style={styles.select} value={campos.categoria} onChange={(e) => setCampo("categoria", e.target.value)}>
            <option value="">Selecione...</option>
            {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Status</label>
          <select style={styles.select} value={campos.status} onChange={(e) => setCampo("status", e.target.value)}>
            {STATUS_OPCOES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div style={styles.linha}>
        <div style={styles.field}>
          <label style={styles.label}>Data de chegada</label>
          <input style={styles.input} type="date" value={campos.dataChegada} onChange={(e) => setCampo("dataChegada", e.target.value)} />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>PDV (opcional)</label>
          <PdvPicker pdvBase={pdvBase} value={pdv} onChange={setPdv} />
        </div>
      </div>

      <div style={styles.linha}>
        <div style={styles.field}>
          <label style={styles.label}>Foto da etiqueta *</label>
          <FotoPicker
            label="Tirar foto da etiqueta"
            iconeAtivo="🏷️"
            foto={fotoEtiqueta}
            preview={previewEtiqueta}
            onFile={(file) => selecionarFoto(file, setFotoEtiqueta, setPreviewEtiqueta)}
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Foto do refrigerador *</label>
          <FotoPicker
            label="Tirar foto do refrigerador"
            iconeAtivo="🧊"
            foto={fotoEquipamento}
            preview={previewEquipamento}
            onFile={(file) => selecionarFoto(file, setFotoEquipamento, setPreviewEquipamento)}
          />
        </div>
      </div>

      {erro && <p style={styles.erro}>{erro}</p>}
      {sucesso && <p style={styles.sucesso}>{sucesso}</p>}

      <button style={{ ...styles.btnEnviar, opacity: enviando ? 0.7 : 1 }} onClick={enviar} disabled={enviando}>
        {enviando ? "Enviando..." : "💾 Cadastrar Refrigerador"}
      </button>
    </div>
  );
}
