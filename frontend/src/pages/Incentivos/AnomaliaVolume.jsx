// Outros relatórios › Anomalia de Volume — PDVs dos setores 102/995/997 (não podem ter pedido)
// com venda no mês atual. Mostra TUDO da venda (pedidos, itens, datas, HL, valor, canal, quem
// digitou…) e a SUGESTÃO de RN + dia de visita pela base de clientes dos RNs (mesmo bairro/cidade).
// Dado: GET /api/anomalia-volume (gestores). Zera todo mês (só o mês vivo do CORA).
import { useState, useEffect } from "react";
import * as XLSX from "xlsx-js-style";
import api from "../../services/api";

const VERDE = "#7DBA3D", VERM = "#f87171", OURO = "#f5c451";
const fHL = (v) => (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const fRS = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const DIA_NOME = { SEG: "segunda", TER: "terça", QUA: "quarta", QUI: "quinta", SEX: "sexta", SAB: "sábado" };

export default function AnomaliaVolume() {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [aberto, setAberto] = useState(null);
  const [verInternos, setVerInternos] = useState(false);

  useEffect(() => {
    api.get("/api/anomalia-volume", { timeout: 60000 }).then((r) => setD(r.data))
      .catch((e) => setErro(e?.response?.data?.error || "Erro ao carregar."));
  }, []);

  function exportar() {
    const cab = ["Setor", "Cód PDV", "PDV", "Fantasia", "CNPJ", "Cidade", "Bairro", "Nº pedido", "Pedido cliente", "Data", "Entrada", "Entrega", "NF", "Data NF",
      "Situação pedido", "Canal origem", "Canal marcação", "Digitado por", "Vendedor", "Operação", "Tipo mov.", "Pagamento", "Placa",
      "Cód produto", "Produto", "Qtd", "Unid.", "Valor unit.", "Valor item", "HL", "Situação item", "Atend. item", "Motivo corte", "Conta como venda",
      "Sugestão RN", "Sugestão dia"];
    const linhas = [];
    d.pdvs.forEach((p) => p.pedidos.forEach((pe) => pe.itens.forEach((it) => linhas.push([
      p.setor, p.cod_pdv, p.nome_pdv, p.nome_fantasia, p.cnpj, p.cidade, p.bairro, pe.num_pedido, pe.pedido_cliente, pe.data, pe.data_entrada, pe.data_entrega, pe.nf, pe.data_nf,
      pe.situacao_pedido, pe.canal_origem, pe.canal_marcacao, pe.usuario_digitacao, pe.vendedor, pe.operacao, pe.tipo_movimento, pe.pagamento, pe.placa,
      it.cod_produto, it.nome_produto, it.quantidade, it.unidade, it.valor_unitario, it.valor_item, it.volume_hl, it.situacao_item, it.situacao_atend_item, it.motivo_corte, it.venda,
      p.sugestao.opcoes[0]?.setor || "", p.sugestao.opcoes[0]?.dia || "",
    ]))));
    const ws = XLSX.utils.aoa_to_sheet([cab, ...linhas]);
    cab.forEach((_, c) => { const ref = XLSX.utils.encode_cell({ r: 0, c }); if (ws[ref]) ws[ref].s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "2E7D32" } } }; });
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Anomalia de Volume");
    XLSX.writeFile(wb, `Anomalia_Volume_${d.mes || "mes"}.xlsx`);
  }

  if (erro) return <p style={S.nota}>{erro}</p>;
  if (!d) return <p style={S.nota}>Carregando…</p>;
  const lista = d.pdvs.filter((p) => verInternos || !p.interno);
  const internos = d.pdvs.filter((p) => p.interno).length;

  return (
    <div>
      <div style={S.topo}>
        <div>
          <div style={{ fontWeight: 800, fontSize: "1.1rem" }}>🚨 Anomalia de Volume <span style={{ color: "rgba(255,255,255,0.45)", fontWeight: 500, fontSize: "0.85rem" }}>· {d.mes}</span></div>
          <div style={S.nota}>PDVs dos setores <b>102, 995 e 997</b> (não podem fazer pedido) com venda no mês. Zera todo mês. {d.atualizado_em ? `CORA de ${d.atualizado_em}.` : ""}</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {internos > 0 && <label style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.6)", display: "flex", gap: 5, alignItems: "center" }}>
            <input type="checkbox" checked={verInternos} onChange={(e) => setVerInternos(e.target.checked)} /> ver internos ({internos})</label>}
          {d.pdvs.length > 0 && <button style={S.btn} onClick={exportar}>⬇️ Excel (tudo, item a item)</button>}
        </div>
      </div>

      <div style={S.cards}>
        {[["PDVs", d.resumo.pdvs], ["Pedidos", d.resumo.pedidos], ["Volume", `${fHL(d.resumo.hl)} HL`], ["Valor", fRS(d.resumo.valor)],
          ...Object.entries(d.resumo.por_setor).map(([s, n]) => [`Setor ${s}`, `${n} PDV${n > 1 ? "s" : ""}`])].map(([l, v]) => (
          <div key={l} style={S.card}><div style={S.lbl}>{l}</div><div style={{ fontWeight: 800, fontSize: "1.1rem" }}>{v}</div></div>
        ))}
      </div>
      {!d.base_fora_importada && <p style={{ ...S.nota, color: OURO }}>⚠️ Reimporte a base de clientes (0105070402) p/ trazer bairro dos PDVs 102/995/997 — sem ela a sugestão usa só a cidade do pedido.</p>}

      {!lista.length ? <p style={S.nota}>Nenhuma venda nesses setores no mês. 👍</p> : lista.map((p) => {
        const k = `${p.setor}|${p.cod_pdv}`, exp = aberto === k, top = p.sugestao.opcoes[0];
        return (
          <div key={k} style={{ ...S.pdv, ...(p.interno ? { opacity: 0.6 } : {}) }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start", cursor: "pointer" }} onClick={() => setAberto(exp ? null : k)}>
              <span style={S.badge}>{p.setor}</span>
              <div style={{ flex: "1 1 260px" }}>
                <div style={{ fontWeight: 700 }}>{exp ? "▾" : "▸"} {p.cod_pdv} · {p.nome_fantasia || p.nome_pdv}</div>
                <div style={S.nota}>{p.nome_pdv}{p.cnpj ? ` · ${p.cnpj}` : ""} · {[p.bairro, p.cidade].filter(Boolean).join(" / ") || "sem endereço"}{p.segmento ? ` · ${p.segmento}` : ""}{p.status_base ? ` · base: ${p.status_base}` : ""}</div>
                <div style={S.nota}>Datas: {p.datas.join(", ")} · Canal: {p.canais.join(", ") || "—"}{p.digitadores.length ? ` · digitado por: ${p.digitadores.join(", ")}` : ""}{p.vendedores.length ? ` · vendedor: ${p.vendedores.join(", ")}` : ""}</div>
              </div>
              <div style={{ textAlign: "right", minWidth: 130 }}>
                <div style={{ fontWeight: 800, color: VERM }}>{fHL(p.hl)} HL</div>
                <div style={S.nota}>{fRS(p.valor)} · {p.n_pedidos} pedido(s) · {p.itens} itens</div>
              </div>
            </div>
            <div style={S.sug}>
              {top ? <>➡️ <b>Sugestão: setor {top.setor}{top.rn ? ` · ${top.rn.split(" ")[0]}` : ""} · visita de {DIA_NOME[top.dia] || top.dia || "—"}</b>
                <span style={{ color: "rgba(255,255,255,0.55)" }}> — {p.sugestao.motivo}</span>
                {p.sugestao.opcoes.length > 1 && <div style={{ marginTop: 4, fontSize: "0.74rem", color: "rgba(255,255,255,0.5)" }}>
                  Outras opções: {p.sugestao.opcoes.slice(1).map((o) => `setor ${o.setor} (${o.pdvs_bairro} no bairro · ${o.pdvs_cidade} na cidade · ${o.dia || "—"})`).join(" · ")}</div>}
              </> : <span style={{ color: "rgba(255,255,255,0.55)" }}>{p.sugestao.motivo}</span>}
            </div>
            {exp && p.pedidos.map((pe) => (
              <div key={pe.num_pedido} style={S.ped}>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: "0.78rem" }}>
                  <b>Pedido {pe.num_pedido}</b>
                  {pe.pedido_cliente && <span>BEES/cliente: {pe.pedido_cliente}</span>}
                  <span>Data: {pe.data}</span><span>Entrada: {pe.data_entrada || "—"}</span><span>Entrega: {pe.data_entrega || "—"}</span>
                  <span>NF: {pe.nf || "—"}{pe.data_nf ? ` (${pe.data_nf})` : ""}</span>
                  <span>Situação: {pe.situacao_pedido}</span><span>Canal: {pe.canal_origem}{pe.canal_marcacao ? ` / ${pe.canal_marcacao}` : ""}</span>
                  {pe.usuario_digitacao && <span>Digitado: {pe.usuario_digitacao}{pe.motivo_digitacao ? ` (${pe.motivo_digitacao})` : ""}</span>}
                  {pe.vendedor && <span>Vendedor: {pe.vendedor}</span>}
                  <span>Operação: {pe.operacao}{pe.tipo_movimento ? ` · ${pe.tipo_movimento}` : ""}</span>
                  {pe.pagamento && <span>Pagamento: {pe.pagamento}</span>}
                  {pe.placa && <span>Placa: {pe.placa}{pe.itinerario ? ` · ${pe.itinerario}` : ""}</span>}
                  {pe.motivo_cancelamento && <span style={{ color: VERM }}>Cancelamento: {pe.motivo_cancelamento}</span>}
                  <b style={{ color: VERM }}>{fHL(pe.hl)} HL · {fRS(pe.valor)}</b>
                </div>
                <div style={{ overflowX: "auto", marginTop: 6 }}>
                  <table style={S.table}>
                    <thead><tr>{["Cód", "Produto", "Qtd", "Unid.", "Valor unit.", "Valor item", "HL", "Situação", "Atend.", "Corte", "Venda?"].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                    <tbody>{pe.itens.map((it, i) => (
                      <tr key={i} style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                        <td style={S.td}>{it.cod_produto}</td><td style={{ ...S.td, textAlign: "left" }}>{it.nome_produto || "—"}</td>
                        <td style={S.td}>{it.quantidade}</td><td style={S.td}>{it.unidade}</td><td style={S.td}>{it.valor_unitario}</td><td style={S.td}>{it.valor_item}</td>
                        <td style={{ ...S.td, fontWeight: 700 }}>{fHL(it.volume_hl)}</td><td style={S.td}>{it.situacao_item}</td><td style={S.td}>{it.situacao_atend_item}</td>
                        <td style={S.td}>{it.motivo_corte || ""}</td><td style={{ ...S.td, color: it.venda === "SIM" ? VERM : "rgba(255,255,255,0.4)" }}>{it.venda}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        );
      })}
      <p style={S.nota}>Sugestão: RN com mais PDVs no mesmo bairro (desempate: mesma cidade, depois base menor) e o dia em que ele mais visita aquele bairro (desempate: dia mais leve na rota dele). "Venda?" = item atendido de venda, não cancelado — é o que conta no volume.</p>
    </div>
  );
}

const S = {
  topo: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 10 },
  nota: { fontSize: "0.74rem", color: "rgba(255,255,255,0.5)", margin: "2px 0", lineHeight: 1.45 },
  btn: { background: "rgba(125,186,61,0.15)", border: `1px solid ${VERDE}`, color: VERDE, borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.8rem" },
  cards: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, marginBottom: 10 },
  card: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 12px" },
  lbl: { fontSize: "0.7rem", color: "rgba(255,255,255,0.45)", textTransform: "uppercase" },
  pdv: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(248,113,113,0.25)", borderRadius: 12, padding: 12, marginBottom: 10 },
  badge: { background: "rgba(248,113,113,0.15)", color: VERM, fontWeight: 800, borderRadius: 8, padding: "4px 9px", fontSize: "0.85rem" },
  sug: { marginTop: 8, background: "rgba(125,186,61,0.08)", border: "1px solid rgba(125,186,61,0.3)", borderRadius: 8, padding: "7px 10px", fontSize: "0.82rem" },
  ped: { marginTop: 8, background: "rgba(0,0,0,0.2)", borderRadius: 8, padding: 10 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "0.74rem" },
  th: { color: "rgba(255,255,255,0.45)", padding: "5px 6px", whiteSpace: "nowrap", textAlign: "center" },
  td: { padding: "5px 6px", textAlign: "center", color: "rgba(255,255,255,0.8)", whiteSpace: "nowrap" },
};
