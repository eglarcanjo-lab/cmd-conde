// Aba "Incentivos" (menu) — incentivos dos RNs: LIGA CMD (trimestral, pódio) e Bateu, Levou
// dos Zeros (mensal, R$ por meta). Todos veem todos os RNs (competição) e um box destaca
// onde o RN logado está. Admin lança as metas aqui mesmo (por mês × setor × KPI).
// Dado: GET /api/incentivos-rn[/:id?mes=] · PUT /api/incentivos-rn/:id/metas.
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { useAbaUrl } from "../../utils/abaUrl";
import { useContarAba } from "../../utils/uso";

const VERDE = "#7DBA3D", OURO = "#f5c451", VERM = "#f87171", OK = "#4ade80";
const MES_ROT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const rotMes = (m) => (m === "tri" ? "Trimestre" : `${MES_ROT[Number(String(m).slice(5, 7)) - 1]}/${String(m).slice(2, 4)}`);
const fmt = (v, d = 0) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: d }));
const SETORES_PADRAO = ["101", "103", "104", "105", "106", "107", "108", "109", "110", "111"];
const MEDALHA = ["🥇", "🥈", "🥉", "4º", "5º"];

// Célula de um KPI: real / meta, % e o sinal (bateu ✅ · tendência bate 📈 · não bate ❌)
function CelKpi({ k, unidade }) {
  if (!k || k.meta == null) return <td style={S.td}><span style={{ color: "rgba(255,255,255,0.25)" }}>sem meta</span></td>;
  const sinal = k.bateu ? "✅" : k.bateTend ? "📈" : "❌";
  const cor = k.bateu ? OK : k.bateTend ? OURO : VERM;
  return (
    <td style={S.td} title={`Meta ${fmt(k.meta, 2)} ${unidade} · Real ${fmt(k.real, 2)} · Tendência ${fmt(k.tend, 2)} (${fmt(k.atingTend, 1)}%)`}>
      <div style={{ fontWeight: 700, color: cor, whiteSpace: "nowrap" }}>{sinal} {fmt(k.real, 1)} <span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 400 }}>/ {fmt(k.meta, 1)}</span></div>
      <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.45)", whiteSpace: "nowrap" }}>{fmt(k.ating, 1)}% · tend {fmt(k.atingTend, 0)}%</div>
    </td>
  );
}

