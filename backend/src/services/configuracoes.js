// Estado de manutenção em memória — carregado do Sheets na inicialização
const { readSheet } = require("./sheets");

let _estado = { ativo: false, mensagem: "Em Manutenção" };

async function carregarEstado() {
  try {
    const rows = await readSheet("configuracoes");
    const ativa = rows.find((r) => r.chave === "manutencao_ativa");
    const msg   = rows.find((r) => r.chave === "manutencao_mensagem");
    _estado.ativo    = ativa?.valor === "true";
    _estado.mensagem = msg?.valor  || "Em Manutenção";
    console.log(`🔧 Manutenção: ativo=${_estado.ativo}, mensagem="${_estado.mensagem}"`);
  } catch (err) {
    console.warn("⚠️  Não foi possível carregar estado de manutenção:", err.message);
  }
}

function getEstado() { return { ..._estado }; }

function setEstado(ativo, mensagem) {
  _estado.ativo    = !!ativo;
  _estado.mensagem = mensagem || _estado.mensagem;
}

module.exports = { carregarEstado, getEstado, setEstado };
