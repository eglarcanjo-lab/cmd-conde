// Detalhamento HOP — relatórios admin. Sub-abas: Entrega + Ruptura de Estoque.
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";

const VERDE = "#7DBA3D";
const VERMELHO = "#ef6f6f";
const BG = "#0c1410";

function rotuloMes(m) {
  if (!m || !m.includes("-")) return m || "";
  const [a, mm] = m.split("-");
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${nomes[Number(mm) - 1] || mm}/${a.slice(2)}`;
}
const fmt = (n, d = 1) =>
  (Number(n) || 0).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtMoeda = (n) =>
  (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Detalhamento() {
  const navigate = useNavigate();
  const [aba, setAba] = useState("entrega");

  return (
    <div style={S.root}>
      <div style={S.header}>
        <button style={S.voltar} onClick={() => navigate("/")}>← Início</button>
        <div>
          <h1 style={S.titulo}>🌿 Detalhamento HOP</h1>
          <p style={S.sub}>Relatórios de análise · admin</p>
        </div>
      </div>

      <div style={S.abas}>
        <button style={{ ...S.tab, ...(aba === "entrega" ? S.tabAtiva : {}) }} onClick={() => setAba("entrega")}>
          📦 Entrega
        </button>
        <button style={{ ...S.tab, ...(aba === "ruptura" ? S.tabAtiva : {}) }} onClick={() => setAba("ruptura")}>
          📉 Ruptura de Estoque
        </button>
      </div>

      {aba === "entrega" ? <Entrega /> : <Ruptura />}
      <style>{CSS}</style>
    </div>
  );
}

function Kpi({ label, valor, sub, cor }) {
  return (
    <div style={S.kpi}>
      <div style={{ ...S.kpiValor, color: cor || "#fff" }}>{valor}</div>
      <div style={S.kpiLabel}>{label}</div>
      {sub != null && <div style={S.kpiSub}>{sub}</div>}
    </div>
  );
}

function Tabela({ colunas, linhas }) {
  return (
    <div style={S.tabelaWrap}>
      <table style={S.tabela}>
        <thead>
          <tr>{colunas.map((c) => <th key={c.k} style={{ ...S.th, textAlign: c.num ? "right" : "left" }}>{c.t}</th>)}</tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i} style={i % 2 ? S.trAlt : undefined}>
              {colunas.map((c) => (
                <td key={c.k} style={{ ...S.td, textAlign: c.num ? "right" : "left" }}>
                  {c.fmt ? c.fmt(l[c.k]) : l[c.k]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────── ENTREGA ───────────────────────────────
function Entrega() {
  const [mes, setMes] = useState("");
  const [setor, setSetor] = useState("");
  const [motivo, setMotivo] = useState("");
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [sub, setSub] = useState("motivo"); // motivo | setor | pdv | detalhe

  useEffect(() => {
    let vivo = true;
    setLoading(true); setErro("");
    api.get("/api/detalhamento/entrega", { params: { mes, setor, motivo } })
      .then((r) => vivo && setD(r.data))
      .catch(() => vivo && setErro("Não consegui carregar os dados de entrega."))
      .finally(() => vivo && setLoading(false));
    return () => { vivo = false; };
  }, [mes, setor, motivo]);

  if (loading && !d) return <div style={S.info}><span className="dh-spin" /> Carregando…</div>;
  if (erro) return <div style={S.erro}>{erro}</div>;
  if (!d) return null;
  if (!d.tem_dados)
    return (
      <div style={S.vazio}>
        Nenhum dado de entrega ainda. Importe o <b>relatório de Devoluções</b> (Admin › Arquivos —
        pode importar vários meses, ele acumula) e reimporte os <b>Pedidos</b> para gerar as efetivadas.
      </div>
    );

  const op = d.opcoes || { meses: [], setores: [], motivos: [] };
  const taxa = d.taxa_frustracao_pct;
  return (
    <>
      <div style={S.filtros}>
        <Select label="Mês" value={mes} onChange={setMes} opcoes={op.meses} fmtOpt={rotuloMes} todos="Quadrimestre" />
        <Select label="Setor" value={setor} onChange={setSetor} opcoes={op.setores} todos="Todos" />
        <Select label="Motivo" value={motivo} onChange={setMotivo} opcoes={op.motivos} todos="Todos" />
      </div>

      <div style={S.kpis}>
        <Kpi label="Volume efetivado (HL)" valor={fmt(d.volume_efetivado_hl)} cor={VERDE} />
        <Kpi label="Volume frustrado (HL)" valor={fmt(d.volume_frustrado_hl)} cor={VERMELHO} sub={`${d.qtd_frustradas} notas`} />
        <Kpi label="Taxa de frustração" valor={taxa == null ? "—" : `${fmt(taxa)}%`} cor={taxa > 5 ? VERMELHO : "#f5c451"} />
        <Kpi label="Valor frustrado" valor={fmtMoeda(d.valor_frustrado)} cor={VERMELHO} />
      </div>

      <div style={S.subAbas}>
        {[["motivo", "Por motivo"], ["setor", "Por setor"], ["pdv", "Por PDV"], ["detalhe", "Detalhe"]].map(([k, t]) => (
          <button key={k} style={{ ...S.subTab, ...(sub === k ? S.subTabAtiva : {}) }} onClick={() => setSub(k)}>{t}</button>
        ))}
      </div>

      {sub === "motivo" && (
        <Tabela linhas={d.por_motivo} colunas={[
          { k: "desc_motivo", t: "Motivo" },
          { k: "qtd", t: "Notas", num: true },
          { k: "volume_hl", t: "Volume (HL)", num: true, fmt: (v) => fmt(v) },
          { k: "valor", t: "Valor", num: true, fmt: fmtMoeda },
        ]} />
      )}
      {sub === "setor" && (
        <Tabela linhas={d.por_setor} colunas={[
          { k: "setor", t: "Setor" },
          { k: "qtd", t: "Notas", num: true },
          { k: "volume_hl", t: "Volume (HL)", num: true, fmt: (v) => fmt(v) },
          { k: "valor", t: "Valor", num: true, fmt: fmtMoeda },
        ]} />
      )}
      {sub === "pdv" && (
        <Tabela linhas={d.por_pdv} colunas={[
          { k: "cod_pdv", t: "Cód" },
          { k: "nome_pdv", t: "Cliente" },
          { k: "setor", t: "Setor" },
          { k: "qtd", t: "Notas", num: true },
          { k: "volume_hl", t: "Volume (HL)", num: true, fmt: (v) => fmt(v) },
          { k: "valor", t: "Valor", num: true, fmt: fmtMoeda },
        ]} />
      )}
      {sub === "detalhe" && (
        <Tabela linhas={d.detalhe} colunas={[
          { k: "setor", t: "Setor" }, { k: "data", t: "Data" }, { k: "nota", t: "Nota" },
          { k: "nome_pdv", t: "Cliente" }, { k: "desc_motivo", t: "Motivo" },
          { k: "volume_hl", t: "Vol (HL)", num: true, fmt: (v) => fmt(v) },
          { k: "valor", t: "Valor", num: true, fmt: fmtMoeda },
        ]} />
      )}
    </>
  );
}

// ─────────────────────────────── RUPTURA ───────────────────────────────
function Ruptura() {
  const [mes, setMes] = useState(""); // "" = consolidado quadrimestre
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [sub, setSub] = useState("produto"); // produto | cliente

  useEffect(() => {
    let vivo = true;
    setLoading(true); setErro("");
    api.get("/api/detalhamento/ruptura", { params: { mes } })
      .then((r) => vivo && setD(r.data))
      .catch(() => vivo && setErro("Não consegui carregar os dados de ruptura."))
      .finally(() => vivo && setLoading(false));
    return () => { vivo = false; };
  }, [mes]);

  if (loading && !d) return <div style={S.info}><span className="dh-spin" /> Carregando…</div>;
  if (erro) return <div style={S.erro}>{erro}</div>;
  if (!d) return null;
  if (!d.tem_dados)
    return (
      <div style={S.vazio}>
        Nenhuma ruptura registrada. Reimporte os <b>Pedidos</b> (o processador identifica os
        produtos marcados com falta no quadrimestre).
      </div>
    );

  const quad = d.quadrimestre || { meses: [], por_mes: [] };
  const maxVol = Math.max(1, ...quad.por_mes.map((m) => m.volume_falta_hl));
  const escopo = mes ? rotuloMes(mes) : "Quadrimestre (consolidado)";

  return (
    <>
      <div style={S.escopoBar}>
        <span style={S.escopoTxt}>📅 {escopo}</span>
        {mes && <button style={S.limpar} onClick={() => setMes("")}>ver quadrimestre ✕</button>}
        <span style={S.dica}>clique numa barra para filtrar o mês</span>
      </div>

      <div style={S.kpis}>
        <Kpi label="Volume em ruptura (HL)" valor={fmt(d.total_volume_falta_hl)} cor={VERMELHO} sub={escopo} />
        <Kpi label="Produtos afetados" valor={d.produtos_afetados} cor="#f5c451" />
        <Kpi label="Clientes afetados" valor={d.clientes_afetados} cor="#f5c451" />
      </div>

      <h3 style={S.h3}>Comparativo quadrimestre</h3>
      {quad.por_mes.length === 0 ? (
        <div style={S.vazio}>Sem histórico para comparar.</div>
      ) : (
        <div style={S.barras}>
          {quad.por_mes.map((m) => {
            const ativa = m.mes === mes;
            return (
              <button key={m.mes} style={S.barraCol} onClick={() => setMes(ativa ? "" : m.mes)} title="Filtrar este mês">
                <div style={{ ...S.barraValor, color: ativa ? VERDE : "rgba(255,255,255,0.7)" }}>{fmt(m.volume_falta_hl)}</div>
                <div style={S.barraTrack}>
                  <div style={{ ...S.barraFill, height: `${(m.volume_falta_hl / maxVol) * 100}%`, background: ativa ? VERDE : "rgba(239,111,111,0.7)" }} />
                </div>
                <div style={{ ...S.barraMes, color: ativa ? VERDE : "rgba(255,255,255,0.55)" }}>{rotuloMes(m.mes)}</div>
              </button>
            );
          })}
        </div>
      )}

      <div style={S.subAbas}>
        {[["produto", "Por produto"], ["cliente", `Top clientes (${d.clientes_afetados})`]].map(([k, t]) => (
          <button key={k} style={{ ...S.subTab, ...(sub === k ? S.subTabAtiva : {}) }} onClick={() => setSub(k)}>{t}</button>
        ))}
      </div>

      {sub === "produto" && (
        d.por_produto.length === 0 ? <div style={S.vazio}>Sem rupturas no escopo selecionado.</div> :
        <Tabela linhas={d.por_produto} colunas={[
          { k: "nome_produto", t: "Produto" },
          { k: "categoria", t: "Categoria" },
          { k: "qtd_faltas", t: "Ocorrências", num: true },
          { k: "volume_falta_hl", t: "Volume (HL)", num: true, fmt: (v) => fmt(v) },
        ]} />
      )}
      {sub === "cliente" && (
        d.por_cliente.length === 0 ? <div style={S.vazio}>Sem rupturas no escopo selecionado.</div> :
        <Tabela linhas={d.por_cliente} colunas={[
          { k: "cod_pdv", t: "Cód" },
          { k: "nome_pdv", t: "Cliente" },
          { k: "setor", t: "Setor" },
          { k: "qtd_faltas", t: "Ocorrências", num: true },
          { k: "volume_falta_hl", t: "Volume (HL)", num: true, fmt: (v) => fmt(v) },
        ]} />
      )}
    </>
  );
}

function Select({ label, value, onChange, opcoes, todos = "Todos", fmtOpt }) {
  return (
    <label style={S.selWrap}>
      <span style={S.selLabel}>{label}</span>
      <select style={S.select} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{todos}</option>
        {opcoes.map((o) => <option key={o} value={o}>{fmtOpt ? fmtOpt(o) : o}</option>)}
      </select>
    </label>
  );
}

const S = {
  root: { minHeight: "100vh", background: BG, fontFamily: "'Poppins','Segoe UI',system-ui,sans-serif", padding: "clamp(16px,4vw,28px)", maxWidth: "1000px", margin: "0 auto", color: "#fff" },
  header: { display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap", marginBottom: "18px" },
  voltar: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", padding: "8px 14px", borderRadius: "8px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.85rem" },
  titulo: { margin: 0, fontSize: "clamp(1.2rem,4vw,1.5rem)", fontWeight: "800" },
  sub: { margin: "2px 0 0", color: "rgba(255,255,255,0.45)", fontSize: "0.8rem" },
  abas: { display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" },
  tab: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", padding: "10px 18px", borderRadius: "10px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.9rem", fontWeight: "600" },
  tabAtiva: { background: "rgba(125,186,61,0.15)", borderColor: "rgba(125,186,61,0.5)", color: VERDE },
  filtros: { display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "16px" },
  selWrap: { display: "flex", flexDirection: "column", gap: "4px" },
  selLabel: { color: "rgba(255,255,255,0.5)", fontSize: "0.72rem", fontWeight: "600", paddingLeft: "2px" },
  select: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(125,186,61,0.3)", color: "#fff", padding: "9px 12px", borderRadius: "8px", fontFamily: "inherit", fontSize: "0.85rem", colorScheme: "dark", minWidth: "130px" },
  info: { color: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", gap: "10px", padding: "20px 0" },
  erro: { color: VERMELHO, padding: "16px", background: "rgba(239,68,68,0.1)", borderRadius: "10px" },
  vazio: { color: "rgba(255,255,255,0.55)", padding: "20px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", lineHeight: 1.6 },
  kpis: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "12px", marginBottom: "8px" },
  kpi: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "16px" },
  kpiValor: { fontSize: "1.45rem", fontWeight: "800", lineHeight: 1.1 },
  kpiLabel: { color: "rgba(255,255,255,0.6)", fontSize: "0.78rem", marginTop: "6px" },
  kpiSub: { color: "rgba(255,255,255,0.4)", fontSize: "0.72rem", marginTop: "2px" },
  escopoBar: { display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "14px" },
  escopoTxt: { color: VERDE, fontWeight: "700", fontSize: "0.9rem" },
  limpar: { background: "rgba(125,186,61,0.12)", border: "1px solid rgba(125,186,61,0.4)", color: VERDE, padding: "5px 12px", borderRadius: "8px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.78rem" },
  dica: { color: "rgba(255,255,255,0.35)", fontSize: "0.74rem", fontStyle: "italic", marginLeft: "auto" },
  h3: { margin: "20px 0 10px", fontSize: "1rem", fontWeight: "700" },
  subAbas: { display: "flex", gap: "6px", margin: "20px 0 12px", flexWrap: "wrap" },
  subTab: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", padding: "7px 14px", borderRadius: "20px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.8rem", fontWeight: "600" },
  subTabAtiva: { background: "rgba(125,186,61,0.15)", borderColor: "rgba(125,186,61,0.5)", color: VERDE },
  tabelaWrap: { overflowX: "auto", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px" },
  tabela: { width: "100%", borderCollapse: "collapse", fontSize: "0.84rem" },
  th: { padding: "10px 12px", color: "rgba(255,255,255,0.5)", fontWeight: "600", borderBottom: "1px solid rgba(255,255,255,0.1)", whiteSpace: "nowrap", background: "rgba(255,255,255,0.03)" },
  td: { padding: "9px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.85)", whiteSpace: "nowrap" },
  trAlt: { background: "rgba(255,255,255,0.02)" },
  barras: { display: "flex", gap: "10px", alignItems: "flex-end", padding: "16px", background: "rgba(255,255,255,0.03)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)" },
  barraCol: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", minWidth: "48px", background: "none", border: "none", cursor: "pointer", padding: "4px 2px", fontFamily: "inherit", borderRadius: "8px" },
  barraValor: { fontSize: "0.75rem", fontWeight: "600" },
  barraTrack: { height: "120px", width: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center" },
  barraFill: { width: "70%", maxWidth: "44px", borderRadius: "6px 6px 0 0", minHeight: "3px", transition: "height 0.3s" },
  barraMes: { fontSize: "0.74rem", fontWeight: "600" },
};

const CSS = `
.dh-spin { width:16px;height:16px;border:2px solid rgba(125,186,61,0.2);border-top-color:${VERDE};border-radius:50%;display:inline-block;animation:dh-rot .8s linear infinite; }
@keyframes dh-rot { to { transform: rotate(360deg); } }
[style] button:focus { outline: none; }
`;
