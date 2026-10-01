// Solicitações do RN (aba "Solicitações", antiga Incidentes) — tipos novos além do
// Incidente. Tipo 1: MIGRAÇÃO DE PDVs (trocar RN e/ou dia de visita).
// O app NÃO altera nada no Promax: só registra o pedido; o admin aprova/recusa por
// linha e baixa o Excel para fazer a mudança no Promax.
// Tabelas próprias (criadas no 1º uso, como em services/alertas.js):
//   solicitacoes       — cabeçalho (1 por pedido)
//   solicitacoes_itens — linhas (1 por PDV) com status por item
const express = require("express");
const router = express.Router();
const { query } = require("../services/db");
const { readSheet, readSheetMonths } = require("../services/sheets");
const { authMiddleware, adminOnly } = require("../middleware/auth");

router.use(authMiddleware);

const DIAS = ["SEG", "TER", "QUA", "QUI", "SEX"];
const GESTORES = ["admin", "director", "gv1", "gv3"];
const num = (v) => parseFloat(String(v ?? "0").replace(",", ".")) || 0;
const normCod = (v) => String(v ?? "").trim().replace(/\.0$/, "").replace(/^0+/, "");

let _ok = false;
async function ensureTabelas() {
  if (_ok) return;
  await query(`CREATE TABLE IF NOT EXISTS solicitacoes (
    id TEXT PRIMARY KEY, tipo TEXT NOT NULL, setor TEXT, nome_rn TEXT, perfil TEXT,
    criado_em TIMESTAMPTZ DEFAULT now(), status TEXT, motivo TEXT, resposta TEXT,
    decidido_em TIMESTAMPTZ, decidido_por TEXT)`);
  await query(`CREATE TABLE IF NOT EXISTS solicitacoes_itens (
    id SERIAL PRIMARY KEY, solicitacao_id TEXT NOT NULL REFERENCES solicitacoes(id) ON DELETE CASCADE,
    cod_pdv TEXT, nome_pdv TEXT, setor_atual TEXT, dia_atual TEXT, setor_novo TEXT, dia_novo TEXT,
    media_tri_hl NUMERIC, status TEXT DEFAULT 'Pendente')`);
  await query(`CREATE INDEX IF NOT EXISTS idx_solic_itens_sol ON solicitacoes_itens (solicitacao_id)`);
  _ok = true;
}

// Setor sobre o qual o usuário age: RN = o próprio; gestor pode escolher (?setor=).
const setorAlvo = (req, pedido) =>
  GESTORES.includes(req.user.perfil) && pedido ? String(pedido).trim() : String(req.user.cod || "").trim();

