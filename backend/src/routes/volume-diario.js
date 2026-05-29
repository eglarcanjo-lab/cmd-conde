// v1.0 - Volume Diário
const express = require("express");
const router = express.Router();
const { readSheet } = require("../services/sheets");
const { authMiddleware } = require("../middleware/auth");

router.use(authMiddleware);

function filtrarPorPerfil(dados, usuario, campoSetor = "setor") {
  if (["admin", "director"].includes(usuario.perfil)) return dados;
  if (usuario.perfil === "gv1") return dados.filter((r) => String(r[campoSetor]).startsWith("1"));
  if (usuario.perfil === "gv3") return dados.filter((r) => String(r[campoSetor]).startsWith("3"));
  return dados.filter((r) => String(r[campoSetor]) === String(usuario.cod));
}

// Conta dias úteis (seg–sex) no mês dado
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

// Conta dias úteis de 1 ao dia `dia` (inclusive)
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

// dd/mm/yyyy → Date
function parseData(s) {
  if (!s || !s.includes("/")) return null;
  const [dd, mm, yyyy] = s.split("/");
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
}

// Date → dd/mm/yyyy
function toDataStr(d) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// Data de hoje no fuso de Brasília
function hojeEmBrasilia() {
  const now = new Date();
  const br = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return new Date(br.getFullYear(), br.getMonth(), br.getDate());
}

// Soma volume de um array de registros
function somarVol(arr) {
  return arr.reduce((s, r) => s + (parseFloat(r.volume_hl) || 0), 0);
}

// GET /api/volume-diario/setores
router.get("/setores", async (req, res) => {
  try {
    const dados = await readSheet("volume_diario");
    const filtrados = filtrarPorPerfil(dados, req.user);
    const setores = [...new Set(filtrados.map((r) => r.setor))].sort();
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

    // Resolve data de referência
    let dataRef;
    if (req.query.data) {
      dataRef = parseData(req.query.data);
      if (!dataRef || isNaN(dataRef.getTime())) {
        return res.status(400).json({ error: "Parâmetro data inválido. Use dd/mm/yyyy." });
      }
    } else {
      dataRef = hojeEmBrasilia();
    }

    const dataRefStr = toDataStr(dataRef);

    // Data de comparação: mesmo dia da semana –7 dias
    const dataComp = new Date(dataRef);
    dataComp.setDate(dataComp.getDate() - 7);
    const dataCompStr = toDataStr(dataComp);

    // Lê planilhas em paralelo
    const [volumeDiario, metas, skuFoco] = await Promise.all([
      readSheet("volume_diario"),
      readSheet("metas"),
      readSheet("sku_foco").catch(() => []),
    ]);

    // Aplica filtro de perfil
    let dados = filtrarPorPerfil(volumeDiario, usuario);

    // Filtro adicional de setor (admin/director/gv podem escolher)
    if (req.query.setor && ["admin", "director", "gv1", "gv3"].includes(usuario.perfil)) {
      dados = dados.filter((r) => String(r.setor) === String(req.query.setor));
    }

    // ── Volume do dia e comparação ──────────────────────────────────────────
    const dadosHoje = dados.filter((r) => r.data === dataRefStr);
    const dadosComp = dados.filter((r) => r.data === dataCompStr);
    const volumeHoje = somarVol(dadosHoje);
    const volumeComp = somarVol(dadosComp);
    const deltaHL  = volumeHoje - volumeComp;
    const deltaPct = volumeComp > 0 ? ((volumeHoje - volumeComp) / volumeComp) * 100 : null;

    // ── Meta diária ─────────────────────────────────────────────────────────
    const ano  = dataRef.getFullYear();
    const mes  = dataRef.getMonth(); // 0-based
    const mesRef = `${ano}-${String(mes + 1).padStart(2, "0")}`;

    const metasFiltradas = filtrarPorPerfil(metas, usuario).filter((m) => m.mes_referencia === mesRef);
    const metaMensal = metasFiltradas.reduce(
      (s, m) => s + (parseFloat(String(m.meta_volume || "0").replace(",", ".")) || 0), 0
    );
    const totalDiasUteis = diasUteisMes(ano, mes);
    const metaDiaria = totalDiasUteis > 0 ? metaMensal / totalDiasUteis : 0;

    // ── Acumulado do mês e tendência ────────────────────────────────────────
    const dadosMes = dados.filter((r) => {
      const d = parseData(r.data);
      return d && d.getFullYear() === ano && d.getMonth() === mes && d <= dataRef;
    });
    const volumeAcumMes = somarVol(dadosMes);
    const diasPassados  = diasUteisAte(ano, mes, dataRef.getDate());
    const tendencia     = diasPassados > 0 ? (volumeAcumMes / diasPassados) * totalDiasUteis : 0;

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

    // ── SKU Foco progress ───────────────────────────────────────────────────
    const skuFocoFiltrado = filtrarPorPerfil(skuFoco, usuario).filter(
      (s) => s.mes_referencia === mesRef
    );

    const skuFocoProgress = skuFocoFiltrado.map((sf) => {
      const cod = String(sf.cod_produto || "").trim();
      const meta = parseFloat(String(sf.meta_mensal_hl || "0").replace(",", ".")) || 0;
      const realizadoMes = somarVol(dadosMes.filter((r) => String(r.cod_produto || "").trim() === cod));
      const realizadoHoje = somarVol(dadosHoje.filter((r) => String(r.cod_produto || "").trim() === cod));
      const metaDiariaFoco = totalDiasUteis > 0 ? meta / totalDiasUteis : 0;
      return {
        setor: sf.setor,
        cod_produto: cod,
        nome_produto: sf.nome_produto,
        meta_mensal_hl: meta,
        meta_diaria_hl: Math.round(metaDiariaFoco * 100) / 100,
        realizado_mes_hl: Math.round(realizadoMes * 100) / 100,
        realizado_hoje_hl: Math.round(realizadoHoje * 100) / 100,
        pct_mes:  meta > 0 ? Math.round((realizadoMes  / meta)          * 100) : 0,
        pct_hoje: metaDiariaFoco > 0 ? Math.round((realizadoHoje / metaDiariaFoco) * 100) : 0,
      };
    });

    return res.json({
      data:                      dataRefStr,
      data_comparacao:           dataCompStr,
      volume_hoje_hl:            Math.round(volumeHoje  * 100) / 100,
      volume_comparacao_hl:      Math.round(volumeComp  * 100) / 100,
      delta_hl:                  Math.round(deltaHL     * 100) / 100,
      delta_pct:                 deltaPct !== null ? Math.round(deltaPct * 10) / 10 : null,
      meta_diaria_hl:            Math.round(metaDiaria  * 100) / 100,
      meta_mensal_hl:            Math.round(metaMensal  * 100) / 100,
      pct_meta_diaria:           metaDiaria > 0 ? Math.round((volumeHoje / metaDiaria) * 100) : 0,
      volume_acumulado_mes_hl:   Math.round(volumeAcumMes * 100) / 100,
      tendencia_hl:              Math.round(tendencia    * 100) / 100,
      pct_tendencia:             metaMensal > 0 ? Math.round((tendencia / metaMensal) * 100) : 0,
      dias_uteis_mes:            totalDiasUteis,
      dias_uteis_passados:       diasPassados,
      mes_referencia:            mesRef,
      top_skus:                  topSkus,
      sku_foco:                  skuFocoProgress,
    });
  } catch (err) {
    console.error("Erro volume-diario:", err);
    return res.status(500).json({ error: "Erro ao buscar volume diário." });
  }
});

module.exports = router;
