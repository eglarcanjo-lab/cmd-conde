// v1.2 - categoria breakdown, sem tendência, sku_foco setor explícito
const express = require("express");
const router = express.Router();
const { readSheet } = require("../services/sheets");
const { authMiddleware } = require("../middleware/auth");

router.use(authMiddleware);

const { filtrarPorPerfil } = require("../utils/perfil");

// Filtro explícito de setor para sku_foco (não reusa filtrarPorPerfil para evitar edge cases)
function filtrarSkuFocoPorPerfil(lista, usuario) {
  const perfil = String(usuario.perfil || "").toLowerCase();
  if (["admin", "director"].includes(perfil)) return lista;
  if (perfil === "gv1") return lista.filter((s) => String(s.setor || "").trim().startsWith("1"));
  if (perfil === "gv3") return lista.filter((s) => String(s.setor || "").trim().startsWith("3"));
  // RN: exato
  const codUsuario = String(usuario.cod || "").trim();
  return lista.filter((s) => String(s.setor || "").trim() === codUsuario);
}

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
    const [volumeDiario, metas, skuFoco, prodBase, statusArq, rvMktp, rvResultado] = await Promise.all([
      readSheet("volume_diario").catch(() => []),
      readSheet("metas").catch(() => []),
      readSheet("sku_foco").catch(() => []),
      readSheet("produtos_base").catch(() => []),
      readSheet("status_arquivos").catch(() => []),
      readSheet("rv_mktp").catch(() => []),
      readSheet("rv_resultado").catch(() => []),
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
    const volumeHoje = somarVol(dadosHoje);
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

    // ── SKU Foco — filtro EXPLÍCITO por setor ───────────────────────────────
    const skuFocoFiltrado = filtrarSkuFocoPorPerfil(skuFoco, usuario)
      .filter((s) => normalizeMesRef(s.mes_referencia) === mesRef);

    const skuFocoProgress = skuFocoFiltrado.map((sf) => {
      const cod          = normCod(sf.cod_produto);
      const meta         = parseFloat(String(sf.meta_mensal_hl || "0").replace(",", ".")) || 0;
      const metaDiaFoco  = totalDiasUteis > 0 ? meta / totalDiasUteis : 0;
      const realizadoMes  = somarVol(dadosMes.filter( (r) => normCod(r.cod_produto) === cod));
      const realizadoHoje = somarVol(dadosHoje.filter((r) => normCod(r.cod_produto) === cod));
      return {
        setor:            sf.setor,
        cod_produto:      cod,
        nome_produto:     sf.nome_produto,
        motivo:           sf.motivo || "",
        meta_mensal_hl:   meta,
        meta_diaria_hl:   Math.round(metaDiaFoco  * 100) / 100,
        realizado_mes_hl: Math.round(realizadoMes  * 100) / 100,
        realizado_hoje_hl:Math.round(realizadoHoje * 100) / 100,
        pct_mes:  meta        > 0 ? Math.round((realizadoMes  / meta)       * 100) : 0,
        pct_hoje: metaDiaFoco > 0 ? Math.round((realizadoHoje / metaDiaFoco) * 100) : 0,
      };
    });

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
      categorias:              categorias,
      top_skus:                topSkus,
      top_skus_mes:            topSkusMes,
      sku_foco:                skuFocoProgress,
    });
  } catch (err) {
    console.error("Erro volume-diario:", err);
    return res.status(500).json({ error: "Erro ao buscar volume diário." });
  }
});

module.exports = router;
