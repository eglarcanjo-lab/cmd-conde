// SPO — botão "Exportar p/ RPS" (admin/diretor): Excel com Score 5 (Faturamento, item 12, e
// Portfólio Ideal, item 24) e PDVs Aderidos (Planificador TTC, KPI 8) por RN + os PDVs mais
// próximos de bater. Vai para Desktop\RPS\1 - Exports do BI\SPO (a planilha da RPS lê o mais recente).
// Meta por RN = rateio da meta da operação (12/24: nº de PDVs; 8: %), igual às telas do SPO.
import { useState } from "react";
import api from "../../services/api";

const num = (v) => {
  let s = String(v ?? "").replace(/[R$\s%]/g, "");
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  return parseFloat(s) || 0;
};
const r1 = (n) => Math.round(n * 10) / 10;

export default function ExportarRps() {
  const [baixando, setBaixando] = useState(false);

  const exportar = async () => {
    setBaixando(true);
    try {
      const get = (u) => api.get(u).then((r) => r.data).catch(() => []);
      const [metas, fatRes, fatDet, portRes, portDet, ttc, XLSX] = await Promise.all([
        get("/api/spo/painel/metas"), get("/api/spo/score5/resumo"), get("/api/spo/score5/detalhe"),
        get("/api/spo/portfolio-ideal/resumo"), get("/api/spo/portfolio-ideal/detalhe"),
        get("/api/spo/politica-comercial/pdvs"), import("xlsx-js-style"),
      ]);
      const hoje = new Date();
      const mes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
      const metaOp = (item) => {
        const m = (metas || []).find((x) => String(x.item) === String(item) && x.mes === mes);
        return m && m.meta !== "" && m.meta != null ? num(m.meta) : null;
      };
      const mFat = metaOp(12), mPort = metaOp(24), mTtc = metaOp(8);
      const planif = ttc?.pdvs || [];
      const diaPorPdv = {};
      [...portDet, ...planif].forEach((p) => { if (p.dia_visita) diaPorPdv[String(p.cod_pdv)] = p.dia_visita; });

      // ── por RN ───────────────────────────────────────────────────────────
      const rn = {};
      const de = (s) => (rn[s] = rn[s] || { setor: s, fat_total: 0, fat_ok: 0, port_total: 0, port_ok: 0,
        ttc_base: 0, ttc_aderidos: 0, ttc_executados: 0, ttc_ad_exec: 0, ttc_ad_sem_exec: 0, ttc_quase: 0 });
      fatRes.filter((r) => r.setor !== "OPERACAO").forEach((r) => { const o = de(String(r.setor)); o.fat_total += num(r.pdvs_total); o.fat_ok += num(r.pdvs_ok); });
      portRes.filter((r) => r.setor !== "OPERACAO").forEach((r) => { const o = de(String(r.setor)); o.port_total += num(r.pdvs_total); o.port_ok += num(r.pdvs_ideais); });
      const quase = (p) => p.aderido !== "SIM" && num(p.peso_aderido) >= 50 && num(p.peso_aderido) < 80;
      planif.forEach((p) => {
        const o = de(String(p.setor)); o.ttc_base++;
        if (p.aderido === "SIM") o.ttc_aderidos++;
        if (p.executado === "SIM") o.ttc_executados++;
        if (p.aderido_exec === "SIM") o.ttc_ad_exec++;
        if (p.aderido === "SIM" && p.executado !== "SIM") o.ttc_ad_sem_exec++;
        if (quase(p)) o.ttc_quase++;
      });
      const linhasRn = Object.values(rn).sort((a, b) => a.setor.localeCompare(b.setor));
      const opFat = linhasRn.reduce((s, o) => s + o.fat_total, 0), opPort = linhasRn.reduce((s, o) => s + o.port_total, 0);
      linhasRn.forEach((o) => {
        o.fat_meta = mFat != null && opFat > 0 ? Math.ceil(o.fat_total * mFat / opFat) : "";
        o.port_meta = mPort != null && opPort > 0 ? Math.ceil(o.port_total * mPort / opPort) : "";
        o.ttc_meta = mTtc != null ? Math.ceil(o.ttc_base * mTtc / 100) : "";
      });

      // ── PDVs mais próximos de bater (já ordenados; chave = tipo|ordem) ──
      const prox = [];
      const add = (tipo, lista) => lista.forEach((p, i) => prox.push({ chave: `${tipo}|${i + 1}`, tipo, ordem: i + 1, ...p }));
      add("Faturamento", fatDet
        .filter((d) => d.bateu !== "Sim" && num(d.meta_task) > 0)
        .map((d) => { const pc = num(d.real_task) / num(d.meta_task);
          return { setor: String(d.setor), cod_pdv: String(d.cod_pdv), nome_pdv: d.nome_pdv, dia_visita: diaPorPdv[String(d.cod_pdv)] || "",
            indicador: r1(pc * 100), detalhe: `real ${num(d.real_task).toLocaleString("pt-BR")} de ${num(d.meta_task).toLocaleString("pt-BR")}` }; })
        .sort((a, b) => b.indicador - a.indicador));
      add("Portfolio", portDet
        .filter((d) => d.portfolio_ideal !== "SIM")
        .map((d) => { const falta = String(d.itens_faltantes || "").split(",").map((s) => s.trim()).filter((s) => s && s !== "—");
          return { setor: String(d.setor), cod_pdv: String(d.cod_pdv), nome_pdv: d.nome_pdv, dia_visita: d.dia_visita || "",
            indicador: falta.length, detalhe: falta.length ? `falta: ${falta.join(", ")}` : "falta: (sem item listado)" }; })
        .sort((a, b) => a.indicador - b.indicador || a.setor.localeCompare(b.setor)));
      add("TTC sem execucao", planif
        .filter((p) => p.aderido === "SIM" && p.executado !== "SIM")
        .map((p) => ({ setor: String(p.setor), cod_pdv: String(p.cod_pdv), nome_pdv: p.nome_pdv, dia_visita: p.dia_visita || "",
          indicador: num(p.peso_aderido), detalhe: "aderido: falta a foto de TTC validada" }))
        .sort((a, b) => a.setor.localeCompare(b.setor) || b.indicador - a.indicador));
      add("TTC quase aderido", planif.filter(quase)
        .map((p) => ({ setor: String(p.setor), cod_pdv: String(p.cod_pdv), nome_pdv: p.nome_pdv, dia_visita: p.dia_visita || "",
          indicador: num(p.peso_aderido), detalhe: `${num(p.peso_aderido)}% do volume RGB no TTC (precisa 80%)` }))
        .sort((a, b) => b.indicador - a.indicador));

      const dd = String(hoje.getDate()).padStart(2, "0"), mm = String(hoje.getMonth() + 1).padStart(2, "0");
      const info = [["campo", "valor"], ["data_export", `${dd}/${mm}/${hoje.getFullYear()}`], ["mes_referencia", mes],
        ["meta_fat_op_pdvs", mFat ?? ""], ["meta_port_op_pdvs", mPort ?? ""], ["meta_ttc_op_pct", mTtc ?? ""],
        ["ttc_atualizado_em", ttc?.atualizado_em || ""]];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(info), "Info");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhasRn, { header: ["setor", "fat_total", "fat_ok", "fat_meta",
        "port_total", "port_ok", "port_meta", "ttc_base", "ttc_aderidos", "ttc_executados", "ttc_ad_exec", "ttc_ad_sem_exec", "ttc_quase", "ttc_meta"] }), "RN");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(prox, { header: ["chave", "tipo", "ordem", "setor", "cod_pdv",
        "nome_pdv", "dia_visita", "indicador", "detalhe"] }), "Proximos");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet((metas || []).filter((m) => ["8", "12", "24"].includes(String(m.item)))
        .map((m) => ({ item: Number(m.item), mes: m.mes, meta: m.meta === "" ? "" : num(m.meta), real: m.real === "" ? "" : num(m.real) })),
        { header: ["item", "mes", "meta", "real"] }), "Metas");
      XLSX.writeFile(wb, `${mes} SPO HOP (${dd}-${mm}).xlsx`);
    } catch {
      alert("Erro ao exportar a base da RPS.");
    } finally {
      setBaixando(false);
    }
  };

  return (
    <button data-sem-foto onClick={exportar} disabled={baixando}
      title="Excel para a RPS: Score 5 (faturamento e portfólio) e PDVs aderidos TTC por RN + PDVs mais próximos de bater"
      style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: "8px", color: "#fff",
        padding: "5px 10px", cursor: "pointer", fontSize: "0.8rem", fontFamily: "inherit", flexShrink: 0 }}>
      {baixando ? "⏳ Gerando..." : "⬇️ Exportar p/ RPS"}
    </button>
  );
}
