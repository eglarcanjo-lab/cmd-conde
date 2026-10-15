// Tasks › Missões — relatório de missões do BI (campanha, ex.: "MANDA BALA NAS VENDAS").
// Duas visões: POR MISSÃO (quantos PDVs têm cada missão e quantos já validaram) e POR PDV
// (missões de cada PDV). Dados: GET /api/tasks/missoes (escopo por perfil no backend).
// Mostra só os PDVs com VISITA NO DIA escolhido na barra de dias da tela de Tasks (dia de
// visita do PDV na rota — pdv_base). Pesquisa (também no celular) acompanha a visão: Por missão →
// pesquisa a missão; Por PDV → pesquisa o PDV. No celular: sem filtros/Excel.
// Import: Admin › Arquivos › "Missões (BI)".
import { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx-js-style";
import api from "../../services/api";
import { useAbaUrl } from "../../utils/abaUrl";
import { useContarAba } from "../../utils/uso";
import { mesmoSetor } from "../../utils/setor";

const VERDE = "#7DBA3D";
const pctDe = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const corPct = (p) => (p >= 100 ? "#4ade80" : p >= 50 ? VERDE : p > 0 ? "#f5c451" : "rgba(255,255,255,0.35)");
const dataKey = (br) => { const m = String(br || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : "9999"; };

function Barra({ v, total }) {
  const p = pctDe(v, total);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 140 }}>
      <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3 }}>
        <div style={{ width: `${Math.min(100, p)}%`, height: "100%", background: corPct(p), borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: "0.78rem", fontWeight: 700, color: corPct(p), minWidth: 34, textAlign: "right" }}>{p}%</span>
    </div>
  );
}

const normDia = (v) => String(v || "").trim().toUpperCase().split("/")[0].trim();
function useMobile() {
  const q = "(max-width: 767px)";
  const [m, setM] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q); const on = (e) => setM(e.matches);
    mq.addEventListener ? mq.addEventListener("change", on) : mq.addListener(on);
    return () => (mq.removeEventListener ? mq.removeEventListener("change", on) : mq.removeListener(on));
  }, []);
  return m;
}

