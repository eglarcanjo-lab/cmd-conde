import { useEffect, useMemo, useState } from "react";
import api from "../../services/api";
import styles, { STATUS_CONFIG, CATEGORIA_CONFIG } from "./styles";
import { exportarExcelRefrigeradores } from "./exportUtils";

export default function RefrigeradorList({ podeExcluir, refreshKey, onEditar }) {
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("");
  const [categoria, setCategoria] = useState("");

  useEffect(() => { carregar(); }, [refreshKey]);

  async function carregar() {
    setLoading(true);
    try {
      const res = await api.get("/api/refrigeradores");
      setItens(res.data || []);
    } catch { }
    finally { setLoading(false); }
  }

  async function excluir(id) {
    if (!window.confirm("Excluir este refrigerador cadastrado?")) return;
    try {
      await api.delete(`/api/refrigeradores/${id}`);
      setItens((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      alert(err.response?.data?.error || "Erro ao excluir.");
    }
  }

  const filtrados = useMemo(() => {
    return itens.filter((i) => {
      if (status && i.status !== status) return false;
      if (categoria && i.categoria !== categoria) return false;
      if (busca.trim()) {
        const alvo = `${i.item} ${i.modelo} ${i.serial} ${i.rg} ${i.numero_controle_interno} ${i.nome_fantasia}`.toLowerCase();
        if (!alvo.includes(busca.trim().toLowerCase())) return false;
      }
      return true;
    });
  }, [itens, busca, status, categoria]);

  return (
    <div>
      <div style={styles.toolbarExport} className="eq-no-print">
        <button style={styles.btnExport} onClick={() => exportarExcelRefrigeradores(filtrados)} title="Exportar Excel">
          📊 <span className="eq-export-label">Excel</span>
        </button>
        <button style={styles.btnExport} onClick={() => window.print()} title="Exportar PDF">
          📄 <span className="eq-export-label">PDF</span>
        </button>
      </div>

      <div style={styles.filtros} className="eq-no-print">
        <input style={styles.filtroInput} placeholder="Buscar por item, modelo, serial, RG, controle..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select style={styles.filtroSelect} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos status</option>
          {Object.keys(STATUS_CONFIG).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select style={styles.filtroSelect} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          <option value="">Todas categorias</option>
          {Object.keys(CATEGORIA_CONFIG).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {loading ? (
        <p style={styles.msg}>Carregando...</p>
      ) : filtrados.length === 0 ? (
        <p style={styles.msg}>Nenhum refrigerador encontrado.</p>
      ) : (
        <div style={styles.lista} className="eq-lista">
          {filtrados.map((r) => {
            const stConf = STATUS_CONFIG[r.status] || STATUS_CONFIG["Estoque"];
            const catConf = CATEGORIA_CONFIG[r.categoria];
            return (
              <div key={r.id} style={styles.card} className="eq-card eq-card-refrigerador">
                <div style={styles.cardHeader}>
                  <div style={styles.cardHeaderLeft}>
                    <span style={{ ...styles.tag, background: stConf.bg, color: stConf.color }}>{r.status || "—"}</span>
                    {catConf && <span style={{ ...styles.tag, background: catConf.bg, color: catConf.color }}>{r.categoria}</span>}
                  </div>
                  <span style={styles.cardId}>#{r.id}</span>
                </div>

                <h4 style={styles.cardTitulo}>{r.item}</h4>
                {r.nome_fantasia && <p style={styles.cardSub}>🏪 {r.nome_fantasia}</p>}

                <div style={styles.cardGrid}>
                  <div><span style={styles.cardGridLabel}>Modelo: </span><span style={styles.cardGridValor}>{r.modelo || "—"}</span></div>
                  <div><span style={styles.cardGridLabel}>Serial: </span><span style={styles.cardGridValor}>{r.serial || "—"}</span></div>
                  <div><span style={styles.cardGridLabel}>R.G.: </span><span style={styles.cardGridValor}>{r.rg || "—"}</span></div>
                  <div><span style={styles.cardGridLabel}>Controle interno: </span><span style={styles.cardGridValor}>{r.numero_controle_interno || "—"}</span></div>
                  <div><span style={styles.cardGridLabel}>Chegada: </span><span style={styles.cardGridValor}>{r.data_chegada || "—"}</span></div>
                  {r.status === "Comodatado" && (
                    <>
                      <div><span style={styles.cardGridLabel}>Entrega: </span><span style={styles.cardGridValor}>{r.data_entrega || "—"}</span></div>
                      <div><span style={styles.cardGridLabel}>Nota: </span><span style={styles.cardGridValor}>{r.numero_nota || "—"}</span></div>
                      <div><span style={styles.cardGridLabel}>Emissão: </span><span style={styles.cardGridValor}>{r.data_emissao || "—"}</span></div>
                    </>
                  )}
                </div>

                <div style={styles.thumbs} className="eq-thumbs-refrigerador">
                  {r.foto_etiqueta_url && (
                    <a href={r.foto_etiqueta_url} target="_blank" rel="noreferrer">
                      <img src={r.foto_etiqueta_url} alt="etiqueta" style={styles.thumb} className="eq-thumb eq-thumb-etiqueta" />
                    </a>
                  )}
                  {r.foto_equipamento_url && (
                    <a href={r.foto_equipamento_url} target="_blank" rel="noreferrer">
                      <img src={r.foto_equipamento_url} alt="equipamento" style={styles.thumb} className="eq-thumb eq-thumb-equipamento" />
                    </a>
                  )}
                </div>

                <div style={styles.cardAcoes} className="eq-no-print">
                  <button style={styles.btnEditar} onClick={() => onEditar?.(r)}>✏️ Editar</button>
                  {podeExcluir && (
                    <button style={styles.btnExcluir} onClick={() => excluir(r.id)}>🗑️ Excluir</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
