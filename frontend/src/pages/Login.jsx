import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api";

function formatCPF(value) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export default function Login() {
  const [cpf, setCpf] = useState("");
  const [senha, setSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleLogin() {
    setErro("");
    const cpfLimpo = cpf.replace(/\D/g, "");
    if (cpfLimpo.length !== 11) {
      setErro("Digite um CPF válido com 11 dígitos.");
      return;
    }
    if (!senha) {
      setErro("Digite sua senha.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("/api/auth/login", { cpf: cpfLimpo, senha });
      login(res.data.token, res.data.usuario);
      navigate("/");
    } catch (err) {
      setErro(err.response?.data?.error || "Erro ao entrar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.root}>
      <div style={styles.bgPattern} />
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.logoMark}>
            {/* logo da marca (cai no emoji se o arquivo ainda não estiver em /brand/logo.png) */}
            <img
              src="/brand/logo.png"
              alt="Hop Follow-up"
              style={styles.logoImg}
              onError={(e) => { e.currentTarget.style.display = "none"; if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display = "block"; }}
            />
            <span style={styles.logoEmoji}>🌿</span>
          </div>
          <h1 style={styles.title}>
            <span style={{ color: "#7DBA3D" }}>Hop</span> Follow-up
          </h1>
          <p style={styles.subtitle}>Inteligência que gera resultados</p>
        </div>

        <div style={styles.divider} />

        <div style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>CPF</label>
            <input
              style={styles.input}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => setCpf(formatCPF(e.target.value))}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              autoFocus
              maxLength={14}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Senha</label>
            <div style={styles.inputWrapper}>
              <input
                style={{ ...styles.input, flex: 1, border: "none", outline: "none" }}
                type={showSenha ? "text" : "password"}
                placeholder="Cmd@1234"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
              <button
                style={styles.eyeBtn}
                onClick={() => setShowSenha(!showSenha)}
                tabIndex={-1}
              >
                {showSenha ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          {erro && <p style={styles.erro}>{erro}</p>}

          <button
            style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }}
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? "Entrando..." : "Entrar →"}
          </button>

          <p style={styles.hint}>
            Senha padrão: <strong>Cmd@</strong> + 4 primeiros dígitos do CPF
          </p>
        </div>

        <p style={styles.footer}>Hop Follow-up · Análise de dados para cervejarias</p>
      </div>
    </div>
  );
}

const styles = {
  root: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#0c1410",
    fontFamily: "'Poppins', 'Segoe UI', system-ui, sans-serif",
    position: "relative",
    overflow: "hidden",
  },
  bgPattern: {
    position: "absolute",
    inset: 0,
    background: `
      radial-gradient(ellipse 80% 50% at 20% 40%, rgba(125,186,61,0.08) 0%, transparent 60%),
      radial-gradient(ellipse 60% 40% at 80% 60%, rgba(125,186,61,0.05) 0%, transparent 60%)
    `,
    pointerEvents: "none",
  },
  card: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "20px",
    padding: "40px 36px",
    width: "100%",
    maxWidth: "400px",
    backdropFilter: "blur(20px)",
    boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
    zIndex: 1,
  },
  header: { textAlign: "center", marginBottom: "8px" },
  logoMark: {
    width: "72px",
    height: "72px",
    background: "radial-gradient(circle at 35% 30%, #8FCF4A, #2E7D32 75%)",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 16px",
    boxShadow: "0 8px 28px rgba(125,186,61,0.35)",
    overflow: "hidden",
  },
  logoImg: { width: "100%", height: "100%", objectFit: "cover" },
  logoEmoji: { display: "none", fontSize: "2rem" },
  title: { color: "#ffffff", fontSize: "1.5rem", fontWeight: "700", margin: "0 0 4px" },
  subtitle: { color: "rgba(255,255,255,0.45)", fontSize: "0.85rem", margin: 0 },
  divider: { height: "1px", background: "rgba(255,255,255,0.08)", margin: "24px 0" },
  form: { display: "flex", flexDirection: "column", gap: "14px" },
  field: { display: "flex", flexDirection: "column", gap: "6px" },
  label: {
    color: "rgba(255,255,255,0.6)",
    fontSize: "0.8rem",
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  input: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "10px",
    color: "#ffffff",
    fontSize: "1rem",
    padding: "12px 14px",
    fontFamily: "inherit",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  inputWrapper: {
    display: "flex",
    alignItems: "center",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "10px",
    overflow: "hidden",
  },
  eyeBtn: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: "0 14px",
    fontSize: "1rem",
  },
  btn: {
    background: "linear-gradient(135deg, #7DBA3D, #2E7D32)",
    color: "#0c1410",
    border: "none",
    borderRadius: "10px",
    padding: "14px",
    fontSize: "0.95rem",
    fontWeight: "700",
    cursor: "pointer",
    marginTop: "4px",
    fontFamily: "inherit",
  },
  hint: {
    color: "rgba(255,255,255,0.25)",
    fontSize: "0.78rem",
    textAlign: "center",
    margin: 0,
  },
  erro: { color: "#ff6b6b", fontSize: "0.82rem", margin: "0", textAlign: "center" },
  footer: {
    color: "rgba(255,255,255,0.2)",
    fontSize: "0.75rem",
    textAlign: "center",
    marginTop: "24px",
    marginBottom: 0,
  },
};
