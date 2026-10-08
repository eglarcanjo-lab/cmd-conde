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
const geo = require("../services/geo");

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
  await query(`ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS criado_por TEXT`);
  // Inativação de PDV (v3.75): flag + justificativa + prévia (inad/comodato) congelada no pedido
  await query(`ALTER TABLE solicitacoes_itens ADD COLUMN IF NOT EXISTS inativar BOOLEAN DEFAULT false`);
  await query(`ALTER TABLE solicitacoes_itens ADD COLUMN IF NOT EXISTS justificativa TEXT`);
  await query(`ALTER TABLE solicitacoes_itens ADD COLUMN IF NOT EXISTS inad_info TEXT`);
  await query(`ALTER TABLE solicitacoes_itens ADD COLUMN IF NOT EXISTS comodato_info TEXT`);
  // Coordenadas (v3.79): nova lat/lng colada pelo RN + endereço (OpenStreetMap) congelado no pedido
  await query(`ALTER TABLE solicitacoes_itens ADD COLUMN IF NOT EXISTS lat_nova NUMERIC`);
  await query(`ALTER TABLE solicitacoes_itens ADD COLUMN IF NOT EXISTS lng_nova NUMERIC`);
  await query(`ALTER TABLE solicitacoes_itens ADD COLUMN IF NOT EXISTS endereco_novo TEXT`);
  _ok = true;
}

// Setor sobre o qual o usuário age: RN (e demais) = o próprio; SÓ o ADMIN pode agir em
// nome de outro setor (?setor= / body.setor) — simula a visão do RN e abre por ele.
const setorAlvo = (req, pedido) =>
  req.user.perfil === "admin" && pedido ? String(pedido).trim() : String(req.user.cod || "").trim();

// Nome do RN dono do setor (usuarios.cod = setor).
async function nomeDoSetor(setor) {
  const usuarios = await readSheet("usuarios").catch(() => []);
  const u = usuarios.find((x) => String(x.cod || "").trim() === String(setor));
  return u ? String(u.nome || "").trim() : "";
}

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

// Prévia de INATIVAÇÃO: inadimplência (relatório 120601 → inadimplencia_real) e comodato
// (relatório de comodatos → comodatos; quem está na relação TEM comodato) por cod_pdv.
const brl = (v) => "R$ " + (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
async function riscoPorPdv() {
  const [inadRaw, comRaw, status] = await Promise.all([
    readSheet("inadimplencia_real").catch(() => []),
    readSheet("comodatos").catch(() => []),
    readSheet("status_arquivos").catch(() => []),
  ]);
  const inad = {};
  inadRaw.forEach((r) => {
    const c = normCod(r.cod_pdv); if (!c) return;
    const e = inad[c] || (inad[c] = { qtd_titulos: 0, valor: 0, maior_atraso: 0 });
    e.qtd_titulos += num(r.qtd_titulos); e.valor += num(r.valor_total);
    e.maior_atraso = Math.max(e.maior_atraso, num(r.maior_atraso));
  });
  const com = {};
  comRaw.forEach((r) => {
    const c = normCod(r.cod_pdv); if (!c) return;
    const e = com[c] || (com[c] = { em_aberto: 0, itens: [] });
    const ab = num(r.em_aberto);
    e.em_aberto += ab;
    e.itens.push({ descricao: String(r.descricao || "").trim(), comodatado: num(r.comodatado), em_aberto: ab,
                   tipo: String(r.tipo_material || "").trim(), valor: num(r.valor) });
  });
  const dataDe = (re) => { const x = status.find((r) => re.test(String(r.arquivo || ""))); return x ? String(x.atualizado_em || "").trim() : ""; };
  return { inad, com, fontes: { inad: dataDe(/inadimpl/i), comodatos: dataDe(/comodato/i), temComodatos: comRaw.length > 0 } };
}
const txtInad = (i) => (i ? `INADIMPLENTE: ${i.qtd_titulos} título(s) · ${brl(i.valor)} · maior atraso ${i.maior_atraso} dias` : "Sem inadimplência");
const txtCom = (c) => (c
  ? `TEM COMODATO: ${c.itens.map((x) => `${x.descricao} (${x.em_aberto} em aberto)`).join("; ")}`
  : "Sem comodato");

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
    const [base, vendas, pend, risco] = await Promise.all([
      readSheet("pdv_base").catch(() => []),
      readSheetMonths("vendas_cliente_produto", "mes_referencia", ms).catch(() => []),
      pendentesPorPdv(),
      riscoPorPdv(),
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
          inad: risco.inad[c] || null,          // prévia de inativação
          comodato: risco.com[c] || null,
        };
      });
    return res.json({ setor, meses: ms, setores: await listarSetores(base), pdvs, fontes: risco.fontes });
  } catch (e) {
    console.error("solicitacoes/migracao/base:", e);
    return res.status(500).json({ error: "Erro ao carregar a base de PDVs." });
  }
});

