# Como incluir / excluir um KPI do SPO

Guia da rotina trimestral (KPIs entram e saem). Depois da refatoração do registro
(v3.19.2 → v3.19.11), o processo ficou mecânico. Há dois tipos de KPI:

- **Simples** (a maioria: itens 5, 8, 9, 11–24): o "realizado" é uma coluna da linha
  `OPERACAO` de uma aba `spo_<id>_resumo`. Seguem o padrão automatizado abaixo.
- **Especiais** (itens 1, 2, 3, 4, 6, 7): cálculo próprio (somatório por GV, percentual).
  Têm um `case` dedicado em `getRealDados` (front) e em `computeReal` (back `spo.js`).

---

## ➕ Incluir um KPI SIMPLES

Use o **Score 5 (item 12)** como modelo de referência em todos os arquivos.

### 1. Processador (`cmd-conde-processor`)
1. Escreva `processar_<id>(conteudo_bytes, mes_ref=None)` em `src/processor.py`.
   - Gere a aba **`spo_<id>_resumo`** com uma linha por setor **+ uma linha `OPERACAO`**,
     contendo a coluna do realizado (ex.: `pdvs_ok`, `tasks_validas`).
   - Opcional: aba **`spo_<id>_detalhe`** (1 linha por PDV) para o drill-down.
   - Pode copiar a estrutura de `processar_score5`.
2. Importe a função no topo de `src/app.py` (lista do `from processor import ...`).
3. Adicione **1 linha** no dispatch de `/api/processar/ambos`:
   ```python
   _rodar_spo(arquivos, "spo_<id>", processar_<id>, resultados, _mes_ref, msg="<Nome> processado")
   ```
   (se a função NÃO usa mês, passe `usa_mes=False`)

### 2. Backend (`cmd-conde/backend`)
4. Adicione **1 linha** em `src/config/spoKpis.js` → `SPO_REAL`:
   ```js
   <n>: { aba: "spo_<id>_resumo", campos: ["<coluna_realizado>"] },
   ```
   - **Endpoint? Não precisa.** A rota genérica `GET /api/spo/:id/resumo` e `/:id/detalhe`
     já atende qualquer `spo_<id>_resumo`/`_detalhe`.

### 3. Frontend (`cmd-conde/frontend`)
5. Adicione a entrada de exibição em `src/config/spoKpis.js` → `SPO_KPIS`:
   ```js
   { n: <n>, label: "<Nome>", pts: <pts>, peso: <peso>, ativo: true },
   ```
   (isto já alimenta a tela SPO, o Painel e o admin de Metas — fonte única)
6. Adicione o **slot de upload** em `src/pages/Admin/Arquivos.jsx` → `ARQUIVOS_CONFIG`:
   ```js
   { id: "spo_<id>", campo: "spo_<id>", rotulo: "<Nome>", item: "<n>",
     extensoes: ".xlsx,.xls", grupo: "spo", icon: "<emoji>", link: "<BI opcional>" },
   ```
7. Adicione o **bloco do card** em `src/pages/SPO/index.jsx` (procure `kpiAtivo === 12`
   e copie o bloco do item 12, trocando o número, o estado e o rótulo).
   - O fetch do `_resumo`/`_detalhe` entra no `Promise.all` (use a rota genérica
     `/api/spo/<id>/resumo`).

### 4. Subir
8. Bumpe `APP_VERSION` (`frontend/src/App.jsx`) + linha no `CHANGELOG.md`.
9. Commit/push **os dois repos** (processador e app). Deploy é automático.
10. Reimporte o relatório do KPI na aba **Arquivos** com o mês de referência.

---

## ➖ Excluir um KPI do trimestre

- **Soft (recomendado):** em `frontend/src/config/spoKpis.js` (`SPO_KPIS`), marque
  `ativo: false`. Some da tela e do total na hora; a aba e o histórico ficam
  preservados (se voltar no próximo tri, é só `ativo: true`).
- **Hard (remover de vez):** apague a entrada de `SPO_KPIS`, a linha de `SPO_REAL`
  (backend), o slot de `ARQUIVOS_CONFIG`, o bloco do card no `SPO/index.jsx`, a linha
  do dispatch e a função no `processor.py`. As abas físicas no Sheets podem ser
  apagadas à mão (inofensivo deixá-las).

---

## Onde cada coisa vive (mapa rápido)

| Peça | Arquivo |
|---|---|
| Lista de KPIs (label/pts/peso/ativo) | `frontend/src/config/spoKpis.js` → `SPO_KPIS` |
| Regra do realizado (fonte única) | `backend/src/config/spoKpis.js` → `SPO_REAL` (servida em `/api/spo/config`) |
| Endpoints resumo/detalhe | genéricos em `backend/src/routes/spo.js` (`/:id/resumo`, `/:id/detalhe`) |
| Dispatch de importação | `cmd-conde-processor/src/app.py` → `_rodar_spo(...)` |
| Cálculo (memória) | `cmd-conde-processor/src/processor.py` → `processar_<id>` |
| Slot de upload | `frontend/src/pages/Admin/Arquivos.jsx` → `ARQUIVOS_CONFIG` |
| Card na tela | `frontend/src/pages/SPO/index.jsx` |
