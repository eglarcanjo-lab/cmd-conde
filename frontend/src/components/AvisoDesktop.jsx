// Aviso no CELULAR para ferramentas de gestão feitas p/ computador (grades largas, edição em massa).
import { useMobile } from "../utils/mobile";

export default function AvisoDesktop({ texto = "Esta tela foi feita para o computador — no celular algumas tabelas precisam ser arrastadas para o lado." }) {
  const mobile = useMobile();
  if (!mobile) return null;
  return (
    <div role="note" style={{ margin: "8px 12px", padding: "8px 12px", borderRadius: 10, background: "rgba(245,196,81,0.10)", border: "1px solid rgba(245,196,81,0.35)",
      color: "#f5c451", fontSize: "0.78rem", fontFamily: "'Poppins','Segoe UI',system-ui,sans-serif" }}>
      💻 {texto}
    </div>
  );
}
