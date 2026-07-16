import { useState, useEffect } from "react";
import api from "../../services/api";
import * as XLSX from "xlsx-js-style";

const META_PONTOS = 100000;

// Pesos oficiais do regulamento de RV (% do PO). Pontos Force = 50% (Meios);
// os 50% restantes (Resultados) se dividem conforme o segmento.
// Fixos no código — NÃO usar o campo "peso" da planilha de metas (vem corrompido).
const PESOS = {
  OFF: { pontos: 50, cerveja: 25, nab: 12.5, marketplace: 7.5, match: 5 }, // AS/Rota/Sub
  ON:  { pontos: 50, cerveja: 25, nab: 15,   marketplace: 10,  match: 0 }, // On Trade
};

const SETORES = [
  { cod: "101", nome: "João Victor",        tipo: "OFF" },
  { cod: "102", nome: "Eliel Lima",         tipo: "OFF" },
  { cod: "103", nome: "Bruno Leandro",      tipo: "OFF" },
  { cod: "104", nome: "Weferson Alexandre", tipo: "ON"  },
  { cod: "105", nome: "Iger Renan",         tipo: "ON"  },
  { cod: "106", nome: "Claudio Henrique",   tipo: "ON"  },
  { cod: "301", nome: "Luan Marques",       tipo: "ON"  },
  { cod: "302", nome: "Allan Fernando",     tipo: "ON"  },
  { cod: "303", nome: "Adriano Ferreira",   tipo: "ON"  },
  { cod: "304", nome: "Joicilene Alves",    tipo: "ON"  },
  { cod: "305", nome: "Manoel Roseno",      tipo: "ON"  },
];

const KPIS_AP = [
  { key: "tasks_compra",   label: "Tasks de Compra" },
  { key: "compradores",    label: "Compradores"     },
  { key: "rota_efetiva",   label: "Rota Efetiva"    },
  { key: "gps",            label: "GPS"             },
];

function pct(real, meta) {
  if (!meta || meta === 0) return 0;
  return Math.min((real / meta) * 100, 150);
}

// Garante que peso esteja em [0,100]. Se vier corrompido (>100), usa o fallback do regulamento.
function normPeso(val, fallback) {
  const v = parseFloat(val || 0);
  return (v > 0 && v <= 100) ? v : fallback;
}

// Pontos Bees: sem piso (paga de 0% a 150%)
// Resultados (volume/faturamento): piso 70% — abaixo não paga
function calcRv(real, meta, peso, poTotal, apOk, minPct = 70) {
  if (!apOk || !meta) return 0;
  const p = pct(real, meta);
  if (p < minPct) return 0;
  return (poTotal * peso / 100) * (p / 100);
}

function calcRvPot(real, meta, peso, poTotal, minPct = 70) {
  if (!meta) return 0;
  const p = pct(real, meta);
  if (p < minPct) return 0;
  return (poTotal * peso / 100) * (p / 100);
}

