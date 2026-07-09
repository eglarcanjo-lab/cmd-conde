import { useEffect, useState } from "react";
import api from "../../services/api";
import styles from "./styles";
import PdvPicker from "./PdvPicker";
import FotoPicker from "./FotoPicker";
import { comprimirFoto } from "./imageUtils";

const SUGESTOES_TIPO = ["Cartaz", "Adesivo", "Hack Expositor", "Banner", "Faixa", "Móbile"];

function vazio() {
  return { tipo: "", quantidade: "1", dataRegistro: new Date().toISOString().split("T")[0] };
}

// itemEditando: null = cadastro novo. Objeto vindo da lista = edição (PUT em vez de POST).
export default function MaterialLeveForm({ pdvBase, itemEditando, onSalvo, onCancelar }) {
  const editando = !!itemEditando;
  const [campos, setCampos] = useState(vazio());
  const [pdv, setPdv] = useState(null);
  const [foto, setFoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  useEffect(() => {
    if (!itemEditando) {
      setCampos(vazio());
      setPdv(null);
      setFoto(null); setPreview(null);
      return;
    }
    const m = itemEditando;
    setCampos({
      tipo: m.tipo || "", quantidade: String(m.quantidade ?? "1"),
      dataRegistro: m.data_registro || new Date().toISOString().split("T")[0],
    });
    setPdv(m.cod_pdv ? { cod_pdv: m.cod_pdv, nome_fantasia: m.nome_fantasia } : null);
    setFoto(null); setPreview(m.foto_url || null);
  }, [itemEditando]);

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
    if (!editando && !foto) return setErro("Anexe a foto do material.");

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
      if (foto) form.append("foto", foto);

      if (editando) {
        await api.put(`/api/material-leve/${itemEditando.id}`, form, {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 60000,
        });
        setSucesso("Material leve atualizado com sucesso!");
      } else {
        await api.post("/api/material-leve", form, {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 60000,
        });
        setSucesso("Material leve cadastrado com sucesso!");
        setCampos(vazio());
        setPdv(null);
        setFoto(null); setPreview(null);
      }
      setTimeout(() => setSucesso(""), 4000);
      onSalvo?.();
    } catch (err) {
      setErro(err.response?.data?.error || "Erro ao salvar. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div style={styles.formCard}>
      <h3 style={styles.formTitle}>{editando ? "✏️ Editar Material Leve" : "📦 Novo Material Leve"}</h3>

      <div style={styles.field}>
        <label style={styles.label}>Tipo *</label>
        <input style={styles.input} list="tipos-material-leve" placeholder="Ex: Cartaz, Adesivo, Hack Expositor" value={campos.tipo} onChange={(e) => setCampo("tipo", e.target.value)} />
        <datalist id="tipos-material-leve">
          {SUGESTOES_TIPO.map((t) => <option key={t} value={t} />)}
        </datalist>
      </div>

      <div style={styles.linha}>
        <div style={styles.fieldLinha}>
          <label style={styles.label}>Quantidade</label>
          <input style={styles.input} type="number" min="0" value={campos.quantidade} onChange={(e) => setCampo("quantidade", e.target.value)} />
        </div>
        <div style={styles.fieldLinha}>
          <label style={styles.label}>Data</label>
          <input style={styles.input} type="date" value={campos.dataRegistro} onChange={(e) => setCampo("dataRegistro", e.target.value)} />
        </div>
      </div>

      <div style={styles.field}>
        <label style={styles.label}>PDV (opcional)</label>
        <PdvPicker pdvBase={pdvBase} value={pdv} onChange={setPdv} />
      </div>

      <div style={styles.field}>
        <label style={styles.label}>Foto do material {editando ? "" : "*"}</label>
        <FotoPicker
          label="Tirar foto do material"
          iconeAtivo="📦"
          foto={!!preview}
          preview={preview}
          onFile={selecionarFoto}
        />
      </div>

      {erro && <p style={styles.erro}>{erro}</p>}
      {sucesso && <p style={styles.sucesso}>{sucesso}</p>}

      <div style={styles.linha}>
        <button style={{ ...styles.btnEnviar, opacity: enviando ? 0.7 : 1, flex: "1 1 auto" }} onClick={enviar} disabled={enviando}>
          {enviando ? "Salvando..." : editando ? "💾 Salvar Alterações" : "💾 Cadastrar Material"}
        </button>
        {editando && (
          <button style={styles.btnCancelar} onClick={onCancelar} disabled={enviando}>
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}
