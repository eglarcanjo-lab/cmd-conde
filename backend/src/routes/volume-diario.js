// v1.3 - categoria breakdown, sem tendência (SKU Foco removido em v3.85.3)
const express = require("express");
const router = express.Router();
const { readSheet } = require("../services/sheets");
const { authMiddleware } = require("../middleware/auth");

router.use(authMiddleware);

const { filtrarPorPerfil } = require("../utils/perfil");

function diasUteisMes(ano, mes) {
  let count = 0;
  const d = new Date(ano, mes, 1);
  while (d.getMonth() === mes) {
    const dow = d.getDay();
    if (dow >= 1 && dow <= 5) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

function diasUteisAte(ano, mes, dia) {
  let count = 0;
  const d = new Date(ano, mes, 1);
  while (d.getDate() <= dia && d.getMonth() === mes) {
    const dow = d.getDay();
    if (dow >= 1 && dow <= 5) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

function normalizeMesRef(v) {
  const s = String(v ?? "").trim();
  const n = parseFloat(s);
  if (!isNaN(n) && n > 40000 && n < 60000) {
    const d = new Date(Math.round((n - 25569) * 86400 * 1000));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  return s;
}

function parseData(s) {
  if (!s || !s.includes("/")) return null;
  const [dd, mm, yyyy] = s.split("/");
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
}

function toDataStr(d) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function hojeEmBrasilia() {
  const now = new Date();
  const br  = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return new Date(br.getFullYear(), br.getMonth(), br.getDate());
}

function somarVol(arr) {
  return arr.reduce((s, r) => s + (parseFloat(r.volume_hl) || 0), 0);
}

// Normaliza código de produto: remove zeros à esquerda
function normCod(v) {
  const s = String(v || "").trim();
  return s.replace(/^0+/, "") || s;
}

// GET /api/volume-diario/setores
router.get("/setores", async (req, res) => {
  try {
    const dados = await readSheet("volume_diario").catch(() => []);
    const filtrados = filtrarPorPerfil(dados, req.user);
    const setores = [...new Set(filtrados.map((r) => String(r.setor || "").trim()).filter(Boolean))].sort();
    return res.json(setores);
  } catch (err) {
    console.error("volume-diario/setores:", err);
    return res.status(500).json({ error: "Erro ao buscar setores." });
  }
});

// Grupos da RPS por produto (categorias do produtos_base + as "mães"), em "|A|B|"
// para a planilha somar com SUMIFS("*|RGB TT|*"). Mesma régua de categorias_mae do processador.
const RPS_RGB_TT = ["GIRO RGB", "LITRINHO", "TRIMARCA RGB HE (ORIGINAL)", "TRIMARCA RGB HE (STELLA)", "TRIMARCA RGB HE (SPATEN)"];
const RPS_MAES = [
  ["CERVEJA TT", ["CERVEJA", "CERVEJA ZERO", "CERVEJA MULTIPACK", "HE", "HE RGB", ...RPS_RGB_TT]],
  ["RGB TT", RPS_RGB_TT],
  ["HIGH END", ["HE", "HE RGB", "TRIMARCA RGB HE (ORIGINAL)", "TRIMARCA RGB HE (STELLA)", "TRIMARCA RGB HE (SPATEN)"]],
  ["NAB TT", ["NAB", "NAB ZERO"]],
];
function gruposRps(cats) {
  const s = new Set(cats);
  RPS_MAES.forEach(([mae, filhas]) => { if (filhas.some((f) => s.has(f))) s.add(mae); });
  return s.size ? `|${[...s].join("|")}|` : "|SEM CATEGORIA|";
}

// GET /api/volume-diario/rps?data=dd/mm/yyyy — base do slide de Volume da RPS (admin/diretor).
// Mês da data até a data: (a) setor × categoria da meta (meta × real, igual aos cartões da tela)
// e (b) setor × produto com o volume do mês + grupos (as aberturas saem na planilha).
router.get("/rps", async (req, res) => {
  try {
    if (!["admin", "director"].includes(req.user.perfil)) return res.status(403).json({ error: "Sem permissão." });
    const dataRef = req.query.data ? parseData(req.query.data) : hojeEmBrasilia();
    if (!dataRef || isNaN(dataRef.getTime())) return res.status(400).json({ error: "Parâmetro data inválido. Use dd/mm/yyyy." });

    const [volumeDiario, metas, prodBase, statusArq, rvMktp, rvResultado] = await Promise.all([
      readSheet("volume_diario").catch(() => []),
      readSheet("metas").catch(() => []),
      readSheet("produtos_base").catch(() => []),
      readSheet("status_arquivos").catch(() => []),
      readSheet("rv_mktp").catch(() => []),
      readSheet("rv_resultado").catch(() => []),
    ]);
    const ano = dataRef.getFullYear(), mes = dataRef.getMonth();
    const mesRef = `${ano}-${String(mes + 1).padStart(2, "0")}`;
    const num = (v) => {
      let s = String(v ?? "").trim();
      if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
      else if (s.includes(",")) s = s.replace(",", ".");
      return parseFloat(s) || 0;
    };
    const r3 = (n) => Math.round(n * 1000) / 1000;

    const catMap = {};
    prodBase.forEach((p) => {
      const cats = String(p.categorias || "").split("|").map((c) => c.trim().toUpperCase()).filter(Boolean);
      if (normCod(p.cod) && cats.length) catMap[normCod(p.cod)] = cats;
    });

    const dadosMes = volumeDiario.filter((r) => {
      const d = parseData(r.data);
      return d && d.getFullYear() === ano && d.getMonth() === mes && d <= dataRef;
    });
    const ultimoDia = dadosMes.reduce((m, r) => { const d = parseData(r.data); return d > m ? d : m; }, new Date(ano, mes, 1));

    // (b) setor × produto
    const prod = {};
    dadosMes.forEach((r) => {
      const setor = String(r.setor || "").trim(), cod = normCod(r.cod_produto);
      const k = `${setor}|${cod}`;
      if (!prod[k]) prod[k] = { setor, cod_produto: cod, nome_produto: String(r.nome_produto || "").trim(), grupos: gruposRps(catMap[cod] || []), volume_hl: 0 };
      prod[k].volume_hl += parseFloat(r.volume_hl) || 0;
    });
    const produtos = Object.values(prod).map((p) => ({ ...p, volume_hl: r3(p.volume_hl) }))
      .sort((a, b) => a.setor.localeCompare(b.setor) || b.volume_hl - a.volume_hl);

    // (a) setor × categoria da meta — real pela mesma regra dos cartões (categoria base do produto)
    const realSetorCat = {};
    dadosMes.forEach((r) => {
      const setor = String(r.setor || "").trim();
      (catMap[normCod(r.cod_produto)] || []).forEach((c) => {
        const k = `${setor}|${c}`;
        realSetorCat[k] = (realSetorCat[k] || 0) + (parseFloat(r.volume_hl) || 0);
      });
    });
    const mktpReal = {};
    const mktpFonte = rvMktp.some((r) => normalizeMesRef(r.mes_referencia) === mesRef && num(r.gmv_mktp_real) > 0)
      ? rvMktp.map((r) => [r, num(r.gmv_mktp_real)]) : rvResultado.map((r) => [r, num(r.real_marketplace)]);
    mktpFonte.forEach(([r, v]) => {
      if (normalizeMesRef(r.mes_referencia) !== mesRef) return;
      const s = String(r.setor || "").trim();
      mktpReal[s] = (mktpReal[s] || 0) + v;
    });
    const categorias = [];
    metas.filter((m) => normalizeMesRef(m.mes_referencia) === mesRef).forEach((m) => {
      const cat = String(m.categoria || "").trim().toUpperCase(), setor = String(m.setor || "").trim();
      if (!cat || cat === "PONTOS FORCE") return;
      const fat = cat.includes("FATURAMENTO");
      const base = cat.replace(/\s*\((VOLUME|FATURAMENTO)\)\s*$/i, "").trim();
      categorias.push({
        setor, categoria: cat, unidade: fat ? "R$" : "HL", meta: r3(num(m.meta_volume)),
        real: r3(fat ? (mktpReal[setor] || 0) : (realSetorCat[`${setor}|${base}`] || 0)),
      });
    });
    // Setor com venda e sem meta (997/995 = PDVs sem RN): entra com meta 0, p/ o total bater com a tela
    const comMeta = new Set(categorias.map((c) => `${c.setor}|${c.categoria.replace(/\s*\((VOLUME|FATURAMENTO)\)\s*$/i, "")}`));
    const catsMeta = [...new Set(categorias.filter((c) => c.unidade === "HL").map((c) => c.categoria))];
    Object.entries(realSetorCat).forEach(([k, v]) => {
      const [setor, base] = k.split("|");
      const cat = catsMeta.find((c) => c.replace(/\s*\(VOLUME\)\s*$/i, "") === base);
      if (cat && !comMeta.has(k)) categorias.push({ setor, categoria: cat, unidade: "HL", meta: 0, real: r3(v) });
    });
    categorias.sort((a, b) => a.categoria.localeCompare(b.categoria) || a.setor.localeCompare(b.setor));

    const linhaPedidos = statusArq.find((r) => /pedidos|03014701/i.test(String(r.arquivo || "")));
    return res.json({
      mes_referencia: mesRef,
      data_ref: toDataStr(dataRef),
      ultimo_dia_com_venda: dadosMes.length ? toDataStr(ultimoDia) : "",
      dias_uteis_mes: diasUteisMes(ano, mes),
      dias_uteis_passados: diasUteisAte(ano, mes, dataRef.getDate()),
      atualizado_em: linhaPedidos ? String(linhaPedidos.atualizado_em || "").trim() : "",
      categorias, produtos,
    });
  } catch (err) {
    console.error("volume-diario/rps:", err);
    return res.status(500).json({ error: "Erro ao montar a base da RPS." });
  }
});

// GET /api/volume-diario?data=dd/mm/yyyy&setor=101
router.get("/", async (req, res) => {
  try {
    const usuario = req.user;

    let dataRef;
    if (req.query.data) {
      dataRef = parseData(req.query.data);
      if (!dataRef || isNaN(dataRef.getTime())) {
        return res.status(400).json({ error: "Parâmetro data inválido. Use dd/mm/yyyy." });
      }
    } else {
      dataRef = hojeEmBrasilia();
    }

    const dataRefStr  = toDataStr(dataRef);
    const dataComp    = new Date(dataRef);
    dataComp.setDate(dataComp.getDate() - 7);
    const dataCompStr = toDataStr(dataComp);

    // Lê todas as planilhas necessárias em paralelo
    const [volumeDiario, metas, prodBase, statusArq, rvMktp, rvResultado, coraDia] = await Promise.all([
      readSheet("volume_diario").catch(() => []),
      readSheet("metas").catch(() => []),
      readSheet("produtos_base").catch(() => []),
      readSheet("status_arquivos").catch(() => []),
      readSheet("rv_mktp").catch(() => []),
      readSheet("rv_resultado").catch(() => []),
      readSheet("cora_dia").catch(() => []),
    ]);

    // Horário da última importação de pedidos (atualiza o Volume Diário)
    const linhaPedidos = statusArq.find((r) => /pedidos|03014701/i.test(String(r.arquivo || "")));
    const atualizadoEm = linhaPedidos ? String(linhaPedidos.atualizado_em || "").trim() : "";

    // ── Mapa código produto → TODAS as categorias (em caixa alta) ───────────
    const catMap = {};
    prodBase.forEach((p) => {
      const cod  = normCod(p.cod);
      const cats = String(p.categorias || "").split("|").map((c) => c.trim().toUpperCase()).filter(Boolean);
      if (cod && cats.length > 0) catMap[cod] = cats;
    });

    // ── Filtra volume por perfil ────────────────────────────────────────────
    let dados = filtrarPorPerfil(
      volumeDiario.map((r) => ({ ...r, setor: String(r.setor || "").trim() })),
      usuario
    );
    if (req.query.setor && ["admin", "director", "gv1", "gv3"].includes(usuario.perfil)) {
      dados = dados.filter((r) => r.setor === String(req.query.setor).trim());
    }

    // ── Volume do dia / comparação ─────────────────────────────────────────
    const dadosHoje = dados.filter((r) => r.data === dataRefStr);
    const dadosComp = dados.filter((r) => r.data === dataCompStr);
    // Painel do dia igual à "Visão geral" do CORA (cora_dia: todos os setores, inclusive 997
    // = PDVs sem RN, e todas as situações do item). Dia = tudo · Operação = Dia − anulados.
    let coraEsc = filtrarPorPerfil(coraDia.map((r) => ({ ...r, setor: String(r.setor || "").trim() })), usuario)
      .filter((r) => r.data === dataRefStr);
    if (req.query.setor && ["admin", "director", "gv1", "gv3"].includes(usuario.perfil)) {
      coraEsc = coraEsc.filter((r) => r.setor === String(req.query.setor).trim());
    }
    const r2 = (n) => Math.round(n * 1000) / 1000;
    let cora = null;
    if (coraEsc.length) {
      const sit = (nome) => somarVol(coraEsc.filter((r) => String(r.situacao || "").toUpperCase() === nome));
      const faltas = coraEsc.filter((r) => String(r.situacao || "").toUpperCase() === "FALTA");
      const porPdv = {}, porProd = {};
      faltas.forEach((r) => {
        const v = parseFloat(r.volume_hl) || 0;
        const kp = `${r.setor}|${r.cod_pdv}`;
        const p = (porPdv[kp] = porPdv[kp] || { setor: r.setor, cod_pdv: r.cod_pdv, nome_pdv: r.nome_pdv, volume_hl: 0, itens: [] });
        p.volume_hl += v; p.itens.push({ cod_produto: r.cod_produto, nome_produto: r.nome_produto, volume_hl: r2(v) });
        const kq = normCod(r.cod_produto);
        const q = (porProd[kq] = porProd[kq] || { cod_produto: kq, nome_produto: r.nome_produto, volume_hl: 0, pdvs: new Set() });
        q.volume_hl += v; q.pdvs.add(kp);
      });
      const dia = somarVol(coraEsc);
      cora = {
        dia: r2(dia), operacao: r2(dia - sit("ANULADO")), atendidos: r2(sit("ATENDIDO")),
        ag_alocacao: r2(sit("AGUARDANDO_ALOCACAO")), ag_atendimento: r2(sit("AGUARDANDO_ATENDIMENTO")),
        faltas: r2(sit("FALTA")), anulados: r2(sit("ANULADO")),
        sem_rn: r2(somarVol(coraEsc.filter((r) => ["997", "995"].includes(r.setor)))),
        faltas_pdv: Object.values(porPdv).map((p) => ({ ...p, volume_hl: r2(p.volume_hl), itens: p.itens.sort((a, b) => b.volume_hl - a.volume_hl) }))
          .sort((a, b) => b.volume_hl - a.volume_hl),
        faltas_produto: Object.values(porProd).map((q) => ({ cod_produto: q.cod_produto, nome_produto: q.nome_produto, volume_hl: r2(q.volume_hl), pdvs: q.pdvs.size }))
          .sort((a, b) => b.volume_hl - a.volume_hl),
      };
    }
    // Dia atual (marcação): o total do dia = o "Dia" do painel do CORA (inclui os PDVs sem RN).
    const ehHoje = dataRefStr === toDataStr(hojeEmBrasilia());
    const volumeHoje = cora && ehHoje ? cora.dia : somarVol(dadosHoje);
    const volumeComp = somarVol(dadosComp);
    const deltaHL    = volumeHoje - volumeComp;
    const deltaPct   = volumeComp > 0 ? ((volumeHoje - volumeComp) / volumeComp) * 100 : null;

    // ── Datas e metas ───────────────────────────────────────────────────────
    const ano    = dataRef.getFullYear();
    const mes    = dataRef.getMonth();
    const mesRef = `${ano}-${String(mes + 1).padStart(2, "0")}`;

    const totalDiasUteis = diasUteisMes(ano, mes);
    const diasPassados   = diasUteisAte(ano, mes, dataRef.getDate());

    // Só categorias de VOLUME (Marketplace=faturamento e Pontos Force ficam de fora)
    const ehVolume = (cat) => {
      const c = String(cat || "").toUpperCase();
      return !c.includes("FATURAMENTO") && c !== "PONTOS FORCE";
    };

    let metasFiltradas = filtrarPorPerfil(metas, usuario)
      .filter((m) => normalizeMesRef(m.mes_referencia) === mesRef);
    // Respeita o setor selecionado (senão soma/duplica todos os setores)
    if (req.query.setor && ["admin", "director", "gv1", "gv3"].includes(usuario.perfil)) {
      metasFiltradas = metasFiltradas.filter((m) => String(m.setor).trim() === String(req.query.setor).trim());
    }

    // Meta de VOLUME (HL) — não soma faturamento (R$) nem pontos
    const metaMensal = metasFiltradas
      .filter((m) => ehVolume(m.categoria))
      .reduce((s, m) => s + (parseFloat(String(m.meta_volume || "0").replace(",", ".")) || 0), 0);
    const metaDiaria = totalDiasUteis > 0 ? metaMensal / totalDiasUteis : 0;

    // ── Acumulado do mês ────────────────────────────────────────────────────
    const dadosMes = dados.filter((r) => {
      const d = parseData(r.data);
      return d && d.getFullYear() === ano && d.getMonth() === mes && d <= dataRef;
    });
    const volumeAcumMes = somarVol(dadosMes);

    // ── Volume por categoria (breakdown) ────────────────────────────────────
    // Soma o volume em CADA categoria do produto (um produto pode ter mais de uma).
    function volPorCategoria(linhas) {
      const m = {};
      linhas.forEach((r) => {
        const cats = catMap[normCod(r.cod_produto)];
        if (!cats) return;
        const v = parseFloat(r.volume_hl) || 0;
        cats.forEach((cat) => { m[cat] = (m[cat] || 0) + v; });
      });
      return m;
    }
    const catVolHoje = volPorCategoria(dadosHoje);
    const catVolMes  = volPorCategoria(dadosMes);

    // Categoria da meta ("CERVEJA (VOLUME)") → categoria do produto ("CERVEJA")
    const baseCat = (s) =>
      String(s || "").toUpperCase().replace(/\s*\((VOLUME|FATURAMENTO)\)\s*$/i, "").trim();

    // Consolida as metas por categoria (soma os setores do escopo) → 1 card cada.
    const metaPorCat = {};
    metasFiltradas.forEach((m) => {
      const cat = String(m.categoria || "").trim();
      const v   = parseFloat(String(m.meta_volume || "0").replace(",", ".")) || 0;
      if (!cat || v <= 0 || !ehVolume(cat)) return;
      metaPorCat[cat] = (metaPorCat[cat] || 0) + v;
    });

    // Top SKUs de uma categoria (volume do mês, com o do dia junto)
    function topSkusDaCategoria(base) {
      const m = {};
      dadosMes.forEach((r) => {
        const cats = catMap[normCod(r.cod_produto)];
        if (!cats || !cats.includes(base)) return;
        const cod = String(r.cod_produto || "").trim();
        if (!cod) return;
        if (!m[cod]) m[cod] = { cod_produto: cod, nome_produto: String(r.nome_produto || "").trim(), volume_mes_hl: 0, volume_hoje_hl: 0 };
        const v = parseFloat(r.volume_hl) || 0;
        m[cod].volume_mes_hl += v;
        if (r.data === dataRefStr) m[cod].volume_hoje_hl += v;
      });
      return Object.values(m)
        .sort((a, b) => b.volume_mes_hl - a.volume_mes_hl)
        .slice(0, 15)
        .map((s) => ({ ...s, volume_mes_hl: Math.round(s.volume_mes_hl * 100) / 100, volume_hoje_hl: Math.round(s.volume_hoje_hl * 100) / 100 }));
    }

    const categoriasBreakdown = Object.entries(metaPorCat)
      .map(([cat, metaVol]) => {
        const base    = baseCat(cat);
        const metaDia = totalDiasUteis > 0 ? metaVol / totalDiasUteis : 0;
        const volHoje = catVolHoje[base] || 0;
        const volMes  = catVolMes[base]  || 0;
        return {
          categoria:      cat,
          unidade:        "HL",
          meta_mensal_hl: Math.round(metaVol * 100) / 100,
          meta_diaria_hl: Math.round(metaDia * 100) / 100,
          volume_hoje_hl: Math.round(volHoje  * 100) / 100,
          volume_mes_hl:  Math.round(volMes   * 100) / 100,
          pct_dia: metaDia > 0 ? Math.round((volHoje / metaDia) * 100) : 0,
          pct_mes: metaVol > 0 ? Math.round((volMes  / metaVol) * 100) : 0,
          top_skus: topSkusDaCategoria(base),
        };
      })
      .sort((a, b) => b.meta_mensal_hl - a.meta_mensal_hl);

    // ── Marketplace (FATURAMENTO em R$) — meta das metas + realizado de rv ─────
    // Parser BR robusto (aceita "39.597,00", "39597", "39597.5")
    const parseBR = (v) => {
      let s = String(v ?? "").trim();
      if (!s) return 0;
      if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
      else if (s.includes(",")) s = s.replace(",", ".");
      return parseFloat(s) || 0;
    };
    const noEscopo = (lista) => {
      let l = filtrarPorPerfil(lista, usuario);
      if (req.query.setor && ["admin", "director", "gv1", "gv3"].includes(usuario.perfil)) {
        l = l.filter((r) => String(r.setor).trim() === String(req.query.setor).trim());
      }
      return l;
    };

    const mktpMeta = metasFiltradas
      .filter((m) => String(m.categoria || "").toUpperCase().includes("FATURAMENTO"))
      .reduce((s, m) => s + parseBR(m.meta_volume), 0);

    // Realizado: tenta rv_mktp; se vier 0, cai no rv_resultado (mesma fonte do RV)
    let mktpReal = noEscopo(rvMktp.filter((r) => normalizeMesRef(r.mes_referencia) === mesRef))
      .reduce((s, r) => s + parseBR(r.gmv_mktp_real), 0);
    if (mktpReal === 0) {
      mktpReal = noEscopo(rvResultado.filter((r) => normalizeMesRef(r.mes_referencia) === mesRef))
        .reduce((s, r) => s + parseBR(r.real_marketplace), 0);
    }

    const categorias = [...categoriasBreakdown];
    if (mktpMeta > 0 || mktpReal > 0) {
      categorias.push({
        categoria:     "MARKETPLACE (FATURAMENTO)",
        unidade:       "R$",
        meta_mensal_rs: Math.round(mktpMeta * 100) / 100,
        realizado_mes_rs: Math.round(mktpReal * 100) / 100,
        pct_mes: mktpMeta > 0 ? Math.round((mktpReal / mktpMeta) * 100) : 0,
        top_skus: [],
      });
    }

    // ── Top SKUs do dia ─────────────────────────────────────────────────────
    const skuMap = {};
    dadosHoje.forEach((r) => {
      const cod  = String(r.cod_produto  || "").trim();
      const nome = String(r.nome_produto || "").trim();
      if (!cod) return;
      if (!skuMap[cod]) skuMap[cod] = { cod_produto: cod, nome_produto: nome, volume_hl: 0 };
      skuMap[cod].volume_hl += parseFloat(r.volume_hl) || 0;
    });
    const topSkus = Object.values(skuMap)
      .sort((a, b) => b.volume_hl - a.volume_hl)
      .slice(0, 10)
      .map((s) => ({ ...s, volume_hl: Math.round(s.volume_hl * 100) / 100 }));

    // ── Top SKUs do MÊS (para o modo "mês inteiro") ─────────────────────────
    const skuMapMes = {};
    dadosMes.forEach((r) => {
      const cod  = String(r.cod_produto  || "").trim();
      const nome = String(r.nome_produto || "").trim();
      if (!cod) return;
      if (!skuMapMes[cod]) skuMapMes[cod] = { cod_produto: cod, nome_produto: nome, volume_hl: 0 };
      skuMapMes[cod].volume_hl += parseFloat(r.volume_hl) || 0;
    });
    const topSkusMes = Object.values(skuMapMes)
      .sort((a, b) => b.volume_hl - a.volume_hl)
      .slice(0, 15)
      .map((s) => ({ ...s, volume_hl: Math.round(s.volume_hl * 100) / 100 }));

    return res.json({
      data:                    dataRefStr,
      data_comparacao:         dataCompStr,
      volume_hoje_hl:          Math.round(volumeHoje    * 100) / 100,
      volume_comparacao_hl:    Math.round(volumeComp    * 100) / 100,
      delta_hl:                Math.round(deltaHL       * 100) / 100,
      delta_pct:               deltaPct !== null ? Math.round(deltaPct * 10) / 10 : null,
      meta_diaria_hl:          Math.round(metaDiaria    * 100) / 100,
      meta_mensal_hl:          Math.round(metaMensal    * 100) / 100,
      pct_meta_diaria:         metaDiaria > 0 ? Math.round((volumeHoje / metaDiaria) * 100) : 0,
      volume_acumulado_mes_hl: Math.round(volumeAcumMes * 100) / 100,
      dias_uteis_mes:          totalDiasUteis,
      dias_uteis_passados:     diasPassados,
      mes_referencia:          mesRef,
      atualizado_em:           atualizadoEm,
      cora:                    cora,
      categorias:              categorias,
      top_skus:                topSkus,
      top_skus_mes:            topSkusMes,
    });
  } catch (err) {
    console.error("Erro volume-diario:", err);
    return res.status(500).json({ error: "Erro ao buscar volume diário." });
  }
});

module.exports = router;
