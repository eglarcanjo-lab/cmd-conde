// Detalhamento HOP — relatórios admin. Sub-abas: Entrega + Ruptura de Estoque.
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx-js-style";
import api from "../../services/api";

const VERDE = "#7DBA3D";
const VERMELHO = "#ef6f6f";
const AMARELO = "#f5c451";
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
const toBR = (iso) => { if (!iso) return ""; const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; };
const toISO = (br) => { if (!br || !br.includes("/")) return ""; const [d, m, y] = br.split("/"); return `${y}-${m}-${d}`; };
const dataMs = (s) => {
  if (!s || !String(s).includes("/")) return 0;
  const [dd, mm, yy] = String(s).split("/");
  return new Date(Number(yy), Number(mm) - 1, Number(dd)).getTime() || 0;
};

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
        <button style={{ ...S.tab, ...(aba === "entrega" ? S.tabAtiva : {}) }} onClick={() => setAba("entrega")}>📦 Entrega</button>
        <button style={{ ...S.tab, ...(aba === "ruptura" ? S.tabAtiva : {}) }} onClick={() => setAba("ruptura")}>📉 Ruptura de Estoque</button>
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

// Tabela ordenável: clique no cabeçalho ordena (num/data desc, texto asc), alterna.
function Tabela({ colunas, linhas, onRow, inicial }) {
  const [sort, setSort] = useState(inicial || { k: null, dir: "desc" });
  const ordenadas = useMemo(() => {
    if (!sort.k) return linhas;
    const col = colunas.find((c) => c.k === sort.k) || {};
    const arr = [...linhas];
    arr.sort((a, b) => {
      let r;
      if (col.num) r = (Number(a[sort.k]) || 0) - (Number(b[sort.k]) || 0);
      else if (col.date) r = dataMs(a[sort.k]) - dataMs(b[sort.k]);
      else r = String(a[sort.k] ?? "").localeCompare(String(b[sort.k] ?? ""), "pt-BR", { sensitivity: "base", numeric: true });
      return sort.dir === "asc" ? r : -r;
    });
    return arr;
  }, [linhas, sort, colunas]);

  const clicar = (c) => {
    setSort((s) => (s.k === c.k ? { k: c.k, dir: s.dir === "asc" ? "desc" : "asc" } : { k: c.k, dir: c.num || c.date ? "desc" : "asc" }));
  };

  return (
    <div style={S.tabelaWrap}>
      <table style={S.tabela}>
        <thead>
          <tr>
            {colunas.map((c) => (
              <th key={c.k} style={{ ...S.th, textAlign: c.num ? "right" : "left", cursor: "pointer" }} onClick={() => clicar(c)}>
                {c.t}{sort.k === c.k ? (sort.dir === "asc" ? " ▲" : " ▼") : " ⇅"}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ordenadas.map((l, i) => (
            <tr key={i} style={{ ...(i % 2 ? S.trAlt : {}), ...(onRow ? S.trClick : {}) }} onClick={onRow ? () => onRow(l) : undefined}>
              {colunas.map((c) => (
                <td key={c.k} style={{ ...S.td, textAlign: c.num ? "right" : "left" }}>{c.fmt ? c.fmt(l[c.k]) : l[c.k]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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

// ─────────────────────────────── ENTREGA ───────────────────────────────
function Entrega() {
  const [mes, setMes] = useState("");
  const [dia, setDia] = useState(""); // dd/mm/yyyy
  const [setor, setSetor] = useState("");
  const [motivo, setMotivo] = useState("");
  const [pdvInput, setPdvInput] = useState("");
  const [pdv, setPdv] = useState("");
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [sub, setSub] = useState("motivo");
  const [nota, setNota] = useState(null); // { numero, info, itens, loading }

  useEffect(() => {
    const t = setTimeout(() => setPdv(pdvInput.trim()), 400);
    return () => clearTimeout(t);
  }, [pdvInput]);

  useEffect(() => {
    let vivo = true;
    setLoading(true); setErro("");
    api.get("/api/detalhamento/entrega", { params: { mes, dia, setor, motivo, pdv } })
      .then((r) => vivo && setD(r.data))
      .catch(() => vivo && setErro("Não consegui carregar os dados de entrega."))
      .finally(() => vivo && setLoading(false));
    return () => { vivo = false; };
  }, [mes, dia, setor, motivo, pdv]);

  async function abrirNota(linha) {
    if (!linha.nota) return;
    setNota({ numero: linha.nota, info: linha, itens: [], loading: true });
    try {
      const r = await api.get("/api/detalhamento/nota", { params: { nota: linha.nota } });
      setNota({ numero: linha.nota, info: linha, itens: r.data?.itens || [], loading: false });
    } catch {
      setNota({ numero: linha.nota, info: linha, itens: [], loading: false, erro: true });
    }
  }

  function rotuloEscopo() {
    const partes = [];
    if (dia) partes.push(`dia ${dia}`);
    else if (mes) partes.push(`mês ${mes}`);
    else partes.push("quadrimestre");
    if (setor) partes.push(`setor ${setor}`);
    if (motivo) partes.push(`motivo ${motivo}`);
    if (pdv) partes.push(`PDV "${pdv}"`);
    return partes.join(" · ");
  }

  function exportarExcel() {
    const wb = XLSX.utils.book_new();
    const escopo = rotuloEscopo();
    const resumo = [
      ["DEVOLUÇÕES — RELATÓRIO DETALHADO"], [`Escopo: ${escopo}`], [`Gerado em: ${new Date().toLocaleString("pt-BR")}`], [],
      ["Volume efetivado (HL)", d.volume_efetivado_hl ?? "—"],
      ["Volume frustrado (HL)", d.volume_frustrado_hl],
      ["Valor frustrado (R$)", d.valor_frustrado],
      ["Notas frustradas", d.qtd_frustradas],
      ["Taxa de frustração (%)", d.taxa_frustracao_pct ?? "—"],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumo), "Resumo");
    const add = (nome, linhas) => { if (linhas && linhas.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhas), nome); };
    add("Por Caminhão", d.por_caminhao);
    add("Por Dia", d.por_dia);
    add("Por Dia Semana", (d.por_dia_semana || []).map(({ _wd, ...x }) => x));
    add("Por PDV", d.por_pdv);
    add("Por Produto", d.por_produto);
    add("Por Setor", d.por_setor);
    add("Por Motivo", d.por_motivo);
    add("Detalhe", d.detalhe);
    XLSX.writeFile(wb, `devolucoes_${(dia || mes || "quadrimestre").replace(/\//g, "-")}.xlsx`);
  }

  function abrirPdf() {
    const p = new URLSearchParams();
    if (mes) p.set("mes", mes);
    if (dia) p.set("dia", dia);
    if (setor) p.set("setor", setor);
    if (motivo) p.set("motivo", motivo);
    if (pdv) p.set("pdv", pdv);
    window.open(`/detalhamento/entrega-relatorio?${p.toString()}`, "_blank");
  }

  if (loading && !d) return <div style={S.info}><span className="dh-spin" /> Carregando…</div>;
  if (erro) return <div style={S.erro}>{erro}</div>;
  if (!d) return null;
  if (!d.tem_dados)
    return <div style={S.vazio}>Nenhum dado de entrega ainda. Importe o <b>relatório de Devoluções</b> (Admin › Arquivos — acumula vários meses) e reimporte os <b>Pedidos</b> para gerar as efetivadas.</div>;

  const op = d.opcoes || { meses: [], setores: [], motivos: [] };
  const taxa = d.taxa_frustracao_pct;
  return (
    <>
      <div style={S.filtros}>
        <Select label="Mês" value={mes} onChange={setMes} opcoes={op.meses} fmtOpt={rotuloMes} todos="Quadrimestre" />
        <label style={S.selWrap}>
          <span style={S.selLabel}>Dia</span>
          <input type="date" style={S.select} value={toISO(dia)} onChange={(e) => { setDia(toBR(e.target.value)); setMes(""); }} />
        </label>
        <Select label="Setor" value={setor} onChange={setSetor} opcoes={op.setores} todos="Todos" />
        <Select label="Motivo" value={motivo} onChange={setMotivo} opcoes={op.motivos} todos="Todos" />
        <label style={S.selWrap}>
          <span style={S.selLabel}>PDV (código ou nome)</span>
          <input style={S.select} value={pdvInput} onChange={(e) => setPdvInput(e.target.value)} placeholder="ex: 20296 ou geladão" />
        </label>
        {dia && <button style={S.limparDia} onClick={() => setDia("")}>limpar dia ✕</button>}
      </div>

      <div style={S.kpis}>
        <Kpi label="Volume efetivado (HL)" valor={d.volume_efetivado_hl == null ? "—" : fmt(d.volume_efetivado_hl)} cor={VERDE} sub={dia ? "n/d por dia" : null} />
        <Kpi label="Volume frustrado (HL)" valor={fmt(d.volume_frustrado_hl)} cor={VERMELHO} sub={`${d.qtd_frustradas} notas`} />
        <Kpi label="Taxa de frustração" valor={taxa == null ? "—" : `${fmt(taxa)}%`} cor={taxa > 5 ? VERMELHO : AMARELO} />
        <Kpi label="Valor frustrado" valor={fmtMoeda(d.valor_frustrado)} cor={VERMELHO} />
      </div>

      <div style={S.exportBar}>
        <span style={S.exportLbl}>📥 Relatório detalhado ({rotuloEscopo()}):</span>
        <button style={S.btnExcel} onClick={exportarExcel}>📊 Excel</button>
        <button style={S.btnPdf} onClick={abrirPdf}>📄 PDF</button>
      </div>

      <div style={S.subAbas}>
        {[["motivo", "Por motivo"], ["setor", "Por setor"], ["caminhao", "Por caminhão"], ["dia", "Por dia"], ["produto", "Por produto"], ["pdv", "Por PDV"], ["detalhe", "Detalhe"]].map(([k, t]) => (
          <button key={k} style={{ ...S.subTab, ...(sub === k ? S.subTabAtiva : {}) }} onClick={() => setSub(k)}>{t}</button>
        ))}
      </div>

      {sub === "caminhao" && <Tabela inicial={{ k: "volume_hl", dir: "desc" }} linhas={d.por_caminhao} colunas={[
        { k: "placa", t: "Caminhão (placa)" }, { k: "qtd", t: "Notas", num: true },
        { k: "volume_hl", t: "Volume (HL)", num: true, fmt: (v) => fmt(v) }, { k: "valor", t: "Valor", num: true, fmt: fmtMoeda }]} />}
      {sub === "dia" && <Tabela inicial={{ k: "data", dir: "asc" }} linhas={d.por_dia} colunas={[
        { k: "data", t: "Data", date: true }, { k: "qtd", t: "Notas", num: true },
        { k: "volume_hl", t: "Volume (HL)", num: true, fmt: (v) => fmt(v) }, { k: "valor", t: "Valor", num: true, fmt: fmtMoeda }]} />}
      {sub === "produto" && <Tabela inicial={{ k: "volume_hl", dir: "desc" }} linhas={d.por_produto} colunas={[
        { k: "cod_produto", t: "Cód" }, { k: "nome_produto", t: "Produto" }, { k: "notas", t: "Notas", num: true },
        { k: "volume_hl", t: "Volume (HL)", num: true, fmt: (v) => fmt(v) }]} />}

      {sub === "motivo" && <Tabela inicial={{ k: "volume_hl", dir: "desc" }} linhas={d.por_motivo} colunas={[
        { k: "desc_motivo", t: "Motivo" }, { k: "qtd", t: "Notas", num: true },
        { k: "volume_hl", t: "Volume (HL)", num: true, fmt: (v) => fmt(v) }, { k: "valor", t: "Valor", num: true, fmt: fmtMoeda }]} />}
      {sub === "setor" && <Tabela inicial={{ k: "volume_hl", dir: "desc" }} linhas={d.por_setor} colunas={[
        { k: "setor", t: "Setor" }, { k: "qtd", t: "Notas", num: true },
        { k: "volume_hl", t: "Volume (HL)", num: true, fmt: (v) => fmt(v) }, { k: "valor", t: "Valor", num: true, fmt: fmtMoeda }]} />}
      {sub === "pdv" && <Tabela inicial={{ k: "volume_hl", dir: "desc" }} linhas={d.por_pdv} colunas={[
        { k: "cod_pdv", t: "Cód" }, { k: "nome_pdv", t: "Cliente" }, { k: "setor", t: "Setor" },
        { k: "qtd", t: "Notas", num: true }, { k: "volume_hl", t: "Volume (HL)", num: true, fmt: (v) => fmt(v) }, { k: "valor", t: "Valor", num: true, fmt: fmtMoeda }]} />}
      {sub === "detalhe" && (
        <>
          <div style={S.dicaLinha}>👆 clique numa linha para abrir os itens da nota fiscal</div>
          <Tabela inicial={{ k: "volume_hl", dir: "desc" }} onRow={abrirNota} linhas={d.detalhe} colunas={[
            { k: "setor", t: "Setor" }, { k: "data", t: "Data", date: true }, { k: "nota", t: "Nota" },
            { k: "nome_pdv", t: "Cliente" }, { k: "desc_motivo", t: "Motivo" },
            { k: "volume_hl", t: "Vol (HL)", num: true, fmt: (v) => fmt(v) }, { k: "valor", t: "Valor", num: true, fmt: fmtMoeda }]} />
        </>
      )}

      {nota && (
        <div style={S.modalScrim} onClick={() => setNota(null)}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <div style={S.modalHead}>
              <div>
                <div style={S.modalTit}>Nota {nota.numero}</div>
                <div style={S.modalSub}>{nota.info.nome_pdv} · setor {nota.info.setor} · {nota.info.data} · {nota.info.desc_motivo}</div>
              </div>
              <button style={S.fechar} onClick={() => setNota(null)}>✕</button>
            </div>
            {nota.loading ? (
              <div style={S.info}><span className="dh-spin" /> Carregando itens…</div>
            ) : nota.itens.length === 0 ? (
              <div style={S.vazio}>Não encontrei os itens dessa nota nos pedidos. Reimporte os <b>Pedidos</b> do período (os itens vêm da base de pedidos pela Nota Fiscal).</div>
            ) : (
              <Tabela inicial={{ k: "volume_marcacao_hl", dir: "desc" }} linhas={nota.itens} colunas={[
                { k: "cod_produto", t: "Cód" }, { k: "nome_produto", t: "Produto" },
                { k: "volume_marcacao_hl", t: "Volume (HL)", num: true, fmt: (v) => fmt(v, 2) }]} />
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────── RUPTURA ───────────────────────────────
function Ruptura() {
  const [mes, setMes] = useState("");
  const [dia, setDia] = useState(""); // dd/mm/yyyy
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [sub, setSub] = useState("produto");
  const [drill, setDrill] = useState(null); // { tipo, chave, nome }

  useEffect(() => {
    let vivo = true;
    setLoading(true); setErro(""); setDrill(null);
    api.get("/api/detalhamento/ruptura", { params: { mes, dia } })
      .then((r) => vivo && setD(r.data))
      .catch(() => vivo && setErro("Não consegui carregar os dados de ruptura."))
      .finally(() => vivo && setLoading(false));
    return () => { vivo = false; };
  }, [mes, dia]);

  if (loading && !d) return <div style={S.info}><span className="dh-spin" /> Carregando…</div>;
  if (erro) return <div style={S.erro}>{erro}</div>;
  if (!d) return null;
  if (!d.tem_dados)
    return <div style={S.vazio}>Nenhuma ruptura registrada. Reimporte os <b>Pedidos</b> (o processador identifica os produtos marcados com falta no quadrimestre).</div>;

  const quad = d.quadrimestre || { meses: [], por_mes: [], media: 0 };
  const media = quad.media || 0;
  const escala = Math.max(1, ...quad.por_mes.map((m) => m.volume_falta_hl), media) * 1.12;
  const escopo = dia ? `dia ${dia}` : mes ? rotuloMes(mes) : "Quadrimestre (consolidado)";
  const corBarra = (v) => (v >= media && media > 0 ? VERMELHO : v >= 0.9 * media && media > 0 ? AMARELO : VERDE);

  // Drill-down a partir do detalhe do escopo
  const detalheDrill = (() => {
    if (!drill) return null;
    if (drill.tipo === "produto") {
      const linhas = d.detalhe.filter((r) => String(r.cod_produto) === String(drill.chave))
        .map((r) => ({ nome_pdv: r.nome_pdv, cod_pdv: r.cod_pdv, setor: r.setor, data: r.data, volume_falta_hl: r.volume_falta_hl }))
        .sort((a, b) => b.volume_falta_hl - a.volume_falta_hl);
      return { titulo: `Clientes afetados · ${drill.nome}`, linhas, cols: [
        { k: "cod_pdv", t: "Cód" }, { k: "nome_pdv", t: "Cliente" }, { k: "setor", t: "Setor" },
        { k: "data", t: "Data", date: true }, { k: "volume_falta_hl", t: "Volume (HL)", num: true, fmt: (v) => fmt(v, 2) }] };
    }
    // cliente → top produtos
    const m = {};
    d.detalhe.filter((r) => String(r.cod_pdv) === String(drill.chave)).forEach((r) => {
      const k = String(r.cod_produto);
      if (!m[k]) m[k] = { cod_produto: k, nome_produto: r.nome_produto, categoria: r.categoria, qtd_faltas: 0, volume_falta_hl: 0 };
      m[k].qtd_faltas += Number(r.qtd_faltas) || 0;
      m[k].volume_falta_hl += Number(r.volume_falta_hl) || 0;
    });
    const linhas = Object.values(m).map((x) => ({ ...x, volume_falta_hl: Math.round(x.volume_falta_hl * 1000) / 1000 })).sort((a, b) => b.volume_falta_hl - a.volume_falta_hl);
    return { titulo: `Top produtos · ${drill.nome}`, linhas, cols: [
      { k: "nome_produto", t: "Produto" }, { k: "categoria", t: "Categoria" },
      { k: "qtd_faltas", t: "Ocorr.", num: true }, { k: "volume_falta_hl", t: "Volume (HL)", num: true, fmt: (v) => fmt(v, 2) }] };
  })();

  return (
    <>
      <div style={S.escopoBar}>
        <span style={S.escopoTxt}>📅 {escopo}</span>
        <label style={S.diaWrap}>
          <span style={S.diaLbl}>Dia:</span>
          <input type="date" style={S.diaInput} value={toISO(dia)} onChange={(e) => { setDia(toBR(e.target.value)); setMes(""); }} />
        </label>
        {dia && <button style={S.limpar} onClick={() => setDia("")}>limpar dia ✕</button>}
        {mes && !dia && <button style={S.limpar} onClick={() => setMes("")}>ver quadrimestre ✕</button>}
        <span style={S.dica}>clique numa barra p/ o mês · ou escolha um dia · 🔴 acima da média · 🟡 90% · 🟢 abaixo</span>
      </div>

      <div style={S.kpis}>
        <Kpi label="Volume em ruptura (HL)" valor={fmt(d.total_volume_falta_hl)} cor={VERMELHO} sub={escopo} />
        <Kpi label="Produtos afetados" valor={d.produtos_afetados} cor={AMARELO} />
        <Kpi label="Clientes afetados" valor={d.clientes_afetados} cor={AMARELO} />
        <Kpi label="Média / mês (HL)" valor={fmt(media)} cor="#9fb3c8" />
      </div>

      <h3 style={S.h3}>Comparativo quadrimestre</h3>
      {quad.por_mes.length === 0 ? <div style={S.vazio}>Sem histórico.</div> : (
        <div style={S.chartWrap}>
          <div style={S.chartArea}>
            {media > 0 && (
              <>
                <div style={{ ...S.avgLine, bottom: `${(media / escala) * 100}%` }} />
                <div style={{ ...S.avgLabel, bottom: `calc(${(media / escala) * 100}% + 2px)` }}>média {fmt(media)}</div>
              </>
            )}
            {quad.por_mes.map((m) => {
              const ativa = m.mes === mes;
              const h = (m.volume_falta_hl / escala) * 100;
              return (
                <div key={m.mes} style={S.col} onClick={() => { setMes(ativa ? "" : m.mes); setDia(""); }} title="Filtrar este mês">
                  <div style={{ ...S.barAbs, height: `${h}%`, background: corBarra(m.volume_falta_hl), outline: ativa ? `2px solid #fff` : "none" }} />
                  <div style={{ ...S.barVal, bottom: `calc(${h}% + 4px)` }}>{fmt(m.volume_falta_hl)}</div>
                </div>
              );
            })}
          </div>
          <div style={S.chartLabels}>
            {quad.por_mes.map((m) => (
              <div key={m.mes} style={{ ...S.colLabel, color: m.mes === mes ? VERDE : "rgba(255,255,255,0.55)" }}>{rotuloMes(m.mes)}</div>
            ))}
          </div>
        </div>
      )}

      <div style={S.subAbas}>
        {[["produto", "Por produto"], ["cliente", `Top clientes (${d.clientes_afetados})`]].map(([k, t]) => (
          <button key={k} style={{ ...S.subTab, ...(sub === k ? S.subTabAtiva : {}) }} onClick={() => { setSub(k); setDrill(null); }}>{t}</button>
        ))}
      </div>

      {sub === "produto" && (
        d.por_produto.length === 0 ? <div style={S.vazio}>Sem rupturas no escopo.</div> :
        <>
          <div style={S.dicaLinha}>👆 clique num produto para ver os clientes e as datas</div>
          <Tabela inicial={{ k: "volume_falta_hl", dir: "desc" }}
            onRow={(l) => setDrill({ tipo: "produto", chave: l.cod_produto, nome: l.nome_produto })}
            linhas={d.por_produto} colunas={[
            { k: "nome_produto", t: "Produto" }, { k: "categoria", t: "Categoria" },
            { k: "qtd_faltas", t: "Ocorrências", num: true }, { k: "volume_falta_hl", t: "Volume (HL)", num: true, fmt: (v) => fmt(v) }]} />
        </>
      )}
      {sub === "cliente" && (
        d.por_cliente.length === 0 ? <div style={S.vazio}>Sem rupturas no escopo.</div> :
        <>
          <div style={S.dicaLinha}>👆 clique num cliente para ver o top de produtos em falta</div>
          <Tabela inicial={{ k: "volume_falta_hl", dir: "desc" }}
            onRow={(l) => setDrill({ tipo: "cliente", chave: l.cod_pdv, nome: l.nome_pdv })}
            linhas={d.por_cliente} colunas={[
            { k: "cod_pdv", t: "Cód" }, { k: "nome_pdv", t: "Cliente" }, { k: "setor", t: "Setor" },
            { k: "qtd_faltas", t: "Ocorrências", num: true }, { k: "volume_falta_hl", t: "Volume (HL)", num: true, fmt: (v) => fmt(v) }]} />
        </>
      )}

      {drill && detalheDrill && (
        <div style={S.modalScrim} onClick={() => setDrill(null)}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <div style={S.modalHead}>
              <div style={S.modalTit}>{detalheDrill.titulo}</div>
              <button style={S.fechar} onClick={() => setDrill(null)}>✕</button>
            </div>
            {detalheDrill.linhas.length === 0 ? <div style={S.vazio}>Sem ocorrências no escopo.</div> :
              <Tabela inicial={{ k: "volume_falta_hl", dir: "desc" }} linhas={detalheDrill.linhas} colunas={detalheDrill.cols} />}
          </div>
        </div>
      )}
    </>
  );
}

const S = {
  root: { minHeight: "100vh", background: BG, fontFamily: "'Poppins','Segoe UI',system-ui,sans-serif", padding: "clamp(16px,4vw,28px)", maxWidth: "1600px", margin: "0 auto", color: "#fff" },
  header: { display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap", marginBottom: "18px" },
  voltar: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", padding: "8px 14px", borderRadius: "8px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.85rem" },
  titulo: { margin: 0, fontSize: "clamp(1.2rem,4vw,1.5rem)", fontWeight: "800" },
  sub: { margin: "2px 0 0", color: "rgba(255,255,255,0.45)", fontSize: "0.8rem" },
  abas: { display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" },
  tab: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", padding: "10px 18px", borderRadius: "10px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.9rem", fontWeight: "600" },
  tabAtiva: { background: "rgba(125,186,61,0.15)", borderColor: "rgba(125,186,61,0.5)", color: VERDE },
  filtros: { display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "16px", alignItems: "flex-end" },
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
  limparDia: { alignSelf: "flex-end", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)", padding: "9px 12px", borderRadius: "8px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.78rem" },
  diaWrap: { display: "flex", alignItems: "center", gap: "6px" },
  diaLbl: { color: "rgba(255,255,255,0.5)", fontSize: "0.78rem" },
  diaInput: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(125,186,61,0.3)", color: "#fff", padding: "6px 10px", borderRadius: "8px", fontFamily: "inherit", fontSize: "0.8rem", colorScheme: "dark" },
  dica: { color: "rgba(255,255,255,0.35)", fontSize: "0.72rem", fontStyle: "italic", marginLeft: "auto" },
  dicaLinha: { color: "rgba(255,255,255,0.4)", fontSize: "0.76rem", fontStyle: "italic", margin: "0 0 8px 2px" },
  h3: { margin: "20px 0 10px", fontSize: "1rem", fontWeight: "700" },
  exportBar: { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", margin: "16px 0 4px", padding: "10px 14px", background: "rgba(125,186,61,0.06)", border: "1px solid rgba(125,186,61,0.25)", borderRadius: "10px" },
  exportLbl: { color: "rgba(255,255,255,0.7)", fontSize: "0.82rem", flex: 1, minWidth: "180px" },
  btnExcel: { background: "linear-gradient(135deg,#1d8a4e,#0e5c33)", color: "#fff", border: "none", borderRadius: "8px", padding: "8px 16px", fontWeight: "700", cursor: "pointer", fontFamily: "inherit", fontSize: "0.84rem" },
  btnPdf: { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", borderRadius: "8px", padding: "8px 16px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit", fontSize: "0.84rem" },
  subAbas: { display: "flex", gap: "6px", margin: "20px 0 12px", flexWrap: "wrap" },
  subTab: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", padding: "7px 14px", borderRadius: "20px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.8rem", fontWeight: "600" },
  subTabAtiva: { background: "rgba(125,186,61,0.15)", borderColor: "rgba(125,186,61,0.5)", color: VERDE },
  tabelaWrap: { overflowX: "auto", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px" },
  tabela: { width: "100%", borderCollapse: "collapse", fontSize: "0.84rem" },
  th: { padding: "10px 12px", color: "rgba(255,255,255,0.5)", fontWeight: "600", borderBottom: "1px solid rgba(255,255,255,0.1)", whiteSpace: "nowrap", background: "rgba(255,255,255,0.03)", userSelect: "none" },
  td: { padding: "9px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.85)", whiteSpace: "nowrap" },
  trAlt: { background: "rgba(255,255,255,0.02)" },
  trClick: { cursor: "pointer" },
  chartWrap: { padding: "16px", background: "rgba(255,255,255,0.03)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)" },
  chartArea: { position: "relative", height: "150px", display: "flex", gap: "10px", alignItems: "flex-end" },
  col: { position: "relative", flex: 1, height: "100%", cursor: "pointer", minWidth: "40px" },
  barAbs: { position: "absolute", left: "15%", right: "15%", bottom: 0, borderRadius: "6px 6px 0 0", minHeight: "3px", transition: "height 0.3s" },
  barVal: { position: "absolute", left: 0, right: 0, textAlign: "center", fontSize: "0.72rem", fontWeight: "600", color: "rgba(255,255,255,0.8)" },
  avgLine: { position: "absolute", left: 0, right: 0, borderTop: "2px dashed rgba(159,179,200,0.7)", zIndex: 1 },
  avgLabel: { position: "absolute", right: 0, fontSize: "0.68rem", color: "#9fb3c8", background: BG, padding: "0 4px", zIndex: 2 },
  chartLabels: { display: "flex", gap: "10px", marginTop: "6px" },
  colLabel: { flex: 1, textAlign: "center", fontSize: "0.74rem", fontWeight: "600", minWidth: "40px" },
  modalScrim: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)", zIndex: 1600, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" },
  modal: { background: "linear-gradient(180deg,#14241a,#0c1410)", border: "1px solid rgba(125,186,61,0.3)", borderRadius: "16px", padding: "18px", width: "min(640px,100%)", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 24px 70px rgba(0,0,0,0.6)" },
  modalHead: { display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "14px" },
  modalTit: { fontSize: "1.05rem", fontWeight: "800" },
  modalSub: { color: "rgba(255,255,255,0.5)", fontSize: "0.78rem", marginTop: "2px" },
  fechar: { marginLeft: "auto", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.14)", color: "#fff", borderRadius: "50%", width: "32px", height: "32px", cursor: "pointer", flexShrink: 0 },
};

const CSS = `
.dh-spin { width:16px;height:16px;border:2px solid rgba(125,186,61,0.2);border-top-color:${VERDE};border-radius:50%;display:inline-block;animation:dh-rot .8s linear infinite; }
@keyframes dh-rot { to { transform: rotate(360deg); } }
`;
