// Cobertura & Distribuição por SKU — visão consolidada (GV / diretoria / admin).
// Cobertura = nº de PDVs que compraram o SKU (qualquer quantidade = 1).
// Distribuição = soma de CAIXAS (Volume ÷ HL Comercial do produto).
const express = require("express");
const router = express.Router();
const { readSheet } = require("../services/sheets");
const { authMiddleware } = require("../middleware/auth");

router.use(authMiddleware);

const num = (v) => parseFloat(String(v ?? "0").replace(",", ".")) || 0;
const r1 = (n) => Math.round(n * 10) / 10;
const r3 = (n) => Math.round(n * 1000) / 1000;
const normCod = (v) => String(v ?? "").trim().replace(/^0+/, "") || "0";

// Só gestores (RN não acessa esta visão consolidada)
function escopoPerfil(usuario) {
  const p = usuario.perfil;
  if (["admin", "director"].includes(p)) return { ok: true, filtro: () => true };
  if (p === "gv1") return { ok: true, filtro: (s) => String(s).startsWith("1") };
  if (p === "gv3") return { ok: true, filtro: (s) => String(s).startsWith("3") };
  return { ok: false };
}

// GET /api/cobertura-sku?q=33857  (q = código do SKU ou parte do nome)
router.get("/", async (req, res) => {
  try {
    const esc = escopoPerfil(req.user);
    if (!esc.ok) return res.status(403).json({ error: "Acesso restrito a gestores." });

    const q = String(req.query.q || "").trim();
    if (!q) return res.status(400).json({ error: "Informe o SKU (código ou nome)." });

    const [vendasRaw, produtosFull, statusArq] = await Promise.all([
      readSheet("vendas_cliente_produto").catch(() => []),
      readSheet("produtos_full").catch(() => []),
      readSheet("status_arquivos").catch(() => []),
    ]);

    const linhaPed = statusArq.find((r) => /pedidos|03014701/i.test(String(r.arquivo || "")));
    const atualizadoEm = linhaPed ? String(linhaPed.atualizado_em || "").trim() : "";

    // HL por caixa (Fator Hecto Comercial) por código
    const hlMap = {};
    const nomeMap = {};
    produtosFull.forEach((p) => {
      const c = normCod(p.cod);
      hlMap[c] = num(p.hl_caixa);
      if (p.nome) nomeMap[c] = String(p.nome).trim();
    });

    // Vendas dentro do escopo do gestor
    const vendas = vendasRaw.filter((r) => esc.filtro(String(r.setor || "").trim()));
    if (vendas.length === 0) return res.json({ encontrado: false, atualizado_em: atualizadoEm });

    // Resolve o SKU alvo: código exato; senão melhor match por nome (maior volume)
    const alvoCod = (() => {
      const qn = normCod(q);
      const temCod = vendas.some((r) => normCod(r.cod_produto) === qn);
      if (/^\d+$/.test(q) && temCod) return qn;
      const ql = q.toLowerCase();
      const porCod = {};
      vendas.forEach((r) => {
        const nome = `${r.nome_produto || ""} ${nomeMap[normCod(r.cod_produto)] || ""}`.toLowerCase();
        if (nome.includes(ql) || normCod(r.cod_produto) === qn) {
          const c = normCod(r.cod_produto);
          porCod[c] = (porCod[c] || 0) + num(r.volume_hl);
        }
      });
      const cods = Object.keys(porCod);
      if (cods.length === 0) return null;
      return cods.sort((a, b) => porCod[b] - porCod[a])[0];
    })();

    if (!alvoCod) return res.json({ encontrado: false, atualizado_em: atualizadoEm });

    const linhas = vendas.filter((r) => normCod(r.cod_produto) === alvoCod);
    const hlCaixa = hlMap[alvoCod] || 0;
    const nomeProduto = nomeMap[alvoCod] || (linhas[0] && linhas[0].nome_produto) || alvoCod;
    const mesRef = linhas[0]?.mes_referencia || "";

    // Por PDV (agrega caso o mesmo PDV apareça em + de uma linha)
    const mapPdv = {};
    linhas.forEach((r) => {
      const cod = String(r.cod_pdv || "").trim();
      if (!mapPdv[cod]) mapPdv[cod] = { cod_pdv: cod, nome_pdv: r.nome_pdv, setor: String(r.setor || "").trim(), volume_hl: 0 };
      mapPdv[cod].volume_hl += num(r.volume_hl);
    });
    const porPdv = Object.values(mapPdv)
      .map((p) => ({ ...p, volume_hl: r3(p.volume_hl), caixas: hlCaixa > 0 ? r1(p.volume_hl / hlCaixa) : 0 }))
      .filter((p) => p.volume_hl > 0)
      .sort((a, b) => b.caixas - a.caixas);

    // Por RN (setor)
    const mapRn = {};
    porPdv.forEach((p) => {
      if (!mapRn[p.setor]) mapRn[p.setor] = { setor: p.setor, cobertura: 0, distribuicao: 0 };
      mapRn[p.setor].cobertura += 1;
      mapRn[p.setor].distribuicao += p.caixas;
    });
    const porRn = Object.values(mapRn)
      .map((r) => ({ ...r, distribuicao: r1(r.distribuicao) }))
      .sort((a, b) => b.distribuicao - a.distribuicao);

    const cobertura = porPdv.length;
    const distribuicao = r1(porPdv.reduce((s, p) => s + p.caixas, 0));

    return res.json({
      encontrado: true,
      atualizado_em: atualizadoEm,
      mes_referencia: mesRef,
      produto: { cod: alvoCod, nome: nomeProduto, hl_caixa: hlCaixa },
      consolidado: { cobertura, distribuicao },
      sem_hl: hlCaixa <= 0,
      por_rn: porRn,
      por_pdv: porPdv,
    });
  } catch (err) {
    console.error("cobertura-sku:", err);
    return res.status(500).json({ error: "Erro ao buscar cobertura & distribuição." });
  }
});

module.exports = router;
