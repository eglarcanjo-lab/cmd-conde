// Bloco "Verdes" da home — Trimarca Stella + Spaten, cobertura/distribuição mês a mês.
// Gráfico de linha com toggle. Dado: GET /api/resumo/verdes.
import { useState, useEffect } from "react";
import api from "../services/api";

const MESES_ABR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const rotMes = (m) => { const [, mo] = String(m).split("-"); return MESES_ABR[(Number(mo) || 1) - 1] || m; };
const fmt = (n) => (Number(n) || 0).toLocaleString("pt-BR");

export default function ResumoVerdes() {
  const [data, setData] = useState(null);
  const [erro, setErro] = useState("");
  const [esperando, setEsperando] = useState(false);
  const [aba, setAba] = useState("cobertura");

  useEffect(() => {
    let cancel = false;
    let tent = 0;
    const buscar = () => {
      api.get("/api/resumo/verdes", { timeout: 18000 })
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

  if (erro) return null;
  if (!data && !esperando) return null;

  const serie = data ? (aba === "cobertura" ? data.cobertura : data.distribuicao) : [];
  const meses = data ? data.meses : [];
  const temDados = meses.length > 0 && serie.some((x) => x > 0);

  // pontos da linha — X = centro da "coluna" de cada mês (alinha 1:1 com os rótulos flex).
  const W = 300, H = 96, top = 12, bot = 84;
  const max = Math.max(1, ...serie);
  const n = meses.length;
  const colX = (i) => ((i + 0.5) / Math.max(n, 1)) * W;
  const pts = meses.map((_, i) => `${colX(i).toFixed(1)},${(bot - (serie[i] / max) * (bot - top)).toFixed(1)}`);
  const x0 = colX(0), xN = colX(Math.max(n - 1, 0));
  const multiAno = new Set(meses.map((m) => String(m).slice(0, 4))).size > 1; // mostra o ano se >1 ano
  const atual = serie.length ? serie[serie.length - 1] : 0;

  return (
    <div style={S.card}>
      <div style={S.head}>
        <span style={S.title}><span style={{ color: "#7DBA3D" }}>🌿</span> Verdes · Stella + Spaten</span>
        <span style={S.tgl}>
          <button style={aba === "cobertura" ? S.btnOn : S.btn} onClick={() => setAba("cobertura")}>Cobertura</button>
          <button style={aba === "distribuicao" ? S.btnOn : S.btn} onClick={() => setAba("distribuicao")}>Distribuição</button>
        </span>
      </div>

      {!data ? (
        <div style={S.skel}>Acordando o servidor…</div>
      ) : !temDados ? (
        <div style={S.skel}>Sem vendas de Stella/Spaten ainda — importe pedidos por mês.</div>
      ) : (
        <>
          <div style={S.val}>{fmt(atual)} <small style={S.unit}>{aba === "cobertura" ? "coberturas" : "caixas"} · {rotMes(meses[meses.length - 1])}</small></div>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="96" preserveAspectRatio="none" style={{ marginTop: 4, display: "block" }} aria-hidden="true">
            <line x1={x0} y1={bot} x2={xN} y2={bot} stroke="rgba(255,255,255,0.12)" vectorEffect="non-scaling-stroke" />
            {n > 1 && <polyline points={`${x0},${bot} ${pts.join(" ")} ${xN},${bot}`} fill="rgba(125,186,61,0.10)" stroke="none" />}
            <polyline points={pts.join(" ")} fill="none" stroke="#7DBA3D" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
          <div style={S.mlab}>{meses.map((m) => <span key={m} style={S.ms}>{rotMes(m)}{multiAno ? <small style={{ opacity: 0.55 }}>/{String(m).slice(2, 4)}</small> : null}</span>)}</div>
        </>
      )}
    </div>
  );
}

const S = {
  card: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "12px 14px", marginBottom: "16px" },
  head: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" },
  title: { color: "#fff", fontWeight: "600", fontSize: "1.05rem", display: "flex", alignItems: "center", gap: "7px" },
  tgl: { marginLeft: "auto", display: "flex", gap: "5px" },
  btn: { fontSize: "0.82rem", fontFamily: "inherit", color: "rgba(255,255,255,0.5)", background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "20px", padding: "4px 13px", cursor: "pointer" },
  btnOn: { fontSize: "0.82rem", fontFamily: "inherit", color: "#0c1410", background: "#7DBA3D", border: "1px solid #7DBA3D", borderRadius: "20px", padding: "4px 13px", cursor: "pointer", fontWeight: "600" },
  val: { color: "#fff", fontSize: "1.3rem", fontWeight: "600", margin: "8px 0 0" },
  unit: { color: "rgba(255,255,255,0.4)", fontSize: "0.85rem", fontWeight: "400", marginLeft: "4px" },
  mlab: { display: "flex", marginTop: "2px" },
  ms: { flex: 1, fontSize: "0.72rem", color: "rgba(255,255,255,0.4)", textAlign: "center" },
  skel: { color: "rgba(255,255,255,0.35)", fontSize: "0.9rem", padding: "10px 2px" },
};
