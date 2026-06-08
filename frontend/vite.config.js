import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",       // controlamos o refresh via banner (registerSW manual)
      injectRegister: false,        // registramos manualmente em components/AtualizacaoApp
      includeAssets: ["icon-192.png", "icon-512.png", "apple-touch-icon.png"],
      manifest: {
        name: "Hop Follow-up",
        short_name: "Hop",
        description: "Hop Follow-up — Inteligência que gera resultados. Análise de dados comerciais para cervejarias.",
        theme_color: "#0c1410",
        background_color: "#0c1410",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        // clientsClaim: o novo SW assume o controle assim que ativa (após o
        // skipWaiting do botão) → o reload do banner acontece na hora, sem travar.
        clientsClaim: true,
        skipWaiting: false,            // o refresh é controlado pelo botão
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\/api\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
              networkTimeoutSeconds: 10,
            },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