// 3 meses COMPLETOS anteriores ao mês atual (fuso BR) — ex.: em out → jul/ago/set.
function meses3() {
  const br = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return [3, 2, 1].map((k) => {
    const d = new Date(br.getFullYear(), br.getMonth() - k, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}

// Lista de setores (todos) com o nome do RN — p/ o "Migrar RN".
async function listarSetores(base) {
  const usuarios = await readSheet("usuarios").catch(() => []);
  const nome = {};
  usuarios.forEach((u) => { const c = String(u.cod || "").trim(); if (c) nome[c] = String(u.nome || "").trim(); });
  return [...new Set(base.map((p) => String(p.setor || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((s) => ({ setor: s, nome: nome[s] || "" }));
}

// Itens pendentes (em aprovação) por cod_pdv — trava duplicidade.
async function pendentesPorPdv() {
  const r = await query(
    `SELECT i.cod_pdv, s.criado_em FROM solicitacoes_itens i JOIN solicitacoes s ON s.id = i.solicitacao_id
     WHERE s.tipo = 'migracao_pdv' AND i.status = 'Pendente'`);
  const m = {};
  r.rows.forEach((x) => { m[normCod(x.cod_pdv)] = x.criado_em; });
  return m;
}

// GET /api/solicitacoes/migracao/base?setor= — PDVs da base do RN + média do tri.
router.get("/migracao/base", async (req, res) => {
  try {
    await ensureTabelas();
    const setor = setorAlvo(req, req.query.setor);
    const ms = meses3();
    const [base, vendas, pend] = await Promise.all([
      readSheet("pdv_base").catch(() => []),
      readSheetMonths("vendas_cliente_produto", "mes_referencia", ms).catch(() => []),
      pendentesPorPdv(),
    ]);
    const vol = {};
    vendas.forEach((v) => {
      if (String(v.setor || "").trim() !== setor) return;
      const c = normCod(v.cod_pdv); vol[c] = (vol[c] || 0) + num(v.volume_hl);
    });
    const pdvs = base
      .filter((p) => String(p.setor || "").trim() === setor)
      .map((p) => {
        const c = normCod(p.cod_pdv);
        return {
          cod_pdv: c,
          nome: String(p.nome_fantasia || p.razao_social || "").trim(),
          cidade: String(p.cidade || "").trim(),
          dia: String(p.dia_visita || "").trim().toUpperCase().slice(0, 3),
          media_tri: Math.round(((vol[c] || 0) / 3) * 10) / 10,
          pendente_desde: pend[c] || null,
        };
      });
    return res.json({ setor, meses: ms, setores: await listarSetores(base), pdvs });
  } catch (e) {
    console.error("solicitacoes/migracao/base:", e);
    return res.status(500).json({ error: "Erro ao carregar a base de PDVs." });
  }
});

// POST /api/solicitacoes/migracao — { setor?, motivo, itens:[{cod_pdv, setor_novo, dia_novo}] }
// Snapshot (nome/setor/dia/média) é montado AQUI, a partir da base — não confia no cliente.
router.post("/migracao", async (req, res) => {
  try {
    await ensureTabelas();
    const setor = setorAlvo(req, req.body?.setor);
    const itensIn = Array.isArray(req.body?.itens) ? req.body.itens : [];
    const ms = meses3();
    const [base, vendas, pend] = await Promise.all([
      readSheet("pdv_base").catch(() => []),
      readSheetMonths("vendas_cliente_produto", "mes_referencia", ms).catch(() => []),
      pendentesPorPdv(),
    ]);
    const setoresValidos = new Set(base.map((p) => String(p.setor || "").trim()).filter(Boolean));
    const doSetor = {};
    base.forEach((p) => { if (String(p.setor || "").trim() === setor) doSetor[normCod(p.cod_pdv)] = p; });
    const vol = {};
    vendas.forEach((v) => { if (String(v.setor || "").trim() === setor) { const c = normCod(v.cod_pdv); vol[c] = (vol[c] || 0) + num(v.volume_hl); } });

    const itens = [];
    const vistos = new Set();
    for (const it of itensIn) {
      const c = normCod(it.cod_pdv);
      const p = doSetor[c];
      if (!p || vistos.has(c)) continue;
      if (pend[c]) return res.status(409).json({ error: `O PDV ${c} já está em outra solicitação aguardando aprovação.` });
      const diaAtual = String(p.dia_visita || "").trim().toUpperCase().slice(0, 3);
      let setorNovo = String(it.setor_novo || "").trim();
      let diaNovo = String(it.dia_novo || "").trim().toUpperCase();
      if (setorNovo === setor) setorNovo = "";
      if (diaNovo === diaAtual) diaNovo = "";
      if (setorNovo && !setoresValidos.has(setorNovo)) return res.status(400).json({ error: `Setor ${setorNovo} inválido.` });
      if (diaNovo && !DIAS.includes(diaNovo)) return res.status(400).json({ error: `Dia ${diaNovo} inválido.` });
      if (!setorNovo && !diaNovo) continue; // linha sem alteração
      vistos.add(c);
      itens.push({
        cod_pdv: c, nome_pdv: String(p.nome_fantasia || p.razao_social || "").trim(),
        setor_atual: setor, dia_atual: diaAtual, setor_novo: setorNovo, dia_novo: diaNovo,
        media_tri_hl: Math.round(((vol[c] || 0) / 3) * 10) / 10,
      });
    }
    if (!itens.length) return res.status(400).json({ error: "Nenhuma alteração para enviar." });

    const id = "M" + Date.now().toString(36).toUpperCase();
    await query(
      `INSERT INTO solicitacoes (id, tipo, setor, nome_rn, perfil, status, motivo)
       VALUES ($1, 'migracao_pdv', $2, $3, $4, 'Em aprovação', $5)`,
      [id, setor, req.user.nome || "", req.user.perfil || "", String(req.body?.motivo || "").trim().slice(0, 500)]);
    for (const it of itens) {
      await query(
        `INSERT INTO solicitacoes_itens (solicitacao_id, cod_pdv, nome_pdv, setor_atual, dia_atual, setor_novo, dia_novo, media_tri_hl)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [id, it.cod_pdv, it.nome_pdv, it.setor_atual, it.dia_atual, it.setor_novo || null, it.dia_novo || null, it.media_tri_hl]);
    }
    return res.json({ success: true, id, itens: itens.length });
  } catch (e) {
    console.error("solicitacoes/migracao POST:", e);
    return res.status(500).json({ error: "Erro ao registrar a solicitação." });
  }
});

// Carrega solicitações (+ itens) com filtro SQL opcional.
async function carregar(where = "", params = []) {
  const s = await query(`SELECT * FROM solicitacoes ${where} ORDER BY criado_em DESC LIMIT 500`, params);
  if (!s.rows.length) return [];
  const ids = s.rows.map((r) => r.id);
  const it = await query(`SELECT * FROM solicitacoes_itens WHERE solicitacao_id = ANY($1) ORDER BY id`, [ids]);
  const por = {};
  it.rows.forEach((r) => { (por[r.solicitacao_id] = por[r.solicitacao_id] || []).push({ ...r, media_tri_hl: num(r.media_tri_hl) }); });
  return s.rows.map((r) => ({ ...r, itens: por[r.id] || [] }));
}

// GET /api/solicitacoes/minhas — as do setor do usuário
router.get("/minhas", async (req, res) => {
  try {
    await ensureTabelas();
    return res.json(await carregar("WHERE setor = $1", [String(req.user.cod || "").trim()]));
  } catch (e) {
    console.error("solicitacoes/minhas:", e);
    return res.status(500).json({ error: "Erro ao buscar solicitações." });
  }
});

// GET /api/solicitacoes — gestores veem todas (admin aprova)
router.get("/", async (req, res) => {
  try {
    if (!GESTORES.includes(req.user.perfil)) return res.status(403).json({ error: "Acesso restrito a gestores." });
    await ensureTabelas();
    return res.json(await carregar());
  } catch (e) {
    console.error("solicitacoes GET:", e);
    return res.status(500).json({ error: "Erro ao buscar solicitações." });
  }
});

// GET /api/solicitacoes/pendentes — contador p/ o sininho
router.get("/pendentes", async (req, res) => {
  try {
    await ensureTabelas();
    const r = await query(`SELECT COUNT(*)::int AS n FROM solicitacoes WHERE status = 'Em aprovação'`);
    return res.json({ pendentes: r.rows[0]?.n || 0 });
  } catch { return res.json({ pendentes: 0 }); }
});

// POST /api/solicitacoes/:id/decidir — { aprovados:[itemId], resposta }
// Itens fora de "aprovados" são recusados. Status do pedido: Aprovado / Recusado / Parcial.
router.post("/:id/decidir", adminOnly, async (req, res) => {
  try {
    await ensureTabelas();
    const { id } = req.params;
    const aprovados = new Set((req.body?.aprovados || []).map(Number));
    const sol = await carregar("WHERE id = $1", [id]);
    if (!sol.length) return res.status(404).json({ error: "Solicitação não encontrada." });
    if (sol[0].status !== "Em aprovação") return res.status(409).json({ error: "Esta solicitação já foi decidida." });
    const itens = sol[0].itens;
    for (const it of itens) {
      await query(`UPDATE solicitacoes_itens SET status = $1 WHERE id = $2`, [aprovados.has(it.id) ? "Aprovado" : "Recusado", it.id]);
    }
    const nAp = itens.filter((it) => aprovados.has(it.id)).length;
    const status = nAp === itens.length ? "Aprovado" : nAp === 0 ? "Recusado" : "Parcial";
    await query(
      `UPDATE solicitacoes SET status = $1, resposta = $2, decidido_em = now(), decidido_por = $3 WHERE id = $4`,
      [status, String(req.body?.resposta || "").trim().slice(0, 500), req.user.nome || "", id]);
    return res.json({ success: true, status });
  } catch (e) {
    console.error("solicitacoes/decidir:", e);
    return res.status(500).json({ error: "Erro ao registrar a decisão." });
  }
});

module.exports = router;
