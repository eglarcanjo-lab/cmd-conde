-- ─────────────────────────────────────────────────────────────────────────────
-- Hop Follow-up — Schema PostgreSQL (migração Google Sheets → SQL)
-- Alvo: Supabase (Postgres 15+). Rodar uma vez no SQL Editor do Supabase.
--
-- Estratégia (ver Plano_Migracao_Sheets_para_SQL.pdf):
--   • CADASTRO/OPERACIONAL (este arquivo): DDL explícito com PK, tipos e índices.
--     São tabelas atualizadas linha a linha (INSERT/UPDATE) — precisam de schema estável.
--   • COMPUTADAS/IMPORTADAS (spo_*, rv_*, vendas_*, entregas_*, ruptura_detalhe,
--     nota_itens, pdv_base, produtos_*, volume_diario, grade_estoque, cobertura*…):
--     são REESCRITAS inteiras a cada import. O ETL/sqlRepo as cria a partir do
--     cabeçalho real de cada aba, aplicando as REGRAS DE TIPO documentadas no fim.
--     Assim as colunas batem com a realidade e se auto-ajustam se um relatório mudar.
--
-- Convenções de tipo (corrigem bugs do Sheets):
--   • setor, cod_pdv, cod_produto, cod, gv, cpf  → TEXT  (preserva zeros à esquerda)
--   • mes_referencia / mes (YYYY-MM)             → TEXT  (é chave de mês, não data)
--   • volumes, valores, pct, metas, pontos, qtd  → NUMERIC
--   • datas reais (data, data_devol)             → DATE  (acaba o "serial"/vazamento de mês)
--   • ativo, *_ok                                → BOOLEAN
-- ─────────────────────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 1. CADASTRO / OPERACIONAL (DDL explícito)                                   ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS usuarios (
  cod         TEXT PRIMARY KEY,
  nome        TEXT,
  cpf         TEXT UNIQUE,
  telefone    TEXT,
  perfil      TEXT,
  gv          TEXT,
  ativo       BOOLEAN DEFAULT TRUE,
  senha       TEXT,                       -- hash bcrypt ou sentinela ("1234"/"")
  criado_em   TEXT
);

CREATE TABLE IF NOT EXISTS reset_solicitacoes (
  id            TEXT PRIMARY KEY,
  cod           TEXT,
  nome          TEXT,
  cpf           TEXT,
  telefone      TEXT,
  status        TEXT,                     -- pendente | autorizada | rejeitada
  solicitado_em TEXT,
  resolvido_em  TEXT,
  resolvido_por TEXT
);

CREATE TABLE IF NOT EXISTS incidentes (
  id            TEXT PRIMARY KEY,
  data_criacao  TEXT,
  setor         TEXT,
  nome_rn       TEXT,
  descricao     TEXT,
  evidencia_url TEXT,
  status        TEXT,
  resposta      TEXT,
  finalizado_em TEXT,
  data_ocorrido TEXT,
  perfil_rn     TEXT
);
CREATE INDEX IF NOT EXISTS idx_incidentes_setor ON incidentes (setor);

CREATE TABLE IF NOT EXISTS avisos (
  id           TEXT PRIMARY KEY,
  tela         TEXT,
  titulo       TEXT,
  mensagem     TEXT,
  tipo         TEXT,
  publico_alvo TEXT,
  ativo        BOOLEAN DEFAULT TRUE,
  ordem        INTEGER DEFAULT 0,
  criado_em    TEXT
);

CREATE TABLE IF NOT EXISTS popups (
  id           TEXT PRIMARY KEY,
  titulo       TEXT,
  imagem_url   TEXT,
  ativo        BOOLEAN DEFAULT TRUE,
  data_inicio  DATE,
  data_fim     DATE,
  acao_tipo    TEXT,
  acao_valor   TEXT,
  publico_alvo TEXT,
  ordem        INTEGER DEFAULT 0,
  criado_em    TEXT
);

CREATE TABLE IF NOT EXISTS incentivos (
  id           TEXT PRIMARY KEY,
  titulo       TEXT,
  descricao    TEXT,
  tipo         TEXT,
  sku_codigo   TEXT,
  premio       TEXT,
  unidade      TEXT,
  data_inicio  DATE,
  data_fim     DATE,
  ativo        BOOLEAN DEFAULT TRUE,
  publico_alvo TEXT,
  ordem        INTEGER DEFAULT 0,
  cor          TEXT,
  criado_em    TEXT
);

CREATE TABLE IF NOT EXISTS incentivos_resultados (
  id_incentivo  TEXT,
  setor         TEXT,
  nome          TEXT,
  valor         NUMERIC,
  atualizado_em TEXT,
  PRIMARY KEY (id_incentivo, setor)
);

CREATE TABLE IF NOT EXISTS sku_foco (
  setor          TEXT,
  cod_produto    TEXT,
  nome_produto   TEXT,
  meta_mensal_hl NUMERIC,
  mes_referencia TEXT,
  motivo         TEXT,
  PRIMARY KEY (setor, cod_produto, mes_referencia)
);

