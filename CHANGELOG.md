# Versionamento — CMD Conde App

Versão atual: **v3.13.1** — fix faturamento Marketplace no Volume Diário

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

### v3.13.1 — 2026-06-08
- **Fix: Volume Diário não puxava o faturamento Marketplace.** O realizado vinha
  só de `rv_mktp` (que podia estar vazia/desatualizada). Agora, se vier 0, usa o
  `rv_resultado` (mesma fonte do RV). Parsing de número em R$ ficou robusto
  (aceita "39.597,00" etc).

### v3.13.0 — 2026-06-08
- **Volume Diário — caixa "📅 Mês inteiro":** marcando, a tela passa a mostrar o
  **mês atual acumulado** em vez do dia — o card vira "Volume do Mês", os cards
  de categoria mostram só o mês, e o Top SKUs vira o do mês. Backend passa a
  enviar `top_skus_mes`. Desmarcando, volta pro dia.

### v3.12.5 — 2026-06-08
- **Arquivos:** cadastrado o link do BI do **Pontos Bees**.

### v3.12.4 — 2026-06-08
- **Arquivos:** cadastrados os **links do BI** (Power BI) em 8 cards — Rota
  Coaching, Aba Promoção, +RGB, Loja Ideal, Scanntech, Portfólio Ideal Score 5,
  Atendimento Produtivo e Tasks. O 📋 desses copia o link direto.

### v3.12.3 — 2026-06-08
- **Arquivos:** números reais das rotinas Promax — **Devoluções = 030204** e
  **Grade de Estoque = 020304** (o 📋 agora copia o número certo).

### v3.12.2 — 2026-06-08
- **Arquivos:** botão minúsculo **📋** em cada card para **copiar a referência**
  do relatório — nº da **rotina** (Promax) ou o **link do BI** (quando cadastrado
  no campo `link` do card). Mostra ✓ ao copiar. (Faltam os links do BI — pendente
  o Eduardo enviar as URLs pra eu preencher.)

### v3.12.1 — 2026-06-08
- **Fix: botão "Atualizar agora" demorava no desktop.** Faltava `clientsClaim`
  no service worker — o SW novo ativava mas não assumia o controle da página, e
  o reload ficava esperando. Agora assume na hora (+ `cleanupOutdatedCaches`), e
  há um **fallback** que força o reload em 1,8s se o SW travar.
  *Obs.:* a 1ª atualização ainda passa pelo SW antigo; da próxima em diante fica rápido.

### v3.12.0 — 2026-06-08
- **Central de Ajuda & Avisos** ❔ — botão **"?"** sutil no canto de **todas as
  telas**. Ao abrir, mostra os avisos **gerais** + os **da tela atual**. Aparece
  um pontinho verde quando há aviso. Tipos: ℹ️ info · 💡 destaque · ⚠️ alerta.
  - Admin gere em **Admin › ❔ Avisos** (escolhe a tela ou "Geral", título,
    mensagem, tipo, público, ordem, ativo). Backend `GET /api/avisos` + CRUD admin.

### v3.11.1 — 2026-06-08
- **Cobertura & Distribuição por SKU — ajustes:**
  - **Menu suspenso (autocomplete):** ao digitar o nome/código, aparece a lista
    de produtos pra escolher o certo (ninguém decora código/nome exato). Backend
    `GET /api/cobertura-sku/buscar`. Resolve o caso "Stella" virar produto errado.
  - **Responsividade mobile:** botão "Buscar" não corta mais (input encolhe) e o
    "Exportar PDF" saiu de cima do nome do produto (foi pro fluxo normal).

### v3.11.0 — 2026-06-08
- **Cobertura & Distribuição por SKU** (GV / diretoria / admin) — nova tela:
  busca o SKU (código ou nome) e mostra, no layout do app:
  - **Cobertura** = nº de PDVs que compraram (qualquer quantidade = 1).
  - **Distribuição** = total de **caixas** (Volume ÷ HL Comercial do produto).
  - Consolidado + **por RN (setor)** + **por PDV**, com título em evidência
    ("Cobertura e Distribuição — [produto]"), data de atualização e **exportar PDF**.
  - Backend `GET /api/cobertura-sku` (regra do dia: hoje=marcação, demais=entrega).
  - Processador: `vendas_cliente_produto` passa a usar a regra do dia também.
