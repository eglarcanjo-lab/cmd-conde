// SPO — KPI 8 · Aderência da Política Comercial, a partir do Planificador de Execução TTC (BI).
// REAL = PDVs Aderidos E Executados / Compradores RGB Coletável (base). Vale o fechamento de dezembro.
// Mostra: resumo por RN × meta (%), lista de ataque (aderido sem execução / quase aderido /
// fotos recusadas) cruzada com as tasks de TTC do relatório de Tasks, e o ranking de justificativas.
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx-js-style";
import api from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { BarraProgresso, styles } from "./shared";

const DIAS = ["TODOS", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];
const GRUPOS = [
  { id: "aderido",   icon: "🎯", label: "Aderido sem execução", desc: "Preço já está ok — falta só a foto de TTC (faixa, menu ou cardápio) validada. Prioridade máxima." },
  { id: "quase",     icon: "💲", label: "Quase aderido",        desc: "Entre 50% e 79% do volume RGB no TTC meta — ajustar o preço de 1 SKU pode virar aderido (precisa de 80%)." },
  { id: "recusadas", icon: "⚠️", label: "Fotos recusadas",      desc: "O RN fez a task mas não valeu (fraude, regra 60%, sem identificação de SKU ou outros) e o PDV segue sem execução." },
];
const STATUS_TASK = {
  OPEN:    { label: "aberta",   cor: "#f5c451" },
  VALID:   { label: "validada", cor: "#4ade80" },
  INVALID: { label: "inválida", cor: "#f87171" },
};
const n = (v) => Number(v) || 0;
const recusadas = (p) => n(p.fraude) + n(p.regra_60) + n(p.sem_sku) + n(p.outros);
const thS = { ...styles.th, fontSize: "0.72rem", padding: "8px 8px" };
const tdS = { ...styles.td, fontSize: "0.82rem", padding: "7px 8px" };