CREATE TABLE IF NOT EXISTS metas (
  setor          TEXT,
  categoria      TEXT,
  meta_volume    NUMERIC,
  mes_referencia TEXT,
  peso           NUMERIC,
  volume_tri     NUMERIC,
  meta_aplicada  NUMERIC,
  PRIMARY KEY (setor, categoria, mes_referencia)
);

CREATE TABLE IF NOT EXISTS spo_metas (
  item TEXT,
  mes  TEXT,
  meta NUMERIC,
  real NUMERIC,
  PRIMARY KEY (item, mes)
);

CREATE TABLE IF NOT EXISTS spo_desafios (
  gv             TEXT,
  dia            TEXT,
  mes_referencia TEXT,
  status         TEXT,
  PRIMARY KEY (gv, dia, mes_referencia)
);

CREATE TABLE IF NOT EXISTS configuracoes (
  chave TEXT PRIMARY KEY,
  valor TEXT
);

CREATE TABLE IF NOT EXISTS uso_app (
  cod           TEXT,
  nome          TEXT,
  perfil        TEXT,
  data          TEXT,                     -- chave diária (mantida como veio)
  aberturas     INTEGER DEFAULT 0,
  ultimo_acesso TEXT,
  PRIMARY KEY (cod, data)
);

CREATE TABLE IF NOT EXISTS uso_telas (
  cod           TEXT,
  nome          TEXT,
  mes           TEXT,
  telas_json    JSONB,
  atualizado_em TEXT,
  PRIMARY KEY (cod, mes)
);

-- Resumo de inadimplência (colunas fixas conhecidas; demais "fonte" são auto-criadas)
CREATE TABLE IF NOT EXISTS inadimplencia_real (
  setor         TEXT,
  cod_pdv       TEXT,
  nome_fantasia TEXT,
  qtd_titulos   NUMERIC,
  valor_total   NUMERIC,
  maior_atraso  NUMERIC,
  aging         TEXT
);
CREATE INDEX IF NOT EXISTS idx_inad_setor ON inadimplencia_real (setor);


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 2. COMPUTADAS / IMPORTADAS — criadas pelo ETL a partir do cabeçalho da aba  ║
-- ║    Aqui só os ÍNDICES (rodados após o ETL criar as tabelas). As colunas     ║
-- ║    seguem as regras de tipo do topo. Lista das tabelas:                     ║
-- ║      pdv_base, pdv_mix, rank_clientes, sem_compra, inadimplentes,           ║
-- ║      produtos_base, produtos_full, produtos_sem_categoria, grade_estoque,   ║
-- ║      cobertura, cobertura_resumo, volume_diario, vendas_cliente_produto,    ║
-- ║      entregas_frustradas, entregas_efetivadas, ruptura_detalhe, nota_itens, ║
-- ║      rv_resultado, rv, rv_volume, rv_mktp, rv_faturamento_mktp,             ║
-- ║      rv_pontos_bees, rv_ap, status_arquivos,                                ║
-- ║      spo_visitacao_gv(+_resumo), spo_coaching_(detalhe|resumo|sem_coaching),║
-- ║      spo_dias_rota_resumo, spo_menu_resumo, spo_politica_(resumo|detalhe),  ║
-- ║      spo_promo_(resumo|detalhe), spo_dto_resumo,                            ║
-- ║      spo_tasks_(cerveja|nab|volume|marketplace|match|cerv_zero|digit)_resumo,║
-- ║      spo_tasks_cerveja_detalhe, spo_score5_(resumo|detalhe),                ║
-- ║      spo_cupons_(resumo|detalhe), spo_loja_ideal_(resumo|detalhe),          ║
-- ║      spo_scanntech_(resumo|detalhe), spo_portfolio_ideal_(resumo|detalhe),  ║
-- ║      spo_pedido_alone_(resumo|detalhe), spo_ap_(resumo|detalhe),            ║
-- ║      spo_rgb_(total|litrinho|inteira|detalhe)                               ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- Os índices abaixo usam IF NOT EXISTS e só criam se a tabela já existir (rodar
-- DEPOIS do ETL). Foco nos filtros mais comuns do app: setor + mês + PDV/produto.

-- (rodar após o ETL popular as computadas)
-- CREATE INDEX IF NOT EXISTS idx_vendas_setor_mes   ON vendas_cliente_produto (setor, mes_referencia);
-- CREATE INDEX IF NOT EXISTS idx_vendas_pdv         ON vendas_cliente_produto (cod_pdv);
-- CREATE INDEX IF NOT EXISTS idx_entregas_setor_mes ON entregas_frustradas (setor, mes_referencia);
-- CREATE INDEX IF NOT EXISTS idx_entregas_nota      ON entregas_frustradas (nota);
-- CREATE INDEX IF NOT EXISTS idx_ruptura_setor_mes  ON ruptura_detalhe (setor, mes);
-- CREATE INDEX IF NOT EXISTS idx_notaitens_nota     ON nota_itens (nota);
-- CREATE INDEX IF NOT EXISTS idx_voldiario_setor    ON volume_diario (setor, data);
-- CREATE INDEX IF NOT EXISTS idx_pdvbase_setor      ON pdv_base (setor);
-- CREATE INDEX IF NOT EXISTS idx_rank_setor         ON rank_clientes (setor);
-- (os spo_*_resumo são pequenos — não precisam de índice)
