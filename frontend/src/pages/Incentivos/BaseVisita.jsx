// Base de PDVs × dia de visita (estudo de rota) — dentro de "Outros relatórios".
// Substitui a planilha "BASE DEFINITIVA" montada à mão: 1 linha por PDV ativo (cidade,
// bairro, categoria, setor, dia de visita, volume HL do período) + os resumos:
//   • Dia × Cidade por setor (nº de PDVs)   • Cidade / Bairro (PDVs e volume por dia)
//   • Maiores PDVs (sugestão de dia p/ equilibrar o volume na semana)
//   • Cidade × Setor / Dia (quantos RNs atendem cada cidade)   • Base total
// Dados: GET /api/relatorios/base-visita (setores 301–305 já somados em 107–111).
import { useState, useMemo } from "react";
import * as XLSX from "xlsx-js-style";
import api from "../../services/api";
import { contarUso } from "../../utils/uso";

const VERDE = "#7DBA3D";
const NOMES_MES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const rot = (ym) => `${NOMES_MES[Number(ym.slice(5, 7)) - 1]}/${ym.slice(2, 4)}`;
const DIAS_UTEIS = ["SEG", "TER", "QUA", "QUI", "SEX"];
const fmtV = (v) => (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtN = (v) => (Number(v) || 0).toLocaleString("pt-BR");
const ordTxt = (a, b) => String(a).localeCompare(String(b), "pt-BR", { numeric: true });

// Últimos 24 meses; padrão = jan do ano até o último mês completo.
function mesesDisponiveis() {
  const d = new Date(); const out = [];
  for (let k = 0; k < 24; k++) {
    const x = new Date(d.getFullYear(), d.getMonth() - k, 1);
    out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}
function mesesPadrao(opcoes) {
  const d = new Date();
  const fim = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return opcoes.filter((m) => m.slice(0, 4) === String(fim.getFullYear()) && m <= `${fim.getFullYear()}-${String(fim.getMonth() + 1).padStart(2, "0")}`);
}

// Dia com maior valor (empate → o 1º da semana); "" se tudo zero.
const diaMaior = (dias, val) => {
  let best = "", bv = 0;
  dias.forEach((d) => { if ((val[d] || 0) > bv) { bv = val[d]; best = d; } });
  return best;
};

// ── Cálculos (mesma lógica da planilha) ──────────────────────────────────────
export function montar(linhas, topN) {
  const temSab = linhas.some((l) => l.dia === "SAB");
  const DIAS = temSab ? [...DIAS_UTEIS, "SAB"] : DIAS_UTEIS;
  const diaDe = (l) => (DIAS.includes(l.dia) ? l.dia : "S/Dia");
  const cidades = [...new Set(linhas.map((l) => l.cidade || "(sem cidade)"))].sort(ordTxt);
  const setores = [...new Set(linhas.map((l) => l.setor))].sort(ordTxt);
  const cid = (l) => l.cidade || "(sem cidade)";

  // 1) Dia × Cidade por setor
  const porSetor = setores.map((s) => {
    const doSetor = linhas.filter((l) => l.setor === s);
    const linhasCid = [...new Set(doSetor.map(cid))].sort(ordTxt).map((c) => {
      const cont = {}; doSetor.filter((l) => cid(l) === c).forEach((l) => { cont[diaDe(l)] = (cont[diaDe(l)] || 0) + 1; });
      return { cidade: c, cont, total: Object.values(cont).reduce((a, b) => a + b, 0) };
    });
    const tot = {}; doSetor.forEach((l) => { tot[diaDe(l)] = (tot[diaDe(l)] || 0) + 1; });
    return { setor: s, linhas: linhasCid, tot, total: doSetor.length };
  });

  // 2) Cidade e Cidade/Bairro
  const agrega = (grupo) => {
    const cont = {}, vol = {};
    grupo.forEach((l) => { const d = diaDe(l); cont[d] = (cont[d] || 0) + 1; vol[d] = (vol[d] || 0) + l.volume; });
    const volTot = grupo.reduce((a, l) => a + l.volume, 0);
    return { cont, vol, qtd: grupo.length, volTot, diaVol: volTot ? diaMaior(DIAS, vol) : "", diaPdv: grupo.length ? diaMaior(DIAS, cont) : "" };
  };
  const porCidade = cidades.map((c) => ({ cidade: c, ...agrega(linhas.filter((l) => cid(l) === c)) }));
  const totalCidade = agrega(linhas);
  const porBairro = [];
  cidades.forEach((c) => {
    const daCid = linhas.filter((l) => cid(l) === c);
    [...new Set(daCid.map((l) => l.bairro || "(sem bairro)"))].sort(ordTxt).forEach((b) => {
      porBairro.push({ cidade: c, bairro: b, ...agrega(daCid.filter((l) => (l.bairro || "(sem bairro)") === b)) });
    });
  });

  // 3) Maiores PDVs: em ordem de volume, cada PDV vai p/ o dia útil com MENOS volume
  //    acumulado até ali (empate → 1º da semana) → semana equilibrada.
  const top = [...linhas].sort((a, b) => b.volume - a.volume).slice(0, topN);
  const acum = Object.fromEntries(DIAS_UTEIS.map((d) => [d, 0]));
  const estudo = top.map((l, i) => {
    let sug = DIAS_UTEIS[0];
    DIAS_UTEIS.forEach((d) => { if (acum[d] < acum[sug]) sug = d; });
    acum[sug] += l.volume;
    return { rank: i + 1, ...l, sugerido: sug, acao: l.dia === sug ? "Manter" : `Mover p/ ${sug}` };
  });
  const balanco = DIAS_UTEIS.map((d) => ({
    dia: d,
    atual: estudo.filter((e) => e.dia === d).reduce((a, e) => a + e.volume, 0),
    nAtual: estudo.filter((e) => e.dia === d).length,
    sugerido: estudo.filter((e) => e.sugerido === d).reduce((a, e) => a + e.volume, 0),
    nSug: estudo.filter((e) => e.sugerido === d).length,
  }));
  const amp = (k) => Math.max(...balanco.map((b) => b[k])) - Math.min(...balanco.map((b) => b[k]));

  // 4) Cidade × Setor e Cidade × Dia (+ quantos RNs atendem)
  const cidSetor = cidades.map((c) => {
    const daCid = linhas.filter((l) => cid(l) === c);
    const porS = {}; daCid.forEach((l) => { porS[l.setor] = (porS[l.setor] || 0) + 1; });
    const porD = {}; daCid.forEach((l) => { porD[diaDe(l)] = (porD[diaDe(l)] || 0) + 1; });
    return { cidade: c, porS, porD, total: daCid.length, rns: Object.keys(porS).length };
  }).sort((a, b) => b.total - a.total);

  return { DIAS, DIAS_SD: [...DIAS, "S/Dia"], setores, porSetor, porCidade, totalCidade, porBairro, estudo, balanco, ampAtual: amp("atual"), ampSug: amp("sugerido"), cidSetor };
}

const ABAS = [
  { id: "dia", label: "Dia × Cidade (por setor)" },
  { id: "cidade", label: "Cidade / Bairro" },
  { id: "estudo", label: "Maiores PDVs" },
  { id: "cidsetor", label: "Cidade × Setor" },
  { id: "base", label: "Base total" },
];

export default function BaseVisita() {
  const [aberto, setAberto] = useState(false);
  const opcoesMes = mesesDisponiveis();
  const [meses, setMeses] = useState(() => mesesPadrao(opcoesMes));
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [aba, setAba] = useState("dia");
  const [topN, setTopN] = useState(80);
  const [filtroSetor, setFiltroSetor] = useState("");
  const [busca, setBusca] = useState("");

  const toggleMes = (m) => setMeses((ms) => (ms.includes(m) ? ms.filter((x) => x !== m) : [...ms, m]));

  async function gerar() {
    if (!meses.length) { setErro("Marque ao menos um mês."); return; }
    setLoading(true); setErro(""); setD(null);
    try {
      const r = await api.get("/api/relatorios/base-visita", { params: { meses: [...meses].sort().join(",") }, timeout: 90000 });
      setD(r.data);
    } catch (e) { setErro(e.response?.data?.error || "Erro ao gerar o relatório."); }
    finally { setLoading(false); }
  }

  const linhas = useMemo(() => (d ? d.linhas.filter((l) => !filtroSetor || l.setor === filtroSetor) : []), [d, filtroSetor]);
  const r = useMemo(() => (d ? montar(linhas, Math.max(1, Number(topN) || 80)) : null), [d, linhas, topN]);
  const nomeRN = (s) => (d?.setores.find((x) => x.setor === s)?.nome || "").split(" ")[0];
  const periodo = d ? (d.meses.length === 1 ? rot(d.meses[0]) : `${rot(d.meses[0])} a ${rot(d.meses[d.meses.length - 1])} (${d.meses.length} meses)`) : "";

  // ── Excel: as mesmas abas da tela ──────────────────────────────────────────
  function exportar() {
    if (!r) return;
    const head = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "2E7D32" } } };
    const tit = { font: { bold: true, sz: 12 } };
    const totS = { font: { bold: true }, fill: { fgColor: { rgb: "EAF3DE" } } };
    const wb = XLSX.utils.book_new();
    const add = (nome, aoa, estilos, larg) => {
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      estilos.forEach(([row, st]) => (aoa[row] || []).forEach((_, c) => { const ref = XLSX.utils.encode_cell({ r: row, c }); if (ws[ref]) ws[ref].s = st; }));
      if (larg) ws["!cols"] = larg.map((w) => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, ws, nome);
    };
    const v1 = (x) => Math.round(x * 10) / 10;

    // 1) Dia × Cidade por setor
    {
      const aoa = [[`Dia da semana × Cidade, por setor (nº de PDVs) — ${periodo}`], []]; const st = [[0, tit]];
      r.porSetor.forEach((b) => {
        aoa.push([`Setor ${b.setor}${nomeRN(b.setor) ? ` · ${nomeRN(b.setor)}` : ""}`]); st.push([aoa.length - 1, tit]);
        aoa.push(["Cidade", ...r.DIAS_SD, "Total"]); st.push([aoa.length - 1, head]);
        b.linhas.forEach((l) => aoa.push([l.cidade, ...r.DIAS_SD.map((x) => l.cont[x] || 0), l.total]));
        aoa.push(["Total", ...r.DIAS_SD.map((x) => b.tot[x] || 0), b.total]); st.push([aoa.length - 1, totS]);
        aoa.push([]);
      });
      aoa.push(["Total de PDVs na operação"]); st.push([aoa.length - 1, tit]);
      aoa.push(["Setor", "RN", "Qtd PDV"]); st.push([aoa.length - 1, head]);
      r.porSetor.forEach((b) => aoa.push([b.setor, nomeRN(b.setor), b.total]));
      aoa.push(["TOTAL", "", linhas.length]); st.push([aoa.length - 1, totS]);
      add("Dia x Cidade por Setor", aoa, st, [24, 8, 8, 8, 8, 8, 8, 8, 8]);
    }
    // 2) Cidade / Bairro
    {
      const aoa = [[`Resumo por cidade e bairro — ${periodo} (volume em HL)`], [], ["1) Resumo por cidade"]];
      const st = [[0, tit], [2, tit]];
      aoa.push(["Cidade", "Qtd PDVs", "Vol Total", ...r.DIAS.map((x) => `${x} (vol)`), "Dia maior volume", "Dia maior nº PDVs"]); st.push([aoa.length - 1, head]);
      r.porCidade.forEach((c) => aoa.push([c.cidade, c.qtd, v1(c.volTot), ...r.DIAS.map((x) => v1(c.vol[x] || 0)), c.diaVol, c.diaPdv]));
      const t = r.totalCidade;
      aoa.push(["TOTAL", t.qtd, v1(t.volTot), ...r.DIAS.map((x) => v1(t.vol[x] || 0)), "", ""]); st.push([aoa.length - 1, totS]);
      aoa.push([], ["2) Detalhe por cidade e bairro"]); st.push([aoa.length - 1, tit]);
      aoa.push(["Cidade", "Bairro", ...r.DIAS, "Total PDV", ...r.DIAS.map((x) => `${x} vol`), "Vol Total", "Dia maior volume", "Dia maior nº PDV"]); st.push([aoa.length - 1, head]);
      r.porBairro.forEach((b) => aoa.push([b.cidade, b.bairro, ...r.DIAS.map((x) => b.cont[x] || 0), b.qtd, ...r.DIAS.map((x) => v1(b.vol[x] || 0)), v1(b.volTot), b.diaVol, b.diaPdv]));
      add("Cidade-Bairro", aoa, st, [22, 22, 8, 8, 8, 8, 8, 9, 9, 9, 9, 9, 9, 10, 12, 12]);
    }
    // 3) Maiores PDVs
    {
      const aoa = [[`Maiores ${r.estudo.length} PDVs — sugestão de dia p/ equilibrar o volume na semana — ${periodo}`], []];
      const st = [[0, tit]];
      aoa.push(["Rank", "Cód PDV", "Nome Fantasia", "Cidade", "Bairro", "Setor", "Volume (HL)", "Dia atual", "Dia sugerido", "Ação"]); st.push([2, head]);
      r.estudo.forEach((e) => aoa.push([e.rank, Number(e.cod_pdv) || e.cod_pdv, e.nome, e.cidade, e.bairro, e.setor, v1(e.volume), e.dia || "S/Dia", e.sugerido, e.acao]));
      aoa.push([]);
      aoa.push(["Balanceamento"]); st.push([aoa.length - 1, tit]);
      aoa.push(["Dia", "Vol atual", "nº atual", "Vol sugerido", "nº sugerido"]); st.push([aoa.length - 1, head]);
      r.balanco.forEach((b) => aoa.push([b.dia, v1(b.atual), b.nAtual, v1(b.sugerido), b.nSug]));
      aoa.push(["Amplitude (máx − mín)", v1(r.ampAtual), "", v1(r.ampSug), ""]); st.push([aoa.length - 1, totS]);
      add("Maiores PDVs", aoa, st, [6, 9, 32, 20, 20, 7, 11, 9, 11, 13]);
    }
    // 4) Cidade × Setor / Dia
    {
      const aoa = [[`Cidade × Setor e Cidade × Dia (nº de PDVs) — ${periodo}`], []]; const st = [[0, tit]];
      aoa.push(["Cidade", ...r.setores, "Total", "Qtos RNs atendem"]); st.push([2, head]);
      r.cidSetor.forEach((c) => aoa.push([c.cidade, ...r.setores.map((s) => c.porS[s] || ""), c.total, c.rns]));
      aoa.push(["Total geral", ...r.setores.map((s) => linhas.filter((l) => l.setor === s).length), linhas.length, ""]); st.push([aoa.length - 1, totS]);
      aoa.push([]);
      aoa.push(["Cidade", ...r.DIAS_SD, "Total"]); st.push([aoa.length - 1, head]);
      r.cidSetor.forEach((c) => aoa.push([c.cidade, ...r.DIAS_SD.map((x) => c.porD[x] || 0), c.total]));
      add("Cidade x Setor", aoa, st, [22, ...r.setores.map(() => 6), 7, 10]);
    }
    // 5) Base total
    {
      const aoa = [["Cód PDV", "Nome Fantasia", "Cidade", "Bairro", "Categoria", "Setor VDE", "Dia de Visita do VDE", `Volume (${d.meses.length} meses)`, "Média Mensal"]];
      linhas.forEach((l) => aoa.push([Number(l.cod_pdv) || l.cod_pdv, l.nome, l.cidade, l.bairro, l.categoria, Number(l.setor) || l.setor, l.dia, v1(l.volume), Math.round(l.media * 100) / 100]));
      add("Base total", aoa, [[0, head]], [9, 32, 20, 22, 22, 9, 10, 14, 12]);
    }
    const arqMes = d.meses.length === 1 ? rot(d.meses[0]) : `${rot(d.meses[0])}-a-${rot(d.meses[d.meses.length - 1])}`;
    XLSX.writeFile(wb, `Base_PDVs_DiaVisita_${filtroSetor ? `Setor${filtroSetor}_` : ""}${arqMes.replace(/\//g, "")}.xlsx`);
  }

  const baseFiltrada = r && aba === "base"
    ? linhas.filter((l) => { const q = busca.trim().toLowerCase(); return !q || `${l.cod_pdv} ${l.nome} ${l.cidade} ${l.bairro}`.toLowerCase().includes(q); })
    : [];

  return (
    <div style={S.card}>
      <button style={S.head} onClick={() => setAberto((a) => { if (!a) contarUso("/incentivos#base-visita"); return !a; })}>
        <span>🗺️ Base de PDVs × dia de visita — cidade · bairro · volume (estudo de rota)</span>
        <span style={{ color: "rgba(255,255,255,0.5)" }}>{aberto ? "▾" : "▸"}</span>
      </button>
      {aberto && (
        <div style={{ padding: "4px 14px 14px" }}>
          <div style={S.linhaCtrl}>
            <span style={S.lbl}>Volume dos meses:</span>
            {[...opcoesMes].reverse().map((m) => (
              <button key={m} type="button" onClick={() => toggleMes(m)} style={meses.includes(m) ? S.mesOn : S.mes}>{rot(m)}</button>
            ))}
          </div>
          <p style={S.hint}>PDVs ativos da base de clientes (0105070402) com o dia de visita atual. Volume = HL de venda efetiva somado nos meses marcados · média mensal = volume ÷ nº de meses. Setores 301–305 já somados em 107–111.</p>
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button style={S.gerar} onClick={gerar} disabled={loading}>{loading ? "Gerando…" : "Gerar"}</button>
            {d && <button style={S.excel} onClick={exportar}>⤓ Excel (todas as abas)</button>}
            {d && (
              <select style={S.select} value={filtroSetor} onChange={(e) => setFiltroSetor(e.target.value)}>
                <option value="">Todos os setores</option>
                {d.setores.map((s) => <option key={s.setor} value={s.setor}>{s.setor}{s.nome ? ` · ${s.nome.split(" ")[0]}` : ""}</option>)}
              </select>
            )}
          </div>
          {erro && <p style={{ color: "#f87171", fontSize: "0.84rem" }}>{erro}</p>}

          {r && (
            <>
              <div style={S.kpis}>
                <div style={S.kpi}><b>{fmtN(linhas.length)}</b><span style={S.kpiL}>PDVs</span></div>
                <div style={S.kpi}><b>{fmtV(r.totalCidade.volTot)}</b><span style={S.kpiL}>HL no período</span></div>
                <div style={S.kpi}><b>{fmtN(r.porCidade.length)}</b><span style={S.kpiL}>cidades</span></div>
                <div style={S.kpi}><b>{fmtN(linhas.filter((l) => !l.volume).length)}</b><span style={S.kpiL}>PDVs sem venda</span></div>
              </div>
              {!d.tem_bairro && <p style={{ ...S.hint, color: "#fbbf24" }}>⚠️ Bairro ainda vazio — passa a vir na próxima importação da base de clientes (0105070402).</p>}
              <div style={S.abas}>
                {ABAS.map((a) => <button key={a.id} type="button" onClick={() => setAba(a.id)} style={aba === a.id ? S.abaOn : S.aba}>{a.label}</button>)}
              </div>

              {aba === "dia" && (
                <div style={S.grid}>
                  {r.porSetor.map((b) => (
                    <div key={b.setor} style={S.tableWrap}>
                      <div style={S.blocoTit}>Setor {b.setor}{nomeRN(b.setor) ? ` · ${nomeRN(b.setor)}` : ""} <span style={S.media}>· {b.total} PDVs</span></div>
                      <table style={S.table}>
                        <thead><tr><th style={S.th}>Cidade</th>{r.DIAS_SD.map((x) => <th key={x} style={S.thC}>{x}</th>)}<th style={S.thC}>Total</th></tr></thead>
                        <tbody>
                          {b.linhas.map((l) => (
                            <tr key={l.cidade} style={S.tr}><td style={S.td}>{l.cidade}</td>{r.DIAS_SD.map((x) => <td key={x} style={l.cont[x] ? S.tdC : S.tdZ}>{l.cont[x] || 0}</td>)}<td style={{ ...S.tdC, fontWeight: 700 }}>{l.total}</td></tr>
                          ))}
                          <tr style={S.trTot}><td style={{ ...S.td, fontWeight: 700 }}>Total</td>{r.DIAS_SD.map((x) => <td key={x} style={{ ...S.tdC, fontWeight: 700 }}>{b.tot[x] || 0}</td>)}<td style={{ ...S.tdC, fontWeight: 800, color: VERDE }}>{b.total}</td></tr>
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              )}

              {aba === "cidade" && (
                <>
                  <div style={S.tableWrap}>
                    <table style={S.table}>
                      <thead><tr><th style={S.th}>Cidade</th><th style={S.thC}>PDVs</th><th style={S.thC}>Vol total</th>{r.DIAS.map((x) => <th key={x} style={S.thC}>{x} (vol)</th>)}<th style={S.thC}>Dia + volume</th><th style={S.thC}>Dia + PDVs</th></tr></thead>
                      <tbody>
                        {r.porCidade.map((c) => (
                          <tr key={c.cidade} style={S.tr}><td style={S.td}>{c.cidade}</td><td style={S.tdC}>{c.qtd}</td><td style={{ ...S.tdC, fontWeight: 700 }}>{fmtV(c.volTot)}</td>
                            {r.DIAS.map((x) => <td key={x} style={x === c.diaVol ? S.tdDest : (c.vol[x] ? S.tdC : S.tdZ)}>{fmtV(c.vol[x])}</td>)}
                            <td style={S.tdC}>{c.diaVol}</td><td style={S.tdC}>{c.diaPdv}</td></tr>
                        ))}
                        <tr style={S.trTot}><td style={{ ...S.td, fontWeight: 700 }}>TOTAL</td><td style={{ ...S.tdC, fontWeight: 700 }}>{r.totalCidade.qtd}</td><td style={{ ...S.tdC, fontWeight: 800, color: VERDE }}>{fmtV(r.totalCidade.volTot)}</td>
                          {r.DIAS.map((x) => <td key={x} style={{ ...S.tdC, fontWeight: 700 }}>{fmtV(r.totalCidade.vol[x])}</td>)}<td /><td /></tr>
                      </tbody>
                    </table>
                  </div>
                  <div style={{ ...S.blocoTit, marginTop: 14 }}>Detalhe por cidade e bairro <span style={S.media}>· nº de PDVs por dia · volume (HL)</span></div>
                  <div style={{ ...S.tableWrap, maxHeight: 520, overflowY: "auto" }}>
                    <table style={S.table}>
                      <thead><tr><th style={S.th}>Cidade</th><th style={S.th}>Bairro</th>{r.DIAS.map((x) => <th key={x} style={S.thC}>{x}</th>)}<th style={S.thC}>PDVs</th><th style={S.thC}>Vol total</th><th style={S.thC}>Dia + volume</th><th style={S.thC}>Dia + PDVs</th></tr></thead>
                      <tbody>
                        {r.porBairro.map((b) => (
                          <tr key={`${b.cidade}|${b.bairro}`} style={S.tr}><td style={S.td}>{b.cidade}</td><td style={S.td}>{b.bairro}</td>
                            {r.DIAS.map((x) => <td key={x} style={b.cont[x] ? S.tdC : S.tdZ} title={b.vol[x] ? `${fmtV(b.vol[x])} HL` : ""}>{b.cont[x] || 0}</td>)}
                            <td style={{ ...S.tdC, fontWeight: 700 }}>{b.qtd}</td><td style={S.tdC}>{fmtV(b.volTot)}</td><td style={S.tdC}>{b.diaVol}</td><td style={S.tdC}>{b.diaPdv}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {aba === "estudo" && (
                <>
                  <div style={S.linhaCtrl}>
                    <span style={S.lbl}>Quantos maiores PDVs:</span>
                    <input type="number" min={5} max={500} style={{ ...S.select, width: 80 }} value={topN} onChange={(e) => setTopN(e.target.value)} />
                    <span style={S.hint}>Em ordem de volume, cada PDV vai p/ o dia (SEG–SEX) com menos volume acumulado — a semana fica equilibrada.</span>
                  </div>
                  <div style={{ ...S.tableWrap, marginBottom: 12 }}>
                    <table style={S.table}>
                      <thead><tr><th style={S.th}>Dia</th><th style={S.thC}>Vol atual</th><th style={S.thC}>nº atual</th><th style={S.thC}>Vol sugerido</th><th style={S.thC}>nº sugerido</th></tr></thead>
                      <tbody>
                        {r.balanco.map((b) => <tr key={b.dia} style={S.tr}><td style={S.td}>{b.dia}</td><td style={S.tdC}>{fmtV(b.atual)}</td><td style={S.tdC}>{b.nAtual}</td><td style={{ ...S.tdC, color: VERDE, fontWeight: 700 }}>{fmtV(b.sugerido)}</td><td style={S.tdC}>{b.nSug}</td></tr>)}
                        <tr style={S.trTot}><td style={{ ...S.td, fontWeight: 700 }}>Amplitude (máx − mín)</td><td style={{ ...S.tdC, fontWeight: 700 }}>{fmtV(r.ampAtual)}</td><td /><td style={{ ...S.tdC, fontWeight: 800, color: VERDE }}>{fmtV(r.ampSug)}</td><td /></tr>
                      </tbody>
                    </table>
                  </div>
                  <div style={{ ...S.tableWrap, maxHeight: 520, overflowY: "auto" }}>
                    <table style={S.table}>
                      <thead><tr><th style={S.thC}>#</th><th style={S.th}>PDV</th><th style={S.th}>Cidade · Bairro</th><th style={S.thC}>Setor</th><th style={S.thC}>Volume</th><th style={S.thC}>Dia atual</th><th style={S.thC}>Sugerido</th><th style={S.th}>Ação</th></tr></thead>
                      <tbody>
                        {r.estudo.map((e) => (
                          <tr key={e.cod_pdv} style={S.tr}><td style={S.tdC}>{e.rank}</td><td style={S.td}><b>{e.cod_pdv}</b> · {e.nome}</td><td style={S.td}>{e.cidade}{e.bairro ? ` · ${e.bairro}` : ""}</td><td style={S.tdC}>{e.setor}</td>
                            <td style={S.tdC}>{fmtV(e.volume)}</td><td style={S.tdC}>{e.dia || "S/Dia"}</td><td style={S.tdC}>{e.sugerido}</td>
                            <td style={{ ...S.td, color: e.acao === "Manter" ? "rgba(255,255,255,0.45)" : "#fbbf24" }}>{e.acao}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {aba === "cidsetor" && (
                <>
                  <div style={S.tableWrap}>
                    <table style={S.table}>
                      <thead><tr><th style={S.th}>Cidade</th>{r.setores.map((s) => <th key={s} style={S.thC}>{s}</th>)}<th style={S.thC}>Total</th><th style={S.thC}>RNs</th></tr></thead>
                      <tbody>
                        {r.cidSetor.map((c) => (
                          <tr key={c.cidade} style={S.tr}><td style={S.td}>{c.cidade}</td>{r.setores.map((s) => <td key={s} style={c.porS[s] ? S.tdC : S.tdZ}>{c.porS[s] || "·"}</td>)}
                            <td style={{ ...S.tdC, fontWeight: 700 }}>{c.total}</td><td style={{ ...S.tdC, color: c.rns > 2 ? "#fbbf24" : "#fff" }}>{c.rns}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ ...S.blocoTit, marginTop: 14 }}>Cidade × dia de visita <span style={S.media}>· nº de PDVs</span></div>
                  <div style={S.tableWrap}>
                    <table style={S.table}>
                      <thead><tr><th style={S.th}>Cidade</th>{r.DIAS_SD.map((x) => <th key={x} style={S.thC}>{x}</th>)}<th style={S.thC}>Total</th></tr></thead>
                      <tbody>
                        {r.cidSetor.map((c) => (
                          <tr key={c.cidade} style={S.tr}><td style={S.td}>{c.cidade}</td>{r.DIAS_SD.map((x) => <td key={x} style={c.porD[x] ? S.tdC : S.tdZ}>{c.porD[x] || 0}</td>)}<td style={{ ...S.tdC, fontWeight: 700 }}>{c.total}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {aba === "base" && (
                <>
                  <input style={{ ...S.select, width: 300, marginBottom: 10 }} placeholder="🔎 Filtrar por código, nome, cidade ou bairro" value={busca} onChange={(e) => setBusca(e.target.value)} />
                  <div style={{ ...S.tableWrap, maxHeight: 560, overflowY: "auto" }}>
                    <table style={S.table}>
                      <thead><tr><th style={S.th}>Cód</th><th style={S.th}>Nome fantasia</th><th style={S.th}>Cidade</th><th style={S.th}>Bairro</th><th style={S.th}>Categoria</th><th style={S.thC}>Setor</th><th style={S.thC}>Dia</th><th style={S.thC}>Volume</th><th style={S.thC}>Média/mês</th></tr></thead>
                      <tbody>
                        {baseFiltrada.slice(0, 600).map((l) => (
                          <tr key={l.cod_pdv} style={S.tr}><td style={S.td}>{l.cod_pdv}</td><td style={S.td}>{l.nome}</td><td style={S.td}>{l.cidade}</td><td style={S.td}>{l.bairro}</td><td style={S.td}>{l.categoria}</td>
                            <td style={S.tdC}>{l.setor}</td><td style={S.tdC}>{l.dia || "S/Dia"}</td><td style={S.tdC}>{fmtV(l.volume)}</td><td style={S.tdC}>{fmtV(l.media)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p style={S.hint}>{baseFiltrada.length > 600 ? `Mostrando 600 de ${fmtN(baseFiltrada.length)} — o Excel traz todos.` : `${fmtN(baseFiltrada.length)} PDVs.`}</p>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

const S = {
  card: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(125,186,61,0.25)", borderRadius: 14, marginBottom: 16, overflow: "hidden" },
  head: { width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", background: "transparent", border: "none", color: "#fff", padding: "14px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.95rem", fontWeight: 700, textAlign: "left" },
  linhaCtrl: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 },
  select: { background: "#13231a", color: "#fff", border: "1px solid rgba(125,186,61,0.3)", borderRadius: 8, padding: "8px 10px", fontSize: "0.84rem", fontFamily: "inherit" },
  lbl: { color: "rgba(255,255,255,0.55)", fontSize: "0.8rem" },
  mes: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.55)", borderRadius: 16, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.78rem" },
  mesOn: { background: "rgba(125,186,61,0.18)", border: "1px solid rgba(125,186,61,0.6)", color: VERDE, borderRadius: 16, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.78rem", fontWeight: 700 },
  hint: { color: "rgba(255,255,255,0.4)", fontSize: "0.76rem", margin: "4px 0 10px" },
  gerar: { background: "linear-gradient(135deg,#7DBA3D,#2E7D32)", color: "#0c1410", border: "none", borderRadius: 8, padding: "8px 18px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  excel: { background: "transparent", border: "1px solid rgba(125,186,61,0.5)", color: VERDE, borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 },
  kpis: { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 },
  kpiL: { color: "rgba(255,255,255,0.5)", fontSize: "0.72rem" },
  kpi: { display: "flex", flexDirection: "column", background: "rgba(125,186,61,0.08)", border: "1px solid rgba(125,186,61,0.25)", borderRadius: 10, padding: "8px 14px", color: "#fff", fontSize: "1.05rem", minWidth: 110 },
  abas: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 8 },
  aba: { background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.8rem" },
  abaOn: { background: "rgba(125,186,61,0.2)", border: "1px solid rgba(125,186,61,0.6)", color: VERDE, borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.8rem", fontWeight: 700 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12 },
  blocoTit: { color: "#fff", fontWeight: 700, fontSize: "0.86rem", padding: "8px 10px 4px" },
  tableWrap: { overflowX: "auto", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" },
  th: { padding: "7px 9px", color: "rgba(255,255,255,0.5)", textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap", position: "sticky", top: 0, background: "#0f1c15" },
  thC: { padding: "7px 9px", color: "rgba(255,255,255,0.5)", textAlign: "right", borderBottom: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap", position: "sticky", top: 0, background: "#0f1c15" },
  tr: { borderBottom: "1px solid rgba(255,255,255,0.05)" },
  trTot: { background: "rgba(125,186,61,0.10)" },
  td: { padding: "6px 9px", color: "rgba(255,255,255,0.85)", whiteSpace: "nowrap" },
  tdC: { padding: "6px 9px", color: "#fff", textAlign: "right", whiteSpace: "nowrap" },
  tdZ: { padding: "6px 9px", color: "rgba(255,255,255,0.22)", textAlign: "right", whiteSpace: "nowrap" },
  tdDest: { padding: "6px 9px", color: VERDE, fontWeight: 700, textAlign: "right", whiteSpace: "nowrap" },
  media: { color: "rgba(255,255,255,0.4)", fontSize: "0.72rem", fontWeight: 400 },
};
