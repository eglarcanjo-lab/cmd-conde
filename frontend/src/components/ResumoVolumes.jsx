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
  const [modo, setModo] = useState("sintetico"); // sintetico (barras) | analitico (planilha)
  const [ordAnal, setOrdAnal] = useState(null);   // ordenação do Analítico: { key, dir } | null

  // Célula de % colorida (heatmap) no dark theme.
  const corCel = (c) => c === "up" ? { background: "rgba(74,222,128,0.16)", color: "#7ee6a0", fontWeight: 700 }
    : c === "mid" ? { background: "rgba(232,196,104,0.16)", color: "#e8c468", fontWeight: 700 }
    : c === "down" ? { background: "rgba(240,153,123,0.16)", color: "#f0997b", fontWeight: 700 } : {};

  // Tabela analítica (planilha): Operação → GV → RN × categorias × Meta/Real/%/Tend/%T.
  // Clicar num cabeçalho (Setor/RN ou Meta/Real/%/Tend/%T de uma categoria) ordena a
  // seção "Por RN" — 1º clique desc, 2º asc, 3º volta ao padrão.
  const parseNum = (s) => parseFloat(String(s ?? "").replace(/\./g, "").replace(",", ".").replace("%", "")) || 0;
  const ordenarAnal = (key) => setOrdAnal((o) => (o && o.key === key) ? (o.dir === "desc" ? { key, dir: "asc" } : null) : { key, dir: "desc" });
  const setaAnal = (key) => ordAnal && ordAnal.key === key ? (ordAnal.dir === "asc" ? " ▲" : " ▼") : "";
  const renderAnalitico = (report) => {
    const cats = report.categorias || [], sub = report.subcols || [];
    return (report.secoes || []).map((sec) => {
      let linhas = sec.linhas || [];
      if (sec.setorCol && ordAnal) {
        const [cat, scol] = ordAnal.key.split("|");
        const valNum = (l) => cat === "__setor" ? (Number(l.setor) || 0) : cat === "__rn" ? null : parseNum(l.cats?.[cat]?.[scol]);
        linhas = [...linhas].sort((a, b) => {
          if (cat === "__rn") { const r = String(a.rotulo || "").localeCompare(String(b.rotulo || "")); return ordAnal.dir === "asc" ? r : -r; }
          return ordAnal.dir === "asc" ? valNum(a) - valNum(b) : valNum(b) - valNum(a);
        });
      }
      const clic = (key) => sec.setorCol ? { cursor: "pointer" } : {};
      const onOrd = (key) => sec.setorCol ? () => ordenarAnal(key) : undefined;
      const arrow = (key) => sec.setorCol ? setaAnal(key) : "";
      return (
        <div key={sec.titulo} style={{ marginBottom: 12 }}>
          <div style={S.mtxSecTit}>{sec.titulo}</div>
          <div style={{ overflowX: "auto" }}>
            <table style={S.mtx}>
              <thead>
                <tr>
                  <th style={S.mtxLbl} colSpan={sec.setorCol ? 2 : 1}></th>
                  {cats.map((c) => <th key={c.key} colSpan={sub.length} style={S.mtxCat}>{c.label}</th>)}
                </tr>
                <tr>
                  {sec.setorCol
                    ? <><th style={{ ...S.mtxLbl, ...clic() }} onClick={onOrd("__setor")}>Setor{arrow("__setor")}</th><th style={{ ...S.mtxLbl, ...clic() }} onClick={onOrd("__rn")}>{sec.colLabel}{arrow("__rn")}</th></>
                    : <th style={S.mtxLbl}>{sec.colLabel}</th>}
                  {cats.map((c) => sub.map((sc) => { const key = `${c.key}|${sc.key}`; return <th key={key} style={{ ...S.mtxSc, ...clic() }} onClick={onOrd(key)}>{sc.label}{arrow(key)}</th>; }))}
                </tr>
              </thead>
              <tbody>
                {linhas.map((l, i) => (
                  <tr key={i}>
                    {sec.setorCol
                      ? <><td style={S.mtxLblTd}>{l.setor || ""}</td><td style={S.mtxLblTd}>{l.rotulo}</td></>
                      : <td style={{ ...S.mtxLblTd, fontWeight: 700 }}>{l.rotulo}</td>}
                    {cats.map((c) => { const d = l.cats?.[c.key] || {}; return sub.map((sc) => {
                      const cor = sc.key === "pct" ? d._cor : sc.key === "pctT" ? d._corT : null;
                      return <td key={c.key + sc.key} style={{ ...S.mtxTd, ...(cor ? corCel(cor) : {}) }}>{d[sc.key] ?? "—"}</td>;
                    }); })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    });
  };

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

  const analitico = modo === "analitico" && data?.report;

  return (
    <div style={S.card}>
      <div style={S.title}>
        <span style={{ color: "#7DBA3D" }}>📊</span> Volumes{analitico ? "" : " — % da meta"}
        {data?.report && (
          <div style={S.seg}>
            {[["sintetico", "Sintético"], ["analitico", "Analítico"]].map(([k, l]) => (
              <button key={k} onClick={() => setModo(k)} style={modo === k ? { ...S.segBtn, ...S.segOn } : S.segBtn}>{l}</button>
            ))}
          </div>
        )}
      </div>
      <div style={S.sub}>{analitico
        ? "Planilha por Operação · GV · RN — Meta · Real · % · Tendência · %T (heatmap no %)"
        : "Barra escura = realizado · barra clara = tendência do mês · zeros = monitoramento (15%)"}</div>
      {!data ? (
        <div style={S.skel}>Carregando…</div>
      ) : analitico ? (
        renderAnalitico(data.report)
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
  seg: { display: "inline-flex", background: "rgba(255,255,255,0.05)", borderRadius: "8px", padding: "2px", marginLeft: "auto" },
  segBtn: { background: "transparent", border: "none", color: "rgba(255,255,255,0.5)", padding: "4px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "0.78rem", fontFamily: "inherit" },
  segOn: { background: "rgba(125,186,61,0.2)", color: "#7DBA3D", fontWeight: "700" },
  mtxSecTit: { color: "#7DBA3D", fontWeight: "700", fontSize: "0.85rem", margin: "10px 0 4px" },
  mtx: { borderCollapse: "collapse", fontSize: "0.72rem", width: "100%" },
  mtxCat: { background: "rgba(125,186,61,0.18)", color: "#cfe8b0", textAlign: "center", padding: "3px 6px", border: "1px solid rgba(255,255,255,0.06)", whiteSpace: "nowrap", fontWeight: "700" },
  mtxSc: { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)", padding: "3px 6px", border: "1px solid rgba(255,255,255,0.06)", textAlign: "right", whiteSpace: "nowrap", fontWeight: "500" },
  mtxLbl: { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)", padding: "3px 8px", border: "1px solid rgba(255,255,255,0.06)", textAlign: "left", whiteSpace: "nowrap" },
  mtxLblTd: { color: "#fff", padding: "3px 8px", border: "1px solid rgba(255,255,255,0.05)", textAlign: "left", whiteSpace: "nowrap" },
  mtxTd: { color: "rgba(255,255,255,0.8)", padding: "3px 6px", border: "1px solid rgba(255,255,255,0.05)", textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" },
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