export default function PoliticaTtc({ spoMetaTotal }) {
  const { usuario } = useAuth();
  const isGestor = ["admin", "director", "gv1", "gv3"].includes(usuario?.perfil);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [grupo, setGrupo] = useState("aderido");
  const [rn, setRn] = useState("");
  const [dia, setDia] = useState("TODOS");
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(null); // cod_pdv com as tasks expandidas

  useEffect(() => {
    api.get("/api/spo/politica-comercial/pdvs")
      .then((r) => setDados(r.data))
      .catch(() => setErro("Não foi possível carregar o planificador."));
  }, []);

  const pdvs = dados?.pdvs || [];
  const meta = spoMetaTotal(8); // meta da operação em % (ex.: 28.8)

  // ── Resumo por RN (e operação) ─────────────────────────────────────────────
  const porSetor = useMemo(() => {
    const g = {};
    pdvs.forEach((p) => {
      const s = (g[p.setor] = g[p.setor] || { setor: p.setor, base: 0, ad: 0, ex: 0, ae: 0, adSemEx: 0, tot: 0, val: 0, just: 0, semVis: 0, rec: 0 });
      s.base++;
      if (p.aderido === "SIM") s.ad++;
      if (p.executado === "SIM") s.ex++;
      if (p.aderido_exec === "SIM") s.ae++;
      if (p.aderido === "SIM" && p.executado !== "SIM") s.adSemEx++;
      s.tot += n(p.totais); s.val += n(p.validadas); s.just += n(p.justificadas); s.semVis += n(p.sem_visita); s.rec += recusadas(p);
    });
    return Object.values(g).sort((a, b) => String(a.setor).localeCompare(String(b.setor)));
  }, [pdvs]);
  const op = useMemo(() => porSetor.reduce((o, s) => {
    Object.keys(o).forEach((k) => { if (k !== "setor") o[k] += s[k]; });
    return o;
  }, { setor: "OPERACAO", base: 0, ad: 0, ex: 0, ae: 0, adSemEx: 0, tot: 0, val: 0, just: 0, semVis: 0, rec: 0 }), [porSetor]);

  const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
  const metaPdvs = (base) => (meta != null ? Math.ceil((base * meta) / 100) : null);

  // ── Lista de ataque ────────────────────────────────────────────────────────
  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return pdvs.filter((p) => {
      if (rn && String(p.setor) !== rn) return false;
      if (dia !== "TODOS" && !String(p.dia_visita || "").toUpperCase().split("/").map((d) => d.trim()).includes(dia)) return false;
      if (q && !(String(p.cod_pdv).includes(q) || String(p.nome_pdv || "").toLowerCase().includes(q))) return false;
      if (grupo === "aderido") return p.aderido === "SIM" && p.executado !== "SIM";
      if (grupo === "quase") return p.aderido !== "SIM" && n(p.peso_aderido) >= 50;
      return recusadas(p) > 0 && p.executado !== "SIM";
    }).sort((a, b) => {
      const ab = (p) => (p.tasks_ttc || []).some((t) => t.status === "OPEN") ? 1 : 0;
      if (grupo === "aderido") return ab(b) - ab(a) || n(b.justificadas) - n(a.justificadas);
      if (grupo === "quase") return n(b.peso_aderido) - n(a.peso_aderido);
      return recusadas(b) - recusadas(a);
    });
  }, [pdvs, grupo, rn, dia, busca]);

  const contagem = useMemo(() => ({
    aderido: pdvs.filter((p) => (!rn || String(p.setor) === rn) && p.aderido === "SIM" && p.executado !== "SIM").length,
    quase: pdvs.filter((p) => (!rn || String(p.setor) === rn) && p.aderido !== "SIM" && n(p.peso_aderido) >= 50).length,
    recusadas: pdvs.filter((p) => (!rn || String(p.setor) === rn) && recusadas(p) > 0 && p.executado !== "SIM").length,
  }), [pdvs, rn]);

  function exportar() {
    const cab = ["RN", "Cód PDV", "PDV", "Dia visita", "% vol. aderido", "Aderido", "Executado", "Tasks L60d", "Validadas", "Justificadas", "Sem visita", "Recusadas", "Tasks TTC abertas (relatório de Tasks)"];
    const linhas = lista.map((p) => [Number(p.setor) || p.setor, Number(p.cod_pdv) || p.cod_pdv, p.nome_pdv, p.dia_visita, n(p.peso_aderido), p.aderido, p.executado,
      n(p.totais), n(p.validadas), n(p.justificadas), n(p.sem_visita), recusadas(p),
      (p.tasks_ttc || []).filter((t) => t.status === "OPEN").map((t) => t.descricao).join(" | ")]);
    const ws = XLSX.utils.aoa_to_sheet([cab, ...linhas]);
    cab.forEach((_, c) => { const ref = XLSX.utils.encode_cell({ r: 0, c }); if (ws[ref]) ws[ref].s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "2E7D32" } } }; });
    ws["!cols"] = [6, 9, 30, 10, 12, 9, 10, 10, 10, 12, 10, 10, 60].map((w) => ({ wch: w }));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Planificador TTC");
    XLSX.writeFile(wb, `PoliticaComercial_${grupo}${rn ? `_RN${rn}` : ""}${dia !== "TODOS" ? `_${dia}` : ""}.xlsx`);
  }

  if (erro) return <p style={styles.msg}>{erro}</p>;
  if (!dados) return <p style={styles.msg}>Carregando planificador…</p>;
  if (!pdvs.length) return (
    <p style={styles.msg}>Importe o <b>Planificador TTC (BI)</b> em Admin → Arquivos → SPO para calcular este KPI.</p>
  );

  const realOp = pct(op.ae, op.base);
  const faltaOp = metaPdvs(op.base) != null ? Math.max(0, metaPdvs(op.base) - op.ae) : null;
  const corOp = meta == null ? "#7DBA3D" : realOp >= meta ? "#4ade80" : realOp >= meta * 0.9 ? "#f5c451" : "#f87171";
  const btn = (ativo) => ({ background: ativo ? "rgba(125,186,61,0.18)" : "rgba(255,255,255,0.05)", border: `1px solid ${ativo ? "rgba(125,186,61,0.4)" : "rgba(255,255,255,0.08)"}`, color: ativo ? "#7DBA3D" : "rgba(255,255,255,0.55)", padding: "6px 12px", borderRadius: "8px", cursor: "pointer", fontSize: "0.8rem", fontFamily: "inherit", fontWeight: ativo ? 600 : 400 });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <p style={{ margin: 0, fontSize: "0.76rem", color: "rgba(255,255,255,0.4)" }}>
        Real = PDVs <b>Aderidos E Executados</b> ÷ Compradores RGB Coletável (últimos 60 dias). Vale o fechamento de <b>dezembro</b>; parcial = 90% da meta.
        {dados.atualizado_em && <> · Planificador atualizado em {dados.atualizado_em}</>}
      </p>

      {/* Funil da operação */}
      <div style={{ ...styles.gvCard, border: "1px solid rgba(125,186,61,0.3)" }}>
        <div style={styles.gvHeader}>
          <span style={{ fontWeight: 700 }}>{isGestor ? "🏭 Operação" : `Setor ${usuario?.cod ?? ""}`}</span>
          <span style={{ color: corOp, fontWeight: 800, fontSize: "1.3rem" }}>{realOp}%{meta != null && <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.8rem", fontWeight: 500 }}> / meta {meta}%</span>}</span>
        </div>
        <BarraProgresso pct={meta ? (realOp / meta) * 100 : realOp} cor={corOp} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "8px", marginTop: "6px" }}>
          {[
            ["Base (compradores RGB)", op.base, ""],
            ["Aderidos", op.ad, `${pct(op.ad, op.base)}%`],
            ["Executados", op.ex, `${pct(op.ex, op.base)}%`],
            ["Aderidos e executados", op.ae, `${realOp}%`],
            ["🎯 Aderidos sem execução", op.adSemEx, "só falta a foto"],
            ["Faltam p/ meta", faltaOp == null ? "—" : faltaOp, faltaOp == null ? "lance a meta (%) em Metas SPO" : `meta ${metaPdvs(op.base)} PDVs`],
          ].map(([l, v, s]) => (
            <div key={l} style={{ background: "rgba(255,255,255,0.03)", borderRadius: "8px", padding: "8px 10px" }}>
              <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.45)" }}>{l}</div>
              <div style={{ fontSize: "1.2rem", fontWeight: 800 }}>{v}</div>
              <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.35)" }}>{s}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Por RN + ranking de justificativas */}
      {isGestor && porSetor.length > 1 && (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead><tr>
              <th style={thS}>RN</th><th style={thS}>Base</th><th style={thS}>Aderidos</th><th style={thS}>Executados</th>
              <th style={thS}>Ader. e exec.</th><th style={thS}>Real</th><th style={thS}>Meta (PDVs)</th><th style={thS}>Faltam</th>
              <th style={thS}>🎯 Ader. s/ exec.</th><th style={thS}>Tasks L60d</th><th style={thS}>Justificadas</th><th style={thS}>Sem visita</th><th style={thS}>Recusadas</th>
            </tr></thead>
            <tbody>
              {porSetor.map((s) => {
                const r = pct(s.ae, s.base); const m = metaPdvs(s.base); const pj = pct(s.just, s.tot);
                return (
                  <tr key={s.setor} style={{ ...styles.tr, cursor: "pointer", background: rn === String(s.setor) ? "rgba(125,186,61,0.08)" : undefined }}
                      onClick={() => setRn(rn === String(s.setor) ? "" : String(s.setor))} title="Clique para filtrar a lista de ataque por este RN">
                    <td style={{ ...tdS, fontWeight: 700 }}>{s.setor}{String(s.setor) === "997" ? " · sem RN" : ""}</td>
                    <td style={tdS}>{s.base}</td><td style={tdS}>{s.ad}</td><td style={tdS}>{s.ex}</td>
                    <td style={{ ...tdS, fontWeight: 700 }}>{s.ae}</td>
                    <td style={{ ...tdS, fontWeight: 700, color: meta == null ? undefined : r >= meta ? "#4ade80" : "#f87171" }}>{r}%</td>
                    <td style={tdS}>{m ?? "—"}</td>
                    <td style={tdS}>{m == null ? "—" : Math.max(0, m - s.ae)}</td>
                    <td style={{ ...tdS, color: "#f5c451", fontWeight: 700 }}>{s.adSemEx}</td>
                    <td style={tdS}>{s.tot}</td>
                    <td style={{ ...tdS, color: pj >= 50 ? "#f87171" : undefined }}>{s.just} <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.72rem" }}>({pj}%)</span></td>
                    <td style={tdS}>{s.semVis}</td><td style={tdS}>{s.rec}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p style={{ margin: "6px 10px", fontSize: "0.7rem", color: "rgba(255,255,255,0.35)" }}>
            Justificadas = tasks de TTC que o RN justificou em vez de executar (últimos 60 dias). Clique num RN para filtrar a lista abaixo.
          </p>
        </div>
      )}

      {/* Lista de ataque */}
      <div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "8px" }}>
          {GRUPOS.map((g) => (
            <button key={g.id} style={btn(grupo === g.id)} onClick={() => setGrupo(g.id)}>{g.icon} {g.label} ({contagem[g.id]})</button>
          ))}
        </div>
        <p style={{ margin: "0 0 10px", fontSize: "0.74rem", color: "rgba(255,255,255,0.45)" }}>{GRUPOS.find((g) => g.id === grupo).desc}</p>
        <div style={styles.filtrosRow}>
          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
            {DIAS.map((d) => <button key={d} style={btn(dia === d)} onClick={() => setDia(d)}>{d === "TODOS" ? "Todos" : d}</button>)}
          </div>
          {isGestor && porSetor.length > 1 && (
            <select value={rn} onChange={(e) => setRn(e.target.value)} style={styles.inputFiltro}>
              <option value="">Todos os RNs</option>
              {porSetor.map((s) => <option key={s.setor} value={String(s.setor)}>{s.setor}</option>)}
            </select>
          )}
          <input placeholder="Buscar PDV…" value={busca} onChange={(e) => setBusca(e.target.value)} style={styles.inputFiltro} />
          <button style={btn(false)} onClick={exportar}>⬇️ Excel</button>
          <span style={styles.countLabel}>{lista.length} PDVs</span>
        </div>

        {lista.length === 0 ? <p style={{ ...styles.msg, padding: "20px" }}>Nenhum PDV neste filtro.</p> : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead><tr>
                <th style={thS}>RN</th><th style={{ ...thS, textAlign: "left" }}>PDV</th><th style={thS}>Dia</th><th style={thS}>% vol. aderido</th>
                {grupo === "quase" && <th style={thS}>Executado</th>}
                <th style={thS}>Tasks L60d</th><th style={thS}>Validadas</th><th style={thS}>Justif.</th><th style={thS}>Sem visita</th><th style={thS}>Recusadas</th>
                <th style={{ ...thS, textAlign: "left" }}>Task de TTC no relatório de Tasks</th>
              </tr></thead>
              <tbody>
                {lista.map((p) => {
                  const tks = p.tasks_ttc || [];
                  const abertas = tks.filter((t) => t.status === "OPEN");
                  const exp = aberto === p.cod_pdv;
                  return (
                    <tr key={p.cod_pdv} style={{ ...styles.tr, verticalAlign: "top" }}>
                      <td style={tdS}>{p.setor}</td>
                      <td style={{ ...tdS, textAlign: "left" }}><span style={styles.codBadge}>{p.cod_pdv}</span> {p.nome_pdv}</td>
                      <td style={tdS}>{p.dia_visita || "—"}</td>
                      <td style={{ ...tdS, color: n(p.peso_aderido) >= 80 ? "#4ade80" : n(p.peso_aderido) >= 50 ? "#f5c451" : "#f87171" }}>{n(p.peso_aderido)}%</td>
                      {grupo === "quase" && <td style={{ ...tdS, color: p.executado === "SIM" ? "#4ade80" : "rgba(255,255,255,0.4)" }}>{p.executado === "SIM" ? "Sim" : "Não"}</td>}
                      <td style={tdS}>{n(p.totais)}</td><td style={tdS}>{n(p.validadas)}</td>
                      <td style={{ ...tdS, color: n(p.justificadas) > 0 ? "#f87171" : undefined }}>{n(p.justificadas)}</td>
                      <td style={tdS}>{n(p.sem_visita)}</td>
                      <td style={tdS} title={`Fraude ${n(p.fraude)} · Regra 60% ${n(p.regra_60)} · Sem identificação SKU ${n(p.sem_sku)} · Outros ${n(p.outros)}`}>{recusadas(p)}</td>
                      <td style={{ ...tdS, textAlign: "left", minWidth: "260px" }}>
                        {tks.length === 0 ? (
                          <span style={{ color: "rgba(255,255,255,0.35)" }}>Nenhuma task de TTC no relatório de Tasks deste mês</span>
                        ) : (
                          <>
                            {(exp ? tks : abertas.length ? abertas : tks.slice(0, 1)).map((t, i) => {
                              const st = STATUS_TASK[t.status] || { label: t.status.toLowerCase(), cor: "rgba(255,255,255,0.5)" };
                              return (
                                <div key={i} style={{ marginBottom: "4px" }}>
                                  <span style={{ ...styles.statusTag, background: "rgba(255,255,255,0.06)", color: st.cor }}>{st.label}</span>{" "}
                                  <span style={{ color: "rgba(255,255,255,0.8)" }}>{t.descricao || t.id_task}</span>
                                  <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.72rem" }}>
                                    {t.data_visita ? ` · visita ${t.data_visita}` : ""}{t.justificativa ? ` · justificativa: ${t.justificativa}` : ""}
                                  </span>
                                </div>
                              );
                            })}
                            {tks.length > (abertas.length || 1) && (
                              <button onClick={() => setAberto(exp ? null : p.cod_pdv)} style={{ background: "none", border: "none", color: "#7DBA3D", cursor: "pointer", fontSize: "0.72rem", padding: 0, fontFamily: "inherit" }}>
                                {exp ? "ver menos" : `ver todas (${tks.length})`}
                              </button>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
