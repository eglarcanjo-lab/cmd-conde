import { useEffect, useMemo, useState } from "react";
import api from "../../services/api";
import styles from "./styles";
import { exportarExcelMaterialLeve } from "./exportUtils";

export default function MaterialLeveList({ podeExcluir, refreshKey }) {
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState("");

  useEffect(() => { carregar(); }, [refreshKey]);

  async function carregar() {
    setLoading(true);
    try {
      const res = await api.get("/api/material-leve");
      setItens(res.data || []);
    } catch { }
    finally { setLoading(false); }
  }

  async function excluir(id) {
    if (!window.confirm("Excluir este material leve cadastrado?")) return;
    try {
      await api.delete(`/api/material-leve/${id}`);
      setItens((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      alert(err.response?.data?.error || "Erro ao excluir.");
    }
  }

  const filtrados = useMemo(() => {
    if (!busca.trim()) return itens;
    const alvo = busca.trim().toLowerCase();
    return itens.filter((i) => `${i.tipo} ${i.nome_fantasia}`.toLowerCase().includes(alvo));
  }, [itens, busca]);

  return (
    <div>
      <div style={styles.toolbarExport} className="eq-no-print">
        <button style={styles.btnExport} onClick={() => exportarExcelMaterialLeve(filtrados)} title="Exportar Excel">
          📊 <span className="eq-export-label">Excel</span>
        </button>
        <button style={styles.btnExport} onClick={() => window.print()} title="Exportar PDF">
          📄 <span className="eq-export-label">PDF</span>
        </button>
      </div>

      <div style={styles.filtros} className="eq-no-print">
        <input style={styles.filtroInput} placeholder="Buscar por tipo ou PDV..." value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>

      {loading ? (
        <p style={styles.msg}>Carregando...</p>
      ) : filtrados.length === 0 ? (
        <p style={styles.msg}>Nenhum material leve encontrado.</p>
      ) : (
        <div style={styles.lista}>
          {filtrados.map((m) => (
            <div key={m.id} style={styles.card} className="eq-card">
              <div style={styles.cardHeader}>
                <h4 style={styles.cardTitulo}>{m.tipo}</h4>
                <span style={styles.cardId}>#{m.id}</span>
              </div>
              {m.nome_fantasia && <p style={styles.cardSub}>🏪 {m.nome_fantasia}</p>}

              <div style={styles.cardGrid}>
                <div><span style={styles.cardGridLabel}>Quantidade: </span><span style={styles.cardGridValor}>{m.quantidade ?? "—"}</span></div>
                <div><span style={styles.cardGridLabel}>Data: </span><span style={styles.cardGridValor}>{m.data_registro || "—"}</span></div>
              </div>

              {m.foto_url && (
                <div style={styles.thumbs}>
                  <a href={m.foto_url} target="_blank" rel="noreferrer">
                    <img src={m.foto_url} alt="material" style={styles.thumb} className="eq-thumb" />
                  </a>
                </div>
              )}

              {podeExcluir && (
                <div style={styles.cardAcoes} className="eq-no-print">
                  <button style={styles.btnExcluir} onClick={() => excluir(m.id)}>🗑️ Excluir</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
