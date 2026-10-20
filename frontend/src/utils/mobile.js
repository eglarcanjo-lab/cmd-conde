// Celular × computador — fonte única do breakpoint (o mesmo do mobile.css / TabelaResponsiva).
import { useEffect, useState } from "react";

export const QUERY_MOBILE = "(max-width: 767px)";

export function ehMobile() {
  return typeof window !== "undefined" && window.matchMedia(QUERY_MOBILE).matches;
}

// Hook: true no celular; reage a girar a tela / redimensionar.
export function useMobile() {
  const [mob, setMob] = useState(ehMobile);
  useEffect(() => {
    const mq = window.matchMedia(QUERY_MOBILE);
    const on = (e) => setMob(e.matches);
    if (mq.addEventListener) mq.addEventListener("change", on); else mq.addListener(on);
    return () => { if (mq.removeEventListener) mq.removeEventListener("change", on); else mq.removeListener(on); };
  }, []);
  return mob;
}
