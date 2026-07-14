import { useEffect, useState } from "react";
import api from "../../services/api";
import styles from "./styles";
import PdvPicker from "./PdvPicker";
import FotoPicker from "./FotoPicker";
import { comprimirFoto } from "./imageUtils";
import { paraInputDate } from "./dateUtils";

const CATEGORIAS = ["SOPI", "VISA"];
const STATUS_OPCOES = ["Estoque", "Comodatado", "Quebrado"];

function vazio() {
  return {
    item: "", modelo: "", serial: "", rg: "", categoria: "", status: "Estoque",
    numeroControleInterno: "", dataChegada: new Date().toISOString().split("T")[0],
    dataEntrega: "", numeroNota: "", dataEmissao: "",
  };
}

// itemEditando: null = cadastro novo. Objeto vindo da lista = edição (PUT em vez de POST).
export default function RefrigeradorForm({ pdvBase, itemEditando, onSalvo, onCancelar }) {
  const editando = !!itemEditando;
  const [campos, setCampos] = useState(vazio());
  const [pdv, setPdv] = useState(null);
  const [fotoEtiqueta, setFotoEtiqueta] = useState(null);
  const [previewEtiqueta, setPreviewEtiqueta] = useState(null);
  const [fotoEquipamento, setFotoEquipamento] = useState(null);
  const [previewEquipamento, setPreviewEquipamento] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  useEffect(() => {
    if (!itemEditando) {
      setCampos(vazio());
      setPdv(null);
      setFotoEtiqueta(null); setPreviewEtiqueta(null);
      setFotoEquipamento(null); setPreviewEquipamento(null);
      // Número de controle interno define a ordem de exibição em tudo — pré-preenche
      // com o próximo da sequência pra não depender de digitar certo.
      api.get("/api/refrigeradores/proximo-controle")
        .then((res) => setCampos((c) => ({ ...c, numeroControleInterno: res.data?.proximo || "" })))
        .catch(() => {});
      return;
    }
    const r = itemEditando;
    setCampos({
      item: r.item || "", modelo: r.modelo || "", serial: r.serial || "", rg: r.rg || "",
      categoria: r.categoria || "", status: r.status || "Estoque",
      numeroControleInterno: r.numero_controle_interno || "",
      dataChegada: paraInputDate(r.data_chegada) || new Date().toISOString().split("T")[0],
      dataEntrega: paraInputDate(r.data_entrega), numeroNota: r.numero_nota || "", dataEmissao: paraInputDate(r.data_emissao),
    });
    setPdv(r.cod_pdv ? { cod_pdv: r.cod_pdv, nome_fantasia: r.nome_fantasia } : null);
    setFotoEtiqueta(null); setPreviewEtiqueta(r.foto_etiqueta_url || null);
    setFotoEquipamento(null); setPreviewEquipamento(r.foto_equipamento_url || null);
  }, [itemEditando]);

  const comodatado = campos.status === "Comodatado";

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
    if (!editando && !fotoEtiqueta) return setErro("Anexe a foto da etiqueta.");
    if (!editando && !fotoEquipamento) return setErro("Anexe a foto do refrigerador.");
    if (comodatado && !pdv) return setErro("Comodatado precisa de um PDV — informe pra quem foi entregue.");
    if (comodatado && !campos.dataEntrega) return setErro("Comodatado precisa da data de entrega.");
    if (comodatado && !campos.numeroNota.trim()) return setErro("Comodatado precisa do número da nota.");
    if (comodatado && !campos.dataEmissao) return setErro("Comodatado precisa da data de emissão da nota.");

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
      form.append("data_entrega", campos.dataEntrega);
      form.append("numero_nota", campos.numeroNota);
      form.append("data_emissao", campos.dataEmissao);
      if (pdv) {
        form.append("cod_pdv", pdv.cod_pdv);
        form.append("nome_fantasia", pdv.nome_fantasia);
      }
      if (fotoEtiqueta) form.append("foto_etiqueta", fotoEtiqueta);
      if (fotoEquipamento) form.append("foto_equipamento", fotoEquipamento);

      if (editando) {
        await api.put(`/api/refrigeradores/${itemEditando.id}`, form, {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 60000,
        });
        setSucesso("Refrigerador atualizado com sucesso!");
      } else {
        await api.post("/api/refrigeradores", form, {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 60000,
        });
        setSucesso("Refrigerador cadastrado com sucesso!");
        setCampos(vazio());
        setPdv(null);
        setFotoEtiqueta(null); setPreviewEtiqueta(null);
        setFotoEquipamento(null); setPreviewEquipamento(null);
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
      <h3 style={styles.formTitle}>{editando ? "✏️ Editar Refrigerador" : "🧊 Novo Refrigerador"}</h3>

      <div style={styles.field}>
        <label style={styles.label}>Item *</label>
        <input style={styles.input} placeholder="Ex: Refrigerador Spaten" value={campos.item} onChange={(e) => setCampo("item", e.target.value)} />
      </div>

      <div style={styles.linha}>
        <div style={styles.fieldLinha}>
          <label style={styles.label}>Modelo</label>
          <input style={styles.input} placeholder="Ex: VN50A FDI42" value={campos.modelo} onChange={(e) => setCampo("modelo", e.target.value)} />
        </div>
        <div style={styles.fieldLinha}>
          <label style={styles.label}>Serial</label>
          <input style={styles.input} value={campos.serial} onChange={(e) => setCampo("serial", e.target.value)} />
        </div>
      </div>

      <div style={styles.linha}>
        <div style={styles.fieldLinha}>
          <label style={styles.label}>R.G.</label>
          <input style={styles.input} value={campos.rg} onChange={(e) => setCampo("rg", e.target.value)} />
        </div>
        <div style={styles.fieldLinha}>
          <label style={styles.label}>Número de controle interno</label>
          <input style={styles.input} value={campos.numeroControleInterno} onChange={(e) => setCampo("numeroControleInterno", e.target.value)} />
          {!editando && <span style={styles.hint}>Preenchido com o próximo da sequência — é o que define a ordem de exibição em tudo (lista, PDF, Excel).</span>}
        </div>
      </div>

      <div style={styles.linha}>
        <div style={styles.fieldLinha}>
          <label style={styles.label}>Categoria</label>
          <select style={styles.select} value={campos.categoria} onChange={(e) => setCampo("categoria", e.target.value)}>
            <option value="">Selecione...</option>
            {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={styles.fieldLinha}>
          <label style={styles.label}>Status</label>
          <select style={styles.select} value={campos.status} onChange={(e) => setCampo("status", e.target.value)}>
            {STATUS_OPCOES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div style={styles.linha}>
        <div style={styles.fieldLinha}>
          <label style={styles.label}>Data de chegada</label>
          <input style={styles.input} type="date" value={campos.dataChegada} onChange={(e) => setCampo("dataChegada", e.target.value)} />
        </div>
        <div style={styles.fieldLinha}>
          <label style={styles.label}>PDV {comodatado ? "*" : "(opcional)"}</label>
          <PdvPicker pdvBase={pdvBase} value={pdv} onChange={setPdv} obrigatorio={comodatado} />
        </div>
      </div>

      {comodatado && (
        <>
          <div style={styles.linha}>
            <div style={styles.fieldLinha}>
              <label style={styles.label}>Data de entrega *</label>
              <input style={styles.input} type="date" value={campos.dataEntrega} onChange={(e) => setCampo("dataEntrega", e.target.value)} />
            </div>
            <div style={styles.fieldLinha}>
              <label style={styles.label}>Número da nota *</label>
              <input style={styles.input} value={campos.numeroNota} onChange={(e) => setCampo("numeroNota", e.target.value)} />
            </div>
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Data de emissão *</label>
            <input style={styles.input} type="date" value={campos.dataEmissao} onChange={(e) => setCampo("dataEmissao", e.target.value)} />
            <span style={styles.hint}>Comodatado precisa do PDV, data de entrega, número da nota e data de emissão.</span>
          </div>
        </>
      )}

      <div style={styles.linha}>
        <div style={styles.fieldLinha}>
          <label style={styles.label}>Foto da etiqueta {editando ? "" : "*"}</label>
          <FotoPicker
            label="Tirar foto da etiqueta"
            iconeAtivo="🏷️"
            foto={!!previewEtiqueta}
            preview={previewEtiqueta}
            onFile={(file) => selecionarFoto(file, setFotoEtiqueta, setPreviewEtiqueta)}
          />
        </div>

        <div style={styles.fieldLinha}>
          <label style={styles.label}>Foto do refrigerador {editando ? "" : "*"}</label>
          <FotoPicker
            label="Tirar foto do refrigerador"
            iconeAtivo="🧊"
            foto={!!previewEquipamento}
            preview={previewEquipamento}
            onFile={(file) => selecionarFoto(file, setFotoEquipamento, setPreviewEquipamento)}
          />
        </div>
      </div>

      {erro && <p style={styles.erro}>{erro}</p>}
      {sucesso && <p style={styles.sucesso}>{sucesso}</p>}

      <div style={styles.linha}>
        <button style={{ ...styles.btnEnviar, opacity: enviando ? 0.7 : 1, flex: "1 1 auto" }} onClick={enviar} disabled={enviando}>
          {enviando ? "Salvando..." : editando ? "💾 Salvar Alterações" : "💾 Cadastrar Refrigerador"}
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
