import imageCompression from "browser-image-compression";
import { Capacitor } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";

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

// true só dentro do app Android/iOS instalado (Capacitor). No navegador (PWA) é false.
export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

// Abre a câmera nativa direto (sem o seletor Câmera/Arquivos do navegador) e devolve
// um File pronto pra comprimir/enviar. Só funciona dentro do app instalado.
export async function tirarFotoNativa() {
  const foto = await Camera.getPhoto({
    quality: 85,
    allowEditing: false,
    resultType: CameraResultType.Uri,
    source: CameraSource.Camera,
  });
  const resposta = await fetch(foto.webPath);
  const blob = await resposta.blob();
  const extensao = foto.format || "jpg";
  return new File([blob], `foto-${Date.now()}.${extensao}`, { type: blob.type || `image/${extensao}` });
}