function EditorMetas({ inc, mes, metas, setores, onFechar, onSalvo }) {
  const [m, setM] = useState(mes === "tri" ? inc.meses[0] : mes);
  const ini = (mm) => Object.fromEntries(setores.map((s) => [s, Object.fromEntries(inc.kpis.map((k) => [k.key, metas?.[mm]?.[s]?.[k.key] ?? ""]))]));
  const [val, setVal] = useState(() => ini(m));
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { setVal(ini(m)); }, [m]); // eslint-disable-line react-hooks/exhaustive-deps
  async function salvar() {
    setSalvando(true);
    try { await api.put(`/api/incentivos-rn/${inc.id}/metas`, { mes: m, metas: val }); onSalvo(); }
    catch (e) { alert("Erro ao salvar: " + (e?.response?.data?.error || e?.message || "falha")); }
    finally { setSalvando(false); }
  }
  const inp = { width: 72, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, color: "#fff", padding: "4px 6px", fontFamily: "inherit", fontSize: "0.8rem", textAlign: "right" };
  return (
    <div style={S.modalFundo} onClick={onFechar}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
          <b>🎯 Metas · {inc.titulo}</b>
          <button onClick={onFechar} style={{ marginLeft: "auto", background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: "1rem" }}>✕</button>
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {inc.meses.map((mm) => <button key={mm} onClick={() => setM(mm)} style={S.chip(m === mm)}>{rotMes(mm)}</button>)}
        </div>
        <p style={{ margin: "0 0 8px", fontSize: "0.72rem", color: "rgba(255,255,255,0.5)" }}>Em branco = sem meta naquele KPI (o RN não é avaliado nele). Salvar substitui as metas do mês.</p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontSize: "0.8rem", width: "100%" }}>
            <thead><tr><th style={S.th}>Setor</th>{inc.kpis.map((k) => <th key={k.key} style={S.th}>{k.label}<div style={{ fontWeight: 400, opacity: 0.6 }}>{k.unidade}</div></th>)}</tr></thead>
            <tbody>
              {setores.map((s) => (
                <tr key={s} style={S.tr}>
                  <td style={{ ...S.td, fontWeight: 700 }}>{s}</td>
                  {inc.kpis.map((k) => (
                    <td key={k.key} style={S.td}>
                      <input inputMode="decimal" style={inp} value={val[s]?.[k.key] ?? ""}
                        onChange={(e) => setVal((o) => ({ ...o, [s]: { ...o[s], [k.key]: e.target.value } }))} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button onClick={salvar} disabled={salvando} style={S.btnSalvar}>{salvando ? "Salvando…" : `Salvar metas de ${rotMes(m)}`}</button>
      </div>
    </div>
  );
}

function Liga({ d, meu }) {
  const inc = d.incentivo;
  const eu = d.linhas.find((l) => l.setor === meu);
  const lider = (pos) => d.linhas.find((l) => l.posicaoTend === pos);
  return (
    <>
      {/* Pódio — quem está levando cada prêmio pela TENDÊNCIA (só elegíveis ≥ min pts) */}
      <div style={S.podio}>
        {inc.premios.map((p, i) => {
          const dono = d.linhas.find((l) => l.premioTend === p);
          return (
            <div key={p} style={{ ...S.premio, ...(i === 0 ? { borderColor: OURO } : {}) }}>
              <div style={{ fontSize: "1.3rem" }}>{MEDALHA[i]}</div>
              <div style={{ fontWeight: 700, fontSize: "0.86rem" }}>{p}</div>
              <div style={{ fontSize: "0.74rem", color: dono ? VERDE : "rgba(255,255,255,0.35)", marginTop: 2 }}>
                {dono ? `Setor ${dono.setor}${dono.setor === meu ? " · você!" : ""}` : "ninguém elegível ainda"}
              </div>
            </div>
          );
        })}
      </div>

      {eu && (
        <div style={S.meuBox}>
          <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.55)" }}>📍 Sua posição na Liga · setor {eu.setor}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap", marginTop: 4 }}>
            <span style={{ fontSize: "1.8rem", fontWeight: 800, color: VERDE }}>{eu.posicaoTend}º</span>
            <span style={{ fontWeight: 700 }}>{eu.pontosTend} pts na tendência <span style={{ color: "rgba(255,255,255,0.45)", fontWeight: 400 }}>· {eu.pontos} pts batidos hoje</span></span>
            <span style={{ color: eu.elegivelTend ? OK : VERM, fontWeight: 700 }}>
              {eu.elegivelTend ? (eu.premioTend ? `🏆 levando: ${eu.premioTend}` : "elegível, fora do top 5") : `faltam ${inc.minPts - eu.pontosTend} pts p/ ficar elegível (${inc.minPts})`}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            {inc.kpis.map((k, i) => {
              const c = eu.kpis[i];
              const st = c.meta == null ? ["sem meta", "rgba(255,255,255,0.3)"] : c.bateu ? ["batido ✅", OK] : c.bateTend ? ["tendência bate 📈", OURO] : [`falta ${fmt(Math.max(0, c.meta - c.real), 1)} ${k.unidade}`, VERM];
              return <span key={k.key} style={{ ...S.pill, borderColor: st[1], color: st[1] }}>{k.label} ({k.pts}): {st[0]}</span>;
            })}
          </div>
          {lider(1) && lider(1).setor !== eu.setor && <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.45)", marginTop: 6 }}>1º hoje: setor {lider(1).setor} com {lider(1).pontosTend} pts na tendência.</div>}
        </div>
      )}

      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>#</th><th style={S.th}>Setor</th>
              {inc.kpis.map((k) => <th key={k.key} style={S.th}>{k.label}<div style={{ fontWeight: 400, opacity: 0.6 }}>{k.pts} pts · {k.unidade}</div></th>)}
              <th style={S.th}>Pts hoje</th><th style={S.th}>Pts tendência</th><th style={S.th}>Ating. médio</th><th style={S.th}>Prêmio (tend.)</th>
            </tr>
          </thead>
          <tbody>
            {d.linhas.map((l) => (
              <tr key={l.setor} style={{ ...S.tr, ...(l.setor === meu ? { background: "rgba(125,186,61,0.10)" } : {}) }}>
                <td style={{ ...S.td, fontWeight: 800 }}>{l.posicaoTend}º</td>
                <td style={{ ...S.td, fontWeight: 700 }}>{l.setor}{l.setor === meu ? " · você" : ""}</td>
                {inc.kpis.map((k, i) => <CelKpi key={k.key} k={l.kpis[i]} unidade={k.unidade} />)}
                <td style={{ ...S.td, fontWeight: 700 }}>{l.pontos}</td>
                <td style={{ ...S.td, fontWeight: 800, color: l.elegivelTend ? OK : "rgba(255,255,255,0.8)" }}>{l.pontosTend}</td>
                <td style={S.td}>{fmt(l.atingMedioTend, 1)}%</td>
                <td style={{ ...S.td, color: l.premioTend ? OURO : "rgba(255,255,255,0.3)", fontWeight: 700 }}>{l.premioTend || (l.elegivelTend ? "—" : `< ${inc.minPts} pts`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={S.nota}>
        Regras: cada KPI é <b>tudo ou nada</b> (bateu a meta = pontos cheios). Precisa de <b>{inc.minPts} pts</b> para ser elegível.
        Pódio por pontos; empate → maior % médio de atingimento. ✅ batido · 📈 tendência de bater (ritmo de dias úteis) · ❌ não bate no ritmo atual.
        Trimestre: volume soma os meses; distribuição e cobertura usam a média mensal.
      </p>
    </>
  );
}

function Zeros({ d, meu }) {
  const inc = d.incentivo;
  const eu = d.linhas.find((l) => l.setor === meu);
  return (
    <>
      {eu && (
        <div style={S.meuBox}>
          <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.55)" }}>📍 Você · setor {eu.setor}</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 800, color: VERDE, marginTop: 4 }}>
            R$ {fmt(eu.valorTend)} <span style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.55)", fontWeight: 500 }}>na tendência · R$ {fmt(eu.valor)} garantidos</span>
          </div>
        </div>
      )}
      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Setor</th>
              {inc.kpis.map((k) => <th key={k.key} style={S.th}>{k.label}<div style={{ fontWeight: 400, opacity: 0.6 }}>{k.unidade}</div></th>)}
              <th style={S.th}>Garantido</th><th style={S.th}>Tendência</th>
            </tr>
          </thead>
          <tbody>
            {d.linhas.map((l) => (
              <tr key={l.setor} style={{ ...S.tr, ...(l.setor === meu ? { background: "rgba(125,186,61,0.10)" } : {}) }}>
                <td style={{ ...S.td, fontWeight: 700 }}>{l.setor}{l.setor === meu ? " · você" : ""}</td>
                {inc.kpis.map((k, i) => <CelKpi key={k.key} k={l.kpis[i]} unidade={k.unidade} />)}
                <td style={{ ...S.td, fontWeight: 700, color: l.valor ? OK : "rgba(255,255,255,0.5)" }}>R$ {fmt(l.valor)}</td>
                <td style={{ ...S.td, fontWeight: 800, color: l.valorTend ? OURO : "rgba(255,255,255,0.5)" }}>R$ {fmt(l.valorTend)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={S.nota}>Cada meta batida no mês vale <b>R$ {fmt(inc.valorMeta)}</b>. Segmentado (AS) é avaliado por volume; Rota por cobertura (PDVs que compraram).</p>
    </>
  );
}

export default function IncentivosRn() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const isAdmin = usuario?.perfil === "admin";
  const [lista, setLista] = useState([]);
  const [incId, setIncId] = useAbaUrl("inc", "");
  const [mes, setMes] = useAbaUrl("mes", "");
  useContarAba("/incentivos-rn", incId || "lista");
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [editar, setEditar] = useState(false);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => { api.get("/api/incentivos-rn").then((r) => setLista(r.data || [])).catch(() => setLista([])); }, []);
  useEffect(() => {
    if (!incId) { setD(null); return; }
    setD(null); setErro("");
    api.get(`/api/incentivos-rn/${incId}`, { params: mes ? { mes } : {}, timeout: 30000 })
      .then((r) => setD(r.data))
      .catch((e) => setErro(e?.response?.data?.error || "Erro ao carregar o incentivo."));
  }, [incId, mes, recarga]);

  const meu = String(usuario?.cod ?? "");
  const setores = d ? [...new Set([...SETORES_PADRAO, ...d.linhas.map((l) => l.setor)])].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })) : SETORES_PADRAO;

  return (
    <div style={S.root}>
      <div style={S.header}>
        <button style={S.back} onClick={() => (incId ? setIncId("") : navigate("/"))}>← {incId ? "Incentivos" : "Voltar"}</button>
        <h1 style={S.h1}>🏆 Incentivos</h1>
      </div>
      <div style={S.content}>
        {!incId ? (
          <div style={S.cards}>
            {lista.map((i) => (
              <button key={i.id} style={S.card} onClick={() => { setMes(""); setIncId(i.id); }}>
                <div style={{ fontSize: "1.6rem" }}>{i.id === "liga" ? "🏆" : "💰"}</div>
                <div style={{ fontWeight: 800, fontSize: "1.1rem", color: VERDE }}>{i.titulo}</div>
                <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.55)" }}>{i.subtitulo}</div>
              </button>
            ))}
            {!lista.length && <p style={S.nota}>Carregando…</p>}
          </div>
        ) : erro ? <p style={S.nota}>{erro}</p> : !d ? <p style={S.nota}>Carregando…</p> : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: "1.25rem", color: VERDE }}>{d.incentivo.titulo}</div>
                <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)" }}>
                  {d.incentivo.subtitulo}{d.diasUteis ? ` · 📅 ${d.diasUteis.feitos} de ${d.diasUteis.total} dias úteis` : ""}
                </div>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[...d.incentivo.meses, ...(d.incentivo.id === "liga" ? ["tri"] : [])].map((m) => (
                  <button key={m} onClick={() => setMes(m)} style={S.chip(d.mes === m)}>{rotMes(m)}</button>
                ))}
                {isAdmin && <button onClick={() => setEditar(true)} style={{ ...S.chip(false), borderColor: OURO, color: OURO }}>🎯 Metas</button>}
              </div>
            </div>
            {!d.linhas.length ? <p style={S.nota}>Sem metas lançadas para {rotMes(d.mes)}.{isAdmin ? " Use 🎯 Metas." : ""}</p>
              : d.incentivo.id === "liga" ? <Liga d={d} meu={meu} /> : <Zeros d={d} meu={meu} />}
            {editar && <EditorMetas inc={d.incentivo} mes={d.mes} metas={d.metas} setores={setores}
              onFechar={() => setEditar(false)} onSalvo={() => { setEditar(false); setRecarga((x) => x + 1); }} />}
          </>
        )}
      </div>
    </div>
  );
}

