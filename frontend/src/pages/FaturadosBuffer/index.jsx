import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import api from "../../services/api";

const fmtHL = (v) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function PdvRow({ pdv, aberto, onToggle, cor }) {
  return (
    <div style={S.pdv}>
      <div style={S.pdvHead} onClick={onToggle}>
        <span style={S.caret}>{aberto ? "▾" : "▸"}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={S.pdvNome}>{pdv.nome || "—"}</div>
          <div style={S.pdvSub}>cod {pdv.cod} · Setor {pdv.setor} · {pdv.qtdPedidos} ped.</div>
        </div>
        <div style={{ ...S.pdvTotal, color: cor }}>{fmtHL(pdv.total)} <small>HL</small></div>
      </div>
      {/* chips por tipo */}
      <div style={S.chips}>
        {Object.entries(pdv.porTipo).map(([tipo, vol]) => (
          <span key={tipo} style={S.chip}>{tipo}: <b>{fmtHL(vol)}</b></span>
        ))}
      </div>
      {aberto && (
        <div style={S.pedidos}>
          {pdv.pedidos.map((ped) => (
            <div key={ped.num} style={S.ped}>
              <span style={S.pedNum}>#{ped.num}</span>
              <span style={S.pedItens}>
                {ped.itens.map((it, i) => (
                  <span key={i} style={S.pedItem}>{it.tipo} <b>{fmtHL(it.vol)}</b></span>
                ))}
              </span>
              <span style={S.pedTot}>{fmtHL(ped.total)} HL</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FaturadosBuffer() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const canFilter = ["admin", "director", "gv1", "gv3"].includes(usuario?.perfil);

  const [setor, setSetor] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [aba, setAba] = useState("faturados");
  const [abertos, setAbertos] = useState(() => new Set());

  const carregar = useCallback(() => {
    setLoading(true); setErro("");
    let tent = 0;
    const buscar = () => {
      const params = new URLSearchParams();
      if (setor) params.set("setor", setor);
      api.get(`/api/faturados-buffer?${params.toString()}`, { timeout: 18000 })
        .then((r) => { setData(r.data); setLoading(false); })
        .catch((e) => {
          const st = e?.response?.status;
          const cold = st === 503 || st === 502 || e?.code === "ECONNABORTED" || !st;
          if (cold && tent < 5) { tent += 1; setTimeout(buscar, 7000); }
          else { setErro(st ? `HTTP ${st}` : (e?.message || "falha")); setLoading(false); }
        });
    };
    buscar();
  }, [setor]);

  useEffect(() => { carregar(); }, [carregar]);

  const toggle = (cod) => setAbertos((prev) => {
    const n = new Set(prev); n.has(cod) ? n.delete(cod) : n.add(cod); return n;
  });

  const lado = data ? (aba === "faturados" ? data.faturados : data.buffer) : null;
  const corLado = aba === "faturados" ? "#4ade80" : "#f0997b";
  const rz = data?.resumo;

  return (
    <div style={S.root}>
      <div style={S.header}>
        <button style={S.backBtn} onClick={() => navigate("/")}>← Voltar</button>
        <div>
          <h2 style={S.title}>Faturados × Buffer</h2>
          <p style={S.sub}>Faturados = saíram p/ entrega · Buffer = ainda não faturados</p>
        </div>
      </div>

      {canFilter && data?.setores?.length > 0 && (
        <div style={S.filterRow}>
          <label style={S.filterLbl}>Ver por RN:</label>
          <select style={S.select} value={setor} onChange={(e) => setSetor(e.target.value)}>
            <option value="">Todos</option>
            {data.setores.map((s) => <option key={s} value={s}>Setor {s}</option>)}
          </select>
        </div>
      )}

      {loading && <div style={S.msg}>Carregando… (plano grátis pode levar ~50s)</div>}
      {erro && !loading && <div style={S.msg}>Indisponível ({erro}). <button style={S.retry} onClick={carregar}>tentar de novo</button></div>}

      {data && !loading && (
        <>
          {/* Resumo comparativo */}
          <div style={S.resumo}>
            <div style={{ ...S.rCard, borderColor: "rgba(74,222,128,0.3)" }}>
              <div style={S.rLbl}>✅ Faturado</div>
              <div style={{ ...S.rVal, color: "#4ade80" }}>{fmtHL(rz.faturadoHl)} <small>HL</small></div>
              <div style={S.rPed}>{rz.faturadoPedidos} pedidos</div>
            </div>
            <div style={S.conv}>
              <div style={S.convPct}>{rz.conversaoHl != null ? `${rz.conversaoHl}%` : "—"}</div>
              <div style={S.convLbl}>convertido</div>
            </div>
            <div style={{ ...S.rCard, borderColor: "rgba(240,153,123,0.3)" }}>
              <div style={S.rLbl}>⏳ Buffer</div>
              <div style={{ ...S.rVal, color: "#f0997b" }}>{fmtHL(rz.bufferHl)} <small>HL</small></div>
              <div style={S.rPed}>{rz.bufferPedidos} pedidos</div>
            </div>
          </div>

          {/* Sub-abas */}
          <div style={S.tabs}>
            <button style={aba === "faturados" ? S.tabOn : S.tab} onClick={() => setAba("faturados")}>Faturados</button>
            <button style={aba === "buffer" ? S.tabOn : S.tab} onClick={() => setAba("buffer")}>Buffer</button>
          </div>

          {lado.pdvs.length === 0 ? (
            <div style={S.msg}>Nenhum PDV neste filtro.</div>
          ) : (
            <>
              <div style={S.listHead}>
                {lado.qtdPdvs} PDVs · {lado.qtdPedidos} pedidos · <b style={{ color: corLado }}>{fmtHL(lado.total)} HL</b>
              </div>
              {lado.pdvs.map((p) => (
                <PdvRow key={p.cod} pdv={p} aberto={abertos.has(p.cod)} onToggle={() => toggle(p.cod)} cor={corLado} />
              ))}
              {/* Total por tipo (rodapé) */}
              <div style={S.footer}>
                <span style={S.footLbl}>Total por operação:</span>
                {Object.entries(lado.porTipo).map(([t, v]) => (
                  <span key={t} style={S.footChip}>{t}: <b>{fmtHL(v)}</b></span>
                ))}
                <span style={{ ...S.footChip, marginLeft: "auto", color: corLado }}>Total: <b>{fmtHL(lado.total)} HL</b></span>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

const S = {
  root: { minHeight: "100vh", background: "#0c1410", fontFamily: "'Poppins','Segoe UI',system-ui,sans-serif", padding: "clamp(16px,4vw,28px)", maxWidth: "1600px", margin: "0 auto" },
  header: { display: "flex", alignItems: "flex-start", gap: "14px", marginBottom: "18px" },
  backBtn: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", padding: "9px 14px", borderRadius: "8px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.85rem", flexShrink: 0 },
  title: { color: "#fff", margin: 0, fontSize: "1.3rem", fontWeight: "700" },
  sub: { color: "rgba(255,255,255,0.4)", margin: "3px 0 0", fontSize: "0.78rem" },
  filterRow: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" },
  filterLbl: { color: "rgba(255,255,255,0.5)", fontSize: "0.82rem" },
  select: { background: "#16211b", color: "#fff", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px", padding: "8px 12px", fontFamily: "inherit", fontSize: "0.85rem", minHeight: "40px" },
  msg: { color: "rgba(255,255,255,0.5)", fontSize: "0.85rem", padding: "16px 4px" },
  retry: { background: "none", border: "none", color: "#7DBA3D", cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" },
  resumo: { display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "10px", alignItems: "stretch", marginBottom: "16px" },
  rCard: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "12px 14px", textAlign: "center" },
  rLbl: { color: "rgba(255,255,255,0.55)", fontSize: "0.78rem", marginBottom: "4px" },
  rVal: { fontSize: "1.5rem", fontWeight: "700" },
  rPed: { color: "rgba(255,255,255,0.4)", fontSize: "0.72rem", marginTop: "2px" },
  conv: { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "0 4px" },
  convPct: { color: "#7DBA3D", fontSize: "1.15rem", fontWeight: "700" },
  convLbl: { color: "rgba(255,255,255,0.35)", fontSize: "0.62rem" },
  tabs: { display: "flex", gap: "8px", marginBottom: "12px" },
  tab: { flex: 1, background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.5)", borderRadius: "10px", padding: "10px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.88rem", minHeight: "44px" },
  tabOn: { flex: 1, background: "rgba(125,186,61,0.14)", border: "1px solid #7DBA3D", color: "#7DBA3D", borderRadius: "10px", padding: "10px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.88rem", fontWeight: "600", minHeight: "44px" },
  listHead: { color: "rgba(255,255,255,0.45)", fontSize: "0.78rem", margin: "4px 2px 10px" },
  pdv: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "10px 12px", marginBottom: "8px" },
  pdvHead: { display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" },
  caret: { color: "rgba(255,255,255,0.4)", fontSize: "0.8rem", width: "12px" },
  pdvNome: { color: "#fff", fontSize: "0.9rem", fontWeight: "600", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  pdvSub: { color: "rgba(255,255,255,0.4)", fontSize: "0.7rem", marginTop: "1px" },
  pdvTotal: { fontSize: "1rem", fontWeight: "700", flexShrink: 0 },
  chips: { display: "flex", flexWrap: "wrap", gap: "5px", marginTop: "7px", paddingLeft: "22px" },
  chip: { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", borderRadius: "20px", padding: "2px 9px", fontSize: "0.7rem" },
  pedidos: { marginTop: "9px", paddingLeft: "22px", display: "flex", flexDirection: "column", gap: "5px" },
  ped: { display: "flex", alignItems: "center", gap: "8px", background: "rgba(0,0,0,0.18)", borderRadius: "8px", padding: "6px 9px", flexWrap: "wrap" },
  pedNum: { color: "#7DBA3D", fontSize: "0.74rem", fontWeight: "600", flexShrink: 0 },
  pedItens: { display: "flex", flexWrap: "wrap", gap: "8px", flex: 1 },
  pedItem: { color: "rgba(255,255,255,0.55)", fontSize: "0.72rem" },
  pedTot: { color: "rgba(255,255,255,0.75)", fontSize: "0.74rem", flexShrink: 0 },
  footer: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", marginTop: "12px", padding: "12px", background: "rgba(255,255,255,0.03)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.07)" },
  footLbl: { color: "rgba(255,255,255,0.45)", fontSize: "0.76rem" },
  footChip: { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.65)", borderRadius: "20px", padding: "3px 10px", fontSize: "0.74rem" },
};
