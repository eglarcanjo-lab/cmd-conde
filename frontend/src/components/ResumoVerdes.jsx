// Home — bloco "Verdes" focado no SKU 33857 (Stella Pure Gold), mês a mês.
// Flag Cobertura/Distribuição controla TUDO: a linha do RN selecionado (Todos = consolidado)
// e a faixa de ranking dos RNs (maior→menor). Dado: GET /api/resumo/verdes.
import { useState, useEffect } from "react";
import api from "../services/api";

const MESES_ABR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const rotMes = (m) => { const [, mo] = String(m).split("-"); return MESES_ABR[(Number(mo) || 1) - 1] || m; };
const fmt = (n) => (Number(n) || 0).toLocaleString("pt-BR");
const primeiroNome = (s) => String(s || "").trim().split(/\s+/)[0] || "";

export default function ResumoVerdes() {
  const [data, setData] = useState(null);
  const [erro, setErro] = useState("");
  const [esperando, setEsperando] = useState(false);
  const [aba, setAba] = useState("cobertura");   // flag mestre: cobertura | distribuicao
  const [rnSel, setRnSel] = useState("todos");     // todos (consolidado) | <setor>

  useEffect(() => {
    let cancel = false, tent = 0;
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

  const meses = data ? data.meses : [];
  const porRn = data ? (data.porRn || []) : [];
  const prod = data ? data.produto : { cod: "33857", nome: "Stella Pure Gold" };

  // Série do selecionado (Todos = consolidado; senão o RN escolhido).
  const serieDe = (obj) => (obj ? (aba === "cobertura" ? obj.cobertura : obj.distribuicao) : []) || [];
  const rnObj = rnSel === "todos" ? null : porRn.find((r) => String(r.setor) === String(rnSel));
  const serie = rnSel === "todos" ? serieDe(data && data.consolidado) : serieDe(rnObj);
  const temDados = meses.length > 0 && serie.some((x) => x > 0);

  // Ranking dos RNs pelo flag atual (soma do período), maior→menor.
  const ranking = porRn
    .map((r) => ({ setor: r.setor, rn: r.rn, total: serieDe(r).reduce((s, x) => s + (Number(x) || 0), 0) }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);
  const maxRank = ranking.length ? ranking[0].total : 1;

  // Pontos da linha — X = centro da "coluna" de cada mês (alinha com os rótulos flex).
  const W = 300, H = 96, top = 12, bot = 84;
  const max = Math.max(1, ...serie);
  const n = meses.length;
  const colX = (i) => ((i + 0.5) / Math.max(n, 1)) * W;
  const pts = meses.map((_, i) => `${colX(i).toFixed(1)},${(bot - ((serie[i] || 0) / max) * (bot - top)).toFixed(1)}`);
  const x0 = colX(0), xN = colX(Math.max(n - 1, 0));
  const multiAno = new Set(meses.map((m) => String(m).slice(0, 4))).size > 1;
  const atual = serie.length ? serie[serie.length - 1] : 0;
  const unidade = aba === "cobertura" ? "PDVs" : "caixas";

  return (
    <div style={S.card}>
      <div style={S.head}>
        <span style={S.title}><span style={{ color: "#7DBA3D" }}>🌿</span> Verdes · {prod.nome} <small style={S.cod}>({prod.cod})</small></span>
        <span style={S.tgl}>
          <button style={aba === "cobertura" ? S.btnOn : S.btn} onClick={() => setAba("cobertura")}>Cobertura</button>
          <button style={aba === "distribuicao" ? S.btnOn : S.btn} onClick={() => setAba("distribuicao")}>Distribuição</button>
        </span>
      </div>

      {!data ? (
        <div style={S.skel}>Acordando o servidor…</div>
      ) : (
        <>
          {/* Seletor de RN */}
          <div style={S.rnRow}>
            <label style={S.rnLbl}>RN:</label>
            <select style={S.rnSel} value={rnSel} onChange={(e) => setRnSel(e.target.value)}>
              <option value="todos">Todos (consolidado)</option>
              {porRn.map((r) => (
                <option key={r.setor} value={r.setor}>{r.setor}{r.rn ? ` · ${primeiroNome(r.rn)}` : ""}</option>
              ))}
            </select>
          </div>

          {!temDados ? (
            <div style={S.skel}>Sem vendas de {prod.nome} {rnSel !== "todos" ? `no setor ${rnSel}` : ""} — importe pedidos por mês.</div>
          ) : (
            <>
              <div style={S.val}>{fmt(atual)} <small style={S.unit}>{unidade} · {rotMes(meses[meses.length - 1])}{rnSel !== "todos" ? ` · setor ${rnSel}` : ""}</small></div>
              <div style={S.vlab}>{meses.map((m, i) => <span key={m} style={S.vs}>{serie[i] ? fmt(serie[i]) : ""}</span>)}</div>
              <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="96" preserveAspectRatio="none" style={{ marginTop: 2, display: "block" }} aria-hidden="true">
                <line x1={x0} y1={bot} x2={xN} y2={bot} stroke="rgba(255,255,255,0.12)" vectorEffect="non-scaling-stroke" />
                {n > 1 && <polyline points={`${x0},${bot} ${pts.join(" ")} ${xN},${bot}`} fill="rgba(125,186,61,0.10)" stroke="none" />}
                <polyline points={pts.join(" ")} fill="none" stroke="#7DBA3D" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              </svg>
              <div style={S.mlab}>{meses.map((m) => <span key={m} style={S.ms}>{rotMes(m)}{multiAno ? <small style={{ opacity: 0.55 }}>/{String(m).slice(2, 4)}</small> : null}</span>)}</div>
            </>
          )}

          {/* Faixa de ranking dos RNs pelo flag atual */}
          {ranking.length > 0 && (
            <div style={S.faixaWrap}>
              <div style={S.faixaTit}>Ranking RN — {aba === "cobertura" ? "cobertura" : "distribuição"} (maior → menor)</div>
              {ranking.map((r) => {
                const sel = String(r.setor) === String(rnSel);
                return (
                  <div key={r.setor} style={S.faixaRow} onClick={() => setRnSel(sel ? "todos" : r.setor)} title={r.rn ? `${r.rn} · setor ${r.setor}` : `setor ${r.setor}`}>
                    <span style={{ ...S.faixaLbl, color: sel ? "#7DBA3D" : "rgba(255,255,255,0.7)", fontWeight: sel ? 700 : 500 }}>
                      {r.setor}{r.rn ? ` · ${primeiroNome(r.rn)}` : ""}
                    </span>
                    <span style={S.faixaBarBg}>
                      <span style={{ ...S.faixaBar, width: `${Math.max(3, (r.total / maxRank) * 100)}%`, background: sel ? "#7DBA3D" : "rgba(125,186,61,0.55)" }} />
                    </span>
                    <span style={S.faixaVal}>{fmt(r.total)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const S = {
  card: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "12px 14px", marginBottom: "16px" },
  head: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" },
  title: { color: "#fff", fontWeight: "600", fontSize: "1.05rem", display: "flex", alignItems: "center", gap: "7px" },
  cod: { color: "rgba(255,255,255,0.4)", fontWeight: "400", fontSize: "0.8rem" },
  tgl: { marginLeft: "auto", display: "flex", gap: "5px" },
  btn: { fontSize: "0.82rem", fontFamily: "inherit", color: "rgba(255,255,255,0.5)", background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "20px", padding: "4px 13px", cursor: "pointer" },
  btnOn: { fontSize: "0.82rem", fontFamily: "inherit", color: "#0c1410", background: "#7DBA3D", border: "1px solid #7DBA3D", borderRadius: "20px", padding: "4px 13px", cursor: "pointer", fontWeight: "600" },
  rnRow: { display: "flex", alignItems: "center", gap: "8px", marginTop: "10px" },
  rnLbl: { color: "rgba(255,255,255,0.5)", fontSize: "0.8rem" },
  rnSel: { background: "#16211b", color: "#fff", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px", padding: "5px 10px", fontFamily: "inherit", fontSize: "0.82rem", cursor: "pointer", flex: 1, minWidth: 0 },
  val: { color: "#fff", fontSize: "1.3rem", fontWeight: "600", margin: "8px 0 0" },
  unit: { color: "rgba(255,255,255,0.4)", fontSize: "0.85rem", fontWeight: "400", marginLeft: "4px" },
  vlab: { display: "flex", marginTop: "6px", marginBottom: "1px" },
  vs: { flex: 1, fontSize: "0.62rem", color: "#9fce6a", fontWeight: "600", textAlign: "center", whiteSpace: "nowrap" },
  mlab: { display: "flex", marginTop: "2px" },
  ms: { flex: 1, fontSize: "0.72rem", color: "rgba(255,255,255,0.4)", textAlign: "center" },
  skel: { color: "rgba(255,255,255,0.35)", fontSize: "0.9rem", padding: "10px 2px" },
  faixaWrap: { marginTop: "14px", borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: "10px", display: "flex", flexDirection: "column", gap: "5px" },
  faixaTit: { color: "rgba(255,255,255,0.5)", fontSize: "0.76rem", marginBottom: "3px" },
  faixaRow: { display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" },
  faixaLbl: { fontSize: "0.76rem", width: "96px", flexShrink: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  faixaBarBg: { flex: 1, height: "10px", background: "rgba(255,255,255,0.06)", borderRadius: "5px", overflow: "hidden" },
  faixaBar: { display: "block", height: "100%", borderRadius: "5px", transition: "width 0.3s" },
  faixaVal: { fontSize: "0.76rem", color: "rgba(255,255,255,0.8)", fontWeight: "600", width: "44px", textAlign: "right", flexShrink: 0, fontVariantNumeric: "tabular-nums" },
};
