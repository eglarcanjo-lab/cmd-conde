// Detalhamento HOP — relatórios admin. Sub-abas: Entrega + Ruptura de Estoque.
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";

const VERDE = "#7DBA3D";
const BG = "#0c1410";

function mesAtualStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
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
  const [mes, setMes] = useState(mesAtualStr());
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [entrega, setEntrega] = useState(null);
  const [ruptura, setRuptura] = useState(null);

  useEffect(() => {
    let vivo = true;
    setLoading(true);
    setErro("");
    const url = aba === "entrega" ? "/api/detalhamento/entrega" : "/api/detalhamento/ruptura";
    api
      .get(url, { params: { mes } })
      .then((r) => {
        if (!vivo) return;
        if (aba === "entrega") setEntrega(r.data);
        else setRuptura(r.data);
      })
      .catch(() => vivo && setErro("Não consegui carregar os dados agora."))
      .finally(() => vivo && setLoading(false));
    return () => { vivo = false; };
  }, [aba, mes]);

  return (
    <div style={S.root}>
      <div style={S.header}>
        <button style={S.voltar} onClick={() => navigate("/")}>← Início</button>
        <div>
          <h1 style={S.titulo}>🌿 Detalhamento HOP</h1>
          <p style={S.sub}>Relatórios de análise · admin</p>
        </div>
        <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} style={S.mes} />
      </div>

      <div style={S.abas}>
        <button style={{ ...S.tab, ...(aba === "entrega" ? S.tabAtiva : {}) }} onClick={() => setAba("entrega")}>
          📦 Entrega
        </button>
        <button style={{ ...S.tab, ...(aba === "ruptura" ? S.tabAtiva : {}) }} onClick={() => setAba("ruptura")}>
          📉 Ruptura de Estoque
        </button>
      </div>

      {loading && <div style={S.info}><span className="dh-spin" /> Carregando…</div>}
      {erro && !loading && <div style={S.erro}>{erro}</div>}

      {!loading && !erro && aba === "entrega" && <Entrega d={entrega} />}
      {!loading && !erro && aba === "ruptura" && <Ruptura d={ruptura} />}

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

function Entrega({ d }) {
  if (!d) return null;
  if (!d.tem_dados)
    return (
      <div style={S.vazio}>
        Nenhum dado de entrega ainda. Importe o <b>relatório de Devoluções</b> (Admin › Arquivos)
        e reimporte os <b>Pedidos</b> para gerar as efetivadas.
      </div>
    );
  const taxa = d.taxa_frustracao_pct;
  return (
    <>
      <div style={S.kpis}>
        <Kpi label="Volume efetivado (HL)" valor={fmt(d.volume_efetivado_hl)} cor={VERDE} />
        <Kpi label="Volume frustrado (HL)" valor={fmt(d.volume_frustrado_hl)} cor="#ef6f6f" sub={`${d.qtd_frustradas} notas`} />
        <Kpi label="Taxa de frustração" valor={taxa == null ? "—" : `${fmt(taxa)}%`} cor={taxa > 5 ? "#ef6f6f" : "#f5c451"} />
        <Kpi label="Valor frustrado" valor={fmtMoeda(d.valor_frustrado)} cor="#ef6f6f" />
      </div>

      <h3 style={S.h3}>Motivos das frustradas</h3>
      {d.por_motivo.length === 0 ? (
        <div style={S.vazio}>Sem devoluções no mês selecionado.</div>
      ) : (
        <Tabela
          colunas={[
            { k: "desc_motivo", t: "Motivo" },
            { k: "qtd", t: "Notas", num: true },
            { k: "volume_hl", t: "Volume (HL)", num: true, fmt: (v) => fmt(v) },
            { k: "valor", t: "Valor", num: true, fmt: fmtMoeda },
          ]}
          linhas={d.por_motivo}
        />
      )}

      <h3 style={S.h3}>Detalhe por nota <span style={S.h3sub}>(top {Math.min(d.detalhe.length, 500)})</span></h3>
      {d.detalhe.length === 0 ? (
        <div style={S.vazio}>Sem notas frustradas no mês.</div>
      ) : (
        <Tabela
          colunas={[
            { k: "setor", t: "Setor" },
            { k: "data", t: "Data" },
            { k: "nota", t: "Nota" },
            { k: "nome_pdv", t: "Cliente" },
            { k: "desc_motivo", t: "Motivo" },
            { k: "volume_hl", t: "Vol (HL)", num: true, fmt: (v) => fmt(v) },
            { k: "valor", t: "Valor", num: true, fmt: fmtMoeda },
          ]}
          linhas={d.detalhe}
        />
      )}
    </>
  );
}

