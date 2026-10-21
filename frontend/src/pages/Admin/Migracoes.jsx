// Admin › Solicitações › Migrações de PDV — aprova/recusa por linha e baixa Excel
// (a mudança é feita à mão no Promax; o app só registra).
import { useState, useEffect } from "react";
import * as XLSX from "xlsx-js-style";
import api from "../../services/api";
import { Seta, TagInativar, TagCoord, TagPer } from "../Incidentes/Migracao";

const COR = {
  "Em aprovação": "#f5c451", Aprovado: "#4ade80", Recusado: "#f87171", Parcial: "#60a5fa", Pendente: "#f5c451",
};
const dataBR = (v) => (v ? new Date(v).toLocaleDateString("pt-BR") : "");
const fmt = (n) => (Number(n) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// Coordenada sempre com 6 casas e PONTO decimal, como TEXTO (o Excel não arredonda nem troca p/ vírgula)
const coord6 = (v) => (v == null || v === "" || isNaN(Number(v)) ? "" : Number(v).toFixed(6));

// Código da filial no Promax (rotina 01.31.59) — algumas unidades usam o código antigo (01.04.09).
// Pedido 1x e guardado neste navegador.
function filialPromax(trocar) {
  let f = "";
  try { f = localStorage.getItem("hop_filial_promax") || ""; } catch { /* sem storage */ }
  if (!f || trocar) {
    f = String(window.prompt("Código da FILIAL no Promax para o arquivo de coordenadas (rotina 01.31.59).\nConfira na 01.04.09 (binóculo) — algumas unidades usam o código antigo.", f) || "").trim();
    if (!/^\d+$/.test(f)) { if (f) alert("O código da filial deve ter só números."); return ""; }
    try { localStorage.setItem("hop_filial_promax", f); } catch { /* sem storage */ }
  }
  return f;
}
// Linhas no layout da 01.31.59: FILIAL + CLIENTE(5 dígitos, zero à esquerda);LATITUDE;LONGITUDE (6 casas)
function linhasCoordenadas(itens, filial) {
  return itens.filter((it) => it.lat_nova != null && it.lng_nova != null).map((it) => {
    const cli = String(it.cod_pdv || "").replace(/\D/g, "").padStart(5, "0");
    return { codigo: `${filial}${cli}`, lat: coord6(it.lat_nova), lng: coord6(it.lng_nova), it };
  });
}
// COORDENADAS.CSV (sem cabeçalho, ";" e quebra de linha do Windows) p/ salvar em int\dvs
function baixarCoordenadasCsv(itens, origem) {
  const filial = filialPromax(false); if (!filial) return;
  const ls = linhasCoordenadas(itens, filial);
  if (!ls.length) { alert(`Nenhuma coordenada ${origem} para gerar.`); return; }
  const longos = ls.filter((l) => String(l.it.cod_pdv).replace(/\D/g, "").length > 5);
  if (longos.length) alert(`Atenção: ${longos.length} PDV(s) com código maior que 5 dígitos (${longos.slice(0, 5).map((l) => l.it.cod_pdv).join(", ")}). Confira o layout antes de importar.`);
  const txt = ls.map((l) => `${l.codigo};${l.lat};${l.lng}`).join("\r\n") + "\r\n";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([txt], { type: "text/csv" }));
  a.download = "COORDENADAS.CSV";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// Consolidado de TODAS as linhas pendentes (todas as solicitações), num Excel só,
// + aba "COORDENADAS 01.31.59" já no layout do Promax.
function exportarPendentes(sols, nomeArq) {
  const itens = sols.flatMap((s) => s.itens.filter((it) => it.status === "Pendente").map((it) => ({ ...it, _s: s })));
  if (!itens.length) { alert("Nenhuma linha pendente."); return; }
  exportar(sols, nomeArq, false, true, (wb) => {
    const filial = filialPromax(false);
    const ls = linhasCoordenadas(itens, filial || "?");
    const ws = XLSX.utils.aoa_to_sheet([["Código (filial + cliente 5 díg.)", "Latitude", "Longitude", "Linha p/ COORDENADAS.CSV", "Cód PDV", "PDV", "Setor", "Solicitação", "Endereço", "Mapa"],
      ...ls.map((l) => [l.codigo, l.lat, l.lng, `${l.codigo};${l.lat};${l.lng}`, l.it.cod_pdv, l.it.nome_pdv, l.it._s.setor, l.it._s.id, l.it.endereco_novo || "", `https://www.google.com/maps?q=${l.lat},${l.lng}`])]);
    // tudo como texto (t:"s") p/ não perder zeros à esquerda nem casas decimais
    Object.keys(ws).filter((k) => !k.startsWith("!")).forEach((k) => { ws[k].t = "s"; ws[k].v = String(ws[k].v); ws[k].z = "@"; });
    ws["!cols"] = [16, 12, 12, 34, 10, 32, 8, 14, 45, 40].map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, "COORDENADAS 01.31.59");
    const inst = XLSX.utils.aoa_to_sheet([["Importação de coordenadas no Promax — rotina 01.31.59"], [""],
      ["Layout: FILIAL + CLIENTE(5 dígitos);LATITUDE;LONGITUDE — ex.: 122222;-33.333333;-44.444444"],
      ["Cliente com menos de 5 dígitos: completar com 0 à esquerda. Latitude/longitude com 6 casas e ponto."],
      [`Filial usada: ${filial || "(não informada)"} — conferir na 01.04.09 (algumas unidades usam o código antigo).`],
      ["Arquivo: COORDENADAS.CSV (botão 📍 na HOP) salvo na pasta int\\dvs."]]);
    inst["!cols"] = [{ wch: 110 }];
    XLSX.utils.book_append_sheet(wb, inst, "Instruções Promax");
  });
}

