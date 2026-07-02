// Bloco "Foco NE" da home — +RGB / Faturamento Score 5 / Portfólio Score 5.
// Dado: GET /api/resumo/foco-ne (nível operação; meta = spo_metas; tri = acumula no 3º mês).
import { useState, useEffect } from "react";
import api from "../services/api";

const cor = (pct) => {
  if (pct == null) return "rgba(255,255,255,0.25)";
  if (pct >= 100) return "#4ade80";
  if (pct >= 70) return "#7DBA3D";
  return "#f0997b";
};
const fmt = (n) => (Number(n) || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 });

export default function ResumoFocoNE() {
  const [data, setData] = useState(null);
  const [erro, setErro] = useState("");
  const [esperando, setEsperando] = useState(false);

  useEffect(() => {
    let cancel = false;
    let tent = 0;
    const buscar = () => {
      api.get("/api/resumo/foco-ne", { timeout: 18000 })
        .then((r) => { if (!cancel) { setData(r.data); setEsperando(false); } })
        .catch((e) => {
          if (cancel) return;
          const st = e?.response?.status;
          const cold = st === 503 || st === 502 || e?.code === "ECONNABORTED" || !st;
          if (cold && tent < 6) { tent += 1; setEsperando(true); setTimeout(buscar, 8000); }
          else setErro(st ? `HTTP ${st}` : (e?.message || "falha"));
        });
    };
    buscar();
    return () => { cancel = true; };
  }, []);

  if (erro) return null; // discreto: se falhar, só não mostra (o Volumes já avisa cold-start)
  if (!data && !esperando) return null;

  return (
    <div style={S.wrap}>
      <div style={S.sec}>
        <span style={{ color: "#7DBA3D" }}>🎯</span> Foco NE
        {data && <span style={S.escopo}>{data.escopo}</span>}
      </div>
      {!data ? (
        <div style={S.skel}>Acordando o servidor…</div>
      ) : (
        <div style={S.grid}>
          {data.items.map((it) => {
            const w = it.pct == null ? 0 : Math.min(it.pct, 100);
            const c = cor(it.pct);
            return (
              <div key={it.item} style={S.mini}>
                <div style={S.miniTop}>
                  <span style={S.lbl}>{it.label}</span>
                  <span style={S.tag}>{it.escopo}</span>
                </div>
                <div style={S.val}>{fmt(it.real)} <small style={S.meta}>/ {fmt(it.meta)}</small>
                  {it.pct != null && <span style={{ ...S.pc, color: c }}>{it.pct}%</span>}
                </div>
                <div style={S.bar}><div style={{ ...S.fill, width: `${w}%`, background: c }} /></div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const S = {
  wrap: { marginBottom: "16px" },
  sec: { color: "#7DBA3D", fontSize: "0.92rem", letterSpacing: "0.4px", margin: "0 2px 8px", display: "flex", alignItems: "center", gap: "6px" },
  escopo: { marginLeft: "auto", color: "rgba(255,255,255,0.4)", fontSize: "0.78rem", fontWeight: "400", letterSpacing: 0 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" },
  mini: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "12px 13px" },
  miniTop: { display: "flex", alignItems: "center", gap: "6px" },
  lbl: { color: "rgba(255,255,255,0.6)", fontSize: "0.88rem" },
  tag: { marginLeft: "auto", color: "rgba(255,255,255,0.35)", fontSize: "0.72rem", background: "rgba(255,255,255,0.06)", borderRadius: "20px", padding: "1px 7px" },
  val: { color: "#fff", fontSize: "1.3rem", fontWeight: "600", margin: "5px 0 0", display: "flex", alignItems: "baseline" },
  meta: { color: "rgba(255,255,255,0.4)", fontSize: "0.85rem", fontWeight: "400", marginLeft: "4px" },
  pc: { marginLeft: "auto", fontSize: "0.95rem", fontWeight: "600" },
  bar: { height: "6px", background: "rgba(255,255,255,0.06)", borderRadius: "3px", marginTop: "8px", overflow: "hidden" },
  fill: { height: "100%", borderRadius: "3px", transition: "width 0.4s" },
  skel: { color: "rgba(255,255,255,0.35)", fontSize: "0.9rem", padding: "4px 2px" },
};
