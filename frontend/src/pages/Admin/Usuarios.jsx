import { useState, useEffect } from "react";
import api from "../../services/api";

const PERFIS = [
  { value: "admin", label: "Admin (Gestor)" },
  { value: "director", label: "Diretor" },
  { value: "gv1", label: "GV1 (Supervisor OFF)" },
  { value: "gv3", label: "GV3 (Supervisor ON)" },
  { value: "rn", label: "RN" },
];

const GVS = [
  { value: "", label: "Nenhum" },
  { value: "gv1", label: "GV1" },
  { value: "gv3", label: "GV3" },
];

const EMPTY_FORM = { cod: "", nome: "", cpf: "", telefone: "", perfil: "rn", gv: "", ativo: "true", senha: "" };

function formatCPF(v) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function formatTel(v) {
  return v.replace(/\D/g, "").slice(0, 13);
}

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState("");

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setLoading(true);
    try {
      const res = await api.get("/api/admin/usuarios");
      setUsuarios(res.data);
    } catch {
      setErro("Erro ao carregar usuários.");
    } finally {
      setLoading(false);
    }
  }

  function abrirNovo() {
    setEditando(null);
    setForm(EMPTY_FORM);
    setErro("");
    setSucesso("");
    setShowModal(true);
  }

  function abrirEditar(u) {
    setEditando(u);
    setForm({
      cod: u.cod,
      nome: u.nome,
      cpf: u.cpf || "",
      telefone: u.telefone || "",
      perfil: u.perfil,
      gv: u.gv || "",
      ativo: u.ativo,
      senha: "",
    });
    setErro("");
    setSucesso("");
    setShowModal(true);
  }

  function fecharModal() {
    setShowModal(false);
    setEditando(null);
    setErro("");
  }

  function setField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function salvar() {
    setErro("");
    setSucesso("");

    const cpfLimpo = form.cpf.replace(/\D/g, "");
    if (!form.cod || !form.nome || cpfLimpo.length !== 11 || !form.perfil) {
      setErro("Preencha todos os campos obrigatórios (Cód, Nome, CPF, Perfil).");
      return;
    }

    setSalvando(true);
    try {
      if (editando) {
        await api.put(`/api/admin/usuarios/${editando.cod}`, {
          ...form,
          cpf: cpfLimpo,
          telefone: form.telefone.replace(/\D/g, ""),
        });
        setSucesso("Usuário atualizado com sucesso.");
      } else {
        await api.post("/api/admin/usuarios", {
          ...form,
          cpf: cpfLimpo,
          telefone: form.telefone.replace(/\D/g, ""),
        });
        setSucesso("Usuário cadastrado com sucesso.");
      }
      await carregar();
      setTimeout(() => { fecharModal(); setSucesso(""); }, 1200);
    } catch (err) {
      setErro(err.response?.data?.error || "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function toggleAtivo(u) {
    try {
      await api.put(`/api/admin/usuarios/${u.cod}`, { ativo: u.ativo === "true" ? "false" : "true" });
      await carregar();
    } catch {
      alert("Erro ao alterar status.");
    }
  }

  async function resetarSenha(u) {
    if (!confirm(`Resetar senha de ${u.nome} para o padrão?`)) return;
    try {
      await api.put(`/api/admin/usuarios/${u.cod}`, { senha: "" });
      alert(`Senha de ${u.nome} resetada para Cmd@${u.cpf?.slice(0, 4) || "????'}`);
    } catch {
      alert("Erro ao resetar senha.");
    }
  }

  const filtrados = usuarios.filter((u) =>
    u.nome?.toLowerCase().includes(busca.toLowerCase()) ||
    u.cod?.toString().includes(busca) ||
    u.perfil?.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <input
          style={styles.busca}
          placeholder="Buscar por nome, código ou perfil..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <button style={styles.btnPrimary} onClick={abrirNovo}>+ Novo Usuário</button>
      </div>

      {/* Tabela */}
      {loading ? (
        <p style={styles.msg}>Carregando...</p>
      ) : filtrados.length === 0 ? (
        <p style={styles.msg}>Nenhum usuário encontrado.</p>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                {["Cód", "Nome", "CPF", "Perfil", "GV", "Telefone", "Status", "Ações"].map((h) => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((u) => (
                <tr key={u.cod} style={styles.tr}>
                  <td style={styles.td}><span style={styles.codBadge}>{u.cod}</span></td>
                  <td style={styles.td}>{u.nome}</td>
                  <td style={styles.td}>{u.cpf ? `***.***.${u.cpf.slice(-5, -2)}-${u.cpf.slice(-2)}` : "—"}</td>
                  <td style={styles.td}><span style={styles.perfilBadge}>{u.perfil}</span></td>
                  <td style={styles.td}>{u.gv || "—"}</td>
                  <td style={styles.td}>{u.telefone ? `+${u.telefone.slice(0, 4)}...` : "—"}</td>
                  <td style={styles.td}>
                    <span style={{ ...styles.statusBadge, background: u.ativo === "true" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: u.ativo === "true" ? "#4ade80" : "#f87171" }}>
                      {u.ativo === "true" ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <div style={styles.acoes}>
                      <button style={styles.btnAcao} onClick={() => abrirEditar(u)}>✏️</button>
                      <button style={styles.btnAcao} onClick={() => toggleAtivo(u)} title={u.ativo === "true" ? "Desativar" : "Ativar"}>
                        {u.ativo === "true" ? "🔴" : "🟢"}
                      </button>
                      <button style={styles.btnAcao} onClick={() => resetarSenha(u)} title="Resetar senha">🔑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && fecharModal()}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>{editando ? "Editar Usuário" : "Novo Usuário"}</h2>
              <button style={styles.closeBtn} onClick={fecharModal}>✕</button>
            </div>

            <div style={styles.modalBody}>
              <div style={styles.row}>
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Código *</label>
                  <input style={styles.input} value={form.cod} onChange={(e) => setField("cod", e.target.value)} placeholder="101" disabled={!!editando} />
                </div>
                <div style={{ ...styles.fieldGroup, flex: 2 }}>
                  <label style={styles.label}>Nome completo *</label>
                  <input style={styles.input} value={form.nome} onChange={(e) => setField("nome", e.target.value)} placeholder="João da Silva" />
                </div>
              </div>

              <div style={styles.row}>
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>CPF *</label>
                  <input style={styles.input} value={formatCPF(form.cpf)} onChange={(e) => setField("cpf", e.target.value)} placeholder="000.000.000-00" maxLength={14} />
                </div>
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Telefone (WhatsApp)</label>
                  <input style={styles.input} value={form.telefone} onChange={(e) => setField("telefone", formatTel(e.target.value))} placeholder="5583999999999" maxLength={13} />
                </div>
              </div>

              <div style={styles.row}>
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Perfil *</label>
                  <select style={styles.select} value={form.perfil} onChange={(e) => setField("perfil", e.target.value)}>
                    {PERFIS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>GV Responsável</label>
                  <select style={styles.select} value={form.gv} onChange={(e) => setField("gv", e.target.value)}>
                    {GVS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                  </select>
                </div>
              </div>

              {editando && (
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Nova senha (deixe vazio para manter)</label>
                  <input style={styles.input} type="password" value={form.senha} onChange={(e) => setField("senha", e.target.value)} placeholder="Nova senha personalizada" />
                </div>
              )}

              {editando && (
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Status</label>
                  <select style={styles.select} value={form.ativo} onChange={(e) => setField("ativo", e.target.value)}>
                    <option value="true">Ativo</option>
                    <option value="false">Inativo</option>
                  </select>
                </div>
              )}

              {erro && <p style={styles.erro}>{erro}</p>}
              {sucesso && <p style={styles.sucesso}>{sucesso}</p>}
            </div>

            <div style={styles.modalFooter}>
              <button style={styles.btnSecondary} onClick={fecharModal}>Cancelar</button>
              <button style={{ ...styles.btnPrimary, opacity: salvando ? 0.7 : 1 }} onClick={salvar} disabled={salvando}>
                {salvando ? "Salvando..." : editando ? "Salvar alterações" : "Cadastrar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  toolbar: { display: "flex", gap: "12px", marginBottom: "20px", alignItems: "center" },
  busca: {
    flex: 1,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "10px",
    color: "#fff",
    padding: "10px 14px",
    fontSize: "0.9rem",
    fontFamily: "inherit",
    outline: "none",
  },
  btnPrimary: {
    background: "linear-gradient(135deg, #fbb900, #e6a200)",
    color: "#0a0f1e",
    border: "none",
    borderRadius: "10px",
    padding: "10px 20px",
    fontWeight: "700",
    cursor: "pointer",
    fontSize: "0.9rem",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
  },
  btnSecondary: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "rgba(255,255,255,0.7)",
    borderRadius: "10px",
    padding: "10px 20px",
    cursor: "pointer",
    fontSize: "0.9rem",
    fontFamily: "inherit",
  },
  msg: { color: "rgba(255,255,255,0.4)", textAlign: "center", padding: "40px" },
  tableWrap: { overflowX: "auto", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.5)",
    fontSize: "0.75rem",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    padding: "12px 16px",
    textAlign: "left",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },
  tr: { borderBottom: "1px solid rgba(255,255,255,0.05)", transition: "background 0.15s" },
  td: { padding: "12px 16px", color: "rgba(255,255,255,0.8)", fontSize: "0.88rem" },
  codBadge: {
    background: "rgba(251,185,0,0.12)",
    color: "#fbb900",
    padding: "2px 8px",
    borderRadius: "6px",
    fontSize: "0.8rem",
    fontWeight: "700",
  },
  perfilBadge: {
    background: "rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.6)",
    padding: "2px 8px",
    borderRadius: "6px",
    fontSize: "0.78rem",
  },
  statusBadge: {
    padding: "3px 10px",
    borderRadius: "20px",
    fontSize: "0.78rem",
    fontWeight: "600",
  },
  acoes: { display: "flex", gap: "6px" },
  btnAcao: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "6px",
    padding: "4px 8px",
    cursor: "pointer",
    fontSize: "0.85rem",
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "20px",
  },
  modal: {
    background: "#111827",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "16px",
    width: "100%",
    maxWidth: "560px",
    maxHeight: "90vh",
    overflow: "auto",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 24px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },
  modalTitle: { margin: 0, fontSize: "1.1rem", fontWeight: "700" },
  closeBtn: {
    background: "transparent",
    border: "none",
    color: "rgba(255,255,255,0.4)",
    fontSize: "1.1rem",
    cursor: "pointer",
    padding: "4px",
  },
  modalBody: { padding: "24px", display: "flex", flexDirection: "column", gap: "16px" },
  modalFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    padding: "16px 24px",
    borderTop: "1px solid rgba(255,255,255,0.08)",
  },
  row: { display: "flex", gap: "12px" },
  fieldGroup: { display: "flex", flexDirection: "column", gap: "6px", flex: 1 },
  label: { color: "rgba(255,255,255,0.5)", fontSize: "0.78rem", fontWeight: "500", textTransform: "uppercase", letterSpacing: "0.06em" },
  input: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "8px",
    color: "#fff",
    padding: "10px 12px",
    fontSize: "0.9rem",
    fontFamily: "inherit",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  select: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "8px",
    color: "#fff",
    padding: "10px 12px",
    fontSize: "0.9rem",
    fontFamily: "inherit",
    outline: "none",
    width: "100%",
    cursor: "pointer",
  },
  erro: { color: "#f87171", fontSize: "0.85rem", margin: 0, textAlign: "center" },
  sucesso: { color: "#4ade80", fontSize: "0.85rem", margin: 0, textAlign: "center" },
};
