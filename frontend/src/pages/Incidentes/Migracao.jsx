// Solicitação de MIGRAÇÃO DE PDVs (RN) — tabela da base do RN agrupada por dia de
// visita (SEG–SEX), com "Migrar RN" e "Migrar dia" (vazio = mantém o original),
// coluna de alteração com seta e balanço por dia. Envia em lote para o admin aprovar.
// O app não altera o Promax: o admin aprova e baixa o Excel.
import { useState, useEffect, useMemo } from "react";
import api from "../../services/api";

const DIAS = ["SEG", "TER", "QUA", "QUI", "SEX"];
const NOME_DIA = { SEG: "Segunda", TER: "Terça", QUA: "Quarta", QUI: "Quinta", SEX: "Sexta", "": "Sem dia definido" };
const fmt = (n) => (Number(n) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const rotMes = (m) => ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][Number(String(m).slice(5, 7)) - 1] || m;

export function Seta({ de, para, tipo }) {
  const c = tipo === "rn" ? { bg: "rgba(167,139,250,0.15)", fg: "#c4b5fd", bd: "rgba(167,139,250,0.4)" }
                          : { bg: "rgba(245,196,81,0.15)", fg: "#f5c451", bd: "rgba(245,196,81,0.4)" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: c.bg, color: c.fg, border: `1px solid ${c.bd}`, borderRadius: 20, padding: "2px 9px", fontSize: "0.74rem", fontWeight: 700, whiteSpace: "nowrap" }}>
      {de || "—"} <span style={{ fontSize: "0.9rem" }}>➜</span> {para}
    </span>
  );
}

// `setor` (opcional): ADM agindo em nome de um RN — o backend só aceita para admin.
export function TagInativar() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(248,113,113,0.15)", color: "#f87171", border: "1px solid rgba(248,113,113,0.45)", borderRadius: 20, padding: "2px 9px", fontSize: "0.74rem", fontWeight: 700, whiteSpace: "nowrap" }}>
      🚫 INATIVAR
    </span>
  );
}

