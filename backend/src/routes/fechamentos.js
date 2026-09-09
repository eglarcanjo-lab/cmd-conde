// Fechamentos — geração de relatórios. 1º: Super Matinal (Fechamento Comercial).
// Volumes por bucket calculados a partir de vendas_cliente_produto (1 linha por
// SKU/mês) → soma cada produto UMA vez por bucket (sem duplicar multi-categoria).
// Marketplace = faturamento (R$) do rv_resultado. Reconhecimento = melhores do
// Atendimento Produtivo (spo_ap_detalhe) do mês anterior.
const express = require("express");
const router = express.Router();
const { readSheet, readSheetMonths } = require("../services/sheets");
const { authMiddleware } = require("../middleware/auth");
const { filtrarPorPerfil } = require("../utils/perfil");

const num = (v) => parseFloat(String(v ?? "0").replace(",", ".")) || 0;
const r1 = (n) => Math.round(n * 10) / 10;
const normCod = (v) => String(v ?? "").trim().replace(/^0+/, "") || "0";
const ROT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const brNow = () => new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));

// Só gestores (relatório de fechamento da operação).
router.use(authMiddleware);
router.use((req, res, next) => {
  if (["admin", "director", "gv1", "gv3"].includes(req.user?.perfil)) return next();
  return res.status(403).json({ error: "Acesso restrito a gestores." });
});

// Buckets de volume (HL) — rótulos conforme produtos_base. Cerveja TT NÃO duplica:
// cada produto conta 1x mesmo tendo várias categorias do conjunto.
const BUCKETS = {
  cerveja_tt:   ["CERVEJA", "CERVEJA ZERO", "BALANCED CHOICE", "GIRO RGB", "HE", "HE RGB", "LITRINHO", "CERVEJA MULTIPACK"],
  rgb:          ["GIRO RGB", "LITRINHO", "HE RGB"],
  high_end:     ["HE", "HE RGB"],
  cerveja_zero: ["CERVEJA ZERO"],
  match:        ["MATCH"],
  nab:          ["NAB", "NAB ZERO"], // NAB total (inclui zero); dedup conta 1x
  nab_zero:     ["NAB ZERO"],
};
const BUCKET_LABEL = {
  cerveja_tt: "Cerveja TT", rgb: "Cerveja RGB", high_end: "High End", cerveja_zero: "Cerveja Zero",
  match: "Match", nab: "NAB", nab_zero: "NAB Zero", marketplace: "Marketplace",
};

router.get("/super-matinal", async (req, res) => {
  try {
    const agora = brNow();
    const ano = agora.getFullYear();
    const mAtual = agora.getMonth(); // 0-based
    const meses = [];
    for (let m = 0; m <= mAtual; m++) meses.push(`${ano}-${String(m + 1).padStart(2, "0")}`);
    const mesAnterior = mAtual > 0 ? `${ano}-${String(mAtual).padStart(2, "0")}` : `${ano - 1}-12`;
    const rotMes = (m) => `${ROT[(Number(m.split("-")[1]) || 1) - 1]}/${m.slice(2, 4)}`;

    const [vendasRaw, prodBase, rvResAll, apDetAll, usuarios] = await Promise.all([
      readSheetMonths("vendas_cliente_produto", "mes_referencia", meses).catch(() => []),
      readSheet("produtos_base").catch(() => []),
      readSheet("rv_resultado").catch(() => []),
      readSheet("spo_ap_detalhe").catch(() => []),
      readSheet("usuarios").catch(() => []),
    ]);
    const vendas = filtrarPorPerfil(vendasRaw, req.user, "setor");

    // cod produto -> Set de categorias (upper)
    const catMap = {};
    prodBase.forEach((p) => {
      const cats = String(p.categorias || p.categoria || "").split(/[,;|]/).map((c) => c.trim().toUpperCase()).filter(Boolean);
      if (cats.length) catMap[normCod(p.cod)] = new Set(cats);
    });
    const bucketSets = {};
    Object.entries(BUCKETS).forEach(([k, arr]) => { bucketSets[k] = new Set(arr); });
    const temBucket = (cats, setb) => { for (const c of cats) if (setb.has(c)) return true; return false; };

    // Volume HL por bucket × mês (dedup: cada linha de produto conta 1x por bucket).
    const vol = {}; // bucket -> { mes -> hl }
    Object.keys(BUCKETS).forEach((k) => { vol[k] = {}; });
    vendas.forEach((r) => {
      const cats = catMap[normCod(r.cod_produto)];
      if (!cats) return;
      const mes = String(r.mes_referencia || "").slice(0, 7);
      const v = num(r.volume_hl);
      if (!mes || v <= 0) return;
      Object.keys(BUCKETS).forEach((k) => { if (temBucket(cats, bucketSets[k])) vol[k][mes] = (vol[k][mes] || 0) + v; });
    });

    // Marketplace (R$) do rv_resultado por mês (no escopo).
    const rvRes = filtrarPorPerfil(rvResAll, req.user, "setor");
    const mktp = {}; // mes -> R$
    rvRes.forEach((r) => {
      const mes = String(r.mes_referencia || r.mes_ref || "").slice(0, 7);
      if (mes) mktp[mes] = (mktp[mes] || 0) + num(r.real_marketplace);
    });

    // Séries por mês + YTD + mês anterior, por bucket.
    const buckets = Object.keys(BUCKET_LABEL).map((k) => {
      const isMktp = k === "marketplace";
      const serie = meses.map((m) => r1(isMktp ? (mktp[m] || 0) : (vol[k]?.[m] || 0)));
      const ytd = r1(serie.reduce((s, x) => s + x, 0));
      const mesAnt = r1(isMktp ? (mktp[mesAnterior] || 0) : (vol[k]?.[mesAnterior] || 0));
      return { chave: k, label: BUCKET_LABEL[k], unidade: isMktp ? "R$" : "HL", serie, ytd, mes_anterior: mesAnt };
    });

    // Reconhecimento — melhores do Atendimento Produtivo do mês anterior.
    const nomeSetor = {};
    usuarios.forEach((u) => { if (u.cod) nomeSetor[String(u.cod).trim()] = String(u.nome || "").trim(); });
    const apDet = filtrarPorPerfil(apDetAll, req.user, "setor")
      .filter((r) => String(r.mes_referencia || "").slice(0, 7) === mesAnterior);
    const reconhecimento = apDet
      .map((r) => ({
        setor: String(r.setor || "").trim(), nome: nomeSetor[String(r.setor || "").trim()] || "",
        ap_ok: String(r.ap_ok || "").trim().toUpperCase() === "SIM",
        kpis_ok: parseInt(r.kpis_ok) || 0,
        positiv_real: num(r.positiv_real),
      }))
      .sort((a, b) => (b.ap_ok - a.ap_ok) || (b.kpis_ok - a.kpis_ok) || (b.positiv_real - a.positiv_real))
      .slice(0, 5);

    return res.json({
      titulo: "Fechamento Comercial · Super Matinal",
      ano, meses, meses_label: meses.map(rotMes),
      mes_anterior: mesAnterior, mes_anterior_label: rotMes(mesAnterior),
      gerado_em: agora.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
      buckets,
      reconhecimento,
    });
  } catch (e) {
    console.error("fechamentos/super-matinal:", e);
    return res.status(500).json({ error: "Erro ao montar a Super Matinal." });
  }
});

module.exports = router;
