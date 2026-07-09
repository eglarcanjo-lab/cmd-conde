import { useState } from "react";
import styles from "./styles";

// Busca de PDV por código ou nome fantasia. `value` é { cod_pdv, nome_fantasia } | null.
export default function PdvPicker({ pdvBase, value, onChange, obrigatorio }) {
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);

  const sugestoes = busca.trim().length >= 2
    ? pdvBase
        .filter((p) =>
          p.nome_fantasia?.toLowerCase().includes(busca.toLowerCase()) ||
          p.cod_pdv?.includes(busca)
        )
        .slice(0, 8)
    : [];

  if (value) {
    return (
      <div style={styles.pdvSelecionado}>
        <span>🏪 {value.nome_fantasia || value.cod_pdv} <span style={{ opacity: 0.6 }}>({value.cod_pdv})</span></span>
        <button type="button" style={styles.pdvLimpar} onClick={() => onChange(null)}>trocar</button>
      </div>
    );
  }

  return (
    <div style={styles.pdvWrap}>
      <input
        style={styles.input}
        type="text"
        placeholder={obrigatorio ? "Buscar PDV por nome ou código" : "Buscar PDV por nome ou código (opcional)"}
        value={busca}
        onChange={(e) => { setBusca(e.target.value); setAberto(true); }}
        onFocus={() => setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
      />
      {aberto && sugestoes.length > 0 && (
        <div style={styles.pdvLista}>
          {sugestoes.map((p) => (
            <div
              key={p.cod_pdv}
              style={styles.pdvItem}
              onMouseDown={() => { onChange(p); setBusca(""); setAberto(false); }}
            >
              {p.nome_fantasia} <span style={{ opacity: 0.5 }}>· {p.cod_pdv}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
