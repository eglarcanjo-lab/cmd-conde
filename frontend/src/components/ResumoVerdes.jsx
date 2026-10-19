// Home — bloco "Verdes" da Stella Pure Gold 600: 33857 (retornável) + 38172 (one way), flag Ambas/33857/38172.
// Flag Cobertura/Vol HL controla TUDO: a linha do RN selecionado (Todos = consolidado)
// e a faixa de ranking dos RNs (maior→menor). Cobertura = PDVs distintos que compraram
// no mês (conta 1x). Vol HL = volume em HL. Dado: GET /api/resumo/verdes.
import { useState, useEffect } from "react";
import * as XLSX from "xlsx-js-style";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";

// Editor das metas (admin): por mês do tri, Operação + cada RN · cobertura (PDVs) e HL.
function MetasVerdes({ meses, metas, setores, onFechar, onSalvo }) {
  const [mes, setMes] = useState(meses[meses.length - 1] || meses[0]);
  const linhas = ["OPERACAO", ...setores];
  const ini = (m) => Object.fromEntries(linhas.map((s) => [s, {
    cobertura: metas?.[m]?.[s]?.cobertura ?? "", hl: metas?.[m]?.[s]?.hl ?? "",
  }]));
  const [val, setVal] = useState(() => ini(mes));
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { setVal(ini(mes)); }, [mes]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (s, k, v) => setVal((o) => ({ ...o, [s]: { ...o[s], [k]: v } }));
  async function salvar() {
    setSalvando(true);
    try {
      await api.put("/api/resumo/verdes/metas", { mes, linhas: linhas.map((s) => ({ setor: s, ...val[s] })) });
      onSalvo();
    } catch (e) { alert("Erro ao salvar: " + (e?.response?.data?.error || e?.message || "falha")); }
    finally { setSalvando(false); }
  }
  const inp = { width: 80, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, color: "#fff", padding: "4px 6px", fontFamily: "inherit", fontSize: "0.8rem", textAlign: "right" };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onFechar}>
      <div style={{ background: "#13231a", border: "1px solid rgba(125,186,61,0.3)", borderRadius: 12, padding: 16, maxWidth: 420, width: "100%", maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <b style={{ color: "#fff" }}>🎯 Metas · Stella Pure Gold 600</b>
          <button onClick={onFechar} style={{ marginLeft: "auto", background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: "1rem" }}>✕</button>
        </div>
        <div style={{ display: "flex", gap: 5, marginBottom: 10 }}>
          {meses.map((m) => (
            <button key={m} onClick={() => setMes(m)} style={mes === m ? S.btnOn : S.btn}>{rotMes(m)}/{String(m).slice(2, 4)}</button>
          ))}
        </div>
        <p style={{ margin: "0 0 8px", fontSize: "0.72rem", color: "rgba(255,255,255,0.5)" }}>33857 + 38172 juntas. Deixe em branco o que não tiver meta. Sem meta da operação, a meta do consolidado é a soma dos RNs.</p>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
          <thead><tr style={{ color: "rgba(255,255,255,0.45)" }}><th style={{ textAlign: "left", padding: 4 }}>Setor</th><th style={{ padding: 4 }}>Cobertura (PDVs)</th><th style={{ padding: 4 }}>Volume (HL)</th></tr></thead>
          <tbody>
            {linhas.map((s) => (
              <tr key={s} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <td style={{ padding: 4, color: s === "OPERACAO" ? "#7DBA3D" : "rgba(255,255,255,0.8)", fontWeight: s === "OPERACAO" ? 700 : 500 }}>{s === "OPERACAO" ? "Operação" : s}</td>
                <td style={{ padding: 4, textAlign: "center" }}><input inputMode="numeric" style={inp} value={val[s]?.cobertura ?? ""} onChange={(e) => set(s, "cobertura", e.target.value)} /></td>
                <td style={{ padding: 4, textAlign: "center" }}><input inputMode="decimal" style={inp} value={val[s]?.hl ?? ""} onChange={(e) => set(s, "hl", e.target.value)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={salvar} disabled={salvando} style={{ ...S.btnOn, marginTop: 12, width: "100%", padding: "8px" }}>{salvando ? "Salvando…" : `Salvar metas de ${rotMes(mes)}`}</button>
      </div>
    </div>
  );
}

const MESES_ABR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const rotMes = (m) => { const [, mo] = String(m).split("-"); return MESES_ABR[(Number(mo) || 1) - 1] || m; };
const fmt = (n) => (Number(n) || 0).toLocaleString("pt-BR");
const primeiroNome = (s) => String(s || "").trim().split(/\s+/)[0] || "";

// Gráfico do mês ABERTO POR DIA (linhas): verde = valor do dia (PDVs que compraram no dia /
// HL do dia), com o número em cima de cada ponto; amarela = acumulado do mês (PDVs distintos
// até o dia = cobertura do mês / HL acumulado). Todas as datas no eixo. Toque/clique num dia
// mostra o detalhe (no celular não há "hover"). Cada linha tem a própria escala.
// sel/setSel vêm do bloco (o dia escolhido também filtra o ranking de RNs embaixo).
function GraficoDias({ dias, aba, mesRot, sel, setSel }) {
  if (!dias?.length) return <div style={S.skel}>Sem pedidos deste SKU no mês (o detalhe diário vem da importação de Pedidos/CORA).</div>;
  const cob = aba === "cobertura";
  const val = (d) => (cob ? d.pdvs : d.hl);
  const acu = (d) => (cob ? d.cob_acum : d.hl_acum);
  const maxV = Math.max(1, ...dias.map(val));
  const maxA = Math.max(1, ...dias.map(acu));
  const H = 130, TOPO = 16, BASE = H - 6, n = dias.length;
  const yV = (d) => BASE - (val(d) / maxV) * (BASE - TOPO);
  const yA = (d) => BASE - (acu(d) / maxA) * (BASE - TOPO);
  const x = (i) => i + 0.5;
  const linhaV = dias.map((d, i) => `${x(i)},${yV(d).toFixed(1)}`).join(" ");
  const linhaA = dias.map((d, i) => `${x(i)},${yA(d).toFixed(1)}`).join(" ");
  const ativo = sel != null ? dias[sel] : [...dias].reverse().find((d) => val(d) > 0) || dias[dias.length - 1];
  const iAtivo = dias.indexOf(ativo);
  const un = cob ? "PDVs" : "HL";
  const DOW = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  const pct = (i) => `${(x(i) / n) * 100}%`;
  const rotuloV = (v) => (cob ? fmt(v) : (Number(v) || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 }));
  return (
    <div style={{ marginTop: 6 }}>
      <div style={S.diaInfo}>
        <b>{String(ativo.dia).padStart(2, "0")}/{mesRot}</b> <span style={{ opacity: 0.55 }}>({DOW[ativo.dow]})</span>
        {" · "}<span style={{ color: "#9fce6a" }}>{rotuloV(val(ativo))} {un} no dia</span>
        {cob && ativo.novos > 0 ? <span style={{ opacity: 0.7 }}> ({ativo.novos} novos)</span> : null}
        {" · "}<span style={{ color: "#e8c468" }}>acumulado {rotuloV(acu(ativo))} {un}</span>
      </div>
      <div style={{ position: "relative", height: H, marginTop: 8 }}>
        {/* fundo: fins de semana + coluna do dia selecionado (também é a área de clique) */}
        <div style={{ position: "absolute", inset: 0, display: "flex" }}>
          {dias.map((d, i) => (
            <div key={d.dia} onClick={() => setSel(sel === i ? null : i)}
              title={`${String(d.dia).padStart(2, "0")}/${mesRot} · ${rotuloV(val(d))} ${un} no dia · acumulado ${rotuloV(acu(d))}`}
              style={{ flex: 1, height: "100%", cursor: "pointer",
                background: i === iAtivo ? "rgba(125,186,61,0.10)" : d.dow === 0 || d.dow === 6 ? "rgba(255,255,255,0.03)" : "transparent" }} />
          ))}
        </div>
        <svg viewBox={`0 0 ${n} ${H}`} preserveAspectRatio="none" width="100%" height={H} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} aria-hidden="true">
          <line x1="0" y1={BASE} x2={n} y2={BASE} stroke="rgba(255,255,255,0.12)" vectorEffect="non-scaling-stroke" />
          <polyline points={linhaA} fill="none" stroke="#e8c468" strokeWidth="2" strokeDasharray="5 4" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <polyline points={`${x(0)},${BASE} ${linhaV} ${x(n - 1)},${BASE}`} fill="rgba(125,186,61,0.10)" stroke="none" />
          <polyline points={linhaV} fill="none" stroke="#7DBA3D" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        {/* pontos e números (HTML p/ não distorcer) */}
        {dias.map((d, i) => (
          <div key={d.dia} style={{ position: "absolute", left: pct(i), top: yV(d), transform: "translate(-50%, -50%)", pointerEvents: "none" }}>
            <span style={{ display: "block", width: i === iAtivo ? 9 : 6, height: i === iAtivo ? 9 : 6, borderRadius: "50%",
              background: i === iAtivo ? "#b8f35a" : "#7DBA3D", border: "1.5px solid #0f1a14" }} />
            {val(d) > 0 && (
              <span style={{ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)", fontSize: "0.6rem", fontWeight: 700,
                color: i === iAtivo ? "#b8f35a" : "#9fce6a", whiteSpace: "nowrap" }}>{rotuloV(val(d))}</span>
            )}
          </div>
        ))}
        <div style={{ position: "absolute", left: pct(iAtivo), top: yA(ativo), transform: "translate(-50%, -50%)", width: 7, height: 7, borderRadius: "50%", background: "#e8c468", pointerEvents: "none" }} />
      </div>
      {/* TODAS as datas */}
      <div style={{ display: "flex", marginTop: 4 }}>
        {dias.map((d, i) => (
          <span key={d.dia} onClick={() => setSel(sel === i ? null : i)} style={{ flex: 1, minWidth: 0, textAlign: "center", fontSize: n > 22 ? "0.58rem" : "0.62rem", cursor: "pointer", overflow: "visible", whiteSpace: "nowrap",
            // mês longo: datas alternadas em 2 alturas (todas visíveis sem encostar)
            paddingTop: n > 20 && i % 2 === 1 ? 10 : 0,
            color: i === iAtivo ? "#7DBA3D" : d.dow === 0 || d.dow === 6 ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.5)", fontWeight: i === iAtivo ? 700 : 400, fontVariantNumeric: "tabular-nums" }}>
            {d.dia}
          </span>
        ))}
      </div>
      <div style={S.legenda}>
        <span><i style={{ ...S.leg, background: "#7DBA3D", height: 3 }} /> {cob ? "PDVs que compraram no dia" : "HL no dia"}</span>
        <span><i style={{ ...S.leg, background: "#e8c468", height: 2 }} /> {cob ? "Cobertura acumulada no mês (tracejada)" : "HL acumulado no mês (tracejada)"}</span>
      </div>
    </div>
  );
}

export default function ResumoVerdes({ mes }) {
  const [data, setData] = useState(null);
  const [erro, setErro] = useState("");
  const [esperando, setEsperando] = useState(false);
  const [aba, setAba] = useState("cobertura");   // flag mestre: cobertura | volhl
  // SKU: Stella Pure Gold 600 retornável (33857), one way (38172) ou as duas (PDV conta 1x)
  const [skuSel, setSkuSel] = useState("ambas");
  const skuParam = skuSel === "ambas" ? "33857,38172" : skuSel;
  const { usuario } = useAuth();
  const isAdmin = usuario?.perfil === "admin";
  const [editMetas, setEditMetas] = useState(false);
  const [recarga, setRecarga] = useState(0); // recarrega após salvar metas
  const [rnSel, setRnSel] = useState("todos");     // todos (consolidado) | <setor> (via clique na faixa)
  const [mesSel, setMesSel] = useState(null);       // índice do mês (filtra a faixa) | null = trimestre
  const [gvSel, setGvSel] = useState("todos");      // todos | "1" (GV1 = 1xx) | "3" (GV3 = 3xx)
  const [dias, setDias] = useState(null);           // mês aberto por dia (quando mesSel != null)
  const [diaSel, setDiaSel] = useState(null);       // índice do dia clicado (filtra o ranking) | null = mês
  const [carregandoDias, setCarregandoDias] = useState(false);
  const mesAberto = mesSel != null ? (data?.meses || [])[mesSel] : null;
  useEffect(() => { setDiaSel(null); }, [mesAberto]);
  useEffect(() => {
    if (!mesAberto) { setDias(null); return; }
    let vivo = true;
    setCarregandoDias(true);
    const params = { mes: mesAberto, sku: skuParam };
    if (rnSel !== "todos") params.setor = rnSel; else if (gvSel !== "todos") params.gv = gvSel;
    api.get("/api/resumo/verdes/dias", { params, timeout: 20000 })
      .then((r) => vivo && setDias(r.data?.dias || []))
      .catch(() => vivo && setDias([]))
      .finally(() => vivo && setCarregandoDias(false));
    return () => { vivo = false; };
  }, [mesAberto, rnSel, gvSel, skuParam]);

  useEffect(() => {
    let cancel = false, tent = 0;
    const buscar = () => {
      api.get("/api/resumo/verdes", { params: mes ? { mes, sku: skuParam } : { sku: skuParam }, timeout: 18000 })
        .then((r) => { if (!cancel) { setData(r.data); setEsperando(false); } })
        .catch((e) => {
          if (cancel) return;
          const st = e?.response?.status;
          const cold = st === 503 || st === 502 || e?.code === "ECONNABORTED" || !st;
          if (cold && tent < 6) { tent += 1; setEsperando(true); setTimeout(buscar, 8000); }
          else setErro(st ? `HTTP ${st}` : (e?.message || "falha"));
        });
    };
    setData(null); setErro(""); setMesSel(null);
    buscar();
    return () => { cancel = true; };
  }, [mes, skuParam, recarga]);

  // Export Excel: linha a linha dos pedidos do SKU, respeitando o filtro atual (RN + mês).
  async function exportarExcel() {
    try {
      const params = new URLSearchParams();
      params.set("sku", skuParam);
      if (rnSel !== "todos") params.set("setor", rnSel);
      if (mesSel != null && (data?.meses || [])[mesSel]) params.set("mes", data.meses[mesSel]);
      const r = await api.get(`/api/resumo/verdes/pedidos?${params.toString()}`);
      const linhas = r.data || [];
      if (!linhas.length) { alert("Sem linhas de pedido para este filtro.\nReimporte os Pedidos para gerar o detalhe (tabela nova)."); return; }
      const rows = linhas.map((x) => ({
        "Nº Pedido": x.num_pedido || "",
        "NF": x.nota_fiscal || "",
        "Data": x.data || "",
        "Setor": x.setor || "",
        "Cod PDV": x.cod_pdv || "",
        "PDV": x.nome_pdv || "",
        "Cod Prod": x.cod_produto || "",
        "Produto": x.nome_produto || "",
        "Volume (HL)": Number(x.volume_hl) || 0,
        "Mês": x.mes_referencia || "",
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [12, 12, 12, 8, 10, 28, 10, 28, 12, 10].map((w) => ({ wch: w }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Pedidos PG600");
      const suf = (rnSel !== "todos" ? `_setor${rnSel}` : "") + (mesSel != null ? `_${data.meses[mesSel]}` : "");
      XLSX.writeFile(wb, `verdes_stella_pg600_${skuSel}${suf}.xlsx`);
    } catch (e) {
      alert("Erro ao exportar: " + (e?.response?.data?.error || e?.message || "falha"));
    }
  }

  if (erro) return null;
  if (!data && !esperando) return null;

  const meses = data ? data.meses : [];
  const porRn = data ? (data.porRn || []) : [];
  const prod = data ? data.produto : { cod: skuParam, nome: "Stella Pure Gold 600" };

  // Série do selecionado. Escopo GV filtra os RNs (1xx = GV1, 3xx = GV3).
  const serieDe = (obj) => (obj ? (aba === "cobertura" ? obj.cobertura : obj.volHl) : []) || [];
  const noGv = (setor) => gvSel === "todos" || String(setor || "")[0] === gvSel;
  const porRnGv = porRn.filter((r) => noGv(r.setor));
  const rnObj = rnSel === "todos" ? null : porRn.find((r) => String(r.setor) === String(rnSel));
  // Consolidado da seleção: RN específico → o RN; senão GV (soma dos RNs do GV) ou global.
  const serie = rnSel !== "todos"
    ? serieDe(rnObj)
    : gvSel === "todos"
      ? serieDe(data && data.consolidado)
      : meses.map((_, i) => porRnGv.reduce((s, r) => s + (Number(serieDe(r)[i]) || 0), 0));
  const temDados = meses.length > 0 && serie.some((x) => x > 0);

  // Meta (só no "Ambas" — a meta é da Stella PG 600 inteira). RN → meta do RN; Todos → meta da
  // operação (ou soma dos RNs, se a operação não tiver); GV → soma das metas dos RNs do GV.
  const metas = (data && data.metas) || {};
  const campoMeta = aba === "cobertura" ? "cobertura" : "hl";
  const metaDe = (m, setor) => { const v = metas[m]?.[setor]?.[campoMeta]; return v == null ? null : Number(v); };
  const somaRns = (m, filtro) => {
    const vs = Object.keys(metas[m] || {}).filter((s) => s !== "OPERACAO" && filtro(s)).map((s) => metaDe(m, s)).filter((v) => v != null);
    return vs.length ? vs.reduce((a, b) => a + b, 0) : null;
  };
  const metaSerie = skuSel !== "ambas" ? meses.map(() => null) : meses.map((m) => (
    rnSel !== "todos" ? metaDe(m, String(rnSel))
      : gvSel !== "todos" ? somaRns(m, (s) => String(s)[0] === gvSel)
        : (metaDe(m, "OPERACAO") ?? somaRns(m, () => true))
  ));
  const temMeta = metaSerie.some((v) => v != null);
  const idxMeta = mesSel != null ? mesSel : meses.length - 1;
  const metaAtual = metaSerie[idxMeta];
  const pctMeta = metaAtual ? Math.round((serie[idxMeta] || 0) / metaAtual * 100) : null;

  // Ranking dos RNs (do GV escolhido) pelo flag atual, maior→menor. Se um mês estiver
  // selecionado, usa o valor daquele mês; senão, a soma do trimestre.
  // Dia clicado no gráfico diário → ranking daquele dia (PDVs / HL do RN no dia).
  const diaObj = mesAberto && diaSel != null && dias ? dias[diaSel] : null;
  const valRank = (r) => {
    if (diaObj) { const e = (diaObj.rn || {})[String(r.setor)]; return e ? (aba === "cobertura" ? e.pdvs : e.hl) : 0; }
    const arr = serieDe(r); return mesSel != null ? (Number(arr[mesSel]) || 0) : arr.reduce((s, x) => s + (Number(x) || 0), 0);
  };
  const ranking = porRnGv
    .map((r) => ({ setor: r.setor, rn: r.rn, total: valRank(r) }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);
  const maxRank = ranking.length ? ranking[0].total : 1;

  // Pontos da linha — X = centro da "coluna" de cada mês (alinha com os rótulos flex).
  const W = 300, H = 96, top = 12, bot = 84;
  const max = Math.max(1, ...serie, ...metaSerie.filter((v) => v != null));
  const n = meses.length;
  const colX = (i) => ((i + 0.5) / Math.max(n, 1)) * W;
  const pts = meses.map((_, i) => `${colX(i).toFixed(1)},${(bot - ((serie[i] || 0) / max) * (bot - top)).toFixed(1)}`);
  const ptsMeta = meses.map((_, i) => (metaSerie[i] == null ? null : `${colX(i).toFixed(1)},${(bot - (metaSerie[i] / max) * (bot - top)).toFixed(1)}`)).filter(Boolean);
  const x0 = colX(0), xN = colX(Math.max(n - 1, 0));
  const multiAno = new Set(meses.map((m) => String(m).slice(0, 4))).size > 1;
  const atual = mesSel != null ? (serie[mesSel] || 0) : (serie.length ? serie[serie.length - 1] : 0);
  const unidade = aba === "cobertura" ? "PDVs" : "HL";

  return (
    <div style={S.card}>
      <div style={S.head}>
        <span style={S.title}><span style={{ color: "#7DBA3D" }}>🌿</span> Verdes · Stella Pure Gold 600 <small style={S.cod}>({prod.cod})</small></span>
        <span style={S.tgl}>
          {[["ambas", "Ambas"], ["33857", "33857"], ["38172", "38172 OW"]].map(([k, l]) => (
            <button key={k} style={skuSel === k ? S.btnOn : S.btn} onClick={() => setSkuSel(k)}
              title={k === "ambas" ? "33857 (retornável) + 38172 (one way) — PDV que comprou qualquer uma conta 1x" : k === "33857" ? "Stella Pure Gold 600 retornável" : "Stella Pure Gold 600 one way"}>{l}</button>
          ))}
          <span style={{ width: 6 }} />
          <button style={aba === "cobertura" ? S.btnOn : S.btn} onClick={() => setAba("cobertura")}>Cobertura</button>
          <button style={aba === "volhl" ? S.btnOn : S.btn} onClick={() => setAba("volhl")}>Vol HL</button>
          <button style={S.excelBtn} onClick={exportarExcel} title="Exportar linhas do pedido (Excel) — respeita o RN e o mês filtrados">⤓ Excel</button>
          {isAdmin && data && <button style={S.excelBtn} onClick={() => setEditMetas(true)} title="Lançar meta de cobertura e volume (operação e por RN)">🎯 Metas</button>}
        </span>
      </div>
      {editMetas && data && (
        <MetasVerdes meses={data.meses} metas={data.metas}
          setores={[...new Set([...(data.porRn || []).map((r) => String(r.setor)), ...Object.values(data.metas || {}).flatMap((o) => Object.keys(o)).filter((s) => s !== "OPERACAO")])].sort()}
          onFechar={() => setEditMetas(false)} onSalvo={() => { setEditMetas(false); setRecarga((x) => x + 1); }} />
      )}

      <div style={S.gvRow}>
        <span style={S.gvLbl}>Escopo:</span>
        {[["todos", "Todos"], ["1", "GV 1"], ["3", "GV 3"]].map(([k, l]) => (
          <button key={k} style={gvSel === k ? { ...S.gvBtn, ...S.gvOn } : S.gvBtn} onClick={() => { setGvSel(k); setRnSel("todos"); }}>{l}</button>
        ))}
      </div>

      {!data ? (
        <div style={S.skel}>Acordando o servidor…</div>
      ) : (
        <>
          {!temDados ? (
            <div style={S.skel}>Sem vendas de {prod.nome} {rnSel !== "todos" ? `no setor ${rnSel}` : ""} — importe pedidos por mês.</div>
          ) : (
            <>
              <div style={S.val}>{fmt(atual)} <small style={S.unit}>{unidade} · {rotMes(mesSel != null ? meses[mesSel] : meses[meses.length - 1])}{rnSel !== "todos" ? ` · setor ${rnSel}` : gvSel !== "todos" ? ` · GV ${gvSel}` : ""}</small>
                {metaAtual != null && (
                  <small style={{ ...S.unit, marginLeft: 8, color: pctMeta >= 100 ? "#4ade80" : pctMeta >= 70 ? "#e8c468" : "#f87171", fontWeight: 700 }}>
                    meta {fmt(metaAtual)} · {pctMeta}%
                  </small>
                )}
              </div>
              {mesAberto ? (
                <>
                  <div style={S.voltar}>
                    <span>📅 {rotMes(mesAberto)} aberto por dia</span>
                    <button style={S.voltarBtn} onClick={() => setMesSel(null)}>← trimestre</button>
                  </div>
                  {carregandoDias || !dias ? <div style={S.skel}>Abrindo o mês por dia…</div>
                    : <GraficoDias dias={dias} aba={aba} mesRot={String(mesAberto).slice(5, 7)} sel={diaSel} setSel={setDiaSel} />}
                </>
              ) : (<>
              <div style={S.vlab}>{meses.map((m, i) => <span key={m} style={S.vs}>{serie[i] ? fmt(serie[i]) : ""}</span>)}</div>
              <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="96" preserveAspectRatio="none" style={{ marginTop: 2, display: "block" }} aria-hidden="true">
                <line x1={x0} y1={bot} x2={xN} y2={bot} stroke="rgba(255,255,255,0.12)" vectorEffect="non-scaling-stroke" />
                {n > 1 && <polyline points={`${x0},${bot} ${pts.join(" ")} ${xN},${bot}`} fill="rgba(125,186,61,0.10)" stroke="none" />}
                <polyline points={pts.join(" ")} fill="none" stroke="#7DBA3D" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                {ptsMeta.length > 1 && <polyline points={ptsMeta.join(" ")} fill="none" stroke="#e8c468" strokeWidth="1.5" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />}
                {ptsMeta.length === 1 && <circle cx={ptsMeta[0].split(",")[0]} cy={ptsMeta[0].split(",")[1]} r="2.5" fill="#e8c468" />}
              </svg>
              {temMeta && (
                <div style={{ ...S.vlab, marginTop: 2 }}>{meses.map((m, i) => (
                  <span key={m} style={{ ...S.vs, color: "#e8c468", fontSize: "0.68rem" }}>
                    {metaSerie[i] != null ? `meta ${fmt(metaSerie[i])} · ${Math.round((serie[i] || 0) / metaSerie[i] * 100)}%` : ""}
                  </span>
                ))}</div>
              )}
              </>)}
              <div style={S.mlab}>{meses.map((m, i) => (
                <span key={m} onClick={() => setMesSel(mesSel === i ? null : i)} style={{ ...S.ms, ...(mesSel === i ? S.msOn : {}) }} title="Clique para abrir este mês por dia">
                  {rotMes(m)}{multiAno ? <small style={{ opacity: 0.55 }}>/{String(m).slice(2, 4)}</small> : null}
                </span>
              ))}</div>
            </>
          )}

          {/* Faixa de ranking dos RNs pelo flag atual */}
          {ranking.length > 0 && (
            <div style={S.faixaWrap}>
              <div style={S.faixaTit}>Ranking RN — {aba === "cobertura" ? "cobertura" : "volume (HL)"} · {diaObj ? `dia ${String(diaObj.dia).padStart(2, "0")}/${String(mesAberto).slice(5, 7)}` : mesSel != null ? rotMes(meses[mesSel]) : "trimestre"} (maior → menor) · clique num RN, mês ou dia p/ filtrar</div>
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
                    <span style={S.faixaVal}>{fmt(r.total)}{(() => {
                      // meta do RN no mês selecionado (ou soma do tri), só no "Ambas" e fora do recorte por dia
                      if (skuSel !== "ambas" || diaObj) return null;
                      const ms = mesSel != null ? [meses[mesSel]] : meses;
                      const vs = ms.map((m) => metaDe(m, String(r.setor))).filter((v) => v != null);
                      if (!vs.length) return null;
                      const mt = vs.reduce((a, b) => a + b, 0); const p = mt ? Math.round(r.total / mt * 100) : 0;
                      return <small style={{ marginLeft: 4, color: p >= 100 ? "#4ade80" : p >= 70 ? "#e8c468" : "#f87171" }}>/{fmt(mt)} · {p}%</small>;
                    })()}</span>
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
  tgl: { marginLeft: "auto", display: "flex", gap: "5px", flexWrap: "wrap", alignItems: "center" },
  gvRow: { display: "flex", alignItems: "center", gap: "6px", marginTop: "8px" },
  gvLbl: { color: "rgba(255,255,255,0.4)", fontSize: "0.76rem", marginRight: "2px" },
  gvBtn: { fontSize: "0.76rem", fontFamily: "inherit", color: "rgba(255,255,255,0.5)", background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "20px", padding: "3px 11px", cursor: "pointer" },
  gvOn: { color: "#0c1410", background: "#7DBA3D", border: "1px solid #7DBA3D", fontWeight: "700" },
  btn: { fontSize: "0.82rem", fontFamily: "inherit", color: "rgba(255,255,255,0.5)", background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "20px", padding: "4px 13px", cursor: "pointer" },
  btnOn: { fontSize: "0.82rem", fontFamily: "inherit", color: "#0c1410", background: "#7DBA3D", border: "1px solid #7DBA3D", borderRadius: "20px", padding: "4px 13px", cursor: "pointer", fontWeight: "600" },
  excelBtn: { fontSize: "0.8rem", fontFamily: "inherit", color: "#4ade80", background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.4)", borderRadius: "20px", padding: "4px 12px", cursor: "pointer", fontWeight: "600" },
  rnRow: { display: "flex", alignItems: "center", gap: "8px", marginTop: "10px" },
  rnLbl: { color: "rgba(255,255,255,0.5)", fontSize: "0.8rem" },
  rnSel: { background: "#16211b", color: "#fff", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px", padding: "5px 10px", fontFamily: "inherit", fontSize: "0.82rem", cursor: "pointer", flex: 1, minWidth: 0 },
  val: { color: "#fff", fontSize: "1.3rem", fontWeight: "600", margin: "8px 0 0" },
  unit: { color: "rgba(255,255,255,0.4)", fontSize: "0.85rem", fontWeight: "400", marginLeft: "4px" },
  vlab: { display: "flex", marginTop: "6px", marginBottom: "1px" },
  vs: { flex: 1, fontSize: "0.62rem", color: "#9fce6a", fontWeight: "600", textAlign: "center", whiteSpace: "nowrap" },
  mlab: { display: "flex", marginTop: "2px" },
  ms: { flex: 1, fontSize: "0.72rem", color: "rgba(255,255,255,0.4)", textAlign: "center", cursor: "pointer", padding: "2px 0", borderRadius: "4px" },
  msOn: { color: "#7DBA3D", fontWeight: "700", background: "rgba(125,186,61,0.14)" },
  skel: { color: "rgba(255,255,255,0.35)", fontSize: "0.9rem", padding: "10px 2px" },
  voltar: { display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, color: "rgba(255,255,255,0.6)", fontSize: "0.78rem" },
  voltarBtn: { fontSize: "0.74rem", fontFamily: "inherit", color: "#7DBA3D", background: "transparent", border: "1px solid rgba(125,186,61,0.4)", borderRadius: 20, padding: "3px 10px", cursor: "pointer" },
  diaInfo: { color: "rgba(255,255,255,0.8)", fontSize: "0.76rem", minHeight: 18 },
  legenda: { display: "flex", gap: 14, flexWrap: "wrap", marginTop: 6, color: "rgba(255,255,255,0.45)", fontSize: "0.68rem" },
  leg: { display: "inline-block", width: 10, height: 8, borderRadius: 2, marginRight: 4, verticalAlign: "middle" },
  faixaWrap: { marginTop: "14px", borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: "10px", display: "flex", flexDirection: "column", gap: "5px" },
  faixaTit: { color: "rgba(255,255,255,0.5)", fontSize: "0.76rem", marginBottom: "3px" },
  faixaRow: { display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" },
  faixaLbl: { fontSize: "0.76rem", width: "96px", flexShrink: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  faixaBarBg: { flex: 1, height: "10px", background: "rgba(255,255,255,0.06)", borderRadius: "5px", overflow: "hidden" },
  faixaBar: { display: "block", height: "100%", borderRadius: "5px", transition: "width 0.3s" },
  faixaVal: { fontSize: "0.76rem", color: "rgba(255,255,255,0.8)", fontWeight: "600", minWidth: "44px", textAlign: "right", whiteSpace: "nowrap", flexShrink: 0, fontVariantNumeric: "tabular-nums" },
};
