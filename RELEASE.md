# Release & Ambiente de Teste (Staging)

Objetivo: continuar ajustando o tempo todo, mas **só liberar pra todos nos dias de
release**. `dev` = teste · `main` = produção.

```
   trabalho do dia  ─────────────►  branch dev  ──(URL de teste, planilha cópia)
                                        │
                            dia de release: merge dev → main
                                        ▼
                                   PRODUÇÃO (todos os usuários)
```

## Cadência combinada
- **Novas funções / visualizações:** ~1x por mês (junta no `dev`, libera no release).
- **Correção de lógica / memória de cálculo:** quando necessário (hotfix direto no `main`).

---

## Setup do ambiente de staging (fazer 1x)

### 1. Planilha cópia (banco de teste)
1. Abra a planilha de produção no Google Sheets → **Arquivo → Fazer uma cópia**.
   Nome: `CMD Conde — STAGING`.
2. **Compartilhe a cópia** com o **mesmo service account** (o e-mail
   `GOOGLE_SERVICE_ACCOUNT_EMAIL`) como **Editor**.
3. Copie o **ID** da cópia (parte da URL entre `/d/` e `/edit`).

### 2. Backend de staging (Railway)
- Crie um **novo serviço** apontando para o repo `cmd-conde`, branch **`dev`**
  (root: `backend`). Copie TODAS as variáveis do backend de produção, **mudando**:
  - `GOOGLE_SHEET_ID` = ID da planilha **cópia**
  - `PROCESSOR_URL` = URL do **processador de staging** (passo 3)
  - (mantém GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, JWT_SECRET, PROCESSOR_TOKEN, etc.)
- Anote a URL pública desse backend (ex: `...-staging.up.railway.app`).

### 3. Processador de staging (Render)
- Crie um **novo serviço** apontando para o repo `cmd-conde-processor`, branch **`dev`**.
  Copie as variáveis do processador de produção, **mudando**:
  - `GOOGLE_SHEET_ID` = ID da planilha **cópia**
  - (mantém o service account e `PROCESSOR_TOKEN` igual ao do backend de staging)

### 4. Frontend de teste (Vercel)
- A Vercel **já gera uma URL de preview** para o branch `dev` automaticamente
  (algo como `cmd-conde-git-dev-...vercel.app`).
- Em **Vercel → Settings → Environment Variables**, defina `VITE_API_URL`
  com escopo **Preview** = URL do **backend de staging** (passo 2).
  (A de produção continua apontando pro backend de produção.)
- O CORS do backend já libera `*.vercel.app`, então a preview conecta sem ajuste.

Pronto: a URL de preview do `dev` = ambiente de teste completo, com dados isolados.

---

## Rotina de release (dia de liberar)
1. Confirma que está tudo testado na URL de preview do `dev`.
2. Merge:
   ```bash
   # repo cmd-conde
   git checkout main && git pull && git merge dev && git push
   git checkout dev
   # repo cmd-conde-processor (se houve mudança no processador)
   git checkout main && git pull && git merge dev && git push
   git checkout dev
   ```
3. Produção (Vercel/Railway/Render) sobe sozinha a partir do `main`.
4. Confere a versão no rodapé do app e avisa a equipe (banner de atualização aparece).

## Hotfix (correção urgente em produção)
- Pode ir direto no `main` (corrige, commita, push). Depois traga de volta pro `dev`:
  `git checkout dev && git merge main`.

## Importante
- **Importações de teste** (pedidos, grade, etc.) devem ser feitas **na planilha cópia**
  (via app de staging), nunca na de produção.
- O **APK** (Capacitor) aponta pra produção (`cmd-conde.vercel.app`) — testers usam a
  **URL de preview** no navegador, não o APK.
