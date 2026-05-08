import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api";

export default function Login() {
  const [step, setStep] = useState("phone"); // "phone" | "otp"
  const [telefone, setTelefone] = useState("");
  const [codigo, setCodigo] = useState("");
  const [nomeUsuario, setNomeUsuario] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  function formatPhone(val) {
    const digits = val.replace(/\D/g, "").slice(0, 13);
    return digits;
  }

  async function handleRequestOTP() {
    setErro("");
    if (telefone.length < 10) {
      setErro("Digite um número válido com DDD.");
      return;
    }
    setLoading(true);
    try {
      // Normaliza: remove tudo que não é dígito, garante que começa com 55
      let digits = telefone.replace(/\D/g, "");
      if (digits.startsWith("55") && digits.length > 11) {
        // já tem o 55, mantém
      } else if (!digits.startsWith("55")) {
        digits = "55" + digits;
      }
      const res = await api.post("/api/auth/request-otp", { telefone: digits });
      setNomeUsuario(res.data.nome);
      setTelefone(digits);
      setStep("otp");
    } catch (err) {
      setErro(err.response?.data?.error || "Erro ao enviar código. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOTP() {
    setErro("");
    if (codigo.length !== 6) {
      setErro("Digite os 6 dígitos do código.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("/api/auth/verify-otp", { telefone, codigo });
      login(res.data.token, res.data.usuario);
      navigate("/");
    } catch (err) {
      setErro(err.response?.data?.error || "Código inválido.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.root}>
      {/* Background pattern */}
      <div style={styles.bgPattern} />

      <div style={styles.card}>
        {/* Logo / Header */}
        <div style={styles.header}>
          <div style={styles.logoMark}>
            <span style={styles.logoText}>CMD</span>
          </div>
          <h1 style={styles.title}>Ambev Conde</h1>
          <p style={styles.subtitle}>Plataforma de Gestão de Campo</p>
        </div>

        {/* Divider */}
        <div style={styles.divider} />

        {step === "phone" ? (
          <div style={styles.form}>
            <label style={styles.label}>Seu número de WhatsApp</label>
            <div style={styles.inputWrapper}>
              <span style={styles.inputPrefix}>+55</span>
              <input
                style={styles.input}
                type="tel"
                placeholder="83 9 8888-8888"
                value={telefone.replace(/^55/, "")}
                onChange={(e) => setTelefone(formatPhone(e.target.value))}
                onKeyDown={(e) => e.key === "Enter" && handleRequestOTP()}
                maxLength={11}
                autoFocus
              />
            </div>
            {erro && <p style={styles.erro}>{erro}</p>}
            <button
              style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }}
              onClick={handleRequestOTP}
              disabled={loading}
            >
              {loading ? "Enviando..." : "Receber código →"}
            </button>
          </div>
        ) : (
          <div style={styles.form}>
            <p style={styles.otpInfo}>
              Olá, <strong>{nomeUsuario}</strong>! 👋<br />
              Digite o código enviado para seu WhatsApp.
            </p>
            <input
              style={{ ...styles.input, textAlign: "center", letterSpacing: "0.5em", fontSize: "1.6rem", width: "100%", padding: "12px" }}
              type="number"
              placeholder="000000"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.slice(0, 6))}
              onKeyDown={(e) => e.key === "Enter" && handleVerifyOTP()}
              autoFocus
              maxLength={6}
            />
            {erro && <p style={styles.erro}>{erro}</p>}
            <button
              style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }}
              onClick={handleVerifyOTP}
              disabled={loading}
            >
              {loading ? "Verificando..." : "Entrar →"}
            </button>
            <button
              style={styles.btnLink}
              onClick={() => { setStep("phone"); setErro(""); setCodigo(""); }}
            >
              ← Usar outro número
            </button>
          </div>
        )}

        <p style={styles.footer}>CMD Ambev · Equipe Conde</p>
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
    background: "#0a0f1e",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    position: "relative",
    overflow: "hidden",
  },
  bgPattern: {
    position: "absolute",
    inset: 0,
    background: `
      radial-gradient(ellipse 80% 50% at 20% 40%, rgba(251,185,0,0.08) 0%, transparent 60%),
      radial-gradient(ellipse 60% 40% at 80% 60%, rgba(251,185,0,0.05) 0%, transparent 60%)
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
  header: {
    textAlign: "center",
    marginBottom: "8px",
  },
  logoMark: {
    width: "56px",
    height: "56px",
    background: "linear-gradient(135deg, #fbb900, #e6a200)",
    borderRadius: "14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 16px",
    boxShadow: "0 8px 24px rgba(251,185,0,0.3)",
  },
  logoText: {
    color: "#0a0f1e",
    fontWeight: "900",
    fontSize: "1.1rem",
    letterSpacing: "0.05em",
  },
  title: {
    color: "#ffffff",
    fontSize: "1.5rem",
    fontWeight: "700",
    margin: "0 0 4px",
  },
  subtitle: {
    color: "rgba(255,255,255,0.45)",
    fontSize: "0.85rem",
    margin: 0,
  },
  divider: {
    height: "1px",
    background: "rgba(255,255,255,0.08)",
    margin: "24px 0",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  label: {
    color: "rgba(255,255,255,0.6)",
    fontSize: "0.8rem",
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  inputWrapper: {
    display: "flex",
    alignItems: "center",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "10px",
    overflow: "hidden",
  },
  inputPrefix: {
    color: "rgba(255,255,255,0.4)",
    padding: "0 12px",
    fontSize: "0.9rem",
    borderRight: "1px solid rgba(255,255,255,0.08)",
    height: "48px",
    display: "flex",
    alignItems: "center",
  },
  input: {
    flex: 1,
    background: "transparent",
    border: "none",
    outline: "none",
    color: "#ffffff",
    fontSize: "1rem",
    padding: "12px 14px",
    fontFamily: "inherit",
  },
  btn: {
    background: "linear-gradient(135deg, #fbb900, #e6a200)",
    color: "#0a0f1e",
    border: "none",
    borderRadius: "10px",
    padding: "14px",
    fontSize: "0.95rem",
    fontWeight: "700",
    cursor: "pointer",
    transition: "opacity 0.2s",
    marginTop: "4px",
  },
  btnLink: {
    background: "transparent",
    border: "none",
    color: "rgba(255,255,255,0.4)",
    fontSize: "0.85rem",
    cursor: "pointer",
    textAlign: "center",
    padding: "4px",
    fontFamily: "inherit",
  },
  otpInfo: {
    color: "rgba(255,255,255,0.7)",
    fontSize: "0.9rem",
    lineHeight: "1.6",
    textAlign: "center",
    margin: "0 0 4px",
  },
  erro: {
    color: "#ff6b6b",
    fontSize: "0.82rem",
    margin: "0",
    textAlign: "center",
  },
  footer: {
    color: "rgba(255,255,255,0.2)",
    fontSize: "0.75rem",
    textAlign: "center",
    marginTop: "24px",
    marginBottom: 0,
  },
};
