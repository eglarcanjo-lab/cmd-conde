// Home (desktop) — bloco simples do incentivo "Desafio Marketplace": faturamento MKTP da
// operação no mês × meta coletiva, tendência e ritmo necessário por dia útil + top RNs.
// Dado: GET /api/resumo/incentivo-mktp (some sozinho quando o incentivo não está ativo).
import { useState, useEffect } from "react";
import api from "../services/api";

const rs = (n) => `R$ ${(Number(n) || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
const cor = (p) => (p >= 100 ? "#4ade80" : p >= 70 ? "#7DBA3D" : "#f0997b");

export default function ResumoMktp() {
  const [d, setD] = useState(null);
  useEffect(() => {
    api.get("/api/resumo/incentivo-mktp", { timeout: 20000 }).then((r) => setD(r.data)).catch(() => {});
  }, []);
  if (!d?.ativo) return null;

  const pctBarra = Math.min(100, d.pct);
  const pctTend = d.tendencia != null ? Math.min(100, (d.tendencia / d.meta) * 100) : null;
  return (
    <div style={S.card}>
      <div style={S.topo}>
        <div>
          <div style={S.tit}>🛒 {d.titulo} · {d.campanha}</div>
          <div style={S.sub}>Faturamento Marketplace da operação · meta {rs(d.meta)}{d.atualizado_em ? ` · CORA de ${d.atualizado_em}` : ""}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ ...S.pct, color: cor(d.pct) }}>{d.pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</div>
          <div style={S.sub}>{rs(d.realizado)}</div>
        </div>
      </div>

      <div style={S.trilho} title={d.tendencia != null ? `Tendência: ${rs(d.tendencia)}` : ""}>
        {pctTend != null && <div style={{ ...S.tend, width: `${pctTend}%` }} />}
        <div style={{ ...S.barra, width: `${pctBarra}%`, background: cor(d.pct) }} />
      </div>

      <div style={S.nums}>
        <span>Falta <b>{rs(d.falta)}</b></span>
        {d.tendencia != null && <span>Tendência <b style={{ color: cor(d.pct_tendencia) }}>{rs(d.tendencia)} ({d.pct_tendencia}%)</b></span>}
        {!d.encerrado && d.dias_restantes > 0 && d.falta > 0 && <span>Precisa <b>{rs(d.ritmo_dia)}</b>/dia útil · {d.dias_restantes} dias</span>}
        {d.encerrado && <span><b>Encerrado</b></span>}
      </div>

      {d.por_rn?.length > 0 && (
        <div style={S.rns}>
          {d.por_rn.slice(0, 11).map((r, i) => (
            <span key={r.setor} style={S.rn}>{i < 3 ? ["🥇", "🥈", "🥉"][i] : `${i + 1}º`} {r.setor}{r.nome ? ` ${r.nome.split(" ")[0]}` : ""} · <b>{rs(r.real)}</b></span>
          ))}
        </div>
      )}
    </div>
  );
}

const S = {
  card: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "14px 16px", marginBottom: "16px" },
  topo: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 10 },
  tit: { color: "#fff", fontWeight: 700, fontSize: "0.98rem" },
  sub: { color: "rgba(255,255,255,0.45)", fontSize: "0.76rem", marginTop: 2 },
  pct: { fontSize: "1.5rem", fontWeight: 800, lineHeight: 1 },
  trilho: { position: "relative", height: 10, background: "rgba(255,255,255,0.08)", borderRadius: 5, overflow: "hidden" },
  tend: { position: "absolute", inset: "0 auto 0 0", background: "rgba(255,255,255,0.14)", borderRadius: 5 },
  barra: { position: "absolute", inset: "0 auto 0 0", borderRadius: 5, transition: "width .6s" },
  nums: { display: "flex", gap: 18, flexWrap: "wrap", marginTop: 10, color: "rgba(255,255,255,0.65)", fontSize: "0.8rem" },
  rns: { display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 },
  rn: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "3px 8px", fontSize: "0.74rem", color: "rgba(255,255,255,0.75)" },
};