const brl = (v) => "R$ " + (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Prévia da inativação: inadimplência (relatório 120601) + comodato (relatório de comodatos).
function PreviaInativar({ p, fontes, justificativa, onJust }) {
  const i = p.inad, c = p.comodato;
  return (
    <div style={S.previa}>
      <div style={S.previaTit}>Prévia da inativação</div>
      <div style={{ ...S.previaLinha, color: i ? "#f87171" : "#4ade80" }}>
        {i ? <>⚠️ <b>Inadimplente</b>: {i.qtd_titulos} título(s) · {brl(i.valor)} · maior atraso {i.maior_atraso} dias</> : <>✅ Sem inadimplência</>}
        <span style={S.fonte}>{fontes?.inad ? ` · base de ${fontes.inad}` : " · importe a Inadimplência (120601)"}</span>
      </div>
      <div style={{ ...S.previaLinha, color: c ? "#f5c451" : "#4ade80" }}>
        {c ? <>🧊 <b>Tem comodato</b>: {c.itens.map((x, k) => <span key={k}>{k ? " · " : ""}{x.descricao} <b>({x.em_aberto} em aberto)</b></span>)}</> : <>✅ Sem comodato</>}
        <span style={S.fonte}>{fontes?.temComodatos ? (fontes.comodatos ? ` · base de ${fontes.comodatos}` : "") : " · importe o relatório de Comodatos"}</span>
      </div>
      <textarea style={{ ...S.just, ...(justificativa.trim().length < 5 ? S.justErro : {}) }} rows={2} maxLength={500}
        placeholder="Justificativa da inativação (obrigatória) — ex.: PDV fechou, mudou de ramo, sem compra há 6 meses…"
        value={justificativa} onChange={(e) => onJust(e.target.value)} />
    </div>
  );
}

export default function Migracao({ onEnviado, setor }) {
  const [base, setBase] = useState(null);
  const [erro, setErro] = useState("");
  const [alt, setAlt] = useState({});          // cod → { setor_novo, dia_novo }
  const [busca, setBusca] = useState("");
  const [soAlterados, setSoAlterados] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState("");

  const carregar = () => {
    setErro("");
    api.get("/api/solicitacoes/migracao/base", { params: setor ? { setor } : {}, timeout: 60000 })
      .then((r) => setBase(r.data))
      .catch((e) => setErro(e.response?.data?.error || "Erro ao carregar sua base de PDVs."));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(carregar, [setor]);

  const setCampo = (cod, campo, val) =>
    setAlt((a) => {
      const n = { ...a, [cod]: { ...(a[cod] || {}), [campo]: val } };
      if (!n[cod].setor_novo && !n[cod].dia_novo && !n[cod].inativar) delete n[cod];
      return n;
    });

  // Inativar é exclusivo: liga → limpa RN/dia (mantém a justificativa digitada); desliga → remove.
  const toggleInativar = (cod) =>
    setAlt((a) => {
      const cur = a[cod] || {};
      const n = { ...a };
      if (cur.inativar) delete n[cod];
      else n[cod] = { inativar: true, justificativa: cur.justificativa || "" };
      return n;
    });

  const mudou = (p) => {
    const a = alt[p.cod_pdv] || {};
    return {
      rn: a.setor_novo && a.setor_novo !== base.setor ? a.setor_novo : "",
      dia: a.dia_novo && a.dia_novo !== p.dia ? a.dia_novo : "",
      inat: !!a.inativar,
    };
  };

  const pdvs = base?.pdvs || [];
  const nAlterados = pdvs.filter((p) => { const m = mudou(p); return m.rn || m.dia || m.inat; }).length;

  // Agrupa por dia (SEG–SEX, depois "sem dia"), ordena por nome dentro do dia.
  const grupos = useMemo(() => {
    if (!base) return [];
    const q = busca.trim().toLowerCase();
    const filtro = (p) => {
      if (q && !(`${p.cod_pdv} ${p.nome}`.toLowerCase().includes(q))) return false;
      if (soAlterados) { const m = mudou(p); if (!m.rn && !m.dia && !m.inat) return false; }
      return true;
    };
    const chave = (d) => (DIAS.includes(d) ? d : "");
    return [...DIAS, ""].map((d) => ({
      dia: d,
      pdvs: pdvs.filter((p) => chave(p.dia) === d && filtro(p)).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    })).filter((g) => g.pdvs.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, busca, soAlterados, alt]);

  // Balanço por dia: antes × depois (quem migra de RN ou é inativado sai da carteira).
  const balanco = useMemo(() => {
    const b = {}; DIAS.forEach((d) => { b[d] = { antes: 0, depois: 0, hlA: 0, hlD: 0 }; });
    pdvs.forEach((p) => {
      const m = mudou(p);
      if (b[p.dia]) { b[p.dia].antes++; b[p.dia].hlA += p.media_tri; }
      if (m.rn || m.inat) return;
      const dDepois = m.dia || p.dia;
      if (b[dDepois]) { b[dDepois].depois++; b[dDepois].hlD += p.media_tri; }
    });
    return b;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, alt]);

  async function enviar() {
    setMsg(""); setErro("");
    const marcados = pdvs.map((p) => ({ p, m: mudou(p) })).filter(({ m }) => m.rn || m.dia || m.inat);
    if (!marcados.length) { setErro("Nenhuma alteração marcada."); return; }
    const semJust = marcados.filter(({ p, m }) => m.inat && (alt[p.cod_pdv]?.justificativa || "").trim().length < 5);
    if (semJust.length) {
      setErro(`Escreva a justificativa da inativação: ${semJust.map(({ p }) => p.nome).join(", ")}.`);
      return;
    }
    const itens = marcados.map(({ p, m }) => (m.inat
      ? { cod_pdv: p.cod_pdv, inativar: true, justificativa: alt[p.cod_pdv].justificativa.trim() }
      : { cod_pdv: p.cod_pdv, setor_novo: m.rn, dia_novo: m.dia }));
    setEnviando(true);
    try {
      const r = await api.post("/api/solicitacoes/migracao", { motivo, itens, ...(setor ? { setor } : {}) }, { timeout: 60000 });
      setMsg(`Solicitação enviada (${r.data.itens} PDV${r.data.itens > 1 ? "s" : ""}). Aguardando aprovação.`);
      setAlt({}); setMotivo(""); setSoAlterados(false);
      carregar();
      onEnviado && onEnviado();
    } catch (e) {
      setErro(e.response?.data?.error || "Erro ao enviar. Tente novamente.");
    } finally { setEnviando(false); }
  }

  if (erro && !base) return <p style={S.erro}>{erro}</p>;
  if (!base) return <p style={S.msg}>Carregando sua base de PDVs…</p>;
  if (!pdvs.length) return <p style={S.msg}>Nenhum PDV encontrado na base do setor {base.setor}.</p>;

  const optSetores = base.setores.filter((s) => s.setor !== base.setor);

  return (
    <div>
      <div style={S.topo}>
        <input style={S.busca} placeholder="🔎 Buscar PDV (nome ou código)" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <label style={S.chk}><input type="checkbox" checked={soAlterados} onChange={(e) => setSoAlterados(e.target.checked)} /> Só alterados</label>
        <span style={S.info}>{pdvs.length} PDVs · média {base.meses.map(rotMes).join("/")}</span>
      </div>
      <p style={S.dica}>Deixe em branco o que não muda. Só as linhas alteradas vão para aprovação. Para tirar o PDV da carteira, use <b style={{ color: "#f87171" }}>🚫 Inativar</b> (mostra inadimplência e comodato; justificativa obrigatória).</p>

      {grupos.map((g) => (
        <div key={g.dia || "sem"} style={{ marginBottom: 14 }}>
          <div style={S.grupo}>{NOME_DIA[g.dia]} · {g.pdvs.length} PDV{g.pdvs.length > 1 ? "s" : ""}</div>
          {g.pdvs.map((p) => {
            const a = alt[p.cod_pdv] || {};
            const m = mudou(p);
            if (p.pendente_desde) {
              return (
                <div key={p.cod_pdv} style={{ ...S.linha, opacity: 0.6 }}>
                  <div style={S.pdv}><div style={S.nome}>{p.nome}</div><div style={S.sub}>{p.cod_pdv} · {fmt(p.media_tri)} HL/mês</div></div>
                  <div style={{ ...S.ctrls, color: "#f5c451", fontSize: "0.8rem" }}>⏳ Em aprovação desde {new Date(p.pendente_desde).toLocaleDateString("pt-BR")}</div>
                </div>
              );
            }
            return (
              <div key={p.cod_pdv} style={{ ...S.linha, ...(m.inat ? S.linhaInat : m.rn || m.dia ? S.linhaOn : {}) }}>
                <div style={S.pdv}>
                  <div style={S.nome}>{p.nome}</div>
                  <div style={S.sub}>{p.cod_pdv} · <b style={{ color: "rgba(255,255,255,0.75)" }}>{fmt(p.media_tri)} HL/mês</b>{p.cidade ? ` · ${p.cidade}` : ""}</div>
                </div>
                <div style={S.ctrls}>
                  <button type="button" onClick={() => toggleInativar(p.cod_pdv)} title="Inativar este PDV"
                    style={{ ...S.btnInat, ...(m.inat ? S.btnInatOn : {}) }}>🚫 {m.inat ? "Inativando" : "Inativar"}</button>
                  {!m.inat && <>
                  <select style={S.sel} value={a.setor_novo || ""} onChange={(e) => setCampo(p.cod_pdv, "setor_novo", e.target.value)} title="Migrar RN">
                    <option value="">RN: manter</option>
                    {optSetores.map((s) => <option key={s.setor} value={s.setor}>{s.setor}{s.nome ? ` · ${s.nome.split(" ")[0]}` : ""}</option>)}
                  </select>
                  <select style={S.sel} value={a.dia_novo || ""} onChange={(e) => setCampo(p.cod_pdv, "dia_novo", e.target.value)} title="Migrar dia de visita">
                    <option value="">Dia: manter</option>
                    {DIAS.filter((d) => d !== p.dia).map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                  </>}
                  <div style={S.alt}>
                    {m.inat && <TagInativar />}
                    {m.dia && <Seta de={p.dia} para={m.dia} tipo="dia" />}
                    {m.rn && <Seta de={base.setor} para={m.rn} tipo="rn" />}
                    {!m.dia && !m.rn && !m.inat && <span style={{ color: "rgba(255,255,255,0.25)" }}>—</span>}
                  </div>
                </div>
                {m.inat && (
                  <PreviaInativar p={p} fontes={base.fontes} justificativa={a.justificativa || ""}
                    onJust={(v) => setCampo(p.cod_pdv, "justificativa", v)} />
                )}
              </div>
            );
          })}
        </div>
      ))}
      {!grupos.length && <p style={S.msg}>Nenhum PDV com esse filtro.</p>}

      {/* Balanço por dia (antes → depois) */}
      <div style={S.balTit}>Balanço por dia {nAlterados ? "(antes ➜ depois)" : ""}</div>
      <div style={S.balGrid}>
        {DIAS.map((d) => {
          const x = balanco[d]; const muda = x.antes !== x.depois || Math.abs(x.hlA - x.hlD) > 0.05;
          return (
            <div key={d} style={{ ...S.bal, ...(muda ? S.balOn : {}) }}>
              <div style={S.balDia}>{d}</div>
              <div style={S.balN}>{muda ? <>{x.antes} <span style={{ color: "#7DBA3D" }}>➜</span> {x.depois}</> : x.antes} <small style={S.balUn}>PDVs</small></div>
              <div style={S.balHl}>{muda ? `${fmt(x.hlA)} ➜ ${fmt(x.hlD)}` : fmt(x.hlA)} HL</div>
            </div>
          );
        })}
      </div>

      <div style={S.rodape}>
        <input style={S.motivo} placeholder="Motivo (opcional) — ex.: rota nova, PDV fechado na segunda…" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} />
        <button style={{ ...S.btn, opacity: enviando || !nAlterados ? 0.6 : 1 }} onClick={enviar} disabled={enviando}>
          {enviando ? "Enviando…" : `📤 Enviar ${nAlterados || ""} alteraç${nAlterados === 1 ? "ão" : "ões"}`}
        </button>
      </div>
      {erro && <p style={S.erro}>{erro}</p>}
      {msg && <p style={S.ok}>{msg}</p>}
    </div>
  );
}

const S = {
  topo: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 },
  busca: { flex: "1 1 220px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff", padding: "10px 12px", fontSize: "0.88rem", fontFamily: "inherit", outline: "none" },
  chk: { display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.65)", fontSize: "0.82rem", cursor: "pointer" },
  info: { color: "rgba(255,255,255,0.35)", fontSize: "0.75rem", marginLeft: "auto" },
  dica: { color: "rgba(255,255,255,0.35)", fontSize: "0.75rem", margin: "0 0 12px" },
  grupo: { background: "rgba(125,186,61,0.12)", color: "#7DBA3D", fontWeight: 700, fontSize: "0.8rem", padding: "6px 12px", borderRadius: 8, marginBottom: 4 },
  linha: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 12px", padding: "9px 10px", borderBottom: "1px solid rgba(255,255,255,0.06)" },
  linhaInat: { background: "rgba(248,113,113,0.06)", borderRadius: 8 },
  btnInat: { background: "transparent", color: "rgba(248,113,113,0.85)", border: "1px solid rgba(248,113,113,0.35)", borderRadius: 8, padding: "6px 10px", fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" },
  btnInatOn: { background: "rgba(248,113,113,0.18)", color: "#f87171", fontWeight: 700 },
  previa: { flex: "1 1 100%", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 10, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 },
  previaTit: { color: "rgba(255,255,255,0.5)", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" },
  previaLinha: { fontSize: "0.82rem", lineHeight: 1.4 },
  fonte: { color: "rgba(255,255,255,0.35)", fontSize: "0.72rem" },
  just: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, color: "#fff", padding: "8px 10px", fontSize: "0.84rem", fontFamily: "inherit", outline: "none", resize: "vertical" },
  justErro: { border: "1px solid rgba(248,113,113,0.6)" },
  linhaOn: { background: "rgba(245,196,81,0.05)", borderRadius: 8 },
  pdv: { flex: "1 1 220px", minWidth: 0 },
  nome: { color: "#fff", fontSize: "0.86rem", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  sub: { color: "rgba(255,255,255,0.4)", fontSize: "0.74rem" },
  ctrls: { flex: "1 1 330px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  sel: { background: "#13231a", color: "#fff", border: "1px solid rgba(125,186,61,0.3)", borderRadius: 8, padding: "7px 8px", fontSize: "0.8rem", fontFamily: "inherit", minWidth: 110 },
  alt: { display: "flex", gap: 6, flexWrap: "wrap", minWidth: 90 },
  balTit: { color: "rgba(255,255,255,0.6)", fontSize: "0.8rem", fontWeight: 700, margin: "16px 0 8px" },
  balGrid: { display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 8 },
  bal: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "8px 10px" },
  balOn: { border: "1px solid rgba(125,186,61,0.45)", background: "rgba(125,186,61,0.07)" },
  balDia: { color: "rgba(255,255,255,0.5)", fontSize: "0.72rem", fontWeight: 700 },
  balN: { color: "#fff", fontWeight: 700, fontSize: "0.95rem" },
  balUn: { color: "rgba(255,255,255,0.35)", fontWeight: 400, fontSize: "0.68rem" },
  balHl: { color: "rgba(255,255,255,0.45)", fontSize: "0.72rem" },
  rodape: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 },
  motivo: { flex: "1 1 260px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff", padding: "11px 12px", fontSize: "0.86rem", fontFamily: "inherit", outline: "none" },
  btn: { flex: "0 0 auto", background: "linear-gradient(135deg, #7DBA3D, #2E7D32)", color: "#0c1410", border: "none", borderRadius: 10, padding: "12px 20px", fontSize: "0.9rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  msg: { color: "rgba(255,255,255,0.4)", textAlign: "center", padding: 30 },
  erro: { color: "#f87171", fontSize: "0.85rem", textAlign: "center" },
  ok: { color: "#4ade80", fontSize: "0.85rem", textAlign: "center" },
};