- **Cobertura existente:** confirmado que já usa a lógica "1 por PDV
  independente da quantidade" (no nível de categoria) — segue para todos.

### v3.10.0 — 2026-06-06
- **Acesso do RN ampliado:** **Cobertura**, **SPO** e **Detalhamento HOP** agora
  aparecem na Home do RN.
  - **Cobertura** e **Detalhamento HOP** mostram os dados **do próprio setor** do
    RN logado (já filtrado no backend).
  - **SPO é a exceção:** mostra o **painel completo** (não é filtrado pelo setor
    do RN). Só os GVs continuam vendo apenas o próprio GV.

### v3.9.2 — 2026-06-06
- **Fix Grade de Estoque — nome completo:** o nome estava vindo abreviado (da
  grade). Agora o **join com a base de produtos é feito na exibição** (backend
  `/api/grade` cruza o **código** da grade com `produtos_full` e usa o **nome
  completo + HL/caixa** de lá). Vantagem: basta o **0111** estar importado —
  não precisa reimportar a grade pra os nomes aparecerem.

### v3.9.1 — 2026-06-06
- **Fix Produtos:** havia **duas** "Base de Produtos" na importação. Removido o
  slot extra — agora a aba `produtos_full` (nomes + HL/caixa para a Grade/Shelf)
  é gerada **a partir do próprio 0111** que já é importado (a coluna "Fator Hecto
  Comercial" vem nele). Um arquivo só, sem duplicidade.

### v3.9.0 — 2026-06-06
- **Senha individual obrigatória:** ao entrar com a senha **padrão (1234)**, o app
  agora **força a criação de uma senha pessoal** antes de liberar o acesso
  (login `precisa_trocar_senha` + `POST /api/auth/trocar-senha`).
- **Redefinir senha (com aprovação do admin):** botão "Esqueci minha senha" no
  login → cria uma **solicitação** (aba `reset_solicitacoes`). O admin vê as
  pendentes em **Admin › Usuários** e, ao **Autorizar**, a senha volta para 1234
  (o usuário cria uma nova no próximo acesso). Também dá pra **Rejeitar**.
- O botão 🔑 do admin (reset direto) agora define **1234** (antes era Cmd@xxxx).
- **Segurança:** removido o endpoint temporário `/api/auth/debug-usuarios` (expunha
  a lista de usuários e senhas).

### v3.8.0 — 2026-06-06
- **Aba Produtos habilitada** 📦 — primeira sub-aba: **Grade de Estoque**.
  - Importação da **Grade** (saldo na coluna *Disp.*, ~3x/dia) + **Base Produtos**
    (nomes completos + **HL por caixa** = col. P "Fator Hecto Comercial").
  - Processador gera `produtos_full` e `grade_estoque` (join 100% no teste:
    135 itens, 740,5 HL). Backend `GET /api/grade`.
  - Tela com **KPIs** (itens, caixas, HL em estoque), **busca** e **tabela
    ordenável**. Mostra a hora da última atualização.
  - Sub-aba **Shelf** (próximo do vencimento) preparada como "em breve" — a
    lógica de descontar pelas vendas (HL ÷ HL/caixa) ficou registrada em
    `PRODUTOS_SHELF.md` para quando o relatório semanal chegar.

### v3.7.0 — 2026-06-06
- **Volume Diário — ajustes pedidos:**
  - **Cabeçalho enxuto:** o "atualizado em…" saiu do topo (estava amassando o
    título) e virou uma linha **discreta** logo abaixo.
  - **Cards Meta Diária + Acumulado** somem na visão **consolidada ("Todos")** —
    lá eles somavam todos os setores e não ajudavam. Continuam aparecendo quando
    um **setor** é selecionado (e para o RN, que vê o próprio setor).
  - **Marketplace (FATURAMENTO)** agora aparece em "Volume por Categoria", em
    **R$** (realizado do mês vs meta), vindo de `rv_mktp`.
  - **Clicar numa categoria** abre os **Top SKUs** daquela categoria (volume do
    mês + do dia).

### Build/APK (Capacitor) — 2026-06-05  *(tooling; não muda o app web)*
- Projeto preparado para gerar **APK Android** via **Capacitor**: `capacitor.config.ts`
  (modo `server.url` = abre a Vercel ao vivo, sem recompilar a cada deploy), deps e
  scripts no `package.json` (`app:assets`, `app:sync`, `app:open`), ícone/splash do
  Hop em `frontend/assets/` e guia passo a passo em `frontend/CAPACITOR.md`.
- A compilação final roda no PC (Android Studio). `frontend/android/` fica fora do Git.

### v3.6.1 — 2026-06-05
- **Hop desativada temporariamente** — o balão flutuante e a janela de
  boas-vindas saem do ar via a flag `HOP_ATIVA` (em `frontend/src/theme.js`).
  **Todo o código continua no projeto** (componentes + rotas `/api/hop`); para
  reativar é só mudar `HOP_ATIVA` para `true`. Em pausa para repensar melhorias.

### v3.6.0 — 2026-06-05
- **Hop chat — mais contexto:** além das vendas do mês, a Hop agora recebe:
  - **Tasks em aberto detalhadas** — por **categoria**, por cluster, por tipo e
    **quantas têm visita hoje** (responde "quantas tasks de NAB", "qual categoria
    tem mais task", "o que tenho pra hoje").
  - **Meus PDVs** — com **dia de visita**, segmento e dias sem compra (responde
    "qual o dia de visita do cliente X", "quais clientes visito hoje").
  - Sabe o **dia da semana de hoje** para perguntas do tipo "pra hoje".

### v3.5.6 — 2026-06-05
- **Hop chat (cota Gemini):** o erro era **429 "quota exceeded"** no
  `gemini-2.0-flash`. Como cada modelo tem **cota própria** no tier grátis, agora
  na cota o backend **passa para o próximo modelo** (inclui os `-lite`, de limite
  grátis mais alto) em vez de desistir. Se todos estiverem no limite, mostra um
  **aviso amigável** ("limite grátis da IA renova sozinho, tenta mais tarde").
- Prompt enxugado (menos tokens por pergunta).

### v3.5.5 — 2026-06-05
- **Hop chat (fix/diagnóstico):** o chat caía no erro genérico sem dizer a causa.
  Agora o backend (a) **tenta vários modelos** do Gemini em sequência
  (`gemini-2.0-flash` → `2.5-flash` → `flash-latest` → `1.5-flash`), resiliente a
  modelo renomeado/indisponível; (b) sobe o limite de tokens; e (c) **mostra a
  causa real** na mensagem de erro (ex: "API key not valid", "model not found",
  "quota exceeded") para diagnóstico rápido.

### v3.5.4 — 2026-06-05
- **Ícone do app trocado pelo logo Hop** 🌿 — gerado a partir da arte do lúpulo
  (badge verde) nos tamanhos `icon-192`, `icon-512` e `apple-touch-icon`, e
  adicionado `favicon` (aba do navegador). Antes ainda eram os ícones antigos.
  *Obs.:* se o app já estiver instalado (PWA), pode ser preciso remover e
  reinstalar para o sistema atualizar o ícone da tela inicial.

### v3.5.3 — 2026-06-05
- **Volume Diário:** mostra a **hora da última atualização** (🔄 Atualizado em
  DD/MM HH:MM) no cabeçalho — útil pra quem importa os pedidos várias vezes ao
  dia. Vem do horário da importação dos Pedidos (`status_arquivos`).
- Processador: carimbo de horário do `status_arquivos` passa a usar o fuso de
  **Brasília** (antes ficava no horário do servidor, ~3h adiantado).

### v3.5.2 — 2026-06-05
- **Fix Volume Diário › Volume por Categoria:**
  - **Barras não enchiam:** a meta "CERVEJA (VOLUME)" não casava com a categoria
    do produto ("CERVEJA"). Agora o nome da meta é normalizado (tira o sufixo
    "(VOLUME)") e o volume é somado em **todas** as categorias do produto.
  - **Cards duplicados por setor:** agora consolida **1 card por categoria**
    (soma os setores do escopo) e respeita o **setor selecionado** no filtro.
  - **Meta mensal/diária** deixam de somar Marketplace (R$) e Pontos Force como
    se fossem HL; o bloco de categorias mostra só indicadores de **volume**.

### v3.5.1 — 2026-06-05
- **Entrega › itens da nota:** removida a coluna "Entregue (HL)" do modal — em
  nota frustrada o entregue é sempre zero. Fica só o volume marcado.

### v3.5.0 — 2026-06-05
- **Tabelas ordenáveis** em todo o Detalhamento — clique no cabeçalho para ordenar
  (números/volume/valor e datas do maior p/ menor; nomes em ordem alfabética).
- **Entrega:**
  - **Busca por PDV** (uma caixa só — digita código *ou* nome).
  - Clicar numa linha do **Detalhe** abre os **itens da nota fiscal** (modal),
    cruzando a Nota com a base de pedidos (`nota_itens`).
- **Ruptura:**
  - **Drill-down:** clicar num **produto** mostra os clientes e as **datas de
    ocorrência**; clicar num **cliente** mostra o **top de produtos** em falta.
  - Gráfico com **cores por média do quadrimestre** (🔴 acima da média ·
    🟡 ≥90% · 🟢 abaixo) e **linha de referência** da média.
  - Processador passa a gerar `ruptura_detalhe` (ocorrência: cliente × produto ×
    dia) e `nota_itens` (itens das notas frustradas).

### v3.4.0 — 2026-06-05
- **Detalhamento HOP — Ruptura repaginada:** o detalhe agora cobre **todo o
  quadrimestre** (antes só o mês atual aparecia). Seleção de mês passa a ser
  **clicando na barra** do gráfico; **sem seleção = consolidado** do quadrimestre.
  Novo sub-relatório **Top clientes afetados** (top 101) além de Por produto.
  Processador gera `ruptura_produto` e `ruptura_cliente` (produto/cliente × mês).
- **Detalhamento HOP — Entrega com filtros:** filtros de **Mês, Setor e Motivo**
  e sub-abas **Por motivo / Por setor / Por PDV / Detalhe**. As **Devoluções**
  agora **acumulam por mês** (importe mês a mês e monte o quadrimestre; reimportar
  um mês o atualiza). `entregas_efetivadas` passa a ser por setor × mês.
- Backend `/api/detalhamento/entrega` e `/ruptura` aceitam filtros e consolidam.

### v3.3.0 — 2026-06-05
- **Detalhamento HOP** 🌿 — nova página de relatórios (admin/director) na Home,
  com sub-abas e seletor de mês:
  - **Entrega** — efetivadas vs frustradas. Novo import do **relatório de
    Devoluções** (Admin › Arquivos) → KPIs (volume efetivado, frustrado, taxa de
    frustração, valor), resumo por **motivo** e detalhe por nota.
  - **Ruptura de Estoque** — produtos/volume em falta no mês (Motivo contém
    FALTA, volume via Marcação) + **comparativo do quadrimestre** (gráfico por mês).
  - Backend `GET /api/detalhamento/entrega|ruptura`; processador gera as abas
    `entregas_frustradas`, `entregas_resumo_motivo`, `entregas_efetivadas`,
    `ruptura_mes`, `ruptura_quadrimestre`.
- **Volume Diário — dia atual via Volume Marcação (col AI):** no dia de hoje
  ainda não há faturamento (Volume Entrega zerado), então o volume do dia passa
  a usar o Volume Marcação (o que está sendo marcado/pedido). Dias anteriores
  seguem com Volume Entrega (faturado). No dia seguinte o faturado entra
  normalmente e o racional "pula" para o novo dia.
- *Setup:* exportar o relatório de Devoluções (.csv) e importar em Arquivos;
  reimportar Pedidos para gerar ruptura/efetivadas.

### v3.2.0 — 2026-06-04
- **Hop com chat IA** (Google Gemini, tier grátis) — o RN pergunta em
  linguagem natural (ex: "qual cliente comprou mais guaraná esse mês?") e a
  Hop responde com base nos dados. Backend `POST /api/hop/chat`; degrada com
  graça se `GEMINI_API_KEY` não estiver configurada.
- **Processador:** nova aba `vendas_cliente_produto` (setor×cliente×produto do
  mês) gerada do arquivo de pedidos — base das perguntas no nível de cliente.
- Campo de chat do balão da Hop ativado.
- *Setup:* criar chave grátis em aistudio.google.com → `GEMINI_API_KEY` no
  Railway; reimportar pedidos para gerar a aba nova.

### v3.1.0 — 2026-06-04
- **Hop, a assistente** 🤖 — balão flutuante em todas as telas. Ao abrir,
  a Hop analisa os dados do RN e mostra **insights automáticos** (sem IA/custo):
  volume do dia, status do AP (gate da RV), posição nos incentivos e tasks
  em aberto. Backend `GET /api/hop/insights`.
- Campo de chat já preparado (desabilitado) para ligar uma IA/LLM no futuro.

### v3.0.0 — 2026-06-04  *(MAJOR — rebrand Hop Follow-up)* 🎨
Nova identidade visual e marca: **CMD Ambev · Conde → Hop Follow-up**.
- **Paleta:** azul/âmbar → verde Hop (`#7DBA3D` acento · `#0c1410` fundo). 404 cores trocadas em 35 telas.
- **Tipografia:** Poppins (fonte da marca).
- **Nome/PWA:** título, manifest, ícone do app, meta tags → Hop Follow-up.
- **Login** e cabeçalhos rebrandeados com logo + slogan "Inteligência que gera resultados".
- **Hop (assistente):** janela de boas-vindas na Home — **só no celular, só para RN, 1x/dia**.
- Relatório PDF com a marca Hop.
- Botões secundários (índigo) realinhados ao verde.
- *Pendente de assets do usuário:* `public/brand/logo.png`, `public/brand/hop-welcome.png` e os ícones do app (`icon-192/512`, `apple-touch-icon`).

### v2.9.10 — 2026-06-04
- **Fix:** página de Remuneração (RN) não mostrava o **Marketplace** para o
  segmento OFF. Agora usa os pesos fixos do regulamento e exibe todos os
  indicadores com peso > 0 (OFF: Cerveja, NAB, Marketplace 7,5%, Match 5%;
  ON: Cerveja, NAB, Marketplace), alinhado ao simulador e ao relatório.
  Também corrige o label do mês (estava fixo em 2026-05).

### v2.9.9 — 2026-06-04
- **Backend (fix):** inicialização das planilhas batia na quota do Google
  Sheets (60 leituras/min) ao ler as ~50 abas uma a uma no startup,
  deixando o backend lento pra subir. Agora usa chamadas em lote
  (metadata 1x + batchGet + batchUpdate) — de ~100 chamadas para ~4.

### v2.9.8 — 2026-06-04
- **Processador (perf):** importação de pedidos passa a ler só as 9 colunas
  usadas (o CSV do Promax tem ~71). Pico de memória caiu de ~255MB para
  ~35MB. Testado com arquivo real de 38,7MB (69k linhas) → pico ~199MB,
  processa sem estourar a RAM do Render free. Resolve de vez o erro ao
  importar o arquivo grande de pedidos.

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
