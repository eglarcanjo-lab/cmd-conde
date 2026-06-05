// updated: 2026-05-16 21:47:53
const { google } = require("googleapis");

const SHEET_ID = process.env.GOOGLE_SHEET_ID;

// ── Cache em memória para reduzir chamadas à Sheets API ───────────────────────
const _cache = new Map(); // tabName → { data, ts }
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

function cacheGet(tab) {
  const entry = _cache.get(tab);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}
function cacheSet(tab, data) { _cache.set(tab, { data, ts: Date.now() }); }
function cacheInvalidate(tab) { _cache.delete(tab); }
function cacheClearAll() { _cache.clear(); }
// ─────────────────────────────────────────────────────────────────────────────

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: (() => {
      const k = process.env.GOOGLE_PRIVATE_KEY || "";
      if (k.includes("\\n")) return k.replace(/\\n/g, "\n");
      if (k.includes("\n")) return k;
      return k.replace(/\\n/g, "\n");
    })(),
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
  const cached = cacheGet(tabName);
  if (cached) return cached;

  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: tabName,
    valueRenderOption: "UNFORMATTED_VALUE",
  });

  const rows = res.data.values || [];
  if (rows.length === 0) { cacheSet(tabName, []); return []; }

  const headers = rows[0];
  const result = rows.slice(1).map((row) => {
    const obj = {};
    headers.forEach((h, i) => {
      // Converte para string para manter compatibilidade com comparações de setor/cod_pdv
      // (UNFORMATTED_VALUE pode retornar números — "101" chegaria como 101)
      const v = row[i];
      obj[h] = v != null ? String(v) : "";
    });
    return obj;
  });

  cacheSet(tabName, result);
  return result;
}

// Escreve uma linha nova no final de uma aba
// Usa RAW para impedir que o Sheets interprete strings como datas (ex: "2026-05" → serial 46143)
async function appendRow(tabName, values) {
  cacheInvalidate(tabName);
  const sheets = await getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: tabName,
    valueInputOption: "RAW",
    resource: { values: [values] },
  });
}

// Escreve várias linhas em uma única chamada à API (batch)
async function appendRows(tabName, rowsArray) {
  if (!rowsArray || rowsArray.length === 0) return;
  cacheInvalidate(tabName);
  const sheets = await getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: tabName,
    valueInputOption: "RAW",
    resource: { values: rowsArray },
  });
}

// Atualiza uma linha específica pelo índice (1-based, considerando cabeçalho na linha 1)
async function updateRow(tabName, rowIndex, values) {
  cacheInvalidate(tabName);
  const sheets = await getSheets();
  const range = `${tabName}!A${rowIndex + 1}`;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range,
    valueInputOption: "RAW",
    resource: { values: [values] },
  });
}

