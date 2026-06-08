# Opções de release/teste — MAPEAMENTO (decisão pendente, nada implementado)

> Contexto: Railway free não deixa criar outro ambiente. Mapeando alternativas
> pra testar versões novas sem afetar todos os usuários. **Nada disso foi
> implementado ainda — é só o plano.**

## A regra que decide tudo
O isolamento só é necessário quando a mudança **escreve no banco** (Google Sheets)
ou **muda um cálculo do servidor**. Telas novas que **só leem** dados existentes
NÃO têm risco — podem ser testadas em produção, escondidas atrás de uma flag.

## 3 níveis (por tipo de mudança)

### 1) Tela/visualização nova (só leitura) → FLAG `beta` no usuário  ✅ preferido
- Adicionar campo `beta` na aba `usuarios` (ou um perfil/grupo "beta").
- No frontend, as features novas aparecem só se `usuario.beta === "1"`.
- Sobe pra produção normal, mas só o(s) usuário(s) de teste veem.
- No dia do release: remove a checagem da flag (libera pra todos).
- **Custo zero, sem ambiente novo, sem risco de dados (é leitura).**
- Cobre a maioria do que construímos (novas abas, relatórios, visualizações).

### 2) Correção de cálculo / memória de cálculo → revisão + staging sob demanda
- Não dá pra gatear por usuário (o cálculo é igual pra todos no servidor).
- Validar com cuidado (temos Python local pra conferir o processador).
- Se precisar testar isolado: subir staging temporário (ver nível 3).

### 3) Importação / processador → staging temporário no Render free + planilha cópia
- Planilha cópia (compartilhada com o MESMO service account).
- Backend + processador de staging no **Render free** (NÃO no Railway):
  - Render aceita serviços grátis que "dormem" — liga só na hora de testar.
  - `GOOGLE_SHEET_ID` = planilha cópia nesses serviços.
- Vercel: preview do branch `dev` já é automática; `VITE_API_URL` (escopo Preview)
  aponta pro backend de staging.
- Usar só quando houver mudança de import/cálculo que exija teste real isolado.

## Por que o "usuário de teste" sozinho não cobre tudo
- Cálculo roda no servidor igual pra todos → não dá pra ser diferente só pro beta.
- Importação escreve na planilha real → afeta todos, mesmo que só o beta dispare.
- Por isso: flag beta para TELAS (leitura), staging para CÁLCULO/IMPORT (escrita).

## Próximo passo quando decidir
- Implementar a flag `beta` (campo no usuário + checagem nas telas novas) — barato.
- Documentar quais features estão "em beta" a cada ciclo.
- Manter `dev` como branch de trabalho; `main` = produção (ver RELEASE.md).

_Status: aguardando decisão do Eduardo. Sem mudanças no app._
