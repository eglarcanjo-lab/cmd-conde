// Admin › Metas › Distribuição pelo tri: reparte a meta da operação entre os RNs pelo
// peso da média dos 3 últimos meses fechados da CARTEIRA ATUAL de cada um.
// Meta sugerida = meta da operação × peso (arredondada; a sobra do arredondamento vai
// p/ quem tem a maior fração, então a soma bate com a operação). Dá p/ ajustar à mão
// antes de gravar. Gravar = upsert nas metas da RV do mês (Cerveja, NAB, Match, Mktp).
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import api from "../../services/api";

// casas decimais da meta gravada por categoria (Match é pequeno → 2 casas)
const CASAS = { cerveja: 0, nab: 0, match: 2, mktp: 0 };

function proximoMes() {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
const nomeMes = (m) => {
  const [a, mm] = String(m || "").split("-");
  const n = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][Number(mm) - 1];
  return n ? `${n}/${a.slice(2)}` : m;
};
const fmt = (v, casas = 0) => (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const parseNum = (s) => {
  const t = String(s ?? "").trim();
  if (!t) return NaN;
  if (t.includes(",")) return parseFloat(t.replace(/\./g, "").replace(",", "."));
  return parseFloat(t);
};

// rateio com arredondamento que fecha a soma (maior resto)
function ratear(total, pesos, casas) {
  const f = 10 ** casas;
  const alvo = Math.round(total * f);
  const brutos = pesos.map((p) => p * alvo);
  const base = brutos.map(Math.floor);
  let sobra = alvo - base.reduce((a, b) => a + b, 0);
  const ordem = brutos.map((b, i) => [b - Math.floor(b), i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; k < ordem.length && sobra > 0; k++, sobra--) base[ordem[k][1]] += 1;
  return base.map((v) => v / f);
}

export default function DistribuicaoTri() {
  const [mes, setMes] = useState(proximoMes());
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [cat, setCat] = useState("cerveja");
  const [metaOp, setMetaOp] = useState({});    // key → texto digitado
  const [ajuste, setAjuste] = useState({});    // `${key}|${setor}` → texto digitado
  const [gravando, setGravando] = useState(false);

  useEffect(() => { carregar(); }, [mes]); // eslint-disable-line react-hooks/exhaustive-deps

  async function carregar() {
    if (!/^\d{4}-\d{2}$/.test(mes)) return;
    setCarregando(true); setErro(""); setOk("");
    try {
      const r = await api.get("/api/admin/metas/distribuicao", { params: { mes } });
      setDados(r.data);
      const mo = {};
      r.data.categorias.forEach((c) => { const v = r.data.meta_operacao?.[c.key]; mo[c.key] = v ? String(v).replace(".", ",") : ""; });
      setMetaOp(mo); setAjuste({});
    } catch (e) {
      setErro(e.response?.data?.error || "Erro ao calcular a distribuição.");
      setDados(null);
    } finally { setCarregando(false); }
  }

  // por categoria: linhas com média, peso, sugerida, final
  const calc = useMemo(() => {
    if (!dados) return {};
    const out = {};
    dados.categorias.forEach((c) => {
      const linhas = dados.setores.filter((s) => !(c.so_off && !["101", "102", "103"].includes(s.setor)));
      const tot = linhas.reduce((a, s) => a + (s.tri[c.key] || 0), 0);
      const pesos = linhas.map((s) => (tot > 0 ? (s.tri[c.key] || 0) / tot : 0));
      const op = parseNum(metaOp[c.key]);
      const sug = Number.isFinite(op) ? ratear(op, pesos, CASAS[c.key]) : pesos.map(() => NaN);
      const rows = linhas.map((s, i) => {
        const aj = ajuste[`${c.key}|${s.setor}`];
        const fin = aj !== undefined && aj !== "" ? parseNum(aj) : sug[i];
        return { ...s, media: s.tri[c.key] || 0, peso: pesos[i], sugerida: sug[i], final: fin, ajustada: aj !== undefined && aj !== "" };
      });
      const somaFinal = rows.reduce((a, r) => a + (Number.isFinite(r.final) ? r.final : 0), 0);
      out[c.key] = { cat: c, rows, tot, op, somaFinal };
    });
    return out;
  }, [dados, metaOp, ajuste]);

  const atual = calc[cat];

  function exportar() {
    if (!dados) return;
    const wb = XLSX.utils.book_new();
    const linhas = [];
    Object.values(calc).forEach(({ cat: c, rows }) => rows.forEach((r) => linhas.push({
      setor: r.setor, rn: r.nome, categoria: c.categoria, mes_referencia: mes,
      [`media_tri (${c.unidade})`]: r.media, peso: Math.round(r.peso * 10000) / 10000,
      meta_sugerida: r.sugerida, meta_aplicada: r.final, ajustada: r.ajustada ? "sim" : "",
    })));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhas), "Distribuição");
    XLSX.writeFile(wb, `distribuicao_metas_${mes}.xlsx`);
  }

  async function gravar() {
    setErro(""); setOk("");
    const linhas = [];
    for (const { cat: c, rows, op } of Object.values(calc)) {
      if (!Number.isFinite(op)) continue; // categoria sem meta da operação → não grava
      for (const r of rows) {
        if (!Number.isFinite(r.final)) { setErro(`${c.label}: meta inválida no setor ${r.setor}.`); return; }
        linhas.push({ setor: r.setor, categoria: c.categoria, meta: r.final, peso: Math.round(r.peso * 10000) / 10000, volume_tri: r.media });
      }
    }
    if (!linhas.length) { setErro("Preencha a meta da operação de pelo menos uma categoria."); return; }
    const cats = [...new Set(linhas.map((l) => l.categoria))].join(", ");
    if (!window.confirm(`Gravar ${linhas.length} metas de ${nomeMes(mes)} (${cats})?\nSubstitui as metas já lançadas desses setores/categorias no mês.`)) return;
    setGravando(true);
    try {
      const r = await api.post("/api/admin/metas/distribuicao", { mes, linhas });
      setOk(`✅ ${r.data.gravadas} metas gravadas em ${nomeMes(mes)}. Recalcule a RV para refletir.`);
      await carregar();
    } catch (e) {
      setErro(e.response?.data?.error || "Erro ao gravar.");
    } finally { setGravando(false); }
  }

  return (
    <div>
      <div style={st.toolbar}>
        <label style={st.lbl}>Mês da meta</label>
        <input type="month" style={st.input} value={mes} onChange={(e) => setMes(e.target.value)} />
        {dados && (
          <span style={st.info}>
            Base: média de {dados.meses.map(nomeMes).join(" + ")} ÷ 3 · carteira atual
          </span>
        )}
        <div style={{ flex: 1 }} />
        <button style={st.btn2} onClick={exportar} disabled={!dados}>⬇ Excel</button>
        <button style={st.btn1} onClick={gravar} disabled={!dados || gravando}>{gravando ? "Gravando..." : "Gravar metas do mês"}</button>
      </div>

      {erro && <p style={st.erro}>{erro}</p>}
      {ok && <p style={st.ok}>{ok}</p>}
      {carregando && <p style={st.msg}>Calculando...</p>}

      {dados && !carregando && (
        <>
          {/* Meta da operação por categoria */}
          <div style={st.cards}>
            {dados.categorias.map((c) => {
              const k = calc[c.key];
              const dif = k && Number.isFinite(k.op) ? k.somaFinal - k.op : 0;
              return (
                <div key={c.key} style={{ ...st.card, ...(cat === c.key ? st.cardOn : {}) }} onClick={() => setCat(c.key)}>
                  <div style={st.cardTit}>{c.label} <span style={st.un}>({c.unidade})</span></div>
                  <input
                    style={st.inputMeta}
                    value={metaOp[c.key] ?? ""}
                    placeholder="meta da operação"
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setMetaOp((p) => ({ ...p, [c.key]: e.target.value }))}
                  />
                  <div style={st.cardSub}>
                    tri: {fmt(k?.tot, c.key === "match" ? 2 : 0)} {c.unidade}/mês
                    {Math.abs(dif) > 0.005 && <span style={{ color: "#fbbf24" }}> · ajustes {dif > 0 ? "+" : ""}{fmt(dif, CASAS[c.key])}</span>}
                  </div>
                </div>
              );
            })}
          </div>
          <p style={st.nota}>
            Meta sugerida a partir das metas de {nomeMes(dados.meta_operacao_mes)}. Match só no OFF (101–103).
            {dados.mktp_fonte !== "carteira" && ` Marketplace: ${dados.mktp_meses_setor.map(nomeMes).join(", ")} sem R$ por cliente → usa o faturamento do setor nesses meses.`}
          </p>

          {atual && (
            <div style={st.tableWrap}>
              <table style={st.table}>
                <thead>
                  <tr>
                    {["Setor", "RN", "PDVs", `Média tri (${atual.cat.unidade}/mês)`, "Peso", "Meta sugerida", "Meta final", "Meta gravada hoje"].map((h) => <th key={h} style={st.th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {atual.rows.map((r) => (
                    <tr key={r.setor} style={st.tr}>
                      <td style={st.td}><span style={st.badge}>{r.setor}</span></td>
                      <td style={st.td}>{r.nome || "—"}</td>
                      <td style={st.tdN}>{r.pdvs}</td>
                      <td style={st.tdN}>{fmt(r.media, cat === "match" ? 2 : (cat === "mktp" ? 0 : 1))}</td>
                      <td style={st.tdN}>{(r.peso * 100).toFixed(1).replace(".", ",")}%</td>
                      <td style={st.tdN}>{Number.isFinite(r.sugerida) ? fmt(r.sugerida, CASAS[cat]) : "—"}</td>
                      <td style={st.tdN}>
                        <input
                          style={{ ...st.inputCel, ...(r.ajustada ? st.inputAj : {}) }}
                          value={ajuste[`${cat}|${r.setor}`] ?? ""}
                          placeholder={Number.isFinite(r.sugerida) ? fmt(r.sugerida, CASAS[cat]) : ""}
                          onChange={(e) => setAjuste((p) => ({ ...p, [`${cat}|${r.setor}`]: e.target.value }))}
                        />
                      </td>
                      <td style={st.tdN}>{r.metas_atuais?.[atual.cat.categoria] !== undefined ? fmt(r.metas_atuais[atual.cat.categoria], CASAS[cat]) : "—"}</td>
                    </tr>
                  ))}
                  <tr style={st.trTot}>
                    <td style={st.td} colSpan={2}><b>Operação</b></td>
                    <td style={st.tdN}><b>{atual.rows.reduce((a, r) => a + r.pdvs, 0)}</b></td>
                    <td style={st.tdN}><b>{fmt(atual.tot, cat === "match" ? 2 : (cat === "mktp" ? 0 : 1))}</b></td>
                    <td style={st.tdN}><b>100%</b></td>
                    <td style={st.tdN}><b>{Number.isFinite(atual.op) ? fmt(atual.op, CASAS[cat]) : "—"}</b></td>
                    <td style={st.tdN}><b>{fmt(atual.somaFinal, CASAS[cat])}</b></td>
                    <td style={st.tdN}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          <p style={st.nota}>
            Peso = média mensal do RN ÷ média da operação, com o que os PDVs da carteira de hoje compraram nos 3 meses
            (PDV que mudou de setor leva o histórico dele). Digite em "Meta final" só onde quiser mudar; a soma aparece no total.
            Pontos Force não entra aqui (continua 100.000).
          </p>
        </>
      )}
    </div>
  );
}

const st = {
  toolbar: { display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", marginBottom: "16px" },
  lbl: { color: "rgba(255,255,255,0.5)", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.06em" },
  info: { color: "rgba(255,255,255,0.55)", fontSize: "0.85rem" },
  input: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff", padding: "8px 12px", fontSize: "0.88rem", fontFamily: "inherit" },
  btn1: { background: "linear-gradient(135deg, #7DBA3D, #2E7D32)", color: "#0c1410", border: "none", borderRadius: "10px", padding: "10px 18px", fontWeight: 700, cursor: "pointer", fontSize: "0.88rem", fontFamily: "inherit" },
  btn2: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.75)", borderRadius: "10px", padding: "10px 16px", cursor: "pointer", fontSize: "0.88rem", fontFamily: "inherit" },
  cards: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px", marginBottom: "8px" },
  card: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "12px", cursor: "pointer" },
  cardOn: { border: "1px solid #7DBA3D", background: "rgba(125,186,61,0.08)" },
  cardTit: { fontWeight: 700, marginBottom: "8px" },
  un: { color: "rgba(255,255,255,0.45)", fontWeight: 400, fontSize: "0.8rem" },
  inputMeta: { width: "100%", boxSizing: "border-box", background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "#fff", padding: "8px 10px", fontSize: "1rem", fontFamily: "inherit" },
  cardSub: { color: "rgba(255,255,255,0.5)", fontSize: "0.78rem", marginTop: "6px" },
  nota: { color: "rgba(255,255,255,0.45)", fontSize: "0.8rem", margin: "8px 0 14px" },
  tableWrap: { overflowX: "auto", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)", fontSize: "0.72rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", padding: "10px 12px", textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap" },
  tr: { borderBottom: "1px solid rgba(255,255,255,0.05)" },
  trTot: { background: "rgba(125,186,61,0.06)" },
  td: { padding: "9px 12px", color: "rgba(255,255,255,0.85)", fontSize: "0.86rem" },
  tdN: { padding: "9px 12px", color: "rgba(255,255,255,0.85)", fontSize: "0.86rem", textAlign: "right", whiteSpace: "nowrap" },
  badge: { background: "rgba(125,186,61,0.12)", color: "#7DBA3D", padding: "2px 8px", borderRadius: "6px", fontSize: "0.8rem", fontWeight: 700 },
  inputCel: { width: "100px", textAlign: "right", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: "#fff", padding: "5px 8px", fontSize: "0.86rem", fontFamily: "inherit" },
  inputAj: { border: "1px solid #fbbf24", background: "rgba(251,191,36,0.1)" },
  msg: { color: "rgba(255,255,255,0.4)", textAlign: "center", padding: "30px" },
  erro: { color: "#f87171", fontSize: "0.85rem" },
  ok: { color: "#4ade80", fontSize: "0.85rem" },
};