const S = {
  root: { minHeight: "100vh", background: "#0c1410", color: "#fff", fontFamily: "'Poppins', 'Segoe UI', system-ui, sans-serif" },
  header: { display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)" },
  back: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", padding: "7px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" },
  h1: { margin: 0, fontSize: "1.25rem" },
  content: { padding: "16px 20px", maxWidth: 1400, margin: "0 auto" },
  cards: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 },
  card: { textAlign: "left", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(125,186,61,0.3)", borderRadius: 14, padding: 18, cursor: "pointer", color: "#fff", fontFamily: "inherit", display: "flex", flexDirection: "column", gap: 6 },
  chip: (on) => ({ fontSize: "0.8rem", fontFamily: "inherit", color: on ? "#0c1410" : "rgba(255,255,255,0.6)", background: on ? VERDE : "transparent", border: `1px solid ${on ? VERDE : "rgba(255,255,255,0.15)"}`, borderRadius: 20, padding: "5px 13px", cursor: "pointer", fontWeight: on ? 700 : 500 }),
  podio: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 12 },
  premio: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "10px 12px", textAlign: "center" },
  meuBox: { background: "rgba(125,186,61,0.08)", border: `1px solid ${VERDE}`, borderRadius: 12, padding: "12px 14px", marginBottom: 12 },
  pill: { fontSize: "0.72rem", border: "1px solid", borderRadius: 20, padding: "3px 10px" },
  tableWrap: { overflowX: "auto", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10 },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.55)", fontSize: "0.72rem", fontWeight: 600, padding: "8px 8px", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap" },
  tr: { borderBottom: "1px solid rgba(255,255,255,0.05)" },
  td: { padding: "7px 8px", fontSize: "0.82rem", textAlign: "center", color: "rgba(255,255,255,0.85)" },
  nota: { fontSize: "0.74rem", color: "rgba(255,255,255,0.45)", marginTop: 10, lineHeight: 1.5 },
  modalFundo: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 },
  modal: { background: "#13231a", border: "1px solid rgba(125,186,61,0.3)", borderRadius: 12, padding: 16, maxWidth: 760, width: "100%", maxHeight: "90vh", overflowY: "auto", color: "#fff" },
  btnSalvar: { marginTop: 12, width: "100%", padding: 9, borderRadius: 8, border: "none", background: VERDE, color: "#0c1410", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
};