// Sobrescreve toda uma aba (limpa e reescreve com cabeçalho + linhas)
async function sobrescreverAba(tabName, rows) {
  // rows: array de arrays; primeira linha = cabeçalho
  cacheInvalidate(tabName);
  await ensureTab(tabName);
  const sheets = await getSheets();
  await sheets.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range: tabName });
  if (rows.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${tabName}!A1`,
      valueInputOption: "RAW",
      resource: { values: rows },
    });
  }
}

// Remove uma linha de dados pelo índice 0-based (sem contar o cabeçalho)
async function deleteRow(tabName, dataRowIdx) {
  cacheInvalidate(tabName);
  const sheets = await getSheets();

  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: tabName,
    valueRenderOption: "UNFORMATTED_VALUE",
  });

  const allRows = resp.data.values || [];
  if (allRows.length <= 1) return; // só cabeçalho ou vazia

  // dataRowIdx 0-based → posição no array (índice 0 = cabeçalho, índice 1 = 1ª linha de dados)
  const spliceIdx = dataRowIdx + 1;
  if (spliceIdx >= allRows.length) return;
  allRows.splice(spliceIdx, 1);

  await sheets.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range: tabName });
  if (allRows.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${tabName}!A1`,
      valueInputOption: "USER_ENTERED",
      resource: { values: allRows },
    });
  }
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
    spo_menu_resumo: ["setor","tasks_total","tasks_validas","pct","ok","mes_referencia"],
    spo_politica_resumo: ["setor","pdvs_aderidos","pdvs_execucao","pct","meta","ok","mes_referencia"],
    spo_politica_detalhe: ["setor","cod_pdv","tasks_aderidas","tasks_validas","pct","ok","mes_referencia"],
    spo_promo_detalhe: ["setor","cod_pdv","dia_visita","visitas","acesso_promo","pct","mes_referencia"],
    spo_promo_resumo: ["setor","visitas","acesso_promo","pct","meta","ok","mes_referencia"],
    spo_dto_resumo: ["mes_referencia","status_final","matinal_meta","matinal_real","matinal_pct","matinal_status","vespertina_meta","vespertina_real","vespertina_pct","vespertina_status","coaching_meta","coaching_real","coaching_pct","coaching_status"],
    spo_desafios: ["gv","dia","mes_referencia","status"],
    spo_metas: ["item","mes","meta","real"],
    volume_diario: ["data","setor","cod_produto","nome_produto","volume_hl"],
    sku_foco: ["setor","cod_produto","nome_produto","meta_mensal_hl","mes_referencia","motivo"],
    incentivos: ["id","titulo","descricao","tipo","sku_codigo","premio","unidade","data_inicio","data_fim","ativo","publico_alvo","ordem","cor","criado_em"],
    incentivos_resultados: ["id_incentivo","setor","nome","valor","atualizado_em"],
    popups: ["id","titulo","imagem_url","ativo","data_inicio","data_fim","acao_tipo","acao_valor","publico_alvo","ordem","criado_em"],
    vendas_cliente_produto: ["setor","cod_pdv","nome_pdv","cod_produto","nome_produto","volume_hl","mes_referencia"],
    rv_resultado: ["setor", "segmento", "ap_ok", "po_total", "pontos_real", "pontos_meta", "pct_pontos", "peso_pontos", "rv_pontos", "meta_cerveja", "peso_cerveja", "real_cerveja", "meta_nab", "peso_nab", "real_nab", "meta_match", "peso_match", "real_match", "meta_marketplace", "peso_marketplace", "real_marketplace", "indicador_variavel", "mes_referencia"],
    rv: ["setor", "mes_referencia", "categoria", "volume_vendido_hl", "meta_hl", "receita_gerada", "atendimento_produtivo", "rv_bloqueada"],
    configuracoes: ["chave", "valor"],
  };

  const sheets = await getSheets();

  // 1) Metadados UMA vez (em vez de 1 spreadsheets.get por aba)
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const existentes = new Set((meta.data.sheets || []).map((s) => s.properties.title));

  // 2) Cria as abas faltantes num único batchUpdate + escreve cabeçalhos em batch
  const faltantes = Object.keys(tabs).filter((t) => !existentes.has(t));
  if (faltantes.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      resource: { requests: faltantes.map((t) => ({ addSheet: { properties: { title: t } } })) },
    });
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_ID,
      resource: {
        valueInputOption: "USER_ENTERED",
        data: faltantes.map((t) => ({ range: `${t}!A1`, values: [tabs[t]] })),
      },
    });
    console.log(`Abas criadas: ${faltantes.join(", ")}`);
  }

  // 3) Abas existentes: lê a 1ª célula de TODAS num único batchGet e escreve
  //    cabeçalho só nas que estiverem sem header (evita ~50 leituras separadas)
  const paraChecar = Object.keys(tabs).filter((t) => existentes.has(t));
  if (paraChecar.length > 0) {
    const resp = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: SHEET_ID,
      ranges: paraChecar.map((t) => `${t}!A1:A1`),
    });
    const vazias = [];
    (resp.data.valueRanges || []).forEach((vr, i) => {
      const a1 = vr.values?.[0]?.[0];
      if (a1 == null || String(a1).trim() === "") vazias.push(paraChecar[i]);
    });
    if (vazias.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SHEET_ID,
        resource: {
          valueInputOption: "USER_ENTERED",
          data: vazias.map((t) => ({ range: `${t}!A1`, values: [tabs[t]] })),
        },
      });
      console.log(`Cabeçalhos criados: ${vazias.join(", ")}`);
    }
  }

  console.log("✅ Planilhas inicializadas com sucesso.");
}

module.exports = { readSheet, appendRow, appendRows, updateRow, deleteRow, sobrescreverAba, ensureTab, initializeSheets, cacheClearAll };
