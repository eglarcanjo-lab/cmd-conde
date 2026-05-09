const axios = require("axios");

const BASE_URL = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

const headers = () => ({
  Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
  "Content-Type": "application/json",
});

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendOTP(phone, code) {
  const payload = {
    messaging_product: "whatsapp",
    to: phone,
    type: "text",
    text: {
      body: `🔐 *CMD Ambev · Conde*\n\nSeu código de acesso é:\n\n*${code}*\n\nVálido por 10 minutos. Não compartilhe.`,
    },
  };
  try {
    const res = await axios.post(BASE_URL, payload, { headers: headers() });
    return { success: true, messageId: res.data.messages?.[0]?.id };
  } catch (err) {
    console.error("Erro ao enviar OTP:", err.response?.data || err.message);
    return { success: false, error: err.response?.data };
  }
}

async function sendText(phone, message) {
  const payload = {
    messaging_product: "whatsapp",
    to: phone,
    type: "text",
    text: { body: message },
  };
  try {
    const res = await axios.post(BASE_URL, payload, { headers: headers() });
    return { success: true, messageId: res.data.messages?.[0]?.id };
  } catch (err) {
    console.error("Erro ao enviar mensagem:", err.response?.data || err.message);
    return { success: false, error: err.response?.data };
  }
}

async function notifyAdminIncident(incident) {
  const msg =
    `🚨 *Novo Incidente Registrado*\n\n` +
    `*RN:* ${incident.nome_rn} (Setor ${incident.setor})\n` +
    `*Descrição:* ${incident.descricao}\n` +
    `*Horário:* ${new Date().toLocaleString("pt-BR")}\n\n` +
    `Acesse o painel para responder.`;
  return sendText(process.env.ADMIN_WHATSAPP, msg);
}

async function sendIncidentResponse(phone, resposta, nomeRn) {
  const msg =
    `✅ *Resposta ao seu incidente*\n\n` +
    `Olá ${nomeRn},\n\n` +
    `${resposta}\n\n` +
    `— Equipe CMD Ambev`;
  return sendText(phone, msg);
}

module.exports = { generateOTP, sendOTP, sendText, notifyAdminIncident, sendIncidentResponse };
