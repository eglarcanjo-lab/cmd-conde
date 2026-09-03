# Versionamento — CMD Conde App

Versão atual: **v3.40.2** — Ações de Preço: **TTV por produto** + flag **Escalonado / Preço fixo**; escalonado mostra o preço de cada degrau (TTV × (1−desc%)) e o Excel ganha aba **Preços**

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

### v3.40.2 — 2026-09-02
- **Ações de Preço — TTV e tipo de preço.**
  - **TTV por produto** (R$/cx): campo na tabela "Produtos & preço" do combo.
  - **Flag Tipo de preço:** **Escalonado** (degraus, como já existia) ou **Preço fixo**
    (um único preço por produto na ação, sem degraus).
  - No **escalonado**, cada degrau mostra o **preço resultante** = `TTV × (1 − desc%)`;
    no **fixo**, mostra o desconto implícito a partir do TTV.
  - **Excel** ganha a aba **Preços** (TTV + preço por degrau ou preço fixo por produto),
    além da aba de PDVs/não compradores.

### v3.40.1 — 2026-09-02
- **Ações de Preço — combo de produtos.** Botão "+" para empilhar vários SKUs numa
  mesma ação (chips com remover). Ex.: *Gua 2L + Gua 2L Zero*.
  - **Volume:** a média mensal de caixas passa a ser a **soma do combo** por PDV
    (cada SKU convertido por seu próprio HL/caixa; meses = união dos meses comprados).
  - **Cobertura:** lista os PDVs que **não compraram nenhum** dos SKUs do combo
    (comprador = comprou pelo menos um).
  - Export Excel ganha colunas *Combo (cod)* e *Combo (produtos)*.

### v3.40.0 — 2026-09-02
- **Nova tela: Ações de Preço** (menu solto, visível só para **diretoria+**). Apoio ao
  cadastro de descontos escalonados para incentivar volume por cliente.
  - **Busca de SKU** com autocomplete (produtos com venda no trimestre anterior, no escopo do perfil).
  - **Modo Volume:** calcula a **média mensal de caixas** de cada PDV no **trimestre anterior**
    (sem o mês atual). Caixas = `volume_hl / hl_caixa` (da `produtos_full`); média = total ÷ meses
    em que comprou. A partir daí:
    - **Box "aumento de volume alvo (%)"** → gera a *quantidade inicial p/ desconto* = `ceil(base × (1+%))`
      (arredonda caixas **sempre pra cima**).
    - **Piso (padrão 5 cx):** quem compra abaixo do piso usa o piso como base.
    - **Degraus editáveis** (a partir de +X% de volume → Y% de desconto), quantos quiser.
  - **Modo Cobertura:** lista os PDVs que **não compraram** o SKU no trimestre (potenciais).
  - **Export Excel** nos dois modos (PDV, setor, RN, cod produto, quant. inicial e cada degrau).
- Backend: `routes/acoes-preco.js` (`/produtos`, `/volume`, `/cobertura`) restrito a `director`/`admin`.

### v3.36.0 — 2026-07-20
- **Otimização de carregamento (abas lentas).** Três frentes:
  - **Cache de leitura no backend (SQL):** o `sqlRepo` relia a tabela inteira (`SELECT *`)
    a cada request — agora cacheia por **60s** por tabela (invalida em escrita e após
    import/recálculo). Ganho geral em Produtos, PDVs e navegação.
  - **Leitura por mês:** novo `readSheetMonths` (filtro no SQL). Os **rankings** da home
    leem só o **trimestre** (vendas) e **mês atual+anterior** (vd_pdv/vd_produto), não o
    histórico inteiro (pesou após carregar 2025). **Verdes** lê só os **últimos 13 meses**.
  - **Keep-alive:** GitHub Action pinga o `/health` do backend a cada 10 min → acaba o
    cold start de ~50s. Recalcular RV agora **limpa o cache** (reflete na hora).

### v3.35.3 — 2026-07-16 · fix visual do gráfico Verdes (alinhado aos meses + ano)
### v3.35.2 — 2026-07-16 · Recalcular RV com timeout 180s + erro real
### v3.35.1 — 2026-07-16
- **Fix do quadro do GV:** o GV é avaliado como **um RN** — PO = **R$ 1.000** (teto
  **R$ 1.500**, Pontos Force R$ 500 até 150% = 750). O que **soma** é o **atingimento**
  (metas e realizados de toda a sala); o **PO não soma** (na v3.35.0 eu somava os POs →
  dava R$ 11.000, errado). Peso de cada indicador segue a média ponderada pelo PO.

### v3.35.0 — 2026-07-16
- **Simulador RV: quadro consolidado do GV.** Novo card no topo que **soma metas e
  realizados de toda a sala** (todos os RNs) por indicador e aplica a **mesma memória de
  cálculo** dos RNs: atingimento agregado (piso 70% · teto 150%), peso de cada indicador
  como **média ponderada pelo PO** (a sala mistura OFF/ON), PO = soma dos POs. Mostra
  Realizado/Meta/Atingimento/Peso/Parcela por indicador + total RV do GV. A estrutura de
  GV atual foi mantida (hoje 1 GV cobre a sala inteira). Sem trava de AP (foto consolidada).

### v3.34.0 — 2026-07-16
- **Atendimento Produtivo (AP) — correção do parse (o "13400%").** O layout do relatório do
  BI mudou e o código lia pelas colunas antigas, embaralhando tudo (ex.: lia o "134" de
  Compradores como Tasks → 134×100 = 13400%). Remapeado para o layout atual, com os **3
  formatos** certos por KPI: Positivação/Tasks em **% de texto** (Meta / Visitas
  Positivadas), Compradores em **contagem** (Meta.1 / Real), GPS e Rota Efetiva em **fração
  0-1** (×100). Valida no setor 101: Tasks 56,6/52,6 · Compradores 134/100 · GPS 124,4/88,2
  · Rota 99,5/80 — os 4 verdes. Frontend: card de Compradores mostra **número** (não "%").
  Reimportar o AP e recalcular a RV do mês pra aplicar. (Processador + frontend.)

