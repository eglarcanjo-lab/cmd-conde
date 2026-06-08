# CLAUDE.md — regras do projeto Hop Follow-up

## Fluxo de release (ATUAL: direto no main)
- **No momento, trabalho vai DIRETO no `main`** (deploy automático em produção).
  O fluxo dev→staging está **PAUSADO** (decisão do Eduardo: "pode subir automático,
  retomar a ideia depois"). O branch `dev` continua existindo para retomar.
- `main` = **produção** (Vercel + Railway + Render). Cada push sobe pra todos.
- **Quando retomar o staging:** ver `RELEASE.md` (fluxo) e `RELEASE_OPCOES.md`
  (alternativas: flag `beta` por usuário p/ telas, staging no Render free p/ cálculo).
- **Versão/CHANGELOG:** bumpar `APP_VERSION` e logar no CHANGELOG a cada mudança
  que sobe pra produção.

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
