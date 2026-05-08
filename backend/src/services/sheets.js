const { google } = require("googleapis");

const SHEET_ID = process.env.GOOGLE_SHEET_ID;

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive",
    ],
  });
}

async function getSheets() {
  const auth = getAuth();
  return google.sheets({ version: "v4", auth });
}

// Lê uma aba inteira e retorna array de objetos usando a primeira linha como cabeçalho
async function readSheet(tabName) {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: tabName,
  });

  const rows = res.data.values || [];
  if (rows.length === 0) return [];

  const headers = rows[0];
  return rows.slice(1).map((row) => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] ?? "";
    });
    return obj;
  });
}

// Escreve uma linha nova no final de uma aba
async function appendRow(tabName, values) {
  const sheets = await getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: tabName,
    valueInputOption: "USER_ENTERED",
    resource: { values: [values] },
  });
}

// Atualiza uma linha específica pelo índice (1-based, considerando cabeçalho na linha 1)
async function updateRow(tabName, rowIndex, values) {
  const sheets = await getSheets();
  const range = `${tabName}!A${rowIndex + 1}`;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range,
    valueInputOption: "USER_ENTERED",
    resource: { values: [values] },
  });
}

// Garante que uma aba existe, cria se não existir
async function ensureTab(tabName) {
  const sheets = await getSheets();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const exists = meta.data.sheets.some(
    (s) => s.properties.title === tabName
  );

  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      resource: {
        requests: [
          { addSheet: { properties: { title: tabName } } },
        ],
      },
    });
    console.log(`Aba criada: ${tabName}`);
  }
}

// Inicializa todas as abas necessárias com seus cabeçalhos
async function initializeSheets() {
  const tabs = {
    usuarios: ["cod", "nome", "telefone", "perfil", "gv", "ativo", "criado_em"],
    otp_sessions: ["telefone", "codigo", "expira_em", "usado"],
    cobertura: ["setor", "dia_semana", "data", "categoria", "pdvs_visitados", "pdvs_total", "meta"],
    visitas_hoje: ["setor", "data", "cod_pdv", "nome_pdv", "endereco", "rota"],
    pdv_mix: ["cod_pdv", "nome_pdv", "setor", "produto", "qtd_media_4m"],
    pdv_compras: ["cod_pdv", "nome_pdv", "setor", "data", "valor", "mix"],
    sem_compra: ["setor", "cod_pdv", "nome_pdv", "dias_sem_compra", "ultimo_produto"],
    inadimplentes: ["setor", "cod_pdv", "nome_pdv", "valor_aberto", "dias_atraso"],
    rank_clientes: ["setor", "cod_pdv", "nome_pdv", "volume_4m_hl", "devolucoes"],
    tasks: ["setor", "cod_pdv", "nome_pdv", "descricao", "status", "data_abertura", "data_atualizacao"],
    faltas: ["setor", "produto", "qtd_faltas", "mes_referencia"],
    metas: ["setor", "categoria", "meta_volume", "mes_referencia", "peso"],
    incidentes: ["id", "setor", "cod_rn", "nome_rn", "descricao", "imagem_url", "status", "resposta", "criado_em", "respondido_em"],
    rv: ["setor", "mes_referencia", "categoria", "volume_vendido_hl", "meta_hl", "receita_gerada", "atendimento_produtivo", "rv_bloqueada"],
  };

  for (const [tab, headers] of Object.entries(tabs)) {
    await ensureTab(tab);
    const existing = await readSheet(tab);
    if (existing.length === 0) {
      const sheets = await getSheets();
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${tab}!A1`,
        valueInputOption: "USER_ENTERED",
        resource: { values: [headers] },
      });
      console.log(`Cabeçalho criado: ${tab}`);
    }
  }

  console.log("✅ Planilhas inicializadas com sucesso.");
}

module.exports = { readSheet, appendRow, updateRow, ensureTab, initializeSheets };