export default function Missoes({ usuario, isGestor, nomesRn = {}, dia, mapaPdv = {} }) {
  const mobile = useMobile();
  const [dados, setDados] = useState([]);
  const [atualizado, setAtualizado] = useState("");
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [visao, setVisao] = useAbaUrl("mvisao", "missao");    // missao | pdv (chave própria: "visao" é da aba Tasks)
  useContarAba("/tasks#missoes", visao);
  const [filtroRn, setFiltroRn] = useAbaUrl("rn", "");
  const [status, setStatus] = useState("");                  // "" | pendente | validada
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(null);

  useEffect(() => {
    api.get("/api/tasks/missoes", { timeout: 60000 })
      .then((r) => { setDados(r.data?.missoes || []); setAtualizado(r.data?.atualizado_em || ""); })
      .catch((e) => setErro(e.response?.data?.error || "Erro ao carregar as missões."))
      .finally(() => setLoading(false));
  }, []);

  const rns = useMemo(() => [...new Set(dados.map((m) => String(m.setor || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), [dados]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return dados.filter((m) => {
      if (isGestor && filtroRn && !mesmoSetor(m.setor, filtroRn)) return false;
      if (status === "validada" && m.validada !== "SIM") return false;
      if (status === "pendente" && m.validada === "SIM") return false;
      if (dia && dia !== "TODOS" && normDia(mapaPdv[m.cod_pdv]?.dia_visita) !== dia) return false;   // visita do dia (rota); "Todos" = toda a base
      if (q && !(visao === "pdv" ? `${m.cod_pdv} ${m.nome_pdv}` : m.missao).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [dados, isGestor, filtroRn, status, busca, visao, dia, mapaPdv]);

  const validadas = filtradas.filter((m) => m.validada === "SIM").length;
  const pdvs = new Set(filtradas.map((m) => m.cod_pdv)).size;

  const porMissao = useMemo(() => {
    const g = {};
    filtradas.forEach((m) => { (g[m.missao] = g[m.missao] || { missao: m.missao, itens: [], ok: 0 }).itens.push(m); if (m.validada === "SIM") g[m.missao].ok++; });
    return Object.values(g).sort((a, b) => b.itens.length - a.itens.length || a.missao.localeCompare(b.missao, "pt-BR"));
  }, [filtradas]);

  const porPdv = useMemo(() => {
    const g = {};
    filtradas.forEach((m) => {
      const k = m.cod_pdv;
      (g[k] = g[k] || { cod: k, nome: m.nome_pdv, setor: m.setor, visita: m.proxima_visita, itens: [], ok: 0 }).itens.push(m);
      if (m.validada === "SIM") g[k].ok++;
    });
    return Object.values(g).sort((a, b) => dataKey(a.visita).localeCompare(dataKey(b.visita)) || (b.itens.length - b.ok) - (a.itens.length - a.ok));
  }, [filtradas]);

  function exportar() {
    const cab = ["RN", "Cód PDV", "PDV", "Próxima visita", "Missão", "Validada", "Concluída em", "Campanha"];
    const linhas = filtradas.map((m) => [Number(m.setor) || m.setor, Number(m.cod_pdv) || m.cod_pdv, m.nome_pdv, m.proxima_visita, m.missao, m.validada, m.concluida_em, m.campanha]);
    const ws = XLSX.utils.aoa_to_sheet([cab, ...linhas]);
    cab.forEach((_, c) => { const ref = XLSX.utils.encode_cell({ r: 0, c }); if (ws[ref]) ws[ref].s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "2E7D32" } } }; });
    ws["!cols"] = [6, 9, 30, 13, 48, 9, 13, 24].map((w) => ({ wch: w }));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Missões");
    XLSX.writeFile(wb, `Missoes_${dia || "todos"}${filtroRn ? `_RN${filtroRn}` : ""}${status ? `_${status}` : ""}.xlsx`);
  }

  if (loading) return <p style={S.msg}>Carregando missões…</p>;
  if (erro) return <p style={{ ...S.msg, color: "#f87171" }}>{erro}</p>;
  if (!dados.length) return <p style={S.msg}>Nenhuma missão importada ainda. Importe o relatório em Admin › Arquivos › <b>Missões (BI)</b>.</p>;

  return (
    <div>
      <div style={S.dash}>
        <div style={S.card}><span style={S.cardLbl}>Missões</span><b style={S.cardVal}>{filtradas.length}</b></div>
        <div style={S.card}><span style={S.cardLbl}>Validadas</span><b style={{ ...S.cardVal, color: corPct(pctDe(validadas, filtradas.length)) }}>{validadas} <small style={S.small}>· {pctDe(validadas, filtradas.length)}%</small></b></div>
        <div style={S.card}><span style={S.cardLbl}>PDVs</span><b style={S.cardVal}>{pdvs}</b></div>
      </div>
      {atualizado && <p style={S.hint}>Campanha: {dados[0]?.campanha || "—"} · atualizado em {atualizado}</p>}

      <div style={S.toggle}>
        <button type="button" style={visao === "missao" ? S.tOn : S.t} onClick={() => { setVisao("missao"); setAberto(null); setBusca(""); }}>🎯 Por missão</button>
        <button type="button" style={visao === "pdv" ? S.tOn : S.t} onClick={() => { setVisao("pdv"); setAberto(null); setBusca(""); }}>🏪 Por PDV</button>
      </div>

      <input style={{ ...S.input, width: "100%", boxSizing: "border-box", marginBottom: 10 }} value={busca} onChange={(e) => setBusca(e.target.value)}
        placeholder={visao === "pdv" ? "🔎 Pesquisar PDV (código ou nome)…" : "🔎 Pesquisar missão…"} />

      {!mobile && <div style={S.filtros}>
        {isGestor && (
          <select style={{ ...S.input, ...(filtroRn ? { borderColor: VERDE, color: VERDE } : {}) }} value={filtroRn} onChange={(e) => setFiltroRn(e.target.value)}>
            <option value="">Todos os RNs</option>
            {rns.map((s) => <option key={s} value={s}>{s}{nomesRn[s] ? ` · ${nomesRn[s].split(" ")[0]}` : ""}</option>)}
          </select>
        )}
        <select style={S.input} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todas</option>
          <option value="pendente">Pendentes</option>
          <option value="validada">Validadas</option>
        </select>
        <button type="button" style={S.excel} onClick={exportar}>⤓ Excel</button>
      </div>}

      {visao === "missao" ? (
        <div style={S.lista}>
          {porMissao.map((g) => (
            <div key={g.missao} style={S.item}>
              <div style={S.linha} onClick={() => setAberto(aberto === g.missao ? null : g.missao)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={S.titulo}>{g.missao}</div>
                  <div style={S.sub}>{g.itens.length} PDV{g.itens.length > 1 ? "s" : ""} · {g.ok} validada{g.ok === 1 ? "" : "s"}</div>
                </div>
                <Barra v={g.ok} total={g.itens.length} />
                <span style={S.seta}>{aberto === g.missao ? "▾" : "▸"}</span>
              </div>
              {aberto === g.missao && (
                <div style={S.det}>
                  {g.itens.slice().sort((a, b) => (a.validada === "SIM") - (b.validada === "SIM") || dataKey(a.proxima_visita).localeCompare(dataKey(b.proxima_visita))).map((m, i) => (
                    <div key={`${m.cod_pdv}-${i}`} style={S.detLinha}>
                      <span style={S.cod}>{m.cod_pdv}</span>
                      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.nome_pdv}</span>
                      {isGestor && <span style={S.mut}>RN {m.setor}</span>}
                      <span style={S.mut}>visita {m.proxima_visita?.slice(0, 5) || "—"}</span>
                      <span style={m.validada === "SIM" ? S.ok : S.pend}>{m.validada === "SIM" ? `✓ ${m.concluida_em?.slice(0, 5) || ""}` : "pendente"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {!porMissao.length && <p style={S.msg}>Nenhuma missão para os PDVs com visita neste dia.</p>}
        </div>
      ) : (
        <div style={S.lista}>
          {porPdv.map((p) => (
            <div key={p.cod} style={S.item}>
              <div style={S.linha} onClick={() => setAberto(aberto === p.cod ? null : p.cod)}>
                <span style={S.cod}>{p.cod}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={S.titulo}>{p.nome}</div>
                  <div style={S.sub}>{isGestor ? `RN ${p.setor} · ` : ""}visita {p.visita || "—"} · {p.ok}/{p.itens.length} validadas</div>
                </div>
                <Barra v={p.ok} total={p.itens.length} />
                <span style={S.seta}>{aberto === p.cod ? "▾" : "▸"}</span>
              </div>
              {aberto === p.cod && (
                <div style={S.det}>
                  {p.itens.map((m, i) => (
                    <div key={i} style={S.detLinha}>
                      <span style={{ flex: 1, minWidth: 0 }}>{m.missao}</span>
                      <span style={m.validada === "SIM" ? S.ok : S.pend}>{m.validada === "SIM" ? `✓ ${m.concluida_em?.slice(0, 5) || ""}` : "pendente"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {!porPdv.length && <p style={S.msg}>Nenhum PDV com missão e visita neste dia.</p>}
        </div>
      )}
    </div>
  );
}

const S = {
  msg: { color: "rgba(255,255,255,0.45)", textAlign: "center", padding: "32px 0", fontSize: "0.9rem" },
  hint: { color: "rgba(255,255,255,0.4)", fontSize: "0.76rem", margin: "6px 0 12px" },
  dash: { display: "flex", gap: 8 },
  card: { flex: "1 1 0", minWidth: 0, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(125,186,61,0.2)", borderRadius: 12, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 4 },
  cardLbl: { color: "rgba(255,255,255,0.5)", fontSize: "0.75rem" },
  cardVal: { fontSize: "clamp(1.05rem, 4.5vw, 1.5rem)", color: "#fff", whiteSpace: "nowrap" },
  small: { fontSize: "0.72em", fontWeight: 600 },
  toggle: { display: "flex", gap: 8, margin: "4px 0 12px" },
  t: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.85rem" },
  tOn: { background: "rgba(125,186,61,0.18)", border: `1px solid ${VERDE}`, color: VERDE, borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.85rem", fontWeight: 700 },
  filtros: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 },
  input: { background: "#13231a", color: "#fff", border: "1px solid rgba(125,186,61,0.3)", borderRadius: 8, padding: "8px 10px", fontSize: "0.84rem", fontFamily: "inherit", minWidth: 0 },
  excel: { background: "transparent", border: `1px solid rgba(125,186,61,0.5)`, color: VERDE, borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 },
  lista: { display: "flex", flexDirection: "column", gap: 8 },
  item: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, overflow: "hidden" },
  linha: { display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", cursor: "pointer", flexWrap: "wrap" },
  titulo: { color: "#fff", fontSize: "0.88rem", fontWeight: 600 },
  sub: { color: "rgba(255,255,255,0.45)", fontSize: "0.75rem", marginTop: 2 },
  seta: { color: "rgba(255,255,255,0.4)" },
  cod: { background: "rgba(125,186,61,0.12)", color: VERDE, borderRadius: 6, padding: "2px 7px", fontSize: "0.74rem", fontWeight: 700, flexShrink: 0 },
  det: { borderTop: "1px solid rgba(255,255,255,0.06)", padding: "6px 14px 10px", display: "flex", flexDirection: "column", gap: 4 },
  detLinha: { display: "flex", alignItems: "center", gap: 10, fontSize: "0.8rem", color: "rgba(255,255,255,0.8)", padding: "4px 0", flexWrap: "wrap" },
  mut: { color: "rgba(255,255,255,0.4)", fontSize: "0.74rem", flexShrink: 0 },
  ok: { color: "#4ade80", fontSize: "0.75rem", fontWeight: 700, flexShrink: 0 },
  pend: { color: "#f5c451", fontSize: "0.75rem", flexShrink: 0 },
};