// GET /api/solicitacoes/coordenada?texto= — lê o que o RN colou (coordenada ou link do Maps,
// inclusive link curto) e devolve { lat, lng, endereco, link } p/ a prévia na tela.
router.get("/coordenada", async (req, res) => {
  try {
    const c = await geo.resolverCoordenada(req.query.texto);
    return res.json({ ...c, endereco: await geo.enderecoDe(c.lat, c.lng), link: geo.linkMapa(c.lat, c.lng) });
  } catch (e) {
    return res.status(e.http || 500).json({ error: e.http ? e.message : "Erro ao ler a coordenada." });
  }
});

// POST /api/solicitacoes/migracao — { setor?, motivo, itens:[{cod_pdv, setor_novo, dia_novo} | {cod_pdv, inativar:true, justificativa}] }
// Snapshot (nome/setor/dia/média) é montado AQUI, a partir da base — não confia no cliente.
router.post("/migracao", async (req, res) => {
  try {
    await ensureTabelas();
    const setor = setorAlvo(req, req.body?.setor);
    const itensIn = Array.isArray(req.body?.itens) ? req.body.itens : [];
    const ms = meses3();
    const [base, vendas, pend, risco] = await Promise.all([
      readSheet("pdv_base").catch(() => []),
      readSheetMonths("vendas_cliente_produto", "mes_referencia", ms).catch(() => []),
      pendentesPorPdv(),
      riscoPorPdv(),
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
      const nomePdv = String(p.nome_fantasia || p.razao_social || "").trim();
      const media = Math.round(((vol[c] || 0) / 3) * 10) / 10;
      if (it.inativar) {
        // INATIVAR: justificativa obrigatória; RN/dia não se aplicam. Prévia congelada no pedido.
        const just = String(it.justificativa || "").trim();
        if (just.length < 5) return res.status(400).json({ error: `Escreva a justificativa para inativar o PDV ${c} (${nomePdv}).` });
        vistos.add(c);
        itens.push({ cod_pdv: c, nome_pdv: nomePdv, setor_atual: setor, dia_atual: diaAtual, setor_novo: "", dia_novo: "",
                     media_tri_hl: media, inativar: true, justificativa: just.slice(0, 500),
                     inad_info: txtInad(risco.inad[c]), comodato_info: txtCom(risco.com[c]) });
        continue;
      }
      let setorNovo = String(it.setor_novo || "").trim();
      let diaNovo = String(it.dia_novo || "").trim().toUpperCase();
      if (setorNovo === setor) setorNovo = "";
      if (diaNovo === diaAtual) diaNovo = "";
      if (setorNovo && !setoresValidos.has(setorNovo)) return res.status(400).json({ error: `Setor ${setorNovo} inválido.` });
      if (diaNovo && !DIAS.includes(diaNovo)) return res.status(400).json({ error: `Dia ${diaNovo} inválido.` });
      // Nova coordenada (opcional): validada e com endereço congelado no pedido
      let coord = null;
      if (String(it.coordenadas || "").trim()) {
        try {
          coord = await geo.resolverCoordenada(it.coordenadas);
          coord.endereco = await geo.enderecoDe(coord.lat, coord.lng);
        } catch (e) {
          return res.status(400).json({ error: `PDV ${c} (${nomePdv}): ${e.message}` });
        }
      }
      if (!setorNovo && !diaNovo && !coord) continue; // linha sem alteração
      vistos.add(c);
      itens.push({
        cod_pdv: c, nome_pdv: nomePdv,
        setor_atual: setor, dia_atual: diaAtual, setor_novo: setorNovo, dia_novo: diaNovo,
        media_tri_hl: media, inativar: false,
        lat_nova: coord?.lat ?? null, lng_nova: coord?.lng ?? null, endereco_novo: coord?.endereco || null,
      });
    }
    if (!itens.length) return res.status(400).json({ error: "Nenhuma alteração para enviar." });

    const id = "M" + Date.now().toString(36).toUpperCase();
    // ADM abrindo por outro setor: registra em nome do RN do setor + quem criou.
    const emNomeDe = setor !== String(req.user.cod || "").trim();
    const nomeRn = emNomeDe ? (await nomeDoSetor(setor)) || `Setor ${setor}` : req.user.nome || "";
    await query(
      `INSERT INTO solicitacoes (id, tipo, setor, nome_rn, perfil, status, motivo, criado_por)
       VALUES ($1, 'migracao_pdv', $2, $3, $4, 'Em aprovação', $5, $6)`,
      [id, setor, nomeRn, emNomeDe ? "rn" : req.user.perfil || "", String(req.body?.motivo || "").trim().slice(0, 500),
       emNomeDe ? `ADM ${req.user.nome || ""}`.trim() : null]);
    for (const it of itens) {
      await query(
        `INSERT INTO solicitacoes_itens (solicitacao_id, cod_pdv, nome_pdv, setor_atual, dia_atual, setor_novo, dia_novo, media_tri_hl,
                                         inativar, justificativa, inad_info, comodato_info, lat_nova, lng_nova, endereco_novo)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [id, it.cod_pdv, it.nome_pdv, it.setor_atual, it.dia_atual, it.setor_novo || null, it.dia_novo || null, it.media_tri_hl,
         !!it.inativar, it.justificativa || null, it.inad_info || null, it.comodato_info || null,
         it.lat_nova ?? null, it.lng_nova ?? null, it.endereco_novo || null]);
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
  it.rows.forEach((r) => { (por[r.solicitacao_id] = por[r.solicitacao_id] || []).push({ ...r, media_tri_hl: num(r.media_tri_hl),
    lat_nova: r.lat_nova == null ? null : Number(r.lat_nova), lng_nova: r.lng_nova == null ? null : Number(r.lng_nova) }); });
  return s.rows.map((r) => ({ ...r, itens: por[r.id] || [] }));
}

// GET /api/solicitacoes/minhas?setor= — as do setor do usuário (admin: do setor escolhido)
router.get("/minhas", async (req, res) => {
  try {
    await ensureTabelas();
    return res.json(await carregar("WHERE setor = $1", [setorAlvo(req, req.query.setor)]));
  } catch (e) {
    console.error("solicitacoes/minhas:", e);
    return res.status(500).json({ error: "Erro ao buscar solicitações." });
  }
});

// GET /api/solicitacoes/setores — (admin) setores p/ o seletor "Agindo como"
router.get("/setores", adminOnly, async (req, res) => {
  try {
    const base = await readSheet("pdv_base").catch(() => []);
    return res.json(await listarSetores(base));
  } catch (e) {
    console.error("solicitacoes/setores:", e);
    return res.status(500).json({ error: "Erro ao listar setores." });
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

// POST /api/solicitacoes/:id/decidir — { itens:[itemId], acao:"Aprovado"|"Recusado", resposta }
// Decide SÓ os itens marcados (ainda pendentes); os demais seguem pendentes. Dá para decidir
// em etapas. Enquanto houver item pendente o pedido fica "Em aprovação"; quando o último é
// decidido: Aprovado (todos aprovados) / Recusado (todos recusados) / Parcial.
router.post("/:id/decidir", adminOnly, async (req, res) => {
  try {
    await ensureTabelas();
    const { id } = req.params;
    const acao = req.body?.acao;
    if (!["Aprovado", "Recusado"].includes(acao)) return res.status(400).json({ error: "Ação inválida." });
    const marcados = new Set((req.body?.itens || []).map(Number));
    const sol = await carregar("WHERE id = $1", [id]);
    if (!sol.length) return res.status(404).json({ error: "Solicitação não encontrada." });
    if (sol[0].status !== "Em aprovação") return res.status(409).json({ error: "Esta solicitação já foi decidida." });
    const itens = sol[0].itens;
    const alvo = itens.filter((it) => it.status === "Pendente" && marcados.has(it.id));
    if (!alvo.length) return res.status(400).json({ error: "Marque ao menos uma linha pendente." });
    for (const it of alvo) {
      await query(`UPDATE solicitacoes_itens SET status = $1 WHERE id = $2`, [acao, it.id]);
      it.status = acao;
    }
    const pend = itens.filter((it) => it.status === "Pendente").length;
    const nAp = itens.filter((it) => it.status === "Aprovado").length;
    const status = pend > 0 ? "Em aprovação" : nAp === itens.length ? "Aprovado" : nAp === 0 ? "Recusado" : "Parcial";
    // Comentário acumula entre as etapas (ex.: "Recusado: rota cheia | Aprovado: ok").
    const coment = String(req.body?.resposta || "").trim().slice(0, 300);
    const resposta = [sol[0].resposta, coment ? `${acao}: ${coment}` : ""].filter(Boolean).join(" | ").slice(0, 1000);
    await query(
      `UPDATE solicitacoes SET status = $1, resposta = $2, decidido_em = now(), decidido_por = $3 WHERE id = $4`,
      [status, resposta || null, req.user.nome || "", id]);
    return res.json({ success: true, status, decididos: alvo.length, pendentes: pend });
  } catch (e) {
    console.error("solicitacoes/decidir:", e);
    return res.status(500).json({ error: "Erro ao registrar a decisão." });
  }
});

module.exports = router;