function Ruptura({ d }) {
  if (!d) return null;
  if (!d.tem_dados)
    return (
      <div style={S.vazio}>
        Nenhuma ruptura registrada. Reimporte os <b>Pedidos</b> (o processador identifica os
        produtos marcados com falta).
      </div>
    );
  const quad = d.quadrimestre || { meses: [], por_mes: [] };
  const maxVol = Math.max(1, ...quad.por_mes.map((m) => m.volume_falta_hl));
  return (
    <>
      <div style={S.kpis}>
        <Kpi label="Volume em ruptura (HL)" valor={fmt(d.total_volume_falta_hl)} cor="#ef6f6f" sub={`mês ${rotuloMes(d.mes)}`} />
        <Kpi label="Produtos afetados" valor={d.produtos_afetados} cor="#f5c451" />
      </div>

      <h3 style={S.h3}>Comparativo quadrimestre</h3>
      {quad.por_mes.length === 0 ? (
        <div style={S.vazio}>Sem histórico para comparar.</div>
      ) : (
        <div style={S.barras}>
          {quad.por_mes.map((m) => (
            <div key={m.mes} style={S.barraCol}>
              <div style={S.barraValor}>{fmt(m.volume_falta_hl)}</div>
              <div style={S.barraTrack}>
                <div style={{ ...S.barraFill, height: `${(m.volume_falta_hl / maxVol) * 100}%`, background: m.mes === d.mes ? VERDE : "rgba(239,111,111,0.7)" }} />
              </div>
              <div style={{ ...S.barraMes, color: m.mes === d.mes ? VERDE : "rgba(255,255,255,0.5)" }}>{rotuloMes(m.mes)}</div>
            </div>
          ))}
        </div>
      )}

      <h3 style={S.h3}>Produtos com falta <span style={S.h3sub}>({rotuloMes(d.mes)})</span></h3>
      {d.por_produto.length === 0 ? (
        <div style={S.vazio}>Sem rupturas no mês selecionado.</div>
      ) : (
        <Tabela
          colunas={[
            { k: "nome_produto", t: "Produto" },
            { k: "categoria", t: "Categoria" },
            { k: "qtd_faltas", t: "Ocorrências", num: true },
            { k: "volume_falta_hl", t: "Volume (HL)", num: true, fmt: (v) => fmt(v) },
          ]}
          linhas={d.por_produto}
        />
      )}
    </>
  );
}

function Tabela({ colunas, linhas }) {
  return (
    <div style={S.tabelaWrap}>
      <table style={S.tabela}>
        <thead>
          <tr>
            {colunas.map((c) => (
              <th key={c.k} style={{ ...S.th, textAlign: c.num ? "right" : "left" }}>{c.t}</th>
            ))}
          </tr>
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

const S = {
  root: { minHeight: "100vh", background: BG, fontFamily: "'Poppins','Segoe UI',system-ui,sans-serif", padding: "clamp(16px,4vw,28px)", maxWidth: "1000px", margin: "0 auto", color: "#fff" },
  header: { display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap", marginBottom: "18px" },
  voltar: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", padding: "8px 14px", borderRadius: "8px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.85rem" },
  titulo: { margin: 0, fontSize: "clamp(1.2rem,4vw,1.5rem)", fontWeight: "800" },
  sub: { margin: "2px 0 0", color: "rgba(255,255,255,0.45)", fontSize: "0.8rem" },
  mes: { marginLeft: "auto", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(125,186,61,0.3)", color: "#fff", padding: "8px 12px", borderRadius: "8px", fontFamily: "inherit", colorScheme: "dark" },
  abas: { display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" },
  tab: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", padding: "10px 18px", borderRadius: "10px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.9rem", fontWeight: "600" },
  tabAtiva: { background: "rgba(125,186,61,0.15)", borderColor: "rgba(125,186,61,0.5)", color: VERDE },
  info: { color: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", gap: "10px", padding: "20px 0" },
  erro: { color: "#ef6f6f", padding: "16px", background: "rgba(239,68,68,0.1)", borderRadius: "10px" },
  vazio: { color: "rgba(255,255,255,0.55)", padding: "20px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", lineHeight: 1.6 },
  kpis: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "12px", marginBottom: "8px" },
  kpi: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "16px" },
  kpiValor: { fontSize: "1.5rem", fontWeight: "800", lineHeight: 1.1 },
  kpiLabel: { color: "rgba(255,255,255,0.6)", fontSize: "0.78rem", marginTop: "6px" },
  kpiSub: { color: "rgba(255,255,255,0.4)", fontSize: "0.72rem", marginTop: "2px" },
  h3: { margin: "24px 0 10px", fontSize: "1rem", fontWeight: "700" },
  h3sub: { color: "rgba(255,255,255,0.4)", fontWeight: "400", fontSize: "0.8rem" },
  tabelaWrap: { overflowX: "auto", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px" },
  tabela: { width: "100%", borderCollapse: "collapse", fontSize: "0.84rem" },
  th: { padding: "10px 12px", color: "rgba(255,255,255,0.5)", fontWeight: "600", borderBottom: "1px solid rgba(255,255,255,0.1)", whiteSpace: "nowrap", background: "rgba(255,255,255,0.03)" },
  td: { padding: "9px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.85)", whiteSpace: "nowrap" },
  trAlt: { background: "rgba(255,255,255,0.02)" },
  barras: { display: "flex", gap: "12px", alignItems: "flex-end", padding: "16px", background: "rgba(255,255,255,0.03)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)" },
  barraCol: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", minWidth: "48px" },
  barraValor: { fontSize: "0.75rem", color: "rgba(255,255,255,0.7)", fontWeight: "600" },
  barraTrack: { height: "120px", width: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center" },
  barraFill: { width: "70%", maxWidth: "44px", borderRadius: "6px 6px 0 0", minHeight: "3px", transition: "height 0.3s" },
  barraMes: { fontSize: "0.74rem", fontWeight: "600" },
};

const CSS = `
.dh-spin { width:16px;height:16px;border:2px solid rgba(125,186,61,0.2);border-top-color:${VERDE};border-radius:50%;display:inline-block;animation:dh-rot .8s linear infinite; }
@keyframes dh-rot { to { transform: rotate(360deg); } }
`;
