import { useTema } from "../contexts/ThemeContext";

export default function TemaToggle() {
  const { tema, toggleTema } = useTema();

  return (
    <button
      style={styles.btn}
      onClick={toggleTema}
      title={tema === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"}
    >
      {tema === "dark" ? "☀️" : "🌙"}
    </button>
  );
}

const styles = {
  btn: {
    background: "rgba(128,128,128,0.1)",
    border: "1px solid rgba(128,128,128,0.15)",
    borderRadius: "8px",
    padding: "6px 10px",
    cursor: "pointer",
    fontSize: "0.95rem",
    lineHeight: 1,
  },
};
