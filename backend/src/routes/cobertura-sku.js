// Cobertura & Distribuição por SKU — visão consolidada (GV / diretoria / admin).
// Cobertura = nº de PDVs que compraram o SKU (qualquer quantidade = 1).
// Distribuição = soma de CAIXAS (Volume ÷ HL Comercial do produto).
const express = require("express");
const router = express.Router();
const { readSheet, readSheetMonths } = require("../services/sheets");
const { authMiddleware } = require("../middleware/auth");

router.use(authMiddleware);

const num = (v) => parseFloat(String(v ?? "0").replace(",", ".")) || 0;
const r1 = (n) => Math.round(n * 10) / 10;
const r3 = (n) => Math.round(n * 1000) / 1000;
const normCod = (v) => String(v ?? "").trim().replace(/^0+/, "") || "0";
const mesAtualBR = () => { const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
// meses=YYYY-MM,YYYY-MM → array válido; default = mês atual.
const parseMeses = (raw) => {
  const ms = String(raw || "").split(",").map((s) => s.trim()).filter((s) => /^\d{4}-\d{2}$/.test(s));
  return ms.length ? [...new Set(ms)] : [mesAtualBR()];
};

// Só gestores (RN não acessa esta visão consolidada)
function escopoPerfil(usuario) {
  const p = usuario.perfil;
  if (["admin", "director"].includes(p)) return { ok: true, filtro: () => true };
  if (p === "gv1") return { ok: true, filtro: (s) => String(s).startsWith("1") };
  if (p === "gv3") return { ok: true, filtro: (s) => String(s).startsWith("3") };
  return { ok: false };
}

// GET /api/cobertura-sku/meses — meses com venda no escopo (para o seletor). Desc.
router.get("/meses", async (req, res) => {
  try {
    const esc = escopoPerfil(req.user);
    if (!esc.ok) return res.status(403).json({ error: "Acesso restrito a gestores." });
    const vendas = await readSheet("vendas_cliente_produto").catch(() => []);
    const set = new Set();
    vendas.forEach((r) => { const m = String(r.mes_referencia || "").slice(0, 7); if (/^\d{4}-\d{2}$/.test(m)) set.add(m); });
    return res.json([...set].sort().reverse());
  } catch (err) { console.error("cobertura-sku/meses:", err); return res.status(500).json({ error: "Erro ao listar meses." }); }
});

// GET /api/cobertura-sku/buscar?q=stella — sugestões (autocomplete) dos produtos
// que têm venda no escopo do gestor. Retorna [{cod, nome}].
router.get("/buscar", async (req, res) => {
  try {
    const esc = escopoPerfil(req.user);
    if (!esc.ok) return res.status(403).json({ error: "Acesso restrito a gestores." });
    const q = String(req.query.q || "").trim().toLowerCase();
    if (q.length < 2) return res.json([]);

    const [vendasRaw, produtosFull] = await Promise.all([
      readSheet("vendas_cliente_produto").catch(() => []),
      readSheet("produtos_full").catch(() => []),
    ]);
    const nomeMap = {};
    produtosFull.forEach((p) => { nomeMap[normCod(p.cod)] = String(p.nome || "").trim(); });

    const map = {};
    vendasRaw.filter((r) => esc.filtro(String(r.setor || "").trim())).forEach((r) => {
      const c = normCod(r.cod_produto);
      if (!map[c]) map[c] = { cod: c, nome: nomeMap[c] || String(r.nome_produto || "").trim() || c, vol: 0 };
      map[c].vol += num(r.volume_hl);
    });

    const lista = Object.values(map)
      .filter((p) => p.nome.toLowerCase().includes(q) || p.cod.includes(q))
      .sort((a, b) => b.vol - a.vol)
      .slice(0, 20)
      .map((p) => ({ cod: p.cod, nome: p.nome }));
    return res.json(lista);
  } catch (err) {
    console.error("cobertura-sku/buscar:", err);
    return res.status(500).json({ error: "Erro ao buscar produtos." });
  }
});

// GET /api/cobertura-sku?q=33857  (q = código do SKU ou parte do nome)
router.get("/", async (req, res) => {
  try {
    const esc = escopoPerfil(req.user);
    if (!esc.ok) return res.status(403).json({ error: "Acesso restrito a gestores." });

    const q = String(req.query.q || "").trim();
    if (!q) return res.status(400).json({ error: "Informe o SKU (código ou nome)." });
    const meses = parseMeses(req.query.meses);

    const [vendasRaw, produtosFull, statusArq, pdvBaseRaw, usuarios] = await Promise.all([
      readSheetMonths("vendas_cliente_produto", "mes_referencia", meses).catch(() => []),
      readSheet("produtos_full").catch(() => []),
      readSheet("status_arquivos").catch(() => []),
      readSheet("pdv_base").catch(() => []),
      readSheet("usuarios").catch(() => []),
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

    // Fallback: SKU sem venda no período mas existente na base → resolve p/ mostrar
    // a base inteira como "não comprou".
    let alvo = alvoCod;
    if (!alvo) {
      const qn = normCod(q), ql = q.toLowerCase();
      if (/^\d+$/.test(q) && hlMap[qn] !== undefined) alvo = qn;
      else { const hit = Object.keys(nomeMap).find((c) => nomeMap[c].toLowerCase().includes(ql)); if (hit) alvo = hit; }
    }
    if (!alvo) return res.json({ encontrado: false, atualizado_em: atualizadoEm });
    const alvoFinal = alvo;

    const linhas = vendas.filter((r) => normCod(r.cod_produto) === alvoFinal);
    const hlCaixa = hlMap[alvoFinal] || 0;
    const nomeProduto = nomeMap[alvoFinal] || (linhas[0] && linhas[0].nome_produto) || alvoFinal;
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

    // Base que ainda NÃO comprou o SKU nos meses selecionados (escopo do gestor),
    // com RN (nome) e dia de visita — para prospecção.
    const compradores = new Set(porPdv.map((p) => normCod(p.cod_pdv)));
    const rnMap = {};
    usuarios.forEach((u) => { if (u.cod) rnMap[String(u.cod).trim()] = String(u.nome || "").trim(); });
    const naoCompradores = pdvBaseRaw
      .filter((p) => esc.filtro(String(p.setor || "").trim()))
      .map((p) => ({ cod_pdv: normCod(p.cod_pdv || p.cod), nome_pdv: String(p.nome_fantasia || p.nome || "").trim(), setor: String(p.setor || "").trim(), dia_visita: String(p.dia_visita || "").trim() }))
      .filter((p) => p.cod_pdv && p.cod_pdv !== "0" && !compradores.has(p.cod_pdv))
      .map((p) => ({ ...p, rn: rnMap[p.setor] || "" }))
      .sort((a, b) => String(a.setor).localeCompare(String(b.setor)) || a.nome_pdv.localeCompare(b.nome_pdv));

    return res.json({
      encontrado: true,
      atualizado_em: atualizadoEm,
      mes_referencia: mesRef,
      meses,
      produto: { cod: alvoFinal, nome: nomeProduto, hl_caixa: hlCaixa },
      consolidado: { cobertura, distribuicao, total_base: pdvBaseRaw.filter((p) => esc.filtro(String(p.setor || "").trim())).length, nao_compradores: naoCompradores.length },
      sem_hl: hlCaixa <= 0,
      por_rn: porRn,
      por_pdv: porPdv,
      nao_compradores: naoCompradores,
    });
  } catch (err) {
    console.error("cobertura-sku:", err);
    return res.status(500).json({ error: "Erro ao buscar cobertura & distribuição." });
  }
});

module.exports = router;
