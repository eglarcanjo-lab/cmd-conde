import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import HomeClassic from "./HomeClassic";
import HomeDashboard from "./HomeDashboard";

// A home-dashboard (3 blocos + barra lateral) é só para DESKTOP e perfis admin/director.
// RN — e qualquer perfil no mobile — vê a home clássica (menu de cards), como antes.
const QUERY_DESKTOP = "(min-width: 1024px)";

function useDesktop() {
  const [desk, setDesk] = useState(
    () => typeof window !== "undefined" && window.matchMedia(QUERY_DESKTOP).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(QUERY_DESKTOP);
    const onChange = (e) => setDesk(e.matches);
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange); // Safari antigo
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, []);
  return desk;
}

export default function Home() {
  const { usuario } = useAuth();
  const desktop = useDesktop();
  const adminOuDirector = usuario?.perfil === "admin" || usuario?.perfil === "director";

  return desktop && adminOuDirector ? <HomeDashboard /> : <HomeClassic />;
}
