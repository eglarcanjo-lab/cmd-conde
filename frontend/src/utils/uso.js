// Contagem de uso (Engajamento). Acumula no cliente e o App.jsx envia em lote a cada
// 5 min / ao sair (POST /api/uso/telas) — nenhuma escrita extra por clique.
// Chaves: "/rota" (tela) ou "/rota#aba" (aba/bloco dentro da tela).
import { useEffect } from "react";

export const usoContagem = {};

export function contarUso(chave) {
  if (!chave) return;
  usoContagem[chave] = (usoContagem[chave] || 0) + 1;
}

// Conta a aba ativa de uma tela sempre que ela muda: useContarAba("/produtos", aba)
export function useContarAba(rota, aba) {
  useEffect(() => { if (aba) contarUso(`${rota}#${aba}`); }, [rota, aba]);
}
