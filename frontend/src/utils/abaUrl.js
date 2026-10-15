// Aba guardada no ENDEREÇO (?aba=shelf): recarregar a página, voltar ou mandar o link
// abre na mesma aba. Uso igual ao useState:
//   const [aba, setAba] = useAbaUrl("aba", "grade");
// A aba padrão não aparece no endereço. Troca com replace (não enche o "voltar").
import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

export function useAbaUrl(chave, padrao) {
  const [params, setParams] = useSearchParams();
  const aba = params.get(chave) || padrao;
  const setAba = useCallback((nova) => {
    setParams((atual) => {
      const p = new URLSearchParams(atual);
      const valor = typeof nova === "function" ? nova(atual.get(chave) || padrao) : nova;
      if (!valor || valor === padrao) p.delete(chave); else p.set(chave, valor);
      return p;
    }, { replace: true });
  }, [chave, padrao, setParams]);
  return [aba, setAba];
}
