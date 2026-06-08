# CLAUDE.md — regras do projeto Hop Follow-up

## Fluxo de release (IMPORTANTE)
- **Todo trabalho vai para o branch `dev`.** NÃO commitar direto no `main`.
- `main` = **produção** (Vercel + Railway + Render apontam pra ele). Só recebe
  código nos **dias de release**, via `merge dev → main`.
- `dev` = **staging** (planilha cópia + backend/processador de teste). É onde o
  Eduardo testa antes de liberar pra todos.
- **Cadência:** novas funções/visualizações = ~1x por mês. Correções de
  lógica/memória de cálculo = quando necessário (hotfix pode ir pro `main`).
- **Versão/CHANGELOG:** continuo bumpando `APP_VERSION` e logando no CHANGELOG a
  cada mudança (no `dev`). O número só chega na produção no merge de release, então
  o banner de "nova versão" para os usuários só dispara nos dias de release.

## Dois repositórios (sempre os dois quando a mudança envolve o processador)
- `cmd-conde` — frontend (Vercel) + backend Node (Railway).
- `cmd-conde-processor` — processador Python (Render). Repo separado.

## Como fazer o release (merge dev → main)
Ver `RELEASE.md` para o passo a passo e a configuração do ambiente de staging.

## Notas técnicas
- Banco = Google Sheets (`GOOGLE_SHEET_ID`). Staging usa uma **planilha cópia**.
- Sem npm/node local de forma confiável; há um Python em
  `AppData\Local\Python\pythoncore-3.14-64` para validar o processador (py_compile + pandas).
- Versionamento e regras de bump: ver `CHANGELOG.md`.
- Shelf (aba Produtos) pendente: ver `PRODUTOS_SHELF.md`.