### v3.33.5 — 2026-07-16
- **"Recalcular RV" não falha mais no cold start.** O proxy tinha timeout de 60s — se o
  processador estivesse dormindo (plano grátis acorda em ~50s), estourava e mostrava
  "Erro ao recalcular" genérico. Agora: timeout de **180s** e a mensagem de erro traz o
  **motivo real** (inclusive "processador acordando — tente de novo").

### v3.33.4 — 2026-07-16
- **Dieta de memória no import de pedidos (fix do 502).** As melhorias recentes (vendas de
  todos os meses do arquivo, volume RV mensal) passaram a copiar o arquivo **inteiro** em
  memória no Render free (512MB) e o worker morria (502 = OOM). Ajustes no processador:
  - `_processar_vendas_cliente` copia **só as 8 colunas usadas** (antes copiava o df
    completo 2×, incluindo `_categorias` com listas Python — o maior peso).
  - `processar_volume_rv` **vetorizado** com `explode` (antes iterava linha a linha o
    arquivo inteiro montando lista de dicts). Mesmo resultado, muito mais leve e rápido.

### v3.33.3 — 2026-07-16
- **Import retenta sozinho quando a infra responde 429.** A borda Render/Cloudflare às
  vezes recusa a requisição (429 sem corpo) enquanto o processador redeploya/acorda — o
  proxy de import agora **retenta até 3x** (esperas de 15s/30s) antes de desistir. Como
  429 significa que a requisição nem chegou a ser processada, a retentativa é segura.
  Detalhe técnico: o FormData é reconstruído a cada tentativa (o stream é consumido no
  envio); os ~100 linhas de appends viraram um loop sobre a lista de campos.

### v3.33.2 — 2026-07-16
- **PDVs: coluna "Setor responsável" — só para o admin.** Nas tabelas Visitas do Dia,
  Sem Compra e Inadimplentes, o admin vê o setor de cada PDV (verde, ao lado do nome).
  RNs/GVs/diretor não veem a coluna (nada muda pra eles).

### v3.33.1 — 2026-07-16
- **PDVs: opção "Todos" no filtro de dia.** Novo chip "Todos" no seletor (mostra a base
  inteira, sem filtro de dia); clicar de novo no dia ativo também desmarca (cai em Todos).
  Domingo passa a abrir em "Todos" (antes a lista abria vazia — não há rota DOM). O card
  do topo indica "PDVs (todos os dias)" quando sem filtro.

### v3.33.0 — 2026-07-16
- **Sidebar estilo Vercel na home desktop (admin/diretor).** A barra lateral agora começa
  **expandida** (rótulos visíveis), com hover, itens compactos e **seções separadas**.
  Itens com sub-abas **expandem no lugar** (chevron ▸/▾): o grupo **Admin** abre as 16
  sub-abas com **link direto** (`/admin?tab=...` — Usuários, Metas, Arquivos, Alertas…).
  Diretor vê o atalho RV Simulador. Botão ◀ recolhe pra trilho de ícones (clicar num grupo
  recolhido reexpande). Só desktop + admin/diretor (RN/mobile seguem na home clássica).