// O que a linha pede (coluna "Ação"): deixa claro quando é SÓ periodicidade (mesmo dia/setor)
function acaoDe(it) {
  if (it.inativar) return "INATIVAR";
  const p = [];
  if (it.setor_novo) p.push("SETOR");
  if (it.dia_novo && it.dia_novo !== it.dia_atual) p.push("DIA");
  if (it.periodicidade_nova) p.push("PERIODICIDADE");
  if (it.lat_nova != null) p.push("COORDENADA");
  return p.join(" + ") || "—";
}

function exportar(sols, nomeArq, soAprovados, soPendentes, extra) {
  const cab = ["Solicitação", "Data pedido", "RN solicitante", "Cód PDV", "PDV", "Média tri (HL/mês)",
    "Setor atual", "Novo setor", "Dia atual", "Novo dia", "Nova periodicidade", "Status", "Decidido em", "Motivo",
    "Ação", "Justificativa (inativação)", "Inadimplência", "Comodato", "Latitude nova", "Longitude nova", "Endereço (coordenada nova)", "Mapa"];
  // índices das colunas (p/ cor e formato)
  const C = { setorAt: 6, setorNovo: 7, diaAt: 8, diaNovo: 9, per: 10, acao: 14, lat: 18, lng: 19 };
  const linhas = [];
  sols.forEach((s) => s.itens.forEach((it) => {
    if (soAprovados && it.status !== "Aprovado") return;
    if (soPendentes && it.status !== "Pendente") return;
    linhas.push([s.id, dataBR(s.criado_em), `${s.setor} · ${s.nome_rn || ""}`, it.cod_pdv, it.nome_pdv, it.media_tri_hl,
      it.setor_atual, it.setor_novo || it.setor_atual, it.dia_atual, it.dia_novo || it.dia_atual,
      it.periodicidade_nova ? it.periodicidade_nova.charAt(0) + it.periodicidade_nova.slice(1).toLowerCase() : "",
      it.status === "Pendente" ? "Em aprovação" : it.status, dataBR(s.decidido_em), s.motivo || "",
      acaoDe(it),
      it.justificativa || "", it.inad_info || "", it.comodato_info || "",
      coord6(it.lat_nova), coord6(it.lng_nova), it.endereco_novo || "",
      it.lat_nova != null ? `https://www.google.com/maps?q=${coord6(it.lat_nova)},${coord6(it.lng_nova)}` : ""]);
  }));
  if (!linhas.length) { alert("Nenhuma linha para exportar."); return; }
  const ws = XLSX.utils.aoa_to_sheet([cab, ...linhas]);
  const head = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "2E7D32" } }, alignment: { horizontal: "center", vertical: "center", wrapText: true } };
  const muda = { font: { bold: true, color: { rgb: "8A6D00" } }, fill: { fgColor: { rgb: "FFF3CD" } } };
  cab.forEach((_, c) => { const r = XLSX.utils.encode_cell({ r: 0, c }); ws[r].s = head; });
  const inat = { font: { bold: true, color: { rgb: "A52834" } }, fill: { fgColor: { rgb: "F8D7DA" } } };
  linhas.forEach((l, i) => {
    const cel = (c) => ws[XLSX.utils.encode_cell({ r: i + 1, c })];
    if (l[C.acao] === "INATIVAR") cel(C.acao).s = inat;
    if (l[C.setorNovo] !== l[C.setorAt]) cel(C.setorNovo).s = muda;  // novo setor ≠ atual
    if (l[C.diaNovo] !== l[C.diaAt]) cel(C.diaNovo).s = muda;        // novo dia ≠ atual
    if (l[C.per]) cel(C.per).s = muda;                               // nova periodicidade
  });
  ws["!cols"] = [10, 11, 22, 10, 30, 10, 9, 9, 8, 8, 14, 12, 11, 30, 22, 40, 45, 55, 12, 12, 45, 40].map((wch) => ({ wch }));
  ws["!rows"] = [{ hpt: 30 }];
  ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: linhas.length, c: cab.length - 1 } }) };
  // latitude/longitude como texto (6 casas, ponto) — o Excel não arredonda nem troca p/ vírgula
  linhas.forEach((_, i) => [C.lat, C.lng].forEach((c) => { const k = XLSX.utils.encode_cell({ r: i + 1, c }); if (ws[k] && ws[k].v !== "") { ws[k].t = "s"; ws[k].z = "@"; } }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, soPendentes ? "Pendentes" : "Migrações");
  if (extra) extra(wb);
  XLSX.writeFile(wb, nomeArq);
}

