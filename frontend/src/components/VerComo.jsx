// "Ver como setor" (só ADMIN) — seletor + barra fixa enquanto a visão do RN estiver ativa.
// A troca vale p/ o app inteiro (AuthContext + cabeçalho X-Ver-Como no backend).
import { useEffect, useState } from "react";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";

// Seletor de setor (Home do admin). Lista os setores com o nome do RN.
export function SeletorVerComo({ compacto = false }) {
  const { adminReal, verComo, setVerComo } = useAuth();
  const [setores, setSetores] = useState([]);
  useEffect(() => {
    if (!adminReal) return;
    // sem o cabeçalho: a lista é rota de admin (com a visão ativa o backend me trataria como RN)
    api.get("/api/solicitacoes/setores", { headers: { "X-Ver-Como": "" } })
      .then((r) => setSetores(r.data || [])).catch(() => setSetores([]));
  }, [adminReal]);
  if (!adminReal) return null;
  return (
    <label style={{ ...S.sel, ...(compacto ? { padding: "8px 10px" } : {}) }}>
      <span style={S.selLbl}>👁 Ver como setor</span>
      <select value={verComo} onChange={(e) => setVerComo(e.target.value)} style={S.select} aria-label="Ver o app como o RN de um setor">
        <option value="">— eu (admin) —</option>
        {setores.map((s) => (
          <option key={s.setor} value={s.setor}>{s.setor}{s.nome ? ` · ${String(s.nome).split(" ")[0]}` : ""}</option>
        ))}
      </select>
    </label>
  );
}

// Barra fixa no topo enquanto o admin está vendo como um setor.
export function BarraVerComo() {
  const { verComo, setVerComo } = useAuth();
  if (!verComo) return null;
  return (
    <div style={S.barra} role="status">
      <span>👁 Você está vendo como o <b>setor {verComo}</b> (visão do RN)</span>
      <button onClick={() => { setVerComo(""); window.location.assign("/"); }} style={S.sair}>Sair da visão</button>
    </div>
  );
}

const S = {
  sel: { display: "flex", alignItems: "center", gap: 10, background: "rgba(245,196,81,0.08)", border: "1px solid rgba(245,196,81,0.35)", borderRadius: 12, padding: "10px 14px", flexWrap: "wrap" },
  selLbl: { color: "#f5c451", fontWeight: 700, fontSize: "0.85rem" },
  select: { flex: 1, minWidth: 140, background: "#13231a", color: "#fff", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "6px 8px", fontFamily: "inherit" },
  barra: { position: "sticky", top: 0, zIndex: 900, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap",
    background: "#f5c451", color: "#1a1405", padding: "6px max(12px, env(safe-area-inset-right, 0px)) 6px max(12px, env(safe-area-inset-left, 0px))", fontSize: "0.8rem", fontFamily: "'Poppins','Segoe UI',system-ui,sans-serif" },
  sair: { background: "#1a1405", color: "#f5c451", border: "none", borderRadius: 6, padding: "4px 10px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: "0.78rem", minHeight: 0 },
};
