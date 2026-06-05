// Identidade visual — Hop Follow-up
// Use estas constantes em componentes novos para manter a marca consistente.

export const BRAND = {
  nome: "Hop Follow-up",
  slogan: "Inteligência que gera resultados",
  subtitulo: "Análise de dados comerciais para cervejarias",
};

// Paleta oficial
export const COLORS = {
  verde:       "#7DBA3D", // acento principal (claro)
  verdeMedio:  "#2E7D32",
  verdeEscuro: "#0E3B1D",
  preto:       "#1A1A1A",
  cinza:       "#2B2B2B",
  branco:      "#EDEDED",

  // Derivados de UI
  bg:          "#0c1410", // fundo do app (verde-quase-preto)
  surface:     "rgba(255,255,255,0.04)",
  borda:       "rgba(255,255,255,0.08)",
  texto:       "#ffffff",
  textoFraco:  "rgba(255,255,255,0.45)",
  acentoRGBA:  (a = 1) => `rgba(125,186,61,${a})`, // verde com alpha
};

// Caminhos dos assets da marca (coloque os arquivos em frontend/public/brand/)
export const ASSETS = {
  logo:        "/brand/logo.png",         // esfera verde + lúpulo
  hopWelcome:  "/brand/hop-welcome.png",  // a Hop (assistente) — janela de boas-vindas
  icone:       "/icon-512.png",           // ícone do app (PWA)
};
