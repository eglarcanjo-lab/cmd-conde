# Versionamento — CMD Conde App

Versão atual: **v2.9.0**

A versão é exibida no rodapé do app (assinatura) e fica em `frontend/src/App.jsx`
na constante `APP_VERSION`. **Toda mudança que vai para produção deve avançar o número**
conforme as regras abaixo.

## Esquema: `vMAJOR.MINOR.PATCH`

### PATCH — `vX.Y.Z` → `vX.Y.(Z+1)`
Correções e ajustes que **não adicionam tela nem mudam o fluxo**.
- Correção de bug
- Ajuste visual, de texto ou de layout
- Performance / refator interno
- Correção de cálculo já existente

Exemplos reais: corrigir paginação do PDF de RV, ajustar pesos da RV ao regulamento,
neon nos cards do SPO, lupa/paisagem no mobile, fix do `mes_referencia`.

### MINOR — `vX.Y.Z` → `vX.(Y+1).0`  *(zera o patch)*
**Nova funcionalidade, módulo, aba ou relatório**, compatível com o que já existe
(não quebra nada). 
- Nova aba/página no app ou no admin
- Novo relatório/exportação
- Novo tipo de cálculo ou automação

Exemplos reais: aba Volume Diário, SKU Foco, Incentivos, Popups, relatório de RV,
snapshot do SPO, sistema de auto-atualização.

### MAJOR — `vX.Y.Z` → `v(X+1).0.0`  *(zera minor e patch)*
Mudança **estrutural / "nova geração"** — algo que muda a base do app ou exige
migração/reaprendizado dos usuários.
- Trocar o banco (Google Sheets → banco real)
- Reescrever a autenticação
- Redesign completo da navegação
- Suporte a multi-operação / multi-filial
- Quebra de compatibilidade com dados existentes

## Como avançar (checklist por deploy)
1. Identifique o tipo da mudança (patch / minor / major) pela regra acima.
2. Atualize `APP_VERSION` em `frontend/src/App.jsx`.
3. Adicione uma linha no histórico abaixo.
4. Commit + push.

---

## Histórico

### v2.9.7 — 2026-06-04
- **Processador (perf):** otimização de memória no processamento de pedidos
  para não estourar a RAM do Render free (512MB) com arquivos grandes (34MB+).
  Descarta colunas não usadas, vetoriza a categorização (map em vez de apply)
  e libera memória entre etapas. Resolve o "processador reiniciando" ao
  importar o arquivo de pedidos grande.

### v2.9.6 — 2026-06-04
- Importação: limite de upload por arquivo subido para **200MB** e erro de
  tamanho/upload com mensagem clara (413) em vez do genérico.

### v2.9.5 — 2026-06-04
- Importação com **retry automático** no cold start do processador (Render
  free hiberna). Detecta a falha de conexão, aguarda o processador subir e
  re-tenta sozinho (até 2x). Seguro pois o processamento é idempotente
  (sobrescreve, não duplica).

### v2.9.4 — 2026-06-04
- Erro de importação agora mostra o **detalhe real** (status, timeout/cold
  start, processador offline) em vez do genérico "Erro ao processar arquivos".

### v2.9.3 — 2026-06-04
- **Fix:** seletor "Mês de Referência" da importação vinha com default no
  **mês anterior**, fazendo relatórios sem data própria (Visitação, Score5,
  Alone, RGB, Cupons, etc.) serem gravados no mês errado se o usuário não
  trocasse. Default agora é o **mês atual** + banner grande mostrando o mês
  de destino antes de processar.

### v2.9.2 — 2026-06-04
- **Fix:** página Produtos do admin mostrava tudo como "sem categoria".
  Causa: endpoint duplicado `GET /produtos` no admin.js (criado para o
  auto-fill do SKU Foco) sombreava a rota real de `routes/produtos.js` e
  devolvia só cod+nome, sem a coluna `categorias`. Endpoint removido —
  a rota volta a servir a base completa. Auto-fill segue funcionando.

### v2.9.1 — 2026-06-03
- Menu do admin reorganizado: sub-abas agora em **barra lateral à esquerda**
  (conteúdo abre à direita), responsivo no mobile.
- Fontes do **SPO** (painel consolidado + cards de detalhe) aumentadas para legibilidade.
- Fontes da aba **Arquivos** (importação) aumentadas.

### v2.9.0 — 2026-06-03  *(marco / baseline)*
Consolidação a partir da linhagem informal (~v2.8) com o pacote recente:
- **Incentivos** — campanhas data-driven (ranking automático por SKU ou manual), aba no app + admin.
- **Popups** — caixas de imagem 1x/dia, upload Cloudinary, ação configurável.
- **Auto-atualização** — banner de 1 toque, verifica versão nova a cada 60s (sem fechar/reabrir).
- **Relatório de RV** — PDF timbrado + Excel formatado (espelhando o PDF).
- **RV** — pesos fixos por segmento conforme regulamento (OFF 50/25/12,5/7,5/5 · ON 50/25/15/10).
- **SPO** — snapshot de fechamento de mês, neon nos cards por status TRI, lupa/paisagem no mobile.
- **Volume Diário**, **SKU Foco**, **Pontos Force** (nova base), diversas correções de `mes_referencia`.
