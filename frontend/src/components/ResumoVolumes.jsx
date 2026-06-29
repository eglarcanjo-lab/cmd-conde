// Bloco "Volumes" da home — meta × realizado por categoria (% da meta).
// Dado: GET /api/resumo/volumes (escopo automático por perfil no backend).
import { useState, useEffect } from "react";
import api from "../services/api";

const cor = (pct) => {
  if (pct == null) return "rgba(255,255,255,0.25)";
  if (pct >= 100) return "#4ade80";
  if (pct >= 70) return "#7DBA3D";
  return "#f0997b";
};
const fmt = (n) => (Number(n) || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 });

export default function ResumoVolumes() {
  const [data, setData] = useState(null);
  const [erro, setErro] = useState("");
  const [esperando, setEsperando] = useState(false);

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
      <div style={S.sub}>Cerveja (inclui zero) · NAB · Match · Mktp · zeros = monitoramento (meta 15%)</div>
      {!data ? (
        <div style={S.skel}>Carregando…</div>
      ) : (
        data.bars.map((b) => {
          const w = b.pct == null ? 0 : Math.min(b.pct, 100);
          const c = cor(b.pct);
          return (
            <div key={b.label} style={S.row} title={`${fmt(b.real)} / ${fmt(b.meta)} HL`}>
              <div style={S.lbl}>
                {b.label}
                {b.monitoramento && <span style={S.monit} title="Sem meta oficial — monitoramento (15%)">·</span>}
              </div>
              <div style={S.track}><div style={{ ...S.fill, width: `${w}%`, background: c }} /></div>
              <div style={{ ...S.pc, color: c }}>{b.pct == null ? "—" : `${b.pct}%`}</div>
            </div>
          );
        })
      )}
    </div>
  );
}

const S = {
  card: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "14px 16px", marginBottom: "16px" },
  title: { color: "#fff", fontWeight: "600", fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "8px" },
  sub: { color: "rgba(255,255,255,0.4)", fontSize: "0.72rem", margin: "2px 0 12px" },
  row: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" },
  lbl: { width: "92px", flexShrink: 0, fontSize: "0.8rem", color: "rgba(255,255,255,0.55)", textAlign: "right" },
  monit: { color: "#f0b37e", marginLeft: "3px", fontWeight: "700" },
  track: { flex: 1, height: "13px", background: "rgba(255,255,255,0.06)", borderRadius: "7px", overflow: "hidden" },
  fill: { height: "100%", borderRadius: "7px", transition: "width 0.4s" },
  pc: { width: "44px", flexShrink: 0, fontSize: "0.8rem", fontWeight: "600", textAlign: "right" },
  skel: { color: "rgba(255,255,255,0.35)", fontSize: "0.8rem", padding: "8px 0" },
};