function fmtBrl(v) {
  return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtNum(v, dec = 1) {
  return Number(v).toLocaleString("pt-BR", { maximumFractionDigits: dec });
}

function BarRow({ label, real, meta, peso, poTotal, apOk, minPct = 70 }) {
  const p      = pct(real, meta);
  const cor    = p >= 100 ? "#4ade80" : p >= 70 ? "#7DBA3D" : "#f87171";
  const val    = calcRv(real, meta, peso, poTotal, apOk, minPct);
  const valPot = calcRvPot(real, meta, peso, poTotal, minPct);
  return (
    <div style={s.barRow}>
      <div style={s.barRowTop}>
        <span style={s.barLabel}>{label}</span>
        <span style={{ ...s.barPeso, color: cor }}>{p.toFixed(1)}% · <span style={s.barPesoSub}>{peso}% PO</span></span>
      </div>
      <div style={s.barTrack}>
        <div style={{ ...s.barFill, width: `${Math.min(p, 100)}%`, background: cor }} />
        <div style={s.barMark} />
      </div>
      <div style={s.barRowBot}>
        <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.76rem" }}>
          {fmtNum(real, 2)} / {fmtNum(meta, 2)}
        </span>
        <span style={{ color: apOk ? cor : "#7DBA3D", fontWeight: "600", fontSize: "0.82rem" }}>
          {apOk ? `R$ ${fmtBrl(val)}` : `⚠️ R$ ${fmtBrl(valPot)}`}
        </span>
      </div>
    </div>
  );
}

export default function RvSimulador() {
  const [mesRef, setMesRef] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [setorSel, setSetorSel] = useState("101");
  const [rvData,   setRvData]   = useState([]);
  const [pontosData, setPontosData] = useState([]);
  const [apData,   setApData]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [recalc,   setRecalc]   = useState(false);
  const [msg,      setMsg]      = useState("");

  useEffect(() => { carregar(); }, [mesRef]);

  async function carregar() {
    setLoading(true);
    try {
      const [r1, r2, r3] = await Promise.all([
        api.get(`/api/rv?mes=${mesRef}`),
        api.get(`/api/rv/pontos?mes=${mesRef}`),
        api.get(`/api/rv/ap?mes=${mesRef}`),
      ]);
      setRvData(r1.data || []);
      setPontosData(r2.data || []);
      setApData(r3.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function recalcular() {
    setRecalc(true);
    setMsg("");
    try {
      // Recalcula a RV do MÊS selecionado no simulador (não só o corrente)
      await api.post("/api/rv/calcular", { mes: mesRef });
      setMsg(`✅ RV recalculada (${mesRef})!`);
      await carregar();
    } catch { setMsg("❌ Erro ao recalcular."); }
    finally {
      setRecalc(false);
      setTimeout(() => setMsg(""), 3000);
    }
  }

  // ── helpers ───────────────────────────────────────────────────────────────
  function getRv(cod)     { return rvData.find(r => r.setor === cod) || null; }
  function getPontos(cod) { return pontosData.find(r => r.setor === cod) || null; }
  function getAp(cod)     { return apData.find(r => r.setor === cod) || null; }

  function computeTotals(cod) {
    const rv     = getRv(cod);
    const pontos = getPontos(cod);
    const ap     = getAp(cod);
    const seg    = SETORES.find(s => s.cod === cod)?.tipo || "ON";

    const apOk    = ap?.ap_ok === "OK";
    const poTotal = parseFloat(rv?.po_total || 1000);
    const w       = PESOS[seg] || PESOS.ON;

    // ── Pontos Force (Meios) — 50%, sem piso (paga de 0% a 150%) ──
    const pontosReal = parseFloat(pontos?.pontos_real || 0);
    const pesoPontos = w.pontos;
    const pctPts = Math.min(pontosReal / META_PONTOS * 100, 150);
    const rvPontos = apOk && pctPts >= 70 ? (poTotal * pesoPontos / 100) * (pctPts / 100) : 0;

    // ── Resultados — piso 70% ──
    const realCerv = parseFloat(rv?.real_cerveja || 0);
    const metaCerv = parseFloat(rv?.meta_cerveja || 0);
    const pesoCerv = w.cerveja;

    const realNab  = parseFloat(rv?.real_nab || 0);
    const metaNab  = parseFloat(rv?.meta_nab || 0);
    const pesoNab  = w.nab;

    const realMktp = parseFloat(rv?.real_marketplace || 0);
    const metaMktp = parseFloat(rv?.meta_marketplace || 0);
    const pesoMktp = w.marketplace;

    const realMatch = parseFloat(rv?.real_match || 0);
    const metaMatch = parseFloat(rv?.meta_match || 0);
    const pesoMatch = w.match;

    const rvCerv  = calcRv(realCerv,  metaCerv,  pesoCerv,  poTotal, apOk);
    const rvNab   = calcRv(realNab,   metaNab,   pesoNab,   poTotal, apOk);
    const rvMktp  = pesoMktp  > 0 ? calcRv(realMktp,  metaMktp,  pesoMktp,  poTotal, apOk) : 0;
    const rvMatch = pesoMatch > 0 ? calcRv(realMatch, metaMatch, pesoMatch, poTotal, apOk) : 0;
    const total   = rvPontos + rvCerv + rvNab + rvMktp + rvMatch;

    // Potencial (como se AP fosse OK)
    const rvPontsPot = pctPts >= 70 ? (poTotal * pesoPontos / 100) * (pctPts / 100) : 0;
    const rvCervPot  = calcRvPot(realCerv,  metaCerv,  pesoCerv,  poTotal);
    const rvNabPot   = calcRvPot(realNab,   metaNab,   pesoNab,   poTotal);
    const rvMktpPot  = pesoMktp  > 0 ? calcRvPot(realMktp,  metaMktp,  pesoMktp,  poTotal) : 0;
    const rvMatchPot = pesoMatch > 0 ? calcRvPot(realMatch, metaMatch, pesoMatch, poTotal) : 0;
    const totalPot   = rvPontsPot + rvCervPot + rvNabPot + rvMktpPot + rvMatchPot;

    // Indicadores de resultado com peso > 0 (para render dinâmico das barras e export)
    const indicadores = [
      { key: "cerveja",     nome: "Cerveja",     label: "🍺 Cerveja (Volume HL)",  real: realCerv,  meta: metaCerv,  peso: pesoCerv,  rv: rvCerv,  rvPot: rvCervPot  },
      { key: "nab",         nome: "NAB",         label: "🥤 NAB (Volume HL)",      real: realNab,   meta: metaNab,   peso: pesoNab,   rv: rvNab,   rvPot: rvNabPot   },
      { key: "marketplace", nome: "Marketplace", label: "🛒 Marketplace (GMV R$)", real: realMktp,  meta: metaMktp,  peso: pesoMktp,  rv: rvMktp,  rvPot: rvMktpPot  },
      { key: "match",       nome: "Match",       label: "🤝 Match (Vol HL)",       real: realMatch, meta: metaMatch, peso: pesoMatch, rv: rvMatch, rvPot: rvMatchPot },
    ].filter(i => i.peso > 0);

    return {
      apOk, poTotal, seg,
      pontosReal, pesoPontos, pctPontos: pct(pontosReal, META_PONTOS), rvPontos, rvPontsPot,
      realCerv, metaCerv, pesoCerv, rvCerv, rvCervPot,
      realNab,  metaNab,  pesoNab,  rvNab,  rvNabPot,
      realMktp, metaMktp, pesoMktp, rvMktp, rvMktpPot,
      realMatch, metaMatch, pesoMatch, rvMatch, rvMatchPot,
      indicadores,
      total, totalPot,
    };
  }

  const sel  = SETORES.find(s => s.cod === setorSel);
  const tot  = computeTotals(setorSel);
  const apSel = getAp(setorSel);

  // ── totalizador (todas as RNs) ────────────────────────────────────────────
  const linhas = SETORES.map(s => ({ ...s, ...computeTotals(s.cod) }));
  const somaTotal    = linhas.reduce((acc, l) => acc + l.total, 0);
  const somaPotencial = linhas.reduce((acc, l) => acc + (l.apOk ? l.total : l.totalPot), 0);

  function exportarRelatorio() {
    const r2 = (v) => Math.round(v * 100) / 100;
    const totalPO = linhas.reduce((a, l) => a + l.poTotal, 0);

    // ── Estilos (xlsx-js-style) ──────────────────────────────────
    const FMT_BRL = 'R$ #,##0.00';
    const FMT_PCT = '0.0"%"';
    const FMT_NUM = '#,##0.0';
    const bd = { style: "thin", color: { rgb: "D9DBE0" } };
    const border = { top: bd, bottom: bd, left: bd, right: bd };
    const stHeader = { font: { bold: true, color: { rgb: "FFFFFF" }, sz: 10 }, fill: { patternType: "solid", fgColor: { rgb: "111827" } }, alignment: { horizontal: "center", vertical: "center" }, border };
    const stCell   = { font: { sz: 10, color: { rgb: "1F2937" } }, alignment: { vertical: "center" }, border };
    const stAlt    = { ...stCell, fill: { patternType: "solid", fgColor: { rgb: "F6F7F9" } } };
    const stTotal  = { font: { bold: true, sz: 10, color: { rgb: "111827" } }, fill: { patternType: "solid", fgColor: { rgb: "FCE8A6" } }, alignment: { vertical: "center" }, border };
    const setStyle = (ws, r, c, st, fmt) => {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { t: "s", v: "" };
      ws[addr].s = st;
      if (fmt && typeof ws[addr].v === "number") ws[addr].z = fmt;
    };

    // ════════════════════════════════════════════════════════════
    // ABA 1 — RESUMO CONSOLIDADO
    // ════════════════════════════════════════════════════════════
    const resumo = linhas.map(l => ({
      "Setor":            l.cod,
      "Representante":    l.nome,
      "Segmento":         l.tipo,
      "AP":               l.apOk ? "OK" : "NOK",
      "PO Total (R$)":    r2(l.poTotal),
      "Pontos Force %":   r2(pct(l.pontosReal, META_PONTOS)),
      "Cerveja %":        r2(pct(l.realCerv, l.metaCerv)),
      "NAB %":            r2(pct(l.realNab, l.metaNab)),
      "Marketplace %":    l.pesoMktp  > 0 ? r2(pct(l.realMktp, l.metaMktp))   : "—",
      "Match %":          l.pesoMatch > 0 ? r2(pct(l.realMatch, l.metaMatch)) : "—",
      "RV Total (R$)":    r2(l.apOk ? l.total : l.totalPot),
      "% do PO":          l.poTotal > 0 ? r2(((l.apOk ? l.total : l.totalPot) / l.poTotal) * 100) : 0,
      "Status":           l.apOk ? "Confirmada" : "Potencial (AP NOK)",
    }));
    resumo.push({
      "Setor": "TOTAL OPERAÇÃO", "Representante": "", "Segmento": "", "AP": "",
      "PO Total (R$)": r2(totalPO), "Pontos Force %": "", "Cerveja %": "", "NAB %": "",
      "Marketplace %": "", "Match %": "", "RV Total (R$)": r2(somaTotal),
      "% do PO": totalPO > 0 ? r2((somaTotal / totalPO) * 100) : 0, "Status": "",
    });
    const wsResumo = XLSX.utils.json_to_sheet(resumo);
    wsResumo["!cols"] = [10,22,10,7,16,15,12,10,14,10,16,10,20].map(w => ({ wch: w }));
    wsResumo["!autofilter"] = { ref: `A1:M${resumo.length + 1}` };

    const curCols = new Set([4, 10]);              // PO Total, RV Total
    const pctCols = new Set([5, 6, 7, 8, 9, 11]);  // % indicadores + % PO
    const ctrCols = new Set([0, 2, 3]);            // Setor, Segmento, AP
    const NR = resumo.length + 1;                  // total de linhas (com header)
    for (let R = 0; R < NR; R++) {
      const isHead = R === 0;
      const isTot  = R === NR - 1;
      for (let C = 0; C <= 12; C++) {
        let st = isHead ? stHeader : isTot ? stTotal : (R % 2 === 0 ? stAlt : stCell);
        if (!isHead) {
          const align = ctrCols.has(C) ? "center" : (curCols.has(C) || pctCols.has(C)) ? "right" : "left";
          st = { ...st, alignment: { ...st.alignment, horizontal: align } };
        }
        const fmt = curCols.has(C) ? FMT_BRL : pctCols.has(C) ? FMT_PCT : null;
        setStyle(wsResumo, R, C, st, fmt);
      }
    }

    // ════════════════════════════════════════════════════════════
    // ABA 2 — DETALHAMENTO POR REPRESENTANTE (blocos como no PDF)
    // ════════════════════════════════════════════════════════════
    const aoa = [];
    const types = [];                 // tipo de cada linha (para estilizar)
    const merges = [];
    const push = (row, type) => { aoa.push(row); types.push(type); };

    push([`RELATÓRIO DE REMUNERAÇÃO VARIÁVEL — Competência ${mesRef}`, "", "", "", ""], "title");
    push(["", "", "", "", ""], "blank");

    linhas.forEach(l => {
      const ap = getAp(l.cod);
      const r0 = aoa.length;
      push([`Setor ${l.cod} — ${l.nome}  (${l.tipo})`, "", "", "", l.apOk ? "AP OK" : "AP NOK — bloqueada"], "rn");
      merges.push({ s: { r: r0, c: 0 }, e: { r: r0, c: 3 } });
      push([`PO Total: R$ ${fmtBrl(l.poTotal)}`, "", "", "", ""], "po");
      if (ap) {
        const gates = KPIS_AP.map(k => {
          const real = parseFloat(ap[`${k.key}_real`] || 0);
          const meta = parseFloat(ap[`${k.key}_meta`] || 0);
          return `${k.label}: ${real.toFixed(0)}/${meta.toFixed(0)} ${real >= meta ? "OK" : "NOK"}`;
        });
        push(["AP →", gates[0] || "", gates[1] || "", gates[2] || "", gates[3] || ""], "gates");
      }
      push(["Indicador", "Meta", "Realizado", "Atingimento %", "Parcela (R$)"], "thead");
      push(["Pontos Force", r2(META_PONTOS), r2(l.pontosReal), r2(pct(l.pontosReal, META_PONTOS)), r2(l.apOk ? l.rvPontos : l.rvPontsPot)], "row");
      l.indicadores.forEach(ind => {
        push([ind.nome, r2(ind.meta), r2(ind.real), r2(pct(ind.real, ind.meta)), r2(l.apOk ? ind.rv : ind.rvPot)], "row");
      });
      const rvExibido = l.apOk ? l.total : l.totalPot;
      push(["TOTAL RV", "", "", "", r2(rvExibido)], "total");
      if (!l.apOk) push(["Potencial caso AP fosse OK", "", "", "", r2(l.totalPot)], "pot");
      push(["", "", "", "", ""], "blank");
    });

    const wsDet = XLSX.utils.aoa_to_sheet(aoa);
    wsDet["!cols"] = [28, 16, 16, 16, 16].map(w => ({ wch: w }));
    wsDet["!merges"] = merges;
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }); // título

    const stTitle = { font: { bold: true, sz: 13, color: { rgb: "111827" } }, alignment: { vertical: "center" } };
    const stRN    = { font: { bold: true, sz: 11, color: { rgb: "FFFFFF" } }, fill: { patternType: "solid", fgColor: { rgb: "1F2937" } }, alignment: { vertical: "center" } };
    const stPO    = { font: { bold: true, sz: 10, color: { rgb: "374151" } }, fill: { patternType: "solid", fgColor: { rgb: "F3F4F6" } } };
    const stGates = { font: { sz: 9, color: { rgb: "6B7280" } } };
    const stThead = { font: { bold: true, sz: 9, color: { rgb: "374151" } }, fill: { patternType: "solid", fgColor: { rgb: "E5E7EB" } }, alignment: { horizontal: "center", vertical: "center" }, border };
    const stPot   = { font: { italic: true, sz: 9, color: { rgb: "92400E" } }, fill: { patternType: "solid", fgColor: { rgb: "FFF7ED" } } };

    types.forEach((type, R) => {
      if (type === "title") setStyle(wsDet, R, 0, stTitle);
      else if (type === "rn") {
        for (let C = 0; C <= 4; C++) {
          const st = C === 4
            ? { ...stRN, font: { ...stRN.font, color: { rgb: aoa[R][4].includes("NOK") ? "FCA5A5" : "86EFAC" } }, alignment: { horizontal: "right", vertical: "center" } }
            : stRN;
          setStyle(wsDet, R, C, st);
        }
      } else if (type === "po")    setStyle(wsDet, R, 0, stPO);
      else if (type === "gates")   { for (let C = 0; C <= 4; C++) setStyle(wsDet, R, C, stGates); }
      else if (type === "thead")   { for (let C = 0; C <= 4; C++) setStyle(wsDet, R, C, stThead); }
      else if (type === "row") {
        for (let C = 0; C <= 4; C++) {
          const fmt = C === 4 ? FMT_BRL : C === 3 ? FMT_PCT : (C === 1 || C === 2) ? FMT_NUM : null;
          const al  = C === 0 ? "left" : C === 3 ? "center" : "right";
          setStyle(wsDet, R, C, { ...stCell, alignment: { vertical: "center", horizontal: al } }, fmt);
        }
      } else if (type === "total") {
        for (let C = 0; C <= 4; C++) {
          const al = C === 0 ? "left" : "right";
          setStyle(wsDet, R, C, { ...stTotal, alignment: { vertical: "center", horizontal: al } }, C === 4 ? FMT_BRL : null);
        }
      } else if (type === "pot") {
        for (let C = 0; C <= 4; C++) setStyle(wsDet, R, C, { ...stPot, alignment: { horizontal: C === 4 ? "right" : "left" } }, C === 4 ? FMT_BRL : null);
      }
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");
    XLSX.utils.book_append_sheet(wb, wsDet,    "Detalhamento");
    XLSX.writeFile(wb, `relatorio_rv_${mesRef}.xlsx`);
  }

  return (
    <div>
      {/* Toolbar */}
      <div style={s.toolbar}>
        <div>
          <h3 style={s.title}>💰 Simulador RV</h3>
          <p style={s.desc}>Visualize e confira a RV de qualquer RN sem sair do painel admin.</p>
        </div>
        <div style={s.toolbarRight}>
          <input type="month" style={s.inputMes} value={mesRef} onChange={e => setMesRef(e.target.value)} />
          <button style={{ ...s.btnCalc, opacity: recalc ? 0.7 : 1 }} onClick={recalcular} disabled={recalc}>
            {recalc ? "Recalculando..." : "🔄 Recalcular RV"}
          </button>
          <button style={s.btnExport} onClick={() => window.open(`/rv-relatorio?mes=${mesRef}`, "_blank")}>
            📄 Relatório PDF
          </button>
          <button style={s.btnExcel} onClick={exportarRelatorio} title="Baixar dados brutos em Excel">
            ⬇️ Excel
          </button>
        </div>
      </div>
      {msg && <p style={{ color: msg.startsWith("✅") ? "#4ade80" : "#f87171", fontSize: "0.85rem", marginBottom: "12px" }}>{msg}</p>}

      {loading ? <p style={s.msgLoad}>Carregando...</p> : (
        <>
          {/* ── Seletor de RN ─────────────────────────────────────────── */}
          <div style={s.seletorWrap}>
            {SETORES.map(s2 => {
              const t = computeTotals(s2.cod);
              const ativo = s2.cod === setorSel;
              return (
                <button
                  key={s2.cod}
                  style={{
                    ...s.rnBtn,
                    ...(ativo ? s.rnBtnAtivo : {}),
                    borderColor: t.apOk ? "rgba(74,222,128,0.3)" : "rgba(248,113,113,0.3)",
                  }}
                  onClick={() => setSetorSel(s2.cod)}
                >
                  <span style={s.rnCod}>{s2.cod}</span>
                  <span style={s.rnNome}>{s2.nome.split(" ")[0]}</span>
                  <span style={{ ...s.rnTipo, color: s2.tipo === "OFF" ? "#60a5fa" : "#4ade80" }}>{s2.tipo}</span>
                  <span style={{
                    ...s.rnAp,
                    color: t.apOk ? "#4ade80" : "#f87171",
                  }}>{t.apOk ? "✅" : "❌"}</span>
                  <span style={{ color: t.apOk ? "#7DBA3D" : "#7DBA3D", fontSize: "0.7rem", fontWeight: "700" }}>
                    {t.apOk ? "" : "⚠️ "}R$ {fmtBrl(t.apOk ? t.total : t.totalPot)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── Detalhe do RN selecionado ─────────────────────────────── */}
          <div style={s.detalhe}>
            <div style={s.detalheHeader}>
              <div>
                <span style={s.detalheCod}>{sel?.cod}</span>
                <span style={s.detalheNome}>{sel?.nome}</span>
                <span style={{ ...s.detalheTipo, color: sel?.tipo === "OFF" ? "#60a5fa" : "#4ade80" }}>{sel?.tipo}</span>
              </div>
              <div style={s.apBadge(tot.apOk)}>
                {tot.apOk ? "✅ AP OK — RV Liberada" : "❌ AP NOK — RV Bloqueada"}
              </div>
            </div>

            {/* AP KPIs */}
            <div style={s.apGrid}>
              {KPIS_AP.map(kpi => {
                const real = parseFloat(apSel?.[`${kpi.key}_real`] || 0);
                const meta = parseFloat(apSel?.[`${kpi.key}_meta`] || 0);
                const ok   = meta > 0 && real >= meta;
                return (
                  <div key={kpi.key} style={{ ...s.apKpi, borderColor: ok ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)" }}>
                    <span style={s.apKpiLabel}>{kpi.label}</span>
                    <span style={{ fontSize: "1.2rem", fontWeight: "700", color: ok ? "#4ade80" : "#f87171" }}>
                      {real.toFixed(1)}%
                    </span>
                    <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.7rem" }}>meta: {meta.toFixed(1)}%</span>
                    <span>{ok ? "✅" : "❌"}</span>
                  </div>
                );
              })}
            </div>

            {/* RV Total */}
            <div style={s.totalCard}>
              <div>
                <p style={s.totalLabel}>Estimativa RV — {mesRef}</p>
                <p style={{ ...s.totalValor, color: tot.apOk ? "#4ade80" : "#7DBA3D" }}>
                  R$ {fmtBrl(tot.apOk ? tot.total : tot.totalPot)}
                </p>
                {!tot.apOk && (
                  <p style={{ margin: "0 0 2px", color: "#f87171", fontSize: "0.72rem", fontWeight: "600" }}>
                    ⚠️ potencial — bloqueado por AP NOK
                  </p>
                )}
                <p style={s.totalSub}>de R$ {fmtBrl(tot.poTotal)} possíveis (100% PO)</p>
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ ...s.totalPct, color: tot.apOk ? "#7DBA3D" : "#7DBA3D" }}>
                  {tot.poTotal > 0 ? (((tot.apOk ? tot.total : tot.totalPot) / tot.poTotal) * 100).toFixed(1) : "0"}%
                </p>
                <p style={s.totalPctLabel}>{tot.apOk ? "do PO" : "potencial"}</p>
              </div>
            </div>

            {/* Indicadores */}
            <div style={s.barsWrap}>
              {/* Pontos Force — sem piso (paga de 0%) */}
              <BarRow
                label={`⭐ Pontos Force`}
                real={tot.pontosReal} meta={META_PONTOS}
                peso={tot.pesoPontos} poTotal={tot.poTotal} apOk={tot.apOk}
                minPct={0}
              />
              {/* Resultados — piso 70%, renderizados conforme peso do segmento */}
              {tot.indicadores.map(ind => (
                <BarRow
                  key={ind.key}
                  label={ind.label}
                  real={ind.real} meta={ind.meta}
                  peso={ind.peso} poTotal={tot.poTotal} apOk={tot.apOk}
                />
              ))}
            </div>
          </div>

          {/* ── Totalizador ───────────────────────────────────────────── */}
          <div style={s.section}>
            <div style={s.sectionHeader}>
              <h3 style={s.sectionTitle}>📊 Totalizador — Todos os RNs</h3>
              <span style={s.somaChip}>
                Confirmado: <strong>R$ {fmtBrl(somaTotal)}</strong>
                &nbsp;·&nbsp;
                <span style={{ color: "#7DBA3D" }}>⚠️ Potencial: <strong>R$ {fmtBrl(somaPotencial)}</strong></span>
              </span>
            </div>
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    {["RN","Nome","Seg","AP","Pts %","Cerv %","NAB %","Var %","RV Est.","% PO"].map(h => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {linhas
                    .slice()
                    .sort((a, b) => b.total - a.total)
                    .map(l => {
                      const pPts  = l.pctPontos;
                      const pCerv = pct(l.realCerv, l.metaCerv);
                      const pNab  = pct(l.realNab,  l.metaNab);
                      // Var % = indicador variável principal do segmento (OFF→Match, ON→Marketplace)
                      const pVar  = l.seg === "OFF" ? pct(l.realMatch, l.metaMatch) : pct(l.realMktp, l.metaMktp);
                      const ppPO  = l.poTotal > 0 ? (l.total / l.poTotal * 100) : 0;
                      const cor = (v) => v >= 100 ? "#4ade80" : v >= 70 ? "#7DBA3D" : "#f87171";
                      return (
                        <tr
                          key={l.cod}
                          style={{ ...s.tr, cursor: "pointer", background: l.cod === setorSel ? "rgba(125,186,61,0.06)" : "" }}
                          onClick={() => setSetorSel(l.cod)}
                        >
                          <td style={s.td}><span style={s.codBadge}>{l.cod}</span></td>
                          <td style={{ ...s.td, textAlign: "left", fontSize: "0.8rem" }}>{l.nome}</td>
                          <td style={s.td}><span style={{ color: l.tipo === "OFF" ? "#60a5fa" : "#4ade80", fontSize: "0.75rem", fontWeight: "600" }}>{l.tipo}</span></td>
                          <td style={s.td}><span style={{ color: l.apOk ? "#4ade80" : "#f87171", fontWeight: "700" }}>{l.apOk ? "✅" : "❌"}</span></td>
                          <td style={{ ...s.td, color: cor(pPts),  fontWeight: "600" }}>{pPts.toFixed(0)}%</td>
                          <td style={{ ...s.td, color: cor(pCerv), fontWeight: "600" }}>{pCerv.toFixed(0)}%</td>
                          <td style={{ ...s.td, color: cor(pNab),  fontWeight: "600" }}>{pNab.toFixed(0)}%</td>
                          <td style={{ ...s.td, color: cor(pVar),  fontWeight: "600" }}>{pVar.toFixed(0)}%</td>
                          <td style={{ ...s.td, color: "#7DBA3D", fontWeight: "700" }}>
                            {!l.apOk && <span style={{ fontSize: "0.65rem", marginRight: "2px" }}>⚠️</span>}
                            R$ {fmtBrl(l.apOk ? l.total : l.totalPot)}
                          </td>
                          <td style={{ ...s.td, color: ppPO >= 100 ? "#4ade80" : ppPO >= 70 ? "#7DBA3D" : "#f87171", fontWeight: "600" }}>
                            {ppPO.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={8} style={{ ...s.td, textAlign: "right", color: "rgba(255,255,255,0.4)", fontSize: "0.8rem", fontWeight: "600", paddingRight: "12px" }}>
                      TOTAL EQUIPE
                    </td>
                    <td style={{ ...s.td, color: "#7DBA3D", fontWeight: "800", fontSize: "0.95rem" }}>
                      R$ {fmtBrl(somaTotal)}
                    </td>
                    <td style={s.td} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  toolbar: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", flexWrap: "wrap", gap: "12px" },
  toolbarRight: { display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" },
  title: { margin: "0 0 4px", fontSize: "1rem", fontWeight: "600" },
  desc: { margin: 0, color: "rgba(255,255,255,0.4)", fontSize: "0.82rem" },
  inputMes: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff", padding: "8px 12px", fontSize: "0.85rem", fontFamily: "inherit", outline: "none" },
  btnCalc: { background: "linear-gradient(135deg, #7DBA3D, #2E7D32)", color: "#0c1410", border: "none", borderRadius: "8px", padding: "8px 18px", fontWeight: "700", cursor: "pointer", fontSize: "0.85rem", fontFamily: "inherit" },
  btnExport: { background: "rgba(125,186,61,0.14)", border: "1px solid rgba(125,186,61,0.4)", color: "#7DBA3D", borderRadius: "8px", padding: "8px 18px", fontWeight: "600", cursor: "pointer", fontSize: "0.85rem", fontFamily: "inherit" },
  btnExcel: { background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.25)", color: "#4ade80", borderRadius: "8px", padding: "8px 14px", fontWeight: "600", cursor: "pointer", fontSize: "0.85rem", fontFamily: "inherit" },
  msgLoad: { color: "rgba(255,255,255,0.35)", textAlign: "center", padding: "60px" },

  // Seletor de RN
  seletorWrap: { display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "20px" },
  rnBtn: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", padding: "8px 12px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", minWidth: "80px", transition: "all 0.15s", fontFamily: "inherit" },
  rnBtnAtivo: { background: "rgba(125,186,61,0.1)", border: "1px solid rgba(125,186,61,0.4)" },
  rnCod: { color: "#7DBA3D", fontSize: "0.85rem", fontWeight: "700" },
  rnNome: { color: "rgba(255,255,255,0.6)", fontSize: "0.7rem" },
  rnTipo: { fontSize: "0.65rem", fontWeight: "600" },
  rnAp: { fontSize: "0.9rem" },

  // Detalhe
  detalhe: { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "20px", marginBottom: "20px" },
  detalheHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" },
  detalheCod: { background: "rgba(125,186,61,0.12)", color: "#7DBA3D", padding: "3px 10px", borderRadius: "6px", fontSize: "0.85rem", fontWeight: "700", marginRight: "8px" },
  detalheNome: { color: "#fff", fontSize: "1rem", fontWeight: "600", marginRight: "8px" },
  detalheTipo: { fontSize: "0.8rem", fontWeight: "600" },
  apBadge: (ok) => ({ padding: "5px 14px", borderRadius: "20px", fontSize: "0.82rem", fontWeight: "700", background: ok ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: ok ? "#4ade80" : "#f87171" }),

  apGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "8px", marginBottom: "16px" },
  apKpi: { background: "rgba(255,255,255,0.04)", border: "1px solid", borderRadius: "10px", padding: "10px 12px", display: "flex", flexDirection: "column", gap: "3px", alignItems: "center" },
  apKpiLabel: { color: "rgba(255,255,255,0.5)", fontSize: "0.72rem", textAlign: "center" },

  totalCard: { background: "linear-gradient(135deg, rgba(125,186,61,0.08), rgba(125,186,61,0.03))", border: "1px solid rgba(125,186,61,0.2)", borderRadius: "12px", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" },
  totalLabel: { margin: "0 0 4px", color: "rgba(255,255,255,0.5)", fontSize: "0.78rem" },
  totalValor: { margin: "0 0 4px", fontSize: "1.8rem", fontWeight: "800" },
  totalSub: { margin: 0, color: "rgba(255,255,255,0.3)", fontSize: "0.74rem" },
  totalPct: { margin: 0, fontSize: "2.2rem", fontWeight: "800", color: "#7DBA3D" },
  totalPctLabel: { margin: 0, color: "rgba(255,255,255,0.4)", fontSize: "0.76rem" },

  barsWrap: { display: "flex", flexDirection: "column", gap: "10px" },
  barRow: { background: "rgba(255,255,255,0.03)", borderRadius: "8px", padding: "12px 14px", display: "flex", flexDirection: "column", gap: "6px" },
  barRowTop: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  barLabel: { color: "rgba(255,255,255,0.75)", fontSize: "0.84rem", fontWeight: "500" },
  barPeso: { fontSize: "0.8rem", fontWeight: "700" },
  barPesoSub: { color: "rgba(255,255,255,0.35)", fontWeight: "400", fontSize: "0.74rem" },
  barTrack: { height: "7px", background: "rgba(255,255,255,0.08)", borderRadius: "4px", overflow: "visible", position: "relative" },
  barFill: { height: "100%", borderRadius: "4px", transition: "width 0.4s" },
  barMark: { position: "absolute", left: "70%", top: "-3px", width: "2px", height: "13px", background: "rgba(255,255,255,0.25)", borderRadius: "1px" },
  barRowBot: { display: "flex", justifyContent: "space-between", alignItems: "center" },

  // Totalizador
  section: { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "20px" },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "8px" },
  sectionTitle: { margin: 0, fontSize: "0.95rem", fontWeight: "600" },
  somaChip: { background: "rgba(125,186,61,0.1)", color: "#7DBA3D", padding: "4px 12px", borderRadius: "20px", fontSize: "0.82rem" },
  tableWrap: { overflowX: "auto", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.45)", fontSize: "0.68rem", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.04em", padding: "8px 10px", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.06)", whiteSpace: "nowrap" },
  tr: { borderBottom: "1px solid rgba(255,255,255,0.04)" },
  td: { padding: "8px 10px", color: "rgba(255,255,255,0.8)", fontSize: "0.82rem", textAlign: "center" },
  codBadge: { background: "rgba(125,186,61,0.12)", color: "#7DBA3D", padding: "2px 7px", borderRadius: "5px", fontSize: "0.72rem", fontWeight: "700" },
};
