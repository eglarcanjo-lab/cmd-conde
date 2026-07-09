import imageCompression from "browser-image-compression";

// Comprimir fotos tiradas no celular antes do upload — reduz tempo de envio
// e consumo de dados móveis. Se a compressão falhar, manda o arquivo original.
export async function comprimirFoto(file) {
  if (!file) return file;
  try {
    return await imageCompression(file, {
      maxWidthOrHeight: 1600,
      maxSizeMB: 1,
      initialQuality: 0.75,
      useWebWorker: true,
    });
  } catch {
    return file;
  }
}