### v3.32.0 — 2026-07-16
- **RV histórica por mês.** A cadeia inteira da RV virou mensal (era "só o mês corrente,
  substituindo tudo" — por isso o simulador de junho mostrava volumes 0/0):
  - `rv_volume` agora é gerado do **mês real de cada linha** dos pedidos e **acumula por
    mês**; `rv_pontos_bees` e `rv_ap` também passam a acumular (o mês já vinha do arquivo).
  - `calcular_rv_completa(mes)` aceita o **mês-alvo**: filtra metas/volume/pontos/mktp/AP
    daquele mês e grava `rv_resultado` **acumulando por mês** (histórico preservado).
  - **Simulador RV: "Recalcular RV" agora recalcula o mês selecionado** (não só o corrente).
  - Backend: `/api/rv`, `/pontos`, `/ap`, `/relatorio` e o resumo de Volumes filtram por
    mês (default: corrente) — necessário agora que as tabelas guardam vários meses.
  - Fluxo p/ preencher um mês antigo: importar pedidos + mktp (com mês de referência) +
    ter metas do mês no admin → selecionar o mês no simulador → Recalcular RV.

### v3.31.5 — 2026-07-16
- **Importar mês anterior agora grava o mês certo (pedidos + faturamento mktp).**
  - **Pedidos:** as vendas por cliente×produto eram calculadas só das linhas do **mês
    corrente** — importar o arquivo de junho em julho gravava **nada**. Agora a função
    recebe o arquivo inteiro (ela já agrupa pelo mês real de cada linha e substitui só os
    meses presentes). AP e Pontos já funcionavam.
  - **Faturamento Mktp:** carimbava sempre o mês de "hoje" e substituía a tabela inteira.
    Agora respeita o **mês de referência da UI** e **acumula por mês** (substitui só o mês
    importado). O cálculo da RV passou a filtrar **só o mês corrente** do mktp.
  - **Proteção:** arquivo de pedidos **sem linhas do mês corrente** não recalcula mais os
    snapshots de cobertura/volume RV (antes zerava o que estava valendo). Obs.: rank/mix
    ainda são recalculados do arquivo importado — ao importar meses antigos, **reimporte o
    mês atual por último**. (Processador.)

### v3.31.4 — 2026-07-16
- **429 de infraestrutura não é mais rotulado de "Google Sheets".** O proxy de import
  (`arquivos.js`) tinha um fallback antigo que, ao receber **qualquer 429 sem corpo JSON**
  do processador (ex.: Render reiniciando/limitando durante deploy), mostrava "Quota do
  Google Sheets excedida" — mesmo com o app 100% em SQL. Agora a mensagem diz a verdade
  ("infraestrutura limitou a requisição — aguarde 1-2 min") e o backend loga status +
  corpo cru da resposta pra diagnóstico. O processador em si já respondia certo (só marca
  429 se for gspread real, e o /health prova `impls: sql_service`).

### v3.31.3 — 2026-07-09
- **Fix: datas de Equipamentos exibindo ISO cru** (`2026-07-09T00:00:00.000Z`) em vez de
  `09/07/2026`. O Postgres devolve colunas `DATE` em ISO completo depois do `JSON.stringify`;
  faltava formatar antes de mostrar. Corrigido na lista (Chegada, Entrega, Emissão, Data do
  Material Leve), no Excel exportado e no pré-preenchimento do formulário de edição — esse
  último também tinha o bug de deixar os campos de data em branco ao editar um item existente,
  porque `<input type="date">` só aceita `AAAA-MM-DD`, não o ISO completo.

### v3.31.2 — 2026-07-09
- **Fix: PDF de Refrigeradores — item Comodatado estourava a página, jogando uma foto sozinha
  pra próxima.** Os campos extras do Comodatado (PDV, Entrega, Nota, Emissão) deixam o card mais
  alto. Etiqueta continua em 380px (é a que importa pra ler os dados); a foto do equipamento
  (só referência visual) diminuiu pra 250px — sobra espaço suficiente pras duas caberem juntas
  numa página A4 mesmo com os campos extras.

### v3.31.1 — 2026-07-09
- **Controle interno define a ordem de exibição.** A lista de Refrigeradores (e por tabela,
  PDF e Excel exportados, que herdam a mesma ordem) agora ordena por número de controle interno
  crescente, em vez de data de cadastro. Cadastros novos já vêm com o campo pré-preenchido com o
  próximo número da sequência (calculado a partir do maior número já usado) — continua editável,
  mas não precisa mais digitar manualmente. Novo endpoint
  `GET /api/refrigeradores/proximo-controle`.

### v3.31.0 — 2026-07-09
- **Comodatado: número da nota e data de emissão.** Além de PDV e data de entrega, marcar um
  refrigerador como Comodatado agora também exige **Número da Nota** e **Data de Emissão**
  (validado no front e no backend) — aparecem na lista, no PDF e no Excel exportados. Novas
  colunas `numero_nota` e `data_emissao` na tabela `refrigeradores` (precisa rodar
  `ALTER TABLE refrigeradores ADD COLUMN IF NOT EXISTS numero_nota TEXT, ADD COLUMN IF NOT
  EXISTS data_emissao DATE;` no Supabase).

### v3.30.2 — 2026-07-09
- **Fix: PDF de Refrigeradores — em algumas páginas a segunda foto ia sozinha pra próxima
  página.** As fotos de etiqueta (480px) e equipamento (320px) empilhadas, juntas com o texto
  do card, passavam da altura de uma página A4 em alguns casos. Igualei as duas em 380px — cabem
  as duas empilhadas numa página só, com folga.

### v3.30.1 — 2026-07-09
- **PDF de Refrigeradores: 1 item por página, fotos maiores.** Só na lista de Refrigeradores
  (Material Leve não muda): no PDF/impressão, cada refrigerador agora força quebra de página
  (`page-break-after`), e as fotos ficam bem maiores — principalmente a da etiqueta (até 480px,
  `object-fit: contain` pra não cortar nada), pra dar pra ler os dados dela impressa.

### v3.30.0 — 2026-07-09
- **Equipamentos: editar cadastro.** Refrigeradores e Material Leve agora têm botão "✏️ Editar"
  no card (além do "🗑️ Excluir"), abre o mesmo formulário pré-preenchido e salva via PUT em vez
  de POST — na edição não é obrigatório reenviar as fotos (só troca se quiser). Novo campo
  **Data de entrega** no refrigerador: quando o status vira **Comodatado** (equipamento
  entregue a um cliente/PDV), o PDV passa a ser obrigatório e a data de entrega também —
  validado no front e no backend. Nova coluna `data_entrega` na tabela `refrigeradores`
  (precisa rodar `ALTER TABLE refrigeradores ADD COLUMN IF NOT EXISTS data_entrega DATE;` no
  Supabase).

### v3.29.1 — 2026-07-09
- **Fix: PDF de Equipamentos só saía em 1 página.** O container da lista (`.eq-lista`) usava
  `display: flex`, e o Chrome não pagina flex/grid na impressão — o que passava da primeira
  página simplesmente sumia em vez de continuar. Mesmo bug que o RV/Relatório já tinha
  corrigido antes: no `@media print`, o container vira `display: block` (com margem no lugar
  do gap) pra fluir normalmente entre páginas. Também forcei `height: auto` / `overflow:
  visible` no `html, body` durante a impressão (o app trava em `height: 100%` pra evitar
  bounce no iOS, o que também cortava o conteúdo em 1 página).

### v3.29.0 — 2026-07-09
- **Equipamentos: exportar Excel e PDF.** Nas listas de Refrigeradores e Material Leve, novos
  botões de exportação (respeitam os filtros aplicados na tela): "Excel" baixa uma planilha só
  com os dados tabulares (sem fotos — usa `xlsx-js-style`, mesmo padrão do resto do app), "PDF"
  aciona a impressão do navegador (`window.print`, padrão já usado em RV/Relatório e Cobertura
  SKU) numa versão da própria lista com fundo branco e fotos ampliadas — cada item com a(s)
  foto(s) individual(is). No desktop os botões mostram o texto ("📊 Excel" / "📄 PDF"); abaixo de
  600px de largura (celular) só o ícone aparece, pra economizar espaço.

### v3.28.2 — 2026-07-09
- **Equipamentos (ex-Refrigeradores): ajustes.** Renomeado o módulo de "Refrigeradores" para
  "Equipamentos" (as sub-abas internas "Refrigeradores" e "Material Leve" continuam iguais);
  emoji do Material Leve trocado de 🎯 para 📦. Corrigido bug de layout onde os campos "Item"
  e "Tipo" (fora de uma linha de campos lado a lado) herdavam `flex: 1 1 220px` como altura
  mínima em vez de largura, criando um espaço vazio enorme antes do próximo campo — separado
  em `styles.field` (avulso) vs `styles.fieldLinha` (dentro de uma linha). Módulo restrito a
  Admin e Diretor: some do menu pra outros perfis, bloqueia acesso direto pela URL
  (`perfisPermitidos` no front) e agora também retorna 403 no backend pra quem não for
  admin/director (antes só o DELETE era restrito a gestor; GET/POST/PUT estavam abertos a
  qualquer usuário logado).

### v3.28.1 — 2026-07-09
- **Refrigeradores: câmera nativa direta no app Android.** No app instalado (Capacitor),
  tocar em "Tirar foto" agora abre a câmera do celular direto, sem passar pelo seletor
  Câmera/Arquivos do Android — usa o plugin `@capacitor/camera`. No navegador (PWA) continua
  usando `<input capture>`, que é o máximo que um site consegue. Aumentei o limite de
  precache do PWA (`vite.config.js`) porque o plugin novo empurrou o bundle pra cima de 2MB.

### v3.28.0 — 2026-07-09
- **Módulo Refrigeradores + Material Leve.** Nova tela `/refrigeradores` (card na home,
  mobile-first) para cadastrar pelo celular: refrigeradores instalados em PDV (item, modelo,
  serial, R.G., categoria SOPI/VISA, status Estoque/Quebrado/Comodatado, número de controle
  interno, foto da etiqueta + foto do equipamento, PDV opcional) e, em aba separada, material
  leve (cartaz, adesivo, hack expositor etc. — tipo, quantidade, foto, PDV opcional). Cadastro
  manual (sem OCR — decisão consciente, mais confiável que ler a etiqueta automaticamente).
  Fotos sobem comprimidas (novo: `browser-image-compression`) pro Cloudinary, como no módulo
  Incidentes. Duas tabelas novas no Postgres (`refrigeradores`, `material_leve`), consultadas
  direto via `db.query` (não passam pelo shim de Sheets). Exclusão restrita a gestores.

### v3.27.1 — 2026-07-02
- **Relatórios ocupam a tela no desktop.** Os containers das páginas de relatório (que
  ficavam num corredor estreito de 760–1200px no meio, deixando o desktop vazio) passaram
  a **1600px**: Volume Diário, Cobertura, Cobertura SKU, Detalhamento, Faturados×Buffer,
  Incentivos, PDVs, Produtos, RV, Tasks, Incidentes. Modais, a home clássica (RN/mobile) e
  o relatório de impressão continuam com a largura própria. (No mobile nada muda — a tela é
  menor que o limite.)

### v3.27.0 — 2026-07-02
- **Rankings da home: comparação D-1 acumulada + GAP em HL.** A variação dos Top PDVs/
  produtos deixou de ser mês-cheio (sempre negativa no início do mês) e passou a comparar o
  **mesmo período acumulado**: dia 01 até **ontem (D-1)** deste mês × dia 01 até D-1 do mês
  anterior. Mostra o **GAP em HL** (+/−) e o Δ%. Cabeçalho indica o período (ex.: "dia 01–09
  · jul vs jun"). Rank continua pelo trimestre.
  - **Processador:** `processar_pedidos` agora gera `vd_pdv` e `vd_produto` (volume **diário**
    por PDV e por produto, acumula por mês). É preciso **reimportar os Pedidos** uma vez pra
    popular (a home avisa enquanto estiver vazio).

### v3.26.1 — 2026-07-02
- **Home (desktop) ocupa a tela inteira + fontes maiores.** A área do dashboard perdeu o
  limite de largura (usa a tela toda); os dois rankings ficam **lado a lado fixos** (2
  colunas) e ambos passam a **Top 20** (PDVs e produtos). Fontes de Volumes, Foco NE, Verdes
  e das tabelas aumentadas um pouco pra leitura rápida.

### v3.26.0 — 2026-07-01
- **Home (desktop): rankings Top PDVs e Top produtos.** Duas tabelas lado a lado —
  **Top 20 PDVs** e **Top 10 produtos** por volume no **trimestre**, cada linha com a
  **variação vs o mês anterior** (▲/▼ %, "novo" quando não há base). Meses rotulados no
  cabeçalho (ex.: "Δ jul vs jun"). Escopo por perfil. Área da home alargada (880→1320px)
  pra caber as tabelas. `GET /api/resumo/rankings` + `components/ResumoRankings.jsx`.
  - Obs.: comparação é **mês vs mês** (as vendas são consolidadas por mês); "mesmo período
    mid-mês" exigiria dado diário por PDV/produto (mudança no processador — futuro).

### v3.25.3 — 2026-07-01
- **E-mail de ruptura mais acionável.** Na seção de grade, cada produto agora vem com
  **~pedidos/semana** e **% do volume do trimestre**, e o texto pergunta *"Qual a previsão
  de chegada?"*. Abaixo, os **pedidos cortados por falta de estoque**. O top-10 passou a
  ser medido pelo **trimestre** (3 meses mais recentes das vendas), não só pelo mês. Prévia
  no admin mostra os mesmos números.

### v3.25.2 — 2026-07-01
- **Alertas de grade: no máximo 1 e-mail por produto a cada 7 dias.** Antes o dedupe da
  grade era por dia — importar a grade todo dia com o produto ainda esgotado gerava e-mail
  diário (virava spam). Agora usa janela **rolling de 7 dias** por produto (`grade|cod`,
  compara `enviado_em`). Ruptura em pedido segue por ocorrência/dia (cada falta é um evento).

### v3.25.1 — 2026-07-01
- **Alertas: mensagem de erro do Brevo mais clara.** O envio agora captura a resposta do
  Brevo e explica: 401 → chave errada (dica: usar a API key v3 `xkeysib-`, não a SMTP);
  400 → remetente não verificado. Também dá `.trim()` na `BREVO_API_KEY`/`ALERTA_FROM`
  (espaço/quebra de linha no env quebrava a autenticação).

### v3.25.0 — 2026-07-01
- **Alertas de ruptura por e-mail (Fase 1).** Dispara um e-mail digest quando: (1) um
  produto do **top-10 mais vendido** do mês **não está na grade** (esgotado); ou (2) há
  **falta em pedido** (`ruptura_detalhe`) no dia mais recente. Roda **automático após cada
  import** (background, só em modo SQL) + botão "enviar teste" no admin. **Dedupe** (1 por
  chave/dia) evita spam; **1 e-mail** consolidado. Devolutiva = responder o e-mail.
  - Envio via **Brevo** (API HTTP, axios — sem dep nova). Env no backend: `BREVO_API_KEY`,
    `ALERTA_FROM` (remetente verificado), `ALERTA_FROM_NAME` (opcional).
  - Nova aba **📧 Alertas** no admin: liga/desliga, lista central de e-mails, prévia e teste.
  - Tabelas SQL criadas sozinhas (`alertas_destinatarios`, `alertas_enviados`,
    `alertas_config`). Não precisou mexer no processador (grade zerada = top-10 fora de
    `grade_estoque`). Backend: `services/alertas.js` + `routes/alertas.js`.

### v3.24.2 — 2026-07-01
- **Diagnóstico do backend de dados no processador.** O `/health` do processador agora
  retorna `data_backend` ("sql" ou "sheets"), e o boot loga em MAIÚSCULO quando está em
  modo Sheets (alerta pra definir `DATA_BACKEND=sql`). Motivo: um import ainda batia no
  Google Sheets (429) porque o `DATA_BACKEND` do **processador** não estava em `sql`
  (mesmo com o backend/Node já em SQL). Sem mudança de comportamento — só visibilidade.

### v3.24.1 — 2026-07-01
- **RV recalcula automaticamente de novo após o import via `/ambos`.** Estava adiada
  (mensagem "⏳ Recalcule a RV à parte") desde o problema de OOM no Render free (cobertura
  ~20k somada ao import estourava 512MB). Com a importação **mês a mês** os arquivos são
  menores e a memória cabe, então o `/ambos` volta a chamar `calcular_rv_completa()` ao
  final quando importa um relatório que alimenta a RV (pedidos/faturamento_mktp/pontos_bees/
  spo_ap). O endpoint individual de pedidos já fazia isso. (Processador.)

### v3.24.0 — 2026-07-01
- **Nova aba "Faturados × Buffer".** Duas sub-abas: **Faturados** (clientes com NF —
  pedidos que saíram p/ entrega, rotina 030237) e **Buffer** (pedidos ainda não faturados,
  rotina 030111). Escopo por perfil (RN vê só o seu; admin/diretor/GV têm "Todos" + seletor
  "ver por RN"). Por PDV, expansível nos pedidos, com **volume marcação (HL) separado por
  tipo de operação** (venda/bonificação/…) + total, e um **resumo comparativo** no topo
  (Faturado × Buffer + % convertido).
  - **Cruzamento:** o nº do pedido (Faturados col AC / Buffer col G) cruza com o relatório
    de **pedidos** para trazer tipo de operação (col S) + volume marcação (col AI).
  - **Processador:** `processar_pedidos` agora também gera `pedido_chave` (nº pedido × tipo
    → volume, com detecção automática da coluna do nº do pedido); novos `processar_faturados`
    e `processar_buffer` geram `faturados_detalhe` / `buffer_detalhe` (snapshot, substituem
    a cada import). Import via admin (2 slots novos no grupo Promax).
  - Backend `GET /api/faturados-buffer`; página nova no app + item no menu.

### v3.23.1 — 2026-06-29
- **Dashboard da home restrito a desktop + admin/director.** Os blocos (Volumes, Foco NE,
  Verdes) e a barra lateral só aparecem no **desktop** (≥1024px) para perfis **admin** e
  **director**. **RN** — e **qualquer perfil no mobile** — volta a ver a **home clássica**
  (menu de cards), exatamente como era antes. `Home.jsx` virou dispatcher
  (`HomeDashboard` × `HomeClassic`) decidindo por media query + perfil.

### v3.23.0 — 2026-06-29
- **Barra lateral recolhível na tela inicial.** O menu de módulos (que eram cards) virou
  uma **sidebar à esquerda**: rail de ícones por padrão, com botão ☰ que expande para
  mostrar os rótulos (e ✕ para recolher). A área principal mostra o header + os 3 blocos
  do dashboard (Volumes, Foco NE, Verdes). Mesma regra de visibilidade por perfil
  (admin/director não veem Remuneração). Mudança contida na Home; demais telas inalteradas.

### v3.22.0 — 2026-06-29
- **Bloco "Verdes" na tela inicial (3º bloco do dashboard).** Trimarca Stella + Spaten,
  mês a mês, **gráfico de linha com toggle cobertura ↔ distribuição**.
  - **Cobertura** = nº de pares distintos (PDV × trimarca) que compraram (PDV que comprou
    Stella e Spaten conta 2). **Distribuição** = total de **caixas** (= volume_hl ÷ hl/caixa).
  - `GET /api/resumo/verdes` — de `vendas_cliente_produto` (acumulada por mês) +
    `produtos_base` (categoria) + `produtos_full` (hl/caixa). Mostra só os meses já importados.

### v3.21.0 — 2026-06-29
- **Bloco "Foco NE" na tela inicial (2º bloco do dashboard).** +RGB (SPO 20),
  Faturamento Score 5 (SPO 12) e Portfólio Score 5 (SPO 24) — realizado × meta.
  - **Meta** do `spo_metas`; **realizado** ao vivo no mês corrente (linha OPERACAO dos
    resumos SPO) e por snapshot (`spo_metas.real`) nos meses fechados.
  - **Lógica de trimestre:** nos 2 primeiros meses mostra o **mês**; no 3º mês mostra o
    **acumulado** do trimestre (soma os 3). Nível operação.
  - Novo `GET /api/resumo/foco-ne`. Card abaixo do Volumes na Home.

### v3.20.3 — 2026-06-29
- **Remove a mensagem de debug do login** (o `DBG:` que expunha o erro técnico, usado
  no diagnóstico da migração SQL). Volta a mensagem genérica "Erro interno."

### v3.20.2 — 2026-06-29
- **Admin tem acesso total durante a manutenção (correção).** O `maintenanceMiddleware`
  bloqueava TODAS as rotas de dados com 503 quando a manutenção estava ligada, isentando
  só alguns caminhos — mas **não** o usuário admin. Resultado: com manutenção ativa, o
  admin via a tela do app mas **todos os dados sumiam** (503 nas rotas). Agora o middleware
  lê o JWT e **libera o admin** (manual e janela por horário). Era a causa do "503" no card
  e do "sumiram os dados".

### v3.20.1 — 2026-06-29
- **Card de Volumes tolera o cold-start do backend.** O backend (Render free) "dorme"
  com inatividade e demora ~50s pra acordar, devolvendo 503 nesse meio-tempo. O card
  agora **tenta de novo** (até 6×, 8s) em 503/502/timeout e mostra "Acordando o
  servidor…" — em vez de "indisponível". Quando o backend acorda, popula sozinho.

### v3.20.0 — 2026-06-28
- **Resumo de Volumes na tela inicial (1º bloco do dashboard de operação).** Card no
  topo da home com **meta × realizado por categoria** (% da meta, cor por faixa):
  Cerveja, NAB, Match, Mktp + **Cerveja Zero** e **NAB Zero** como monitoramento
  (sem meta oficial → meta derivada = **15% do realizado da categoria regular**).
  - Novo endpoint `GET /api/resumo/volumes` (escopo automático: admin/director = operação,
    GV = região, RN = seu setor). Lê `rv_resultado` + `rv_volume` do SQL.
  - Aditivo: o card fica acima do menu atual (não muda a navegação). Próximos blocos:
    Foco NE (Score 5/RGB com lógica de tri) e Verdes (linha cob/dist).

### v3.19.17 — 2026-06-28
- **Camada SQL do processador (sql_service) — agora a virada SQL é completa.**
  `sql_service.py` espelha `ler_aba`/`sobrescrever_aba`/`atualizar_status_arquivo`
  contra o Postgres; `sheets_service` faz rebind quando `DATA_BACKEND=sql`. Com a
  flag ligada nos **dois** serviços (backend + processador) + `DATABASE_URL` nos dois,
  o sistema inteiro roda no PostgreSQL — **sem o limite de cota (fim do 429)**. Padrão
  segue `sheets`; reversível pela env. (commit do processador no repo cmd-conde-processor)

### v3.19.16 — 2026-06-28
- **Camada SQL do backend (sqlRepo) — virada reversível por flag.** Novo
  `services/sqlRepo.js` (+ `services/db.js`, dependência `pg`) implementa a mesma
  interface de `services/sheets.js` contra o PostgreSQL. `sheets.js` agora escolhe o
  backend por `DATA_BACKEND` (`sql` → Postgres; qualquer outro / ausente → Sheets).
  **Padrão = sheets, então nada muda** até setar a env. Leitura devolve strings (igual
  ao Sheets); escrita manda strings e o Postgres converte os tipos; índice de linha
  mapeado por `ctid`. Falta a camada equivalente no processador (Python) antes da
  virada completa.

### v3.19.15 — 2026-06-28
- **ETL Sheets → Postgres (migração SQL).** Novo endpoint no processador
  `POST /api/migrar/sheets-para-sql` (protegido por token) que lê todas as abas e
  popula o Supabase: cadastro nas tabelas tipadas (TRUNCATE+INSERT), computadas
  criadas como TEXT (DROP+CREATE+INSERT), órfãs ignoradas. Idempotente. Requer a env
  `DATABASE_URL` no processador. Não altera o app (ainda lê/grava do Sheets).

### v3.19.14 — 2026-06-28
- **Fase 0 da migração SQL — acesso a dados 100% no encaixe único.** Três rotas
  falavam com o Google Sheets **direto** pelo `googleapis` (rv.js → `rv_ap`; spo.js →
  `spo_desafios` e `spo_metas`), furando a camada `services/sheets.js`. Agora usam
  `sobrescreverAba`. Benefício imediato: passam a gravar com **RAW** (não convertem
  `2026-04` em serial de data) e, principalmente, sobra **um único ponto** para trocar
  Sheets→SQL. Comportamento preservado.

### v3.19.13 — 2026-06-28
- **Reduz escrita de fundo no Sheets (alivia 429 na importação).** O rastreio de uso
  por tela (`uso_telas`) gravava a cada **30s por RN online** — com vários RNs, ~20-30
  escritas/min só disso, que somadas às ~20 de um import estouravam a cota (60/min).
  - Flush do tracking passou de **30s → 5 min** (ainda flush ao sair da tela/minimizar,
    então não perde dado). Cai ~10× a escrita de fundo, liberando cota para o import.
  - Causa de fundo (volume de escritas no Sheets) só some de vez com redução no
    `sobrescrever_aba` ou a migração para SQL.

### v3.19.12 — 2026-06-28
- **Corrige a cascata de erro 429 na importação.** Causa-raiz: import grande →
  processador bate na quota do Sheets → backoff longo fazia o request passar de 300s
  → o frontend dava **timeout e reenviava o import inteiro** → dois imports pesados
  concorrentes → 429 (quota/Render).
  - **Frontend:** timeout (ECONNABORTED) **não** é mais tratado como cold start —
    não reenvia o import (evita duplicar). Mensagem orienta conferir o status antes
    de reenviar.
  - **Processador:** backoff de retry encurtado (4s/8s/16s, ~28s máx) para o import
    não estourar o timeout do frontend.
  - **Backend:** no 429 do processador, devolve mensagem clara e propaga status 429.

### v3.19.11 — 2026-06-28
- **Dispatch de importação SPO simplificado (Fase 4 — processador):** os ~12 blocos
  `if "spo_X" in arquivos: try/except` repetidos no `/api/processar/ambos` viraram
  chamadas de **uma linha** a um helper `_rodar_spo(...)`, na **mesma ordem** de antes.
  - Importar um KPI novo passa a ser **1 linha** no dispatch (uniforme).
  - Comportamento idêntico (ordem de execução preservada; validado por py_compile +
    conferência das 12 chamadas). Sem mudança no app.

### v3.19.10 — 2026-06-28
- **Fim do arquivo-espelho do "realizado" (Fase 3b):** o mapa `SPO_REAL` (qual coluna
  do resumo é o realizado de cada KPI) estava duplicado em front e back. Agora é
  **fonte única no backend** (`backend/src/config/spoKpis.js`), exposto por
  **`GET /api/spo/config`** (payload estático, não lê Sheets). O front consome e não
  tem mais cópia.
  - Incluir/ajustar um KPI simples passa a ser num lugar só (backend) + a entrada de
    exibição no registro do front (label/pts).
  - Fallback seguro: se o config falhar, os KPIs simples do mês atual ficam sem número
    (meses anteriores via snapshot seguem ok) — sem quebrar a tela.

### v3.19.9 — 2026-06-28
- **Rotas genéricas de KPI no SPO (Fase 3 do registro — aditivo):** novos endpoints
  `GET /api/spo/:id/resumo` e `/:id/detalhe` que leem `spo_<id>_resumo` /
  `spo_<id>_detalhe`. Definidos por último — as rotas específicas existentes continuam
  com prioridade (zero impacto no que já funciona).
  - Efeito: um KPI novo cuja aba siga a convenção `spo_<id>_resumo/_detalhe` **não
    precisa mais de endpoint próprio** no backend.
  - `:id` validado (a-z, 0-9, `-`, `_`); detalhe aplica o filtro por GV como as demais.

### v3.19.8 — 2026-06-28
- **Remove o token padrão fixo do processador (Auditoria 2 — D2):** `PROCESSOR_TOKEN`
  tinha o valor `"cmd_processor_secret"` hardcoded no código (processador e backend) —
  um segredo público no repositório.
  - Agora o token vem **só da env var** (sem default). O processador, se a env não
    estiver setada, **rejeita tudo com 401 e loga aviso** (fail-safe — não derruba o
    serviço). O backend (`arquivos.js`) também perde o default, alinhando ao `rv.js`.
  - **Ação necessária:** garantir que `PROCESSOR_TOKEN` esteja definido (mesmo valor)
    no Render do processador, no Render do backend e no Apps Script de auto-import.

### v3.19.7 — 2026-06-28
- **Senhas com hash bcrypt (Auditoria 2 — D1, severidade ALTA):** as senhas eram
  guardadas e comparadas em **texto puro** na aba `usuarios`. Agora usam **bcrypt**
  (`bcryptjs`), com módulo único `backend/src/utils/senha.js`.
  - **Migração suave, sem deslogar ninguém:** senha real ainda em texto é
    **re-hasheada no próximo login** bem-sucedido; as senhas-padrão (`1234`/vazio/
    `Cmd@xxxx`) continuam como sentinela em texto (para o app pedir a troca).
  - Troca de senha (usuário) e definição de senha pelo admin passam a gravar hash;
    reset volta para `1234` (sentinela). Login aceita hash e texto legado.
  - Nova dependência `bcryptjs` (JS puro; o Render instala no deploy via `npm install`).

### v3.19.6 — 2026-06-28
- **Helpers centralizados no backend (Auditoria 2 — A2/A3):** funções que estavam
  copiadas em várias rotas viraram módulos únicos (qualquer ajuste de regra agora é
  num lugar só, sem risco de divergência).
  - `filtrarPorPerfil` (estava em 6 rotas: cobertura, detalhamento, pdvs, rv, tasks,
    volume-diario) → `backend/src/utils/perfil.js`.
  - `podeVer` + `SET_OFF` (estava em 4 rotas: avisos, hop, incentivos, popups) →
    `backend/src/utils/visibilidade.js`.
  - Cópias eram idênticas; comportamento preservado (validado).

### v3.19.5 — 2026-06-27
- **Remoção de funções duplicadas no processador (Auditoria 2 — A1):**
  `processar_faturamento_mktp` e `processar_pontos_bees` estavam definidas **3× cada**;
  em Python só a última valia, as outras eram código morto (199 linhas).
  - Mantida a versão ativa (a 3ª) de cada; removidas as 2 primeiras.
  - Elimina também a última aba órfã **`rv_pontos`** (só era escrita pelas cópias
    mortas; a ativa escreve `rv_pontos_bees`). Comportamento idêntico.
  - Preservadas `processar_volume_rv` e `calcular_rv_volume` (intercaladas entre as cópias).

### v3.19.4 — 2026-06-27
- **Limpeza de abas órfãs do Google Sheets (Auditoria 2 — quick wins B1/B2):**
  removidas escritas/declarações de abas que **ninguém lê** (verificado por busca
  global nos 2 repos). Menos chamadas à API por import (ajuda no 429) e planilha
  mais limpa.
  - **Processador (deixa de escrever):** `visitas_hoje` (todo import de clientes),
    `faltas` e `devolucoes` (todo import de pedidos — funções `_processar_faltas` e
    `_processar_devolucoes` removidas), `entregas_resumo_motivo` (import de devoluções;
    o resumo por motivo já é calculado on-the-fly na tela).
  - **Backend (initializeSheets):** removidas as declarações de `pdv_compras` e
    `otp_sessions` (login OTP fora de uso) — paravam de ser recriadas vazias.
  - As abas físicas remanescentes na planilha podem ser apagadas à mão (inofensivo).
  - **C1 descartado:** reanálise mostrou que `spo_rgb_total/litrinho/inteira` e
    `spo_tasks_digit_resumo` SÃO escritas (via helper) e alimentam os KPIs 18/20 —
    não eram leituras mortas. `rv_pontos` fica para a limpeza do código duplicado (A1).

### v3.19.3 — 2026-06-27
- **Realizado do SPO unificado (Fase 2 da refatoração):** a regra de "qual coluna do
  resumo é o realizado" estava duplicada em dois switches gigantes — `computeReal`
  (backend `spo.js`) e `getRealDados` (front `SPO/index.jsx`) — origem do tipo de
  divergência que causou o bug do Item 12.
  - Agora vem do mapa **`SPO_REAL`** (registro), co-locado ao KPI: front em
    `config/spoKpis.js`, backend em `backend/src/config/spoKpis.js` (espelho).
  - Vale para os 17 KPIs de padrão simples (5, 8, 9, 11–24); os 6 com cálculo próprio
    (1–4, 6, 7) seguem caso a caso. Comportamento idêntico (validado campo a campo).
  - Incluir um KPI simples = 1 linha em `SPO_REAL` (não mais 2 `case` em 2 arquivos).

### v3.19.2 — 2026-06-27
- **Registro único de KPIs do SPO (Fase 1 da refatoração — ver
  `Auditoria_Final_SPO_KPIs.pdf`):** a lista de KPIs estava duplicada em 3 lugares
  (tela SPO, Painel SPO e admin de Metas), com rótulos divergentes.
  - Nova fonte de verdade: **`frontend/src/config/spoKpis.js`** (`SPO_KPIS`).
  - `SPO_ITEMS` (tela), `ITENS_SPO` (painel) e `ITENS` (SpoMetas) agora **leem do
    registro** — para incluir/excluir um KPI do trimestre, edita-se **só esse
    arquivo** (use `ativo:false` para tirar da tela e do total sem perder histórico).
  - Unifica o rótulo do Item 7 ("% PDVs abrindo Promoção no BEES") no painel e nas
    metas (antes divergia de "% Visitas RN abrindo Promoção").
  - Sem mudança de cálculo. Próximas fases: realizado unificado, rotas genéricas,
    import/schema dirigidos pelo registro.

### v3.19.1 — 2026-06-26
- **Erro "[500]: Request failed with status code 429" ao importar — corrigido:**
  era a **quota da API do Google Sheets** estourando quando vários relatórios
  são importados em sequência.
  - **Processador:** `errorhandler` global transforma o 429 do Sheets numa
    mensagem clara ("Quota do Google Sheets excedida. Aguarde ~1 minuto e
    importe menos relatórios por vez.") em vez de derrubar o import; leitura de
    `pdv_base` no `/ambos` agora é tolerante a falha (não aborta tudo).
  - **Backend (Node):** novo `withRetry` com backoff (1s→8s) nas leituras/escritas
    do Sheets — antes só o processador Python tinha retry; o app não.
  - **Operação:** importe **menos relatórios por vez** e aguarde ~1 min entre
    lotes grandes (limite ~60 chamadas/min por minuto).

### v3.19.0 — 2026-06-26
- **SPO › Item 12 (Score 5 / Task de Faturamento) — corrigido e detalhado:**
  - **Realizado por RN** agora vem da coluna **TASK FAT** (`= 1` → bateu a task),
    em vez da antiga `BATEU META` (que não existe mais na base "task fat" — por
    isso o item ficava zerado/no erro).
  - **Universo (denominador)** = PDVs que **possuem** task de fat (`POSSUI TASK`);
    cai para o total do relatório se a coluna não existir.
  - **Nova aba `spo_score5_detalhe`** (1 linha por PDV com task): setor, cód/nome
    do PDV, **bateu (Sim/Não)**, meta e realizado da task — ordenada com os que
    **não bateram primeiro**.
  - **Tela SPO:** painel "Detalhe por PDV" no Item 12, com filtro por RN e toggle
    **"Só não bateram"** (lista acionável dos PDVs que faltaram).
  - Leitura de colunas robusta (por nome, com fallback posicional).

### v3.18.0 — 2026-06-10
- **Detalhamento HOP › Entrega — relatório detalhado (PDF + Excel):** exporta
  respeitando os filtros da tela. Novas análises: **caminhão (placa)**, **por
  dia**, **dia da semana** (padrão), **produto** (via itens das notas), além de
  setor, motivo, PDV — com volume e **R$** em tudo.
  - **Excel:** planilha multi-abas (Resumo, Caminhão, Dia, PDV, Produto, Setor,
    Motivo, Detalhe).
  - **PDF:** página imprimível com KPIs + rankings em **gráfico de barras** + tabelas.
  - Novas sub-abas na tela: Por caminhão / Por dia / Por produto.

### v3.17.0 — 2026-06-10
- **Auto-import por e-mail:** novo `POST /api/processar/zip` no processador —
  recebe 1 zip com vários relatórios e **detecta cada um pelo nome** (Promax pela
  rotina; BI por `#item`; `task`/`pontos` por palavra-chave), importando na ordem
  certa + recalc da RV. Guia + código do Apps Script (Gmail → zip → processador)
  em `AUTO_IMPORT.md`. Caixa de e-mail vira histórico das versões.

### v3.16.1 — 2026-06-10
- **Fix RV Simulador — volumes não respeitavam o mês selecionado.** O `/api/rv`
  e o `/api/rv/pontos` não filtravam por mês (só o AP filtrava), então trocar o
  mês mudava só o AP e os volumes ficavam no último cálculo. Agora ambos filtram
  por `mes_referencia`. *Limitação:* o `rv_resultado` guarda só o mês atual
  (é sobrescrito a cada recálculo) — meses passados aparecem zerados até criarmos
  snapshots mensais da RV (pendente, se o Eduardo quiser).

### v3.16.0 — 2026-06-10
- **Engajamento por tela:** o app passa a contar **quais telas** cada usuário mais
  acessa (acumula no cliente e envia em lote a cada 30s / ao sair — sem gravar por
  clique). No **Admin › 📊 Engajamento** entrou o ranking **"Telas mais acessadas"**
  (com barra e nº de usuários) — pra saber onde focar a visibilidade. Backend
  `POST /api/uso/telas` + aba `uso_telas` (1 JSON por usuário/mês).

### v3.15.0 — 2026-06-10
- **Engajamento / uso do app:** o app registra cada **abertura** por usuário/dia
  (agregado na aba `uso_app`, sem inchar). Novo **Admin › 📊 Engajamento** com
  filtro de mês e perfil (Só RN / Todos): KPIs (acessaram, não acessaram, total
  de aberturas, média) e tabela por usuário (aberturas, dias ativos, último
  acesso) — inclui quem **nunca abriu** no mês (em vermelho).
  Backend `POST /api/uso/registrar` + `GET /api/uso/relatorio`.

### v3.14.1 — 2026-06-10
- **Cobertura & Distribuição unificada:** os 2 cards da Home viraram **1 só**
  ("Cobertura & Distribuição"). A visão por SKU (antes card separado) virou a
  sub-aba **🔬 Analítico** dentro dele — agora as sub-abas são **Cobertura ·
  Distribuição · Analítico**. O Analítico aparece só para gestores. Removidos o
  card e a rota `/cobertura-sku` separados.

### v3.14.0 — 2026-06-10
- **Detalhamento HOP — filtro de Dia:** nas duas abas (Entrega e Ruptura) dá pra
  escolher um **dia específico**. Na Entrega filtra as devoluções do dia (o
  efetivado/taxa ficam "n/d" pois a base de efetivadas é mensal). Na Ruptura
  mostra as ocorrências daquele dia. Dia e Mês são mutuamente exclusivos.

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
