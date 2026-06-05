import { useNavigate } from "react-router-dom";

export default function ManutencaoScreen({ mensagem = "Em Manutenção" }) {
  const navigate = useNavigate();

  const isAtualizacao = mensagem.toLowerCase().includes("atualiz");
  const icon = isAtualizacao ? "⚙️" : "🔧";

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0c1410",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      position: "relative",
    }}>
      {/* Card central */}
      <div style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "20px",
        padding: "48px 40px",
        maxWidth: "420px",
        width: "100%",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "16px",
      }}>
        <div style={{ fontSize: "3rem", lineHeight: 1 }}>{icon}</div>

        <h1 style={{
          margin: 0,
          fontSize: "1.5rem",
          fontWeight: "800",
          color: "#7DBA3D",
          letterSpacing: "-0.02em",
        }}>
          {mensagem}
        </h1>

        <p style={{
          margin: 0,
          fontSize: "0.9rem",
          color: "rgba(255,255,255,0.45)",
          lineHeight: "1.6",
        }}>
          O sistema está temporariamente indisponível.<br />
          Tente novamente em instantes.
        </p>

        <div style={{
          marginTop: "8px",
          width: "40px",
          height: "3px",
          borderRadius: "2px",
          background: "linear-gradient(90deg, #7DBA3D, rgba(125,186,61,0.3))",
          animation: "pulse 2s ease-in-out infinite",
        }} />
      </div>

      {/* Link discreto pro admin */}
      <button
        onClick={() => navigate("/login")}
        style={{
          position: "absolute",
          bottom: "24px",
          right: "28px",
          background: "none",
          border: "none",
          color: "rgba(255,255,255,0.18)",
          fontSize: "0.72rem",
          cursor: "pointer",
          fontFamily: "inherit",
          padding: "4px 8px",
        }}
      >
        acesso admin
      </button>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
      `}</style>
    </div>
  );
}
