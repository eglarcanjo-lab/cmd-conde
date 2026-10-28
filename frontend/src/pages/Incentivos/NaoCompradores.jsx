// Outros relatórios › 🛒 Não compradores do mês  ·  🆕 Novos cadastros (sem compra).
//   • Não compradores: PDVs ATIVOS da base sem compra no mês + o SKU que o PDV mais comprou no
//     tri anterior (M-3..M-1) — argumento de venda p/ a visita. Sem compra no tri = SKU vazio.
//   • Novos cadastros: PDVs com "Data de Cadastro" (base de clientes) no mês e sem compra
//     registrada desde o cadastro.
// Dados: GET /api/relatorios/nao-compradores | /novos-cadastros ?mes=YYYY-MM (escopo do perfil).
// Compra = venda/bonificação entregue, inclusive itens de 0 HL (mesma regra da Liga/Cobertura).
import { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx-js-style";
import api from "../../services/api";

const VERDE = "#7DBA3D";
const NOMES_MES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const rot = (ym) => `${NOMES_MES[Number(ym.slice(5, 7)) - 1]}/${ym.slice(2, 4)}`;
const fmtHl = (v) => (v == null ? "" : Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 3 }));
// Chave de ordenação: dd/mm/aaaa → aaaammdd; colunas numéricas como número; vazio sempre no fim.
const NUMERICAS = ["sku_hl_tri", "sku_meses"];
const chave = (k, v) => {
  if (v == null || v === "") return null;
  if (NUMERICAS.includes(k)) return Number(v);
  const dt = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(String(v));
  return dt ? `${dt[3]}${dt[2]}${dt[1]}` : String(v);
};
const ultimosMeses = (n) => {
  const d = new Date(); const out = [];
  for (let k = 0; k < n; k++) { const x = new Date(d.getFullYear(), d.getMonth() - k, 1); out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`); }
  return out;
};

const MODOS = {
  nao: {
    url: "/api/relatorios/nao-compradores", arquivo: "Nao_compradores",
    cols: [["setor", "Setor"], ["rn", "RN"], ["cod_pdv", "Cód. PDV"], ["nome", "PDV"], ["cidade", "Cidade"], ["bairro", "Bairro"],
      ["dia_visita", "Dia visita"], ["ultima_compra", "Última compra (base)"], ["sku_cod", "Cód. SKU top tri"], ["sku_nome", "SKU mais comprado no tri"],
      ["sku_hl_tri", "HL do SKU no tri"], ["sku_meses", "Meses c/ o SKU (de 3)"]],
  },
  novos: {
    url: "/api/relatorios/novos-cadastros", arquivo: "Novos_cadastros_sem_compra",
    cols: [["setor", "Setor"], ["rn", "RN"], ["cod_pdv", "Cód. PDV"], ["nome", "PDV"], ["razao", "Razão social"], ["cidade", "Cidade"],
      ["bairro", "Bairro"], ["dia_visita", "Dia visita"], ["data_cadastro", "Data de cadastro"]],
  },
};

export default function NaoCompradores({ modo = "nao" }) {
  const M = MODOS[modo];
  const meses = useMemo(() => ultimosMeses(modo === "novos" ? 6 : 3), [modo]);
  const [mes, setMes] = useState(meses[0]);
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [setor, setSetor] = useState("");
  const [busca, setBusca] = useState("");
  const [sort, setSort] = useState({ k: null, dir: "asc" });
  const ordenar = (k) => setSort((s) => ({ k, dir: s.k === k && s.dir === "asc" ? "desc" : "asc" }));

  useEffect(() => {
    setD(null); setErro("");
    api.get(M.url, { params: { mes }, timeout: 60000 })
      .then((r) => setD(r.data))
      .catch((e) => setErro(e?.response?.data?.error || "Erro ao carregar o relatório."));
  }, [M.url, mes]);

  const linhas = useMemo(() => {
    if (!d) return [];
    const q = busca.trim().toLowerCase();
    const f = d.linhas.filter((l) => (!setor || l.setor === setor) &&
      (!q || `${l.cod_pdv} ${l.nome} ${l.cidade} ${l.bairro} ${l.sku_nome || ""}`.toLowerCase().includes(q)));
    if (!sort.k) return f;
    const sinal = sort.dir === "asc" ? 1 : -1;
    return [...f].sort((a, b) => {
      const x = chave(sort.k, a[sort.k]), y = chave(sort.k, b[sort.k]);
      if (x == null || y == null) return x == null ? (y == null ? 0 : 1) : -1;
      return sinal * (typeof x === "number" ? x - y : x.localeCompare(y, "pt-BR", { numeric: true }));
    });
  }, [d, setor, busca, sort]);

  function exportar() {
    const head = M.cols.map(([, h]) => h);
    const aoa = [head, ...linhas.map((l) => M.cols.map(([k]) => (l[k] == null ? "" : l[k])))];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    head.forEach((_, c) => { const a = XLSX.utils.encode_cell({ r: 0, c }); ws[a].s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "2E7D32" } }, alignment: { horizontal: "center", wrapText: true } }; });
    ws["!cols"] = M.cols.map(([k]) => ({ wch: ["nome", "razao", "sku_nome"].includes(k) ? 36 : k === "rn" ? 18 : 12 }));
    ws["!autofilter"] = { ref: XLSX.utils.encode_range({ r: 0, c: 0 }, { r: aoa.length - 1, c: head.length - 1 }) };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, modo === "nao" ? "Não compradores" : "Novos cadastros");
    XLSX.writeFile(wb, `${M.arquivo}_${mes}${setor ? `_setor${setor}` : ""}.xlsx`);
  }

  const resumo = !d ? null : modo === "nao" ? (
    <>
      <Kpi rot="PDVs na base" v={d.base} />
      <Kpi rot={`Compraram em ${rot(d.mes)}`} v={d.compraram} cor={VERDE} />
      <Kpi rot="Ainda não compraram" v={d.linhas.length} cor="#f87171" />
      <Kpi rot="Sem compra também no tri" v={d.linhas.filter((l) => !l.sku_cod).length} cor="rgba(255,255,255,0.6)" />
    </>
  ) : (
    <>
      <Kpi rot={`Cadastrados em ${rot(d.mes)}`} v={d.novos} />
      <Kpi rot="Já compraram" v={d.com_compra} cor={VERDE} />
      <Kpi rot="Sem compra registrada" v={d.linhas.length} cor="#f87171" />
    </>
  );

  return (
    <div style={S.box}>
      <p style={S.nota}>
        {modo === "nao"
          ? "PDVs ativos da base que ainda não compraram no mês, com o SKU que cada um mais comprou no trimestre anterior (por HL). \"Meses c/ o SKU (de 3)\" = em quantos dos 3 meses do tri o PDV comprou esse SKU (3 = compra todo mês). Quem não comprou nada no tri fica sem SKU."
          : "PDVs com Data de Cadastro no mês (base de clientes) que ainda não têm compra registrada."}
        {" "}Compra = venda ou bonificação entregue, inclusive itens de 0 HL. Clique no cabeçalho para ordenar.
      </p>
      <div style={S.filtros}>
        {meses.map((m) => <button key={m} onClick={() => setMes(m)} style={S.chip(m === mes)}>{rot(m)}</button>)}
        {d && d.setores.length > 1 && (
          <select value={setor} onChange={(e) => setSetor(e.target.value)} style={S.sel}>
            <option value="">Todos os setores</option>
            {d.setores.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        <input placeholder="Buscar PDV, cidade, SKU…" value={busca} onChange={(e) => setBusca(e.target.value)} style={S.inp} />
        {linhas.length > 0 && <button onClick={exportar} style={S.chip(false)}>📥 Excel</button>}
      </div>
      {erro ? <p style={S.nota}>{erro}</p> : !d ? <p style={S.nota}>Carregando…</p> : (
        <>
          {modo === "novos" && !d.tem_data_cadastro && (
            <p style={{ ...S.nota, color: "#f5c451" }}>⚠️ A base de clientes ainda não tem a Data de Cadastro — reimporte a <b>Base de Clientes (0105070402)</b>.</p>
          )}
          <div style={S.kpis}>{resumo}</div>
          {d && modo === "nao" && <p style={S.nota}>Tri considerado: {d.tri.map(rot).join(" · ")}</p>}
          <div style={S.wrap}>
            <table style={S.table}>
              <thead><tr>{M.cols.map(([k, h]) => (
                <th key={k} onClick={() => ordenar(k)} title="Clique para ordenar"
                  style={{ ...S.th, cursor: "pointer", userSelect: "none", ...(sort.k === k ? { color: "#fff" } : {}) }}>
                  {h}{sort.k === k ? (sort.dir === "asc" ? " ▲" : " ▼") : " ⇅"}
                </th>
              ))}</tr></thead>
              <tbody>
                {linhas.slice(0, 500).map((l) => (
                  <tr key={l.cod_pdv} style={S.tr}>
                    {M.cols.map(([k]) => (
                      <td key={k} style={{ ...S.td, ...(k === "nome" || k === "sku_nome" || k === "razao" ? { textAlign: "left" } : {}),
                        ...(k === "sku_nome" && !l.sku_cod ? { color: "rgba(255,255,255,0.3)" } : {}) }}>
                        {k === "sku_hl_tri" ? fmtHl(l[k]) : k === "sku_nome" && !l.sku_cod ? "— sem compra no tri" : k === "sku_meses" && !l.sku_cod ? "" : l[k]}
                      </td>
                    ))}
                  </tr>
                ))}
                {!linhas.length && <tr><td colSpan={M.cols.length} style={{ ...S.td, padding: 16 }}>Nenhum PDV.</td></tr>}
              </tbody>
            </table>
          </div>
          {linhas.length > 500 && <p style={S.nota}>Mostrando 500 de {linhas.length} — baixe o Excel para ver todos.</p>}
        </>
      )}
    </div>
  );
}

function Kpi({ rot: r, v, cor }) {
  return (
    <div style={S.kpi}>
      <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.5)" }}>{r}</div>
      <div style={{ fontSize: "1.4rem", fontWeight: 800, color: cor || "#fff" }}>{Number(v || 0).toLocaleString("pt-BR")}</div>
    </div>
  );
}

const S = {
  box: { padding: "4px 0" },
  nota: { fontSize: "0.76rem", color: "rgba(255,255,255,0.5)", margin: "4px 0 10px", lineHeight: 1.5 },
  filtros: { display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 12 },
  chip: (on) => ({ fontSize: "0.8rem", fontFamily: "inherit", color: on ? "#0c1410" : "rgba(255,255,255,0.65)", background: on ? VERDE : "transparent", border: `1px solid ${on ? VERDE : "rgba(255,255,255,0.15)"}`, borderRadius: 20, padding: "5px 13px", cursor: "pointer", fontWeight: on ? 700 : 500 }),
  sel: { fontSize: "0.8rem", fontFamily: "inherit", color: "#fff", background: "#13231a", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 20, padding: "5px 10px" },
  inp: { fontSize: "0.8rem", fontFamily: "inherit", color: "#fff", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 20, padding: "5px 12px", minWidth: 200 },
  kpis: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, marginBottom: 10 },
  kpi: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 12px" },
  wrap: { overflowX: "auto", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10 },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.55)", fontSize: "0.7rem", fontWeight: 600, padding: "8px", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap" },
  tr: { borderBottom: "1px solid rgba(255,255,255,0.05)" },
  td: { padding: "6px 8px", fontSize: "0.78rem", textAlign: "center", color: "rgba(255,255,255,0.85)", whiteSpace: "nowrap" },
};
