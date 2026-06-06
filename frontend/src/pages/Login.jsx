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
  const [aviso, setAviso] = useState("");
  // etapa: "login" | "trocar"  (trocar = forçar criação de senha individual)
  const [etapa, setEtapa] = useState("login");
  const [pend, setPend] = useState(null); // { token, usuario } aguardando troca de senha
  const [novaSenha, setNovaSenha] = useState("");
  const [confSenha, setConfSenha] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleLogin() {
    setErro(""); setAviso("");
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
      if (res.data.precisa_trocar_senha) {
        // Autentica o token só para a troca; só "loga" de fato após criar a nova senha
        api.defaults.headers.common["Authorization"] = `Bearer ${res.data.token}`;
        setPend({ token: res.data.token, usuario: res.data.usuario });
        setNovaSenha(""); setConfSenha("");
        setEtapa("trocar");
      } else {
        login(res.data.token, res.data.usuario);
        navigate("/");
      }
    } catch (err) {
      setErro(err.response?.data?.error || "Erro ao entrar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleTrocarSenha() {
    setErro("");
    if (novaSenha.length < 4) { setErro("A nova senha precisa ter pelo menos 4 caracteres."); return; }
    if (novaSenha === "1234") { setErro("Escolha uma senha diferente da padrão (1234)."); return; }
    if (novaSenha !== confSenha) { setErro("As senhas não conferem."); return; }
    setLoading(true);
    try {
      await api.post("/api/auth/trocar-senha", { nova_senha: novaSenha });
      login(pend.token, pend.usuario); // agora sim entra
      navigate("/");
    } catch (err) {
      setErro(err.response?.data?.error || "Erro ao salvar a senha.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRedefinir() {
    setErro(""); setAviso("");
    const cpfLimpo = cpf.replace(/\D/g, "");
    if (cpfLimpo.length !== 11) { setErro("Digite seu CPF acima para solicitar a redefinição."); return; }
    setLoading(true);
    try {
      const res = await api.post("/api/auth/redefinir-senha", { cpf: cpfLimpo });
      setAviso(res.data?.message || "Solicitação enviada ao admin.");
    } catch (err) {
      setErro(err.response?.data?.error || "Erro ao solicitar redefinição.");
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

        {etapa === "trocar" ? (
          <div style={styles.form}>
            <p style={styles.trocarTitulo}>👋 Olá{pend?.usuario?.nome ? `, ${pend.usuario.nome.split(" ")[0]}` : ""}! Crie sua senha individual</p>
            <p style={styles.trocarSub}>Você entrou com a senha padrão. Por segurança, defina uma senha só sua.</p>

            <div style={styles.field}>
              <label style={styles.label}>Nova senha</label>
              <div style={styles.inputWrapper}>
                <input
                  style={{ ...styles.input, flex: 1, border: "none", outline: "none" }}
                  type={showSenha ? "text" : "password"}
                  placeholder="Mínimo 4 caracteres"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  autoFocus
                />
                <button style={styles.eyeBtn} onClick={() => setShowSenha(!showSenha)} tabIndex={-1}>{showSenha ? "🙈" : "👁️"}</button>
              </div>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Confirmar nova senha</label>
              <input
                style={styles.input}
                type={showSenha ? "text" : "password"}
                placeholder="Repita a senha"
                value={confSenha}
                onChange={(e) => setConfSenha(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleTrocarSenha()}
              />
            </div>

            {erro && <p style={styles.erro}>{erro}</p>}

            <button style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }} onClick={handleTrocarSenha} disabled={loading}>
              {loading ? "Salvando..." : "Criar senha e entrar →"}
            </button>
          </div>
        ) : (
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
                placeholder="Sua senha"
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
          {aviso && <p style={styles.sucesso}>{aviso}</p>}

          <button
            style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }}
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? "Entrando..." : "Entrar →"}
          </button>

          <button style={styles.linkBtn} onClick={handleRedefinir} disabled={loading} type="button">
            Esqueci minha senha · redefinir
          </button>

          <p style={styles.hint}>
            Primeiro acesso? Senha padrão <strong>1234</strong> — você cria a sua ao entrar.
          </p>
        </div>
        )}

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
  sucesso: { color: "#7DBA3D", fontSize: "0.82rem", margin: "0", textAlign: "center", lineHeight: 1.45 },
  linkBtn: { background: "transparent", border: "none", color: "rgba(255,255,255,0.5)", fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit", textDecoration: "underline", padding: "2px" },
  trocarTitulo: { color: "#fff", fontSize: "1rem", fontWeight: "700", margin: 0, textAlign: "center" },
  trocarSub: { color: "rgba(255,255,255,0.5)", fontSize: "0.82rem", margin: "0 0 4px", textAlign: "center", lineHeight: 1.5 },
  footer: {
    color: "rgba(255,255,255,0.2)",
    fontSize: "0.75rem",
    textAlign: "center",
    marginTop: "24px",
    marginBottom: 0,
  },
};
