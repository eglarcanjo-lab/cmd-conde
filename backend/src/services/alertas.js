// Motor de alertas de ruptura (Fase 1).
// Gatilho 1: produto no TOP-10 mais vendido (mês) que NÃO está na grade (esgotado).
// Gatilho 2: falta em pedido (ruptura_detalhe) do dia mais recente.
// Dedupe (1 por chave/dia) + 1 e-mail digest via Brevo. Lista central editável no admin.
const axios = require("axios");
const { query } = require("./db");
const { readSheet } = require("./sheets");

const num = (v) => {
  if (v === null || v === undefined || v === "") return 0;
  const n = parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? 0 : n;
};
const hojeStr = () => new Date().toISOString().slice(0, 10);
const fmtHL = (v) => (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

async function ensureTabelas() {
  await query(`CREATE TABLE IF NOT EXISTS alertas_destinatarios (
    email TEXT PRIMARY KEY, ativo BOOLEAN DEFAULT true, criado_em TIMESTAMPTZ DEFAULT now())`);
  await query(`CREATE TABLE IF NOT EXISTS alertas_enviados (
    chave TEXT PRIMARY KEY, tipo TEXT, enviado_em TIMESTAMPTZ DEFAULT now())`);
  await query(`CREATE TABLE IF NOT EXISTS alertas_config (
    id INT PRIMARY KEY DEFAULT 1, ativo BOOLEAN DEFAULT true, ultimo_envio TIMESTAMPTZ, ultimo_resumo TEXT)`);
  await query(`INSERT INTO alertas_config (id, ativo) VALUES (1, true) ON CONFLICT (id) DO NOTHING`);
}

async function getConfig() {
  await ensureTabelas();
  const r = await query(`SELECT ativo, ultimo_envio, ultimo_resumo FROM alertas_config WHERE id=1`);
  return r.rows[0] || { ativo: true, ultimo_envio: null, ultimo_resumo: null };
}
async function setAtivo(ativo) { await ensureTabelas(); await query(`UPDATE alertas_config SET ativo=$1 WHERE id=1`, [!!ativo]); }
async function listarDestinatarios() { await ensureTabelas(); const r = await query(`SELECT email, ativo FROM alertas_destinatarios ORDER BY email`); return r.rows; }
async function addDestinatario(email) { await ensureTabelas(); await query(`INSERT INTO alertas_destinatarios (email) VALUES ($1) ON CONFLICT (email) DO UPDATE SET ativo=true`, [email]); }
async function removerDestinatario(email) { await ensureTabelas(); await query(`DELETE FROM alertas_destinatarios WHERE email=$1`, [email]); }

// Computa os candidatos (sem dedupe).
async function computar() {
  const [vendas, grade, ruptura] = await Promise.all([
    readSheet("vendas_cliente_produto").catch(() => []),
    readSheet("grade_estoque").catch(() => []),
    readSheet("ruptura_detalhe").catch(() => []),
  ]);

  // Janela do trimestre: os 3 meses mais recentes presentes nas vendas.
  const mesesTodos = [...new Set(vendas.map((v) => String(v.mes_referencia || "").slice(0, 7)).filter(Boolean))].sort();
  const trimestre = mesesTodos.slice(-3);
  const triSet = new Set(trimestre);
  const semanas = Math.max(1, trimestre.length * 4.345); // ~4,345 semanas/mês

  // Agrega por produto no trimestre: volume, nº de compras (linhas pdv×mês) e PDVs.
  const porProd = {};
  let totalVol = 0;
  for (const v of vendas) {
    if (!triSet.has(String(v.mes_referencia || "").slice(0, 7))) continue;
    const cod = String(v.cod_produto || "").trim();
    if (!cod) continue;
    const vol = num(v.volume_hl);
    if (!porProd[cod]) porProd[cod] = { cod, nome: String(v.nome_produto || "").trim(), vol: 0, compras: 0, pdvs: new Set() };
    const p = porProd[cod];
    p.vol += vol; p.compras += 1; p.pdvs.add(String(v.cod_pdv || "").trim());
    totalVol += vol;
  }
  const top10 = Object.values(porProd).sort((a, b) => b.vol - a.vol).slice(0, 10).map((p, i) => ({
    cod: p.cod, nome: p.nome, rank: i + 1,
    vol: Math.round(p.vol * 10) / 10,
    pct: totalVol > 0 ? Math.round((p.vol / totalVol) * 1000) / 10 : 0,
    freqSemana: Math.round((p.compras / semanas) * 10) / 10, // ~pedidos/semana
    pdvs: p.pdvs.size,
  }));

  const gradeCods = new Set(grade.map((g) => String(g.cod || "").trim()));
  const gradeFalta = top10.filter((p) => !gradeCods.has(p.cod)); // top-10 sem estoque na grade

  // Ruptura do dia mais recente presente na tabela
  const datas = [...new Set(ruptura.map((r) => String(r.data || "").trim()).filter(Boolean))].sort();
  const ultimaData = datas.length ? datas[datas.length - 1] : null;
  const rupturas = ruptura
    .filter((r) => String(r.data || "").trim() === ultimaData)
    .map((r) => ({
      setor: String(r.setor || "").trim(), cod_pdv: String(r.cod_pdv || "").trim(),
      nome_pdv: String(r.nome_pdv || "").trim(), cod: String(r.cod_produto || "").trim(),
      nome: String(r.nome_produto || "").trim(), data: String(r.data || "").trim(),
      volume: Math.round(num(r.volume_falta_hl) * 10) / 10,
    }));

  return { top10, gradeFalta, rupturas, ultimaData, trimestre };
}

function montarDigest(grade, rup, dia) {
  let secGrade = "";
  if (grade.length) {
    const lg = grade.map((g) =>
      `<li><b>${g.nome}</b> (cod ${g.cod}) — #${g.rank} mais vendido · ~${fmtHL(g.freqSemana)} pedidos/semana · representa <b>${fmtHL(g.pct)}%</b> do volume do trimestre</li>`
    ).join("");
    secGrade = `
      <h3 style="color:#c0392b">🔴 Sem grade de estoque (top-10 mais vendidos)</h3>
      <p>Os produtos abaixo estão entre os mais vendidos e estão <b>sem grade de estoque</b>.
      <b>Qual a previsão de chegada?</b></p>
      <ul>${lg}</ul>`;
  }
  let secRup = "";
  if (rup.length) {
    const lr = rup.map((r) =>
      `<li>Setor ${r.setor} · ${r.nome_pdv} (cod ${r.cod_pdv}) — <b>${r.nome}</b>: ${fmtHL(r.volume)} HL</li>`
    ).join("");
    secRup = `<h3>📉 Pedidos cortados por falta de estoque${rup[0]?.data ? ` (${rup[0].data})` : ""}</h3><ul>${lr}</ul>`;
  }
  const html = `
    <div style="font-family:Arial,sans-serif;color:#222;line-height:1.5">
      <h2 style="color:#7DBA3D">Alertas de ruptura — ${dia}</h2>
      ${secGrade}${secRup}
      <hr><small>Hop Follow-up · alerta automático · responda este e-mail com a previsão/devolutiva.</small>
    </div>`;
  const assunto = `[Hop] Ruptura — ${grade.length} produto(s) sem grade, ${rup.length} pedido(s) cortado(s) — ${dia}`;
  return { assunto, html };
}

async function enviarBrevo(destinatarios, assunto, html) {
  const key = (process.env.BREVO_API_KEY || "").trim();
  const from = (process.env.ALERTA_FROM || "").trim();
  if (!key) throw new Error("BREVO_API_KEY não configurada no ambiente.");
  if (!from) throw new Error("ALERTA_FROM (remetente) não configurado no ambiente.");
  try {
    await axios.post("https://api.brevo.com/v3/smtp/email", {
      sender: { email: from, name: process.env.ALERTA_FROM_NAME || "Hop Follow-up" },
      to: destinatarios.map((e) => ({ email: e })),
      subject: assunto,
      htmlContent: html,
    }, { headers: { "api-key": key, "Content-Type": "application/json", accept: "application/json" }, timeout: 20000 });
  } catch (e) {
    const st = e?.response?.status;
    const det = e?.response?.data?.message || e?.response?.data?.code || e.message;
    if (st === 401) {
      throw new Error(`Brevo recusou a chave (401): ${det}. Confira se a BREVO_API_KEY é a API key v3 (começa com 'xkeysib-'), não a senha/chave SMTP, e sem espaços.`);
    }
    if (st === 400) {
      throw new Error(`Brevo recusou o envio (400): ${det}. Geralmente é o remetente não verificado (${from}) — verifique-o em Senders no Brevo.`);
    }
    throw new Error(`Brevo (${st || "?"}): ${det}`);
  }
}

// Roda o ciclo. forcar=true (teste) ignora o dedupe e NÃO grava o histórico (permite reenviar).
async function rodar({ forcar = false } = {}) {
  await ensureTabelas();
  const cfg = await getConfig();
  if (!cfg.ativo && !forcar) return { enviado: false, motivo: "alertas desativados" };

  const { gradeFalta, rupturas } = await computar();
  // Grade: no máximo 1 alerta por produto a cada 7 dias (evita spam quando o produto
  // fica dias sem chegar e a grade é importada todo dia). Ruptura: 1x por ocorrência/dia.
  const GRADE_COOLDOWN_DIAS = 7;
  const itens = [
    ...gradeFalta.map((g) => ({ chave: `grade|${g.cod}`, tipo: "grade", cooldown: GRADE_COOLDOWN_DIAS, g })),
    ...rupturas.map((r) => ({ chave: `ruptura|${r.setor}|${r.cod_pdv}|${r.cod}|${r.data}`, tipo: "ruptura", cooldown: null, r })),
  ];
  if (!itens.length) return { enviado: false, motivo: "nada a alertar" };

  let novos = itens;
  if (!forcar) {
    const r = await query(`SELECT chave, enviado_em FROM alertas_enviados WHERE chave = ANY($1)`, [itens.map((i) => i.chave)]);
    const ultimo = new Map(r.rows.map((x) => [x.chave, new Date(x.enviado_em).getTime()]));
    const agora = Date.now();
    novos = itens.filter((i) => {
      const last = ultimo.get(i.chave);
      if (last == null) return true;                // nunca enviado
      if (i.cooldown == null) return false;         // ruptura: já alertado essa ocorrência
      return agora - last > i.cooldown * 86400000;  // grade: só depois do cooldown (7 dias)
    });
  }
  if (!novos.length) return { enviado: false, motivo: "nada novo (já alertado hoje)" };

  const dest = (await listarDestinatarios()).filter((d) => d.ativo).map((d) => d.email);
  if (!dest.length) return { enviado: false, motivo: "sem destinatários cadastrados" };

  const nGrade = novos.filter((i) => i.tipo === "grade").map((i) => i.g);
  const nRup = novos.filter((i) => i.tipo === "ruptura").map((i) => i.r);
  const { assunto, html } = montarDigest(nGrade, nRup, hojeStr());
  await enviarBrevo(dest, assunto, html);

  if (!forcar) {
    for (const i of novos) {
      // Grade usa a mesma chave sempre (grade|cod) → atualiza a data p/ reiniciar o cooldown.
      await query(`INSERT INTO alertas_enviados (chave, tipo) VALUES ($1,$2)
                   ON CONFLICT (chave) DO UPDATE SET enviado_em=now()`, [i.chave, i.tipo]);
    }
  }
  const resumo = `${nGrade.length} grade + ${nRup.length} ruptura → ${dest.length} destinatário(s)`;
  await query(`UPDATE alertas_config SET ultimo_envio=now(), ultimo_resumo=$1 WHERE id=1`, [resumo]);
  return { enviado: true, resumo, grade: nGrade.length, rupturas: nRup.length, destinatarios: dest.length };
}

module.exports = {
  ensureTabelas, getConfig, setAtivo, listarDestinatarios, addDestinatario, removerDestinatario,
  computar, rodar,
};
