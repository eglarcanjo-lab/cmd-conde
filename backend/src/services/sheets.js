// updated: 2026-05-16 21:47:53
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
    usuarios: ["cod", "nome", "cpf", "telefone", "perfil", "gv", "ativo", "senha", "criado_em"],
    otp_sessions: ["telefone", "codigo", "expira_em", "usado"],
    cobertura: ["setor", "dia_semana", "data", "categoria", "pdvs_visitados", "pdvs_total", "meta"],
    visitas_hoje: ["setor", "data", "cod_pdv", "nome_pdv", "endereco", "rota"],
    pdv_mix: ["cod_pdv", "nome_pdv", "setor", "produto", "qtd_media_4m"],
    pdv_compras: ["cod_pdv", "nome_pdv", "setor", "data", "valor", "mix"],
    sem_compra: ["setor", "cod_pdv", "nome_pdv", "dias_sem_compra", "ultimo_produto"],
    inadimplentes: ["setor", "cod_pdv", "nome_pdv", "valor_aberto", "dias_atraso"],
    rank_clientes: ["setor", "cod_pdv", "nome_pdv", "volume_4m_hl", "devolucoes"],
    tasks: ["mes_ano", "setor", "cod_pdv", "data_visita", "data_criacao", "data_conclusao", "geo", "comercial", "unb", "operacao", "gv", "cluster_primario", "tipo", "mensal_diaria", "id_task", "categoria", "status", "qtd_solicitada", "qtd_comprada", "descricao", "completa", "validada", "pre_validada", "pontuacao", "justificativa"],
    faltas: ["setor", "produto", "qtd_faltas", "mes_referencia"],
    metas: ["setor", "categoria", "meta_volume", "mes_referencia", "peso", "volume_tri", "meta_aplicada"],
    incidentes: ["data_criacao", "id", "setor", "nome_rn", "descricao", "evidencia_url", "status", "resposta", "finalizado_em", "data_ocorrido", "perfil_rn"],
    rv_pontos_bees: ["setor", "pontos_real", "pontos_meta", "pct_atingimento", "mes_referencia"],
    rv_ap: ["setor", "mes_referencia", "tasks_compra_real", "tasks_compra_meta", "compradores_real", "compradores_meta", "rota_efetiva_real", "rota_efetiva_meta", "gps_real", "gps_meta", "ap_ok"],
    rv_faturamento_mktp: ["setor", "faturamento_mktp_real", "mes_referencia"],
    spo_visitacao_gv: ["gv","setor","cod_pdv","nome_pdv","dia_visita","visita_ok","gps_ok","valida","mes_referencia"],
    spo_visitacao_gv_resumo: ["gv","meta","visitados","pct","mes_referencia"],
    spo_coaching_detalhe: ["gv","setor","data_visita","mes_referencia","coaching_ok","tmv_rota","coachings_validos","validacao_segmento"],
    spo_coaching_resumo: ["gv","periodo","mes_referencia","coachings_validos","meta","pct","rns_cobertos","total_rns_sala","gv_ok"],
    spo_coaching_sem_coaching: ["gv","setor","mes_referencia"],
    spo_dias_rota_resumo: ["gv","periodo","mes_referencia","dias_validos","meta","pct","gv_ok"],
    // v2.8 - dto
    spo_promo_detalhe: ["setor","cod_pdv","dia_visita","visitas","acesso_promo","pct","mes_referencia"],
    spo_promo_resumo: ["setor","visitas","acesso_promo","pct","meta","ok","mes_referencia"],
    spo_dto_resumo: ["mes_referencia","status_final","matinal_meta","matinal_real","matinal_pct","matinal_status","vespertina_meta","vespertina_real","vespertina_pct","vespertina_status","coaching_meta","coaching_real","coaching_pct","coaching_status"],
    spo_desafios: ["gv","dia","mes_referencia","status"],
    rv_resultado: ["setor", "segmento", "ap_ok", "po_total", "pontos_real", "pontos_meta", "pct_pontos", "peso_pontos", "rv_pontos", "meta_cerveja", "peso_cerveja", "real_cerveja", "meta_nab", "peso_nab", "real_nab", "meta_match", "peso_match", "real_match", "meta_marketplace", "peso_marketplace", "real_marketplace", "indicador_variavel", "mes_referencia"],
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
