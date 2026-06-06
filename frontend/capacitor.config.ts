import type { CapacitorConfig } from "@capacitor/cli";

// ─────────────────────────────────────────────────────────────────────────────
// URL do app publicado na Vercel.
// Com `server.url` o APK abre o SITE AO VIVO — ou seja, cada deploy na Vercel
// aparece automaticamente, SEM precisar recompilar o APK. (O app é online mesmo,
// pois depende do backend.) Troque pela sua URL de produção:
const VERCEL_URL = "https://SUA-URL.vercel.app";
// ─────────────────────────────────────────────────────────────────────────────

const config: CapacitorConfig = {
  appId: "com.cmdconde.hop",
  appName: "Hop Follow-up",
  webDir: "dist",
  backgroundColor: "#0c1410",
  server: {
    url: VERCEL_URL,
    androidScheme: "https",
    cleartext: false,
  },
  android: {
    backgroundColor: "#0c1410",
  },
};

export default config;

// MODO ALTERNATIVO (app empacotado/offline): apague o bloco `server` acima e
// rode `npm run build` com VITE_API_URL apontando para o backend (Railway).
// Aí o APK leva o app embutido e você recompila a cada atualização de UI.
