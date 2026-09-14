// Bloco "Volumes" da home — meta × realizado por categoria (% da meta).
// Dado: GET /api/resumo/volumes (escopo automático por perfil no backend).
// Consolidado + expandir "por RN" (data.porRn) quando há mais de um setor no escopo.
import { useState, useEffect } from "react";
import api from "../services/api";

const cor = (pct) => {
  if (pct == null) return "rgba(255,255,255,0.25)";
  if (pct >= 100) return "#4ade80";
  if (pct >= 70) return "#7DBA3D";
  return "#f0997b";
};
// Versão clara/translúcida da cor (para a tendência, na mesma barra, mais sutil).
const corClara = (pct) => {
  const hex = cor(pct);
  if (!hex.startsWith("#")) return "rgba(255,255,255,0.12)";
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},0.30)`;
};
const fmt = (n) => (Number(n) || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 });

export default function ResumoVolumes() {
  const [data, setData] = useState(null);
  const [erro, setErro] = useState("");
  const [esperando, setEsperando] = useState(false);
  const [porRnAberto, setPorRnAberto] = useState(false);

  // Renderiza uma barra (realizado escuro + tendência clara atrás + %).
  const renderBar = (b, key) => {
    const w = b.pct == null ? 0 : Math.min(b.pct, 100);
    const wTend = b.pctTend == null ? 0 : Math.min(b.pctTend, 100);
    const c = cor(b.pct);
    const tit = `Realizado ${fmt(b.real)} / ${fmt(b.meta)} (${b.pct == null ? "—" : b.pct + "%"})`
      + (b.tend != null && b.pctTend != null ? ` · Tendência ${fmt(b.tend)} (${b.pctTend}%)` : "");
    return (
      <div key={key} style={S.row} title={tit}>
        <div style={S.lbl}>
          {b.label}
          {b.monitoramento && <span style={S.monit} title="Sem meta oficial — monitoramento (15%)">·</span>}
        </div>
        <div style={S.track}>
          <div style={{ ...S.fill, width: `${wTend}%`, background: corClara(b.pctTend) }} />
          <div style={{ ...S.fill, width: `${w}%`, background: c }} />
        </div>
        <div style={{ ...S.pc, color: c }}>{b.pct == null ? "—" : `${b.pct}%`}</div>
      </div>
    );
  };

  // Versão compacta (para o grid por RN): label curto + mini-barra + %.
  const renderMiniBar = (b, key) => {
    const w = b.pct == null ? 0 : Math.min(b.pct, 100);
    const wTend = b.pctTend == null ? 0 : Math.min(b.pctTend, 100);
    const c = cor(b.pct);
    const tit = `${b.label}: ${fmt(b.real)} / ${fmt(b.meta)} (${b.pct == null ? "—" : b.pct + "%"})`
      + (b.tend != null && b.pctTend != null ? ` · Tend ${b.pctTend}%` : "");
    return (
      <div key={key} style={S.miniRow} title={tit}>
        <div style={S.miniLbl}>{b.label}</div>
        <div style={S.miniTrack}>
          <div style={{ ...S.fill, width: `${wTend}%`, background: corClara(b.pctTend) }} />
          <div style={{ ...S.fill, width: `${w}%`, background: c }} />
        </div>
        <div style={{ ...S.miniPc, color: c }}>{b.pct == null ? "—" : `${b.pct}%`}</div>
      </div>
    );
  };

  useEffect(() => {
    let cancel = false;
    let tentativas = 0;
    const buscar = () => {
      api.get("/api/resumo/volumes", { timeout: 18000 })
        .then((r) => { if (!cancel) { setData(r.data); setEsperando(false); } })
        .catch((e) => {
          if (cancel) return;
          const st = e?.response?.status;
          // Cold start do Render free (backend dormindo): 503/502/timeout/network → tenta de novo.
          const coldStart = st === 503 || st === 502 || e?.code === "ECONNABORTED" || !st;
          if (coldStart && tentativas < 6) {
            tentativas += 1;
            setEsperando(true);
            setTimeout(buscar, 8000);
          } else {
            setErro(st ? `HTTP ${st}` : (e?.message || "falha"));
          }
        });
    };
    buscar();
    return () => { cancel = true; };
  }, []);

  if (erro) {
    return <div style={S.card}><div style={S.title}><span style={{ color: "#7DBA3D" }}>📊</span> Volumes</div><div style={S.sub}>Resumo indisponível ({erro}). Recarregue em ~1 min.</div></div>;
  }
  if (!data && esperando) {
    return <div style={S.card}><div style={S.title}><span style={{ color: "#7DBA3D" }}>📊</span> Volumes</div><div style={S.sub}>Acordando o servidor (plano grátis pode levar ~50s)…</div></div>;
  }
  if (data && (!data.bars || data.bars.length === 0)) {
    return <div style={S.card}><div style={S.title}><span style={{ color: "#7DBA3D" }}>📊</span> Volumes</div><div style={S.sub}>Sem dados de volume ainda — importe pedidos.</div></div>;
  }

  return (
    <div style={S.card}>
      <div style={S.title}><span style={{ color: "#7DBA3D" }}>📊</span> Volumes — % da meta</div>
      <div style={S.sub}>Barra escura = realizado · barra clara = tendência do mês · zeros = monitoramento (15%)</div>
      {!data ? (
        <div style={S.skel}>Carregando…</div>
      ) : (
        <>
          {data.bars.map((b) => renderBar(b, b.label))}

          {/* Expandir por RN — só quando há mais de um setor no escopo (admin/diretor/GV). */}
          {data.porRn && data.porRn.length > 1 && (
            <>
              <button style={S.toggle} onClick={() => setPorRnAberto((v) => !v)}>
                {porRnAberto ? "▾" : "▸"} {porRnAberto ? "Ocultar por RN" : `Ver por RN (${data.porRn.length})`}
              </button>
              {porRnAberto && (
                <div style={S.rnGrid}>
                  {data.porRn.map((rn) => (
                    <div key={rn.setor} style={S.rnBox}>
                      <div style={S.rnBoxHead} title={`Setor ${rn.setor}${rn.nome ? " · " + rn.nome : ""}`}>
                        {rn.setor}{rn.nome ? ` · ${rn.nome.split(" ")[0]}` : ""}
                      </div>
                      {rn.bars.map((b) => renderMiniBar(b, `${rn.setor}-${b.label}`))}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

const S = {
  card: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "14px 16px", marginBottom: "16px" },
  title: { color: "#fff", fontWeight: "600", fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "8px" },
  sub: { color: "rgba(255,255,255,0.4)", fontSize: "0.85rem", margin: "2px 0 12px" },
  row: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "9px" },
  lbl: { width: "108px", flexShrink: 0, fontSize: "0.92rem", color: "rgba(255,255,255,0.55)", textAlign: "right" },
  monit: { color: "#f0b37e", marginLeft: "3px", fontWeight: "700" },
  track: { flex: 1, height: "15px", background: "rgba(255,255,255,0.06)", borderRadius: "7px", overflow: "hidden", position: "relative" },
  fill: { position: "absolute", left: 0, top: 0, height: "100%", borderRadius: "7px", transition: "width 0.4s" },
  pc: { width: "50px", flexShrink: 0, fontSize: "0.92rem", fontWeight: "600", textAlign: "right" },
  skel: { color: "rgba(255,255,255,0.35)", fontSize: "0.9rem", padding: "8px 0" },
  toggle: { marginTop: "6px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", borderRadius: "8px", padding: "6px 12px", cursor: "pointer", fontSize: "0.82rem", fontFamily: "inherit", width: "100%" },
  // Grid por RN — ~5 mini-cards por fileira (compacto pra não alongar a home).
  rnGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "8px", marginTop: "10px", paddingTop: "10px", borderTop: "1px solid rgba(255,255,255,0.06)" },
  rnBox: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "10px", padding: "9px 10px" },
  rnBoxHead: { color: "#7DBA3D", fontSize: "0.78rem", fontWeight: "700", marginBottom: "7px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  miniRow: { display: "flex", alignItems: "center", gap: "5px", marginBottom: "4px" },
  miniLbl: { width: "52px", flexShrink: 0, fontSize: "0.68rem", color: "rgba(255,255,255,0.5)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  miniTrack: { flex: 1, height: "8px", background: "rgba(255,255,255,0.06)", borderRadius: "4px", overflow: "hidden", position: "relative" },
  miniPc: { width: "34px", flexShrink: 0, fontSize: "0.7rem", fontWeight: "600", textAlign: "right" },
};
