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

  // pontos da linha (normaliza para a altura do gráfico)
  const W = 300, H = 96, padX = 16, top = 12, bot = 84;
  const max = Math.max(1, ...serie);
  const n = meses.length;
  const pts = meses.map((_, i) => {
    const x = n <= 1 ? W / 2 : padX + (i * (W - 2 * padX)) / (n - 1);
    const y = bot - (serie[i] / max) * (bot - top);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
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
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="96" style={{ marginTop: 4 }} aria-hidden="true">
            <line x1={padX} y1={bot} x2={W - padX} y2={bot} stroke="rgba(255,255,255,0.12)" />
            {n > 1 && <polyline points={`${padX},${bot} ${pts.join(" ")} ${W - padX},${bot}`} fill="rgba(125,186,61,0.10)" stroke="none" />}
            <polyline points={pts.join(" ")} fill="none" stroke="#7DBA3D" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            {pts.map((p, i) => { const [x, y] = p.split(","); return <circle key={i} cx={x} cy={y} r="2.6" fill="#7DBA3D" />; })}
          </svg>
          <div style={S.mlab}>{meses.map((m) => <span key={m} style={S.ms}>{rotMes(m)}</span>)}</div>
        </>
      )}
    </div>
  );
}

const S = {
  card: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "12px 14px", marginBottom: "16px" },
  head: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" },
  title: { color: "#fff", fontWeight: "600", fontSize: "0.88rem", display: "flex", alignItems: "center", gap: "7px" },
  tgl: { marginLeft: "auto", display: "flex", gap: "5px" },
  btn: { fontSize: "0.72rem", fontFamily: "inherit", color: "rgba(255,255,255,0.5)", background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "20px", padding: "3px 11px", cursor: "pointer" },
  btnOn: { fontSize: "0.72rem", fontFamily: "inherit", color: "#0c1410", background: "#7DBA3D", border: "1px solid #7DBA3D", borderRadius: "20px", padding: "3px 11px", cursor: "pointer", fontWeight: "600" },
  val: { color: "#fff", fontSize: "1.1rem", fontWeight: "600", margin: "8px 0 0" },
  unit: { color: "rgba(255,255,255,0.4)", fontSize: "0.72rem", fontWeight: "400", marginLeft: "4px" },
  mlab: { display: "flex", marginTop: "2px" },
  ms: { flex: 1, fontSize: "0.62rem", color: "rgba(255,255,255,0.4)", textAlign: "center" },
  skel: { color: "rgba(255,255,255,0.35)", fontSize: "0.78rem", padding: "10px 2px" },
};
