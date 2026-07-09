import styles from "./styles";
import { isNativeApp, tirarFotoNativa } from "./imageUtils";

// Dentro do app instalado (Capacitor), abre a câmera nativa direto, sem passar pelo
// seletor Câmera/Arquivos do Android. No navegador (PWA), usa o <input capture> normal.
export default function FotoPicker({ label, iconeAtivo, foto, preview, onFile }) {
  const nativo = isNativeApp();

  async function abrirCameraNativa(e) {
    e.preventDefault();
    try {
      const file = await tirarFotoNativa();
      onFile(file);
    } catch {
      // usuário cancelou a foto — não faz nada
    }
  }

  return (
    <div>
      <label style={styles.uploadLabel} onClick={nativo ? abrirCameraNativa : undefined}>
        {!nativo && (
          <input
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: "none" }}
            onChange={(e) => onFile(e.target.files[0])}
          />
        )}
        <div style={{ ...styles.uploadArea, ...(foto ? styles.uploadAreaAtivo : {}) }}>
          <span style={{ fontSize: "1.5rem" }}>{foto ? iconeAtivo : "📷"}</span>
          <span style={styles.uploadNome}>{foto ? "Foto anexada — toque para trocar" : label}</span>
        </div>
      </label>
      {preview && <img src={preview} alt="preview" style={styles.previewImg} />}
    </div>
  );
}