export default function Migracoes() {
  const [sols, setSols] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("Em aprovação");
  const [sel, setSel] = useState(null);       // solicitação aberta
  const [marcados, setMarcados] = useState(new Set());
  const [resposta, setResposta] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const carregar = async () => {
    setLoading(true);
    let lista = [];
    try { const r = await api.get("/api/solicitacoes", { timeout: 60000 }); lista = (r.data || []).filter((s) => s.tipo === "migracao_pdv"); }
    catch { lista = []; }
    finally { setLoading(false); }
    setSols(lista);
    return lista;
  };
  useEffect(() => { carregar(); }, []);

  // Só linhas PENDENTES são marcáveis; ao abrir, nenhuma vem marcada (você escolhe).
  const pendentes = (s) => s.itens.filter((it) => it.status === "Pendente");
  const abrir = (s) => { setSel(s); setResposta(""); setErro(""); setMarcados(new Set()); };
  const toggle = (id) => setMarcados((m) => { const n = new Set(m); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // Decide SÓ as linhas marcadas; as demais seguem pendentes (dá para decidir em etapas).
  async function decidir(acao) {
    if (!marcados.size) { setErro("Marque as linhas que quer " + (acao === "Aprovado" ? "aprovar." : "recusar.")); return; }
    setSalvando(true); setErro("");
    try {
      await api.post(`/api/solicitacoes/${sel.id}/decidir`, { itens: [...marcados], acao, resposta });
      const lista = await carregar();
      const atual = lista.find((x) => x.id === sel.id);
      if (atual && atual.status === "Em aprovação") abrir(atual);   // ainda há pendentes → continua aberto
      else setSel(null);
    } catch (e) { setErro(e.response?.data?.error || "Erro ao salvar a decisão."); }
    finally { setSalvando(false); }
  }

  const lista = sols.filter((s) => !filtro || s.status === filtro);
  const pend = sols.filter((s) => s.status === "Em aprovação").length;
  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <div style={S.toolbar}>
        <h3 style={S.tit}>Migrações de PDV {pend > 0 && <span style={S.badge}>{pend} p/ aprovar</span>}</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select style={S.select} value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="">Todas</option>
            {["Em aprovação", "Aprovado", "Parcial", "Recusado"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button style={S.xls} onClick={() => exportar(lista, `Migracoes_aprovadas_${hoje}.xlsx`, true)} title="Linhas APROVADAS das solicitações listadas">📥 Excel aprovados</button>
          <button style={S.xls} onClick={() => exportarPendentes(sols, `Solicitacoes_pendentes_${hoje}.xlsx`)}
            title="TODAS as linhas pendentes de TODAS as solicitações num Excel só (+ aba de coordenadas no layout do Promax 01.31.59)">📥 Excel pendentes (todas)</button>
          <button style={S.xls} onClick={() => baixarCoordenadasCsv(sols.flatMap((s) => s.itens.filter((it) => it.status === "Aprovado")), "aprovada")}
            title="COORDENADAS.CSV (01.31.59) com as coordenadas APROVADAS — salvar em int\dvs">📍 COORDENADAS.CSV aprovadas</button>
          <button style={S.xls} onClick={() => baixarCoordenadasCsv(sols.flatMap((s) => s.itens.filter((it) => it.status === "Pendente")), "pendente")}
            title="COORDENADAS.CSV (01.31.59) com as coordenadas PENDENTES">📍 CSV pendentes</button>
          <button style={{ ...S.xls, opacity: 0.7 }} onClick={() => filialPromax(true)} title="Trocar o código da filial usado no arquivo de coordenadas">⚙️ Filial</button>
        </div>
      </div>

      {loading ? <p style={S.msg}>Carregando…</p> : !lista.length ? <p style={S.msg}>Nenhuma migração {filtro ? `"${filtro}"` : ""}.</p> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {lista.map((s) => {
            const nDia = s.itens.filter((it) => it.dia_novo).length, nRn = s.itens.filter((it) => it.setor_novo).length;
            const nInat = s.itens.filter((it) => it.inativar).length;
            const nCoord = s.itens.filter((it) => it.lat_nova != null).length;
            const nPer = s.itens.filter((it) => it.periodicidade_nova).length;
            return (
              <div key={s.id} style={S.card} onClick={() => abrir(s)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ ...S.tag, color: COR[s.status], background: `${COR[s.status]}22` }}>{s.status}</span>
                    <span style={S.rn}>Setor {s.setor} — {s.nome_rn}</span>
                  </div>
                  <span style={S.data}>{dataBR(s.criado_em)} · #{s.id}</span>
                </div>
                <div style={S.resumo}>
                  🔀 {s.itens.length} PDV{s.itens.length > 1 ? "s" : ""}
                  {nDia > 0 && ` · ${nDia} troca${nDia > 1 ? "s" : ""} de dia`}
                  {nRn > 0 && ` · ${nRn} troca${nRn > 1 ? "s" : ""} de RN`}
                  {nPer > 0 && <span style={{ color: "#c4b5fd", fontWeight: 700 }}>{` · ${nPer} periodicidade${nPer > 1 ? "s" : ""}`}</span>}
                  {nInat > 0 && <span style={{ color: "#f87171", fontWeight: 700 }}>{` · ${nInat} inativaç${nInat > 1 ? "ões" : "ão"}`}</span>}
                  {nCoord > 0 && <span style={{ color: "#60a5fa", fontWeight: 700 }}>{` · ${nCoord} coordenada${nCoord > 1 ? "s" : ""}`}</span>}
                  {s.motivo && <span style={{ color: "rgba(255,255,255,0.45)" }}> — {s.motivo}</span>}
                  {s.criado_por && <span style={{ color: "#f5c451" }}> · aberto por {s.criado_por}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {sel && (
        <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && setSel(null)}>
          <div style={S.modal}>
            <div style={S.mHead}>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: "1rem" }}>Migração #{sel.id}</h3>
                <span style={S.rn}>Setor {sel.setor} — {sel.nome_rn} · {dataBR(sel.criado_em)}{sel.criado_por ? ` · aberto por ${sel.criado_por}` : ""}</span>
                {sel.motivo && <p style={{ margin: "6px 0 0", color: "rgba(255,255,255,0.6)", fontSize: "0.82rem" }}>💬 {sel.motivo}</p>}
              </div>
              <button style={S.fechar} onClick={() => setSel(null)}>✕</button>
            </div>
            <div style={{ padding: "14px 20px" }}>
              <div style={{ overflowX: "auto", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                  <thead><tr>
                    {sel.status === "Em aprovação" && (
                      <th style={S.th}>
                        <input type="checkbox" title="Marcar/desmarcar todas as pendentes"
                          checked={pendentes(sel).length > 0 && marcados.size === pendentes(sel).length}
                          onChange={(e) => setMarcados(e.target.checked ? new Set(pendentes(sel).map((it) => it.id)) : new Set())} />
                      </th>
                    )}
                    {["PDV", "Média tri", "Alteração", "Status"].map((h) => <th key={h} style={{ ...S.th, textAlign: h === "PDV" ? "left" : "center" }}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {sel.itens.map((it) => (
                      <tr key={it.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: marcados.has(it.id) ? "rgba(125,186,61,0.08)" : undefined }}>
                        {sel.status === "Em aprovação" && <td style={S.td}>{it.status === "Pendente"
                          ? <input type="checkbox" checked={marcados.has(it.id)} onChange={() => toggle(it.id)} />
                          : <span style={{ color: COR[it.status] }}>{it.status === "Aprovado" ? "✔" : "✖"}</span>}</td>}
                        <td style={{ ...S.td, textAlign: "left" }}>{it.cod_pdv} · {it.nome_pdv}</td>
                        <td style={S.td}>{fmt(it.media_tri_hl)} HL</td>
                        <td style={S.td}><span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
                          {it.inativar && <TagInativar />}
                          {it.dia_novo && <Seta de={it.dia_atual} para={it.dia_novo} tipo="dia" />}
                          {it.periodicidade_nova && <TagPer per={it.periodicidade_nova} />}
                          {it.setor_novo && <Seta de={it.setor_atual} para={it.setor_novo} tipo="rn" />}
                          {it.lat_nova != null && <TagCoord />}
                        </span>
                        {it.lat_nova != null && (
                          <div style={{ textAlign: "left", marginTop: 6, fontSize: "0.74rem", lineHeight: 1.45, maxWidth: 380, color: "rgba(255,255,255,0.8)" }}>
                            📍 {it.lat_nova}, {it.lng_nova}{it.endereco_novo ? ` · ${it.endereco_novo}` : ""}{" · "}
                            <a href={`https://www.google.com/maps?q=${it.lat_nova},${it.lng_nova}`} target="_blank" rel="noreferrer" style={{ color: "#60a5fa" }}>ver no mapa ↗</a>
                          </div>
                        )}
                        {it.inativar && (
                          <div style={{ textAlign: "left", marginTop: 6, fontSize: "0.74rem", lineHeight: 1.45, maxWidth: 380 }}>
                            <div style={{ color: "rgba(255,255,255,0.8)" }}>📝 {it.justificativa}</div>
                            <div style={{ color: /^INADIMPLENTE/.test(it.inad_info || "") ? "#f87171" : "#4ade80" }}>{it.inad_info}</div>
                            <div style={{ color: /^TEM COMODATO/.test(it.comodato_info || "") ? "#f5c451" : "#4ade80" }}>{it.comodato_info}</div>
                          </div>
                        )}</td>
                        <td style={{ ...S.td, color: COR[it.status], fontWeight: 700 }}>{it.status === "Pendente" ? "Pendente" : it.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {sel.status === "Em aprovação" ? (
                <>
                  <p style={{ margin: "10px 0 0", color: "rgba(255,255,255,0.5)", fontSize: "0.78rem" }}>
                    Marque as linhas e clique em aprovar ou recusar — só as marcadas são decididas; as outras continuam pendentes.
                    {` ${pendentes(sel).length} pendente(s).`}
                  </p>
                  <textarea style={S.txt} rows={2} placeholder="Comentário para o RN (opcional — vale para as linhas desta decisão)" value={resposta} onChange={(e) => setResposta(e.target.value)} />
                  {erro && <p style={{ color: "#f87171", fontSize: "0.82rem", margin: "6px 0 0" }}>{erro}</p>}
                  <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    <button style={{ ...S.ok, opacity: marcados.size ? 1 : 0.5 }} disabled={salvando} onClick={() => decidir("Aprovado")}>
                      {salvando ? "Salvando…" : `✅ Aprovar marcados (${marcados.size})`}
                    </button>
                    <button style={{ ...S.nok, opacity: marcados.size ? 1 : 0.5 }} disabled={salvando} onClick={() => decidir("Recusado")}>
                      {`✖ Recusar marcados (${marcados.size})`}
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ marginTop: 10, color: "rgba(255,255,255,0.55)", fontSize: "0.8rem" }}>
                  Decidido em {dataBR(sel.decidido_em)}{sel.decidido_por ? ` por ${sel.decidido_por}` : ""}.
                  {sel.resposta && <> Comentário: <i>{sel.resposta}</i></>}
                </div>
              )}
              <button style={{ ...S.xls, marginTop: 12 }} onClick={() => exportar([sel], `Migracao_${sel.id}.xlsx`, false)}>📥 Excel desta solicitação</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  toolbar: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 10, flexWrap: "wrap" },
  tit: { margin: 0, fontSize: "1rem", fontWeight: 600, display: "flex", alignItems: "center", gap: 10 },
  badge: { background: "rgba(245,196,81,0.18)", color: "#f5c451", padding: "2px 10px", borderRadius: 20, fontSize: "0.75rem", fontWeight: 700 },
  select: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", padding: "8px 12px", fontSize: "0.85rem", fontFamily: "inherit", colorScheme: "dark" },
  xls: { background: "linear-gradient(135deg,#7DBA3D,#2E7D32)", color: "#0c1410", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  msg: { color: "rgba(255,255,255,0.35)", textAlign: "center", padding: 40 },
  card: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 14, cursor: "pointer", display: "flex", flexDirection: "column", gap: 8 },
  tag: { padding: "2px 10px", borderRadius: 20, fontSize: "0.72rem", fontWeight: 700 },
  rn: { color: "rgba(255,255,255,0.65)", fontSize: "0.82rem" },
  data: { color: "rgba(255,255,255,0.35)", fontSize: "0.75rem" },
  resumo: { color: "rgba(255,255,255,0.75)", fontSize: "0.84rem" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 },
  modal: { background: "#111827", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, width: "100%", maxWidth: 760, maxHeight: "90vh", overflow: "auto" },
  mHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "18px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)" },
  fechar: { background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", fontSize: "1.2rem", cursor: "pointer" },
  th: { padding: "8px 10px", color: "rgba(255,255,255,0.45)", fontSize: "0.7rem", textAlign: "center", whiteSpace: "nowrap" },
  td: { padding: "8px 10px", textAlign: "center", color: "rgba(255,255,255,0.8)" },
  txt: { width: "100%", boxSizing: "border-box", marginTop: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", padding: 10, fontSize: "0.85rem", fontFamily: "inherit", outline: "none", resize: "vertical" },
  ok: { background: "linear-gradient(135deg,#7DBA3D,#2E7D32)", color: "#0c1410", border: "none", borderRadius: 10, padding: "11px 18px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  nok: { background: "rgba(248,113,113,0.12)", color: "#f87171", border: "1px solid rgba(248,113,113,0.4)", borderRadius: 10, padding: "11px 18px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
};
