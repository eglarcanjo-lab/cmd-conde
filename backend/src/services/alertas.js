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
const mesAtualStr = () => new Date().toISOString().slice(0, 7);
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

  // Top-10 do mês corrente (por volume HL)
  const mes = mesAtualStr();
  const porProd = {};
  for (const v of vendas) {
    if (String(v.mes_referencia || "").slice(0, 7) !== mes) continue;
    const cod = String(v.cod_produto || "").trim();
    if (!cod) continue;
    if (!porProd[cod]) porProd[cod] = { cod, nome: String(v.nome_produto || "").trim(), vol: 0 };
    porProd[cod].vol += num(v.volume_hl);
  }
  const top10 = Object.values(porProd).sort((a, b) => b.vol - a.vol).slice(0, 10)
    .map((p, i) => ({ ...p, rank: i + 1, vol: Math.round(p.vol * 10) / 10 }));

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

  return { top10, gradeFalta, rupturas, ultimaData };
}

function montarDigest(grade, rup, dia) {
  const lg = grade.map((g) => `<li><b>${g.nome}</b> (cod ${g.cod}) — #${g.rank} mais vendido do mês, <b>esgotado na grade</b></li>`).join("");
  const lr = rup.map((r) => `<li>Setor ${r.setor} · ${r.nome_pdv} (cod ${r.cod_pdv}) — <b>${r.nome}</b>: ${fmtHL(r.volume)} HL em falta</li>`).join("");
  const html = `
    <div style="font-family:Arial,sans-serif;color:#222">
      <h2 style="color:#7DBA3D">Alertas de ruptura — ${dia}</h2>
      ${grade.length ? `<h3>🔴 Grade zerada (top-10 mais vendidos)</h3><ul>${lg}</ul>` : ""}
      ${rup.length ? `<h3>📉 Falta em pedido</h3><ul>${lr}</ul>` : ""}
      <p><b>Por favor, responda este e-mail com a devolutiva.</b></p>
      <hr><small>Hop Follow-up · alerta automático</small>
    </div>`;
  const assunto = `[Hop] Alertas de ruptura — ${dia} (${grade.length} grade, ${rup.length} pedido)`;
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
  const dia = hojeStr();
  const itens = [
    ...gradeFalta.map((g) => ({ chave: `grade|${g.cod}|${dia}`, tipo: "grade", g })),
    ...rupturas.map((r) => ({ chave: `ruptura|${r.setor}|${r.cod_pdv}|${r.cod}|${r.data}`, tipo: "ruptura", r })),
  ];
  if (!itens.length) return { enviado: false, motivo: "nada a alertar" };

  let novos = itens;
  if (!forcar) {
    const jaEnviados = await query(`SELECT chave FROM alertas_enviados WHERE chave = ANY($1)`, [itens.map((i) => i.chave)]);
    const set = new Set(jaEnviados.rows.map((r) => r.chave));
    novos = itens.filter((i) => !set.has(i.chave));
  }
  if (!novos.length) return { enviado: false, motivo: "nada novo (já alertado hoje)" };

  const dest = (await listarDestinatarios()).filter((d) => d.ativo).map((d) => d.email);
  if (!dest.length) return { enviado: false, motivo: "sem destinatários cadastrados" };

  const nGrade = novos.filter((i) => i.tipo === "grade").map((i) => i.g);
  const nRup = novos.filter((i) => i.tipo === "ruptura").map((i) => i.r);
  const { assunto, html } = montarDigest(nGrade, nRup, dia);
  await enviarBrevo(dest, assunto, html);

  if (!forcar) {
    for (const i of novos) {
      await query(`INSERT INTO alertas_enviados (chave, tipo) VALUES ($1,$2) ON CONFLICT (chave) DO NOTHING`, [i.chave, i.tipo]);
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
