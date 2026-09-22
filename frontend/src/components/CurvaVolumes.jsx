// Curva de Volumes — Real × Budget × Ano Passado (12 meses), com menu de categoria.
import { useState } from "react";
import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from "recharts";

const VERDE = "#7DBA3D";
const fmt = (v) => Number(v || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const pct = (r, b) => (b > 0 ? Math.round((r / b - 1) * 1000) / 10 : null);
const pctTxt = (p) => (p == null ? "—" : `${p > 0 ? "+" : ""}${p.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`);

export default function CurvaVolumes({ curva }) {
  const [cat, setCat] = useState("cerveja");
  if (!curva || !curva.dados) return <div style={S.info}>Carregando curva…</div>;

  const cats = curva.categorias || [];
  const d = curva.dados[cat] || { real: [], budget: [], ly: [] };
  const meses = curva.meses || [];
  const rows = meses.map((m, i) => ({
    mes: m,
    real: d.real[i] || 0,
    budget: d.budget[i] || 0,
    meta: (d.meta || [])[i] || 0,
    ly: d.ly[i] || 0,
    vsBgt: pct(d.real[i] || 0, d.budget[i] || 0),
    vsMeta: pct(d.real[i] || 0, (d.meta || [])[i] || 0),
    vsLy: pct(d.real[i] || 0, d.ly[i] || 0),
  }));
  const temBudget = (d.budget || []).some((v) => v > 0);
  const temMeta = (d.meta || []).some((v) => v > 0);
  const temLy = (d.ly || []).some((v) => v > 0);

  return (
    <div>
      <div style={S.barra}>
        <select style={S.select} value={cat} onChange={(e) => setCat(e.target.value)}>
          {cats.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <div style={S.leg}>
          <span style={S.legItem}><i style={{ ...S.dot, background: "#f0a13c" }} /> Real</span>
          {temBudget && <span style={S.legItem}><i style={{ ...S.dot, background: "#3b82f6" }} /> Budget</span>}
          {temMeta && <span style={S.legItem}><i style={{ ...S.dot, background: VERDE }} /> Meta</span>}
          {temLy && <span style={S.legItem}><i style={{ ...S.dot, background: "#9aa0a6" }} /> Ano passado</span>}
        </div>
      </div>

      {/* Linhas de % — Real vs BGT e Real vs LY, alinhadas aos 12 meses */}
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 760 }}>
          {temBudget && <div style={S.pctGrid}>
            <div style={S.pctLbl}>Real vs BGT</div>
            {rows.map((r, i) => <div key={i} style={{ ...S.pctCell, color: r.vsBgt == null ? "rgba(255,255,255,0.3)" : r.vsBgt >= 0 ? "#4ade80" : "#f87171" }}>{pctTxt(r.vsBgt)}</div>)}
          </div>}
          <div style={S.pctGrid}>
            <div style={S.pctLbl}>Real vs LY</div>
            {rows.map((r, i) => <div key={i} style={{ ...S.pctCell, color: r.vsLy == null ? "rgba(255,255,255,0.3)" : r.vsLy >= 0 ? "#4ade80" : "#f87171" }}>{pctTxt(r.vsLy)}</div>)}
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={rows} margin={{ top: 22, right: 10, left: 80, bottom: 4 }}>
              <defs>
                <linearGradient id="gReal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f0a13c" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#f0a13c" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis dataKey="mes" tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} tickLine={false} />
              <YAxis hide domain={[0, "dataMax"]} />
              <Tooltip
                contentStyle={{ background: "#12211a", border: "1px solid rgba(125,186,61,0.4)", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: VERDE, fontWeight: 700 }}
                formatter={(v, n) => [fmt(v) + " HL", n]}
              />
              {temLy && <Area type="monotone" dataKey="ly" name="Ano passado" stroke="#9aa0a6" strokeWidth={2} fill="rgba(154,160,166,0.12)" dot={false} />}
              <Area type="monotone" dataKey="real" name="Real" stroke="#f0a13c" strokeWidth={2.5} fill="url(#gReal)" dot={{ r: 2.5, fill: "#f0a13c" }}>
                <LabelList dataKey="real" position="bottom" formatter={fmt} style={{ fill: "rgba(255,255,255,0.85)", fontSize: 9.5, fontWeight: 600 }} />
              </Area>
              {temBudget && <Line type="monotone" dataKey="budget" name="Budget" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 2.5, fill: "#3b82f6" }}>
                <LabelList dataKey="budget" position="top" formatter={fmt} style={{ fill: "#7fb0f5", fontSize: 9.5, fontWeight: 600 }} />
              </Line>}
              {temMeta && <Line type="monotone" dataKey="meta" name="Meta" stroke={VERDE} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 2, fill: VERDE }} />}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

const S = {
  info: { color: "rgba(255,255,255,0.55)", padding: "16px 0" },
  barra: { display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", margin: "6px 0 10px" },
  select: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(125,186,61,0.35)", color: "#fff", borderRadius: "8px", padding: "7px 12px", fontSize: "0.85rem", fontFamily: "inherit", fontWeight: 600, cursor: "pointer", outline: "none" },
  leg: { display: "flex", gap: "12px", flexWrap: "wrap", marginLeft: "auto" },
  legItem: { color: "rgba(255,255,255,0.7)", fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "5px" },
  dot: { width: 10, height: 10, borderRadius: 3, display: "inline-block" },
  pctGrid: { display: "grid", gridTemplateColumns: "80px repeat(12, 1fr)", alignItems: "center", marginBottom: 2, paddingRight: 10 },
  pctLbl: { color: "rgba(255,255,255,0.45)", fontSize: "0.66rem", fontWeight: 600, whiteSpace: "nowrap", paddingLeft: 2 },
  pctCell: { fontSize: "0.66rem", fontWeight: 700, textAlign: "center" },
};
