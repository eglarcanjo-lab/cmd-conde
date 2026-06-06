# Gerar o APK (Hop Follow-up) com Capacitor

O app já está preparado com **Capacitor**. O APK é um app Android nativo que abre
o site publicado na Vercel **ao vivo** — então cada deploy aparece automaticamente,
**sem precisar recompilar o APK** a cada atualização. Você só recompila o APK se
mudar ícone/splash/config nativa.

> A compilação roda **no seu PC** (precisa de Android Studio). Aqui no projeto já
> deixei tudo pronto: `capacitor.config.ts`, ícones em `assets/`, deps no `package.json`.

## 1. Pré-requisitos (instalar uma vez)
- **Node.js LTS** (18 ou 20): https://nodejs.org
- **Android Studio** (já vem com o Android SDK e o JDK): https://developer.android.com/studio
  - Na 1ª abertura, deixe ele instalar o **Android SDK** e o **Platform-Tools**.

## 2. Configurar a URL do app
Abra `frontend/capacitor.config.ts` e troque a linha:
```ts
const VERCEL_URL = "https://SUA-URL.vercel.app";
```
pela URL real do seu app na Vercel (a mesma que você abre no navegador).

## 3. Comandos (na pasta `frontend`)
```bash
npm install                 # instala tudo (inclui Capacitor)

npm run build               # gera a pasta dist (necessária pro sync)
npx cap add android         # cria a pasta android/ (só na 1ª vez)

npm run app:assets          # gera ícone + splash do Hop (a partir de assets/icon.png)
npm run app:sync            # build + copia tudo pro projeto Android
npm run app:open            # abre o Android Studio
```

## 4. Gerar o APK no Android Studio
- **Pra testar no seu celular (USB):** conecte o aparelho (modo desenvolvedor + depuração USB),
  e clique em **Run ▶** no Android Studio. Instala e abre na hora.
- **Pra gerar o arquivo .apk (sideload/compartilhar):**
  `Build > Build Bundle(s) / APK(s) > Build APK(s)`. O APK sai em
  `android/app/build/outputs/apk/debug/app-debug.apk`.
- **Pra Play Store / APK assinado de release:**
  `Build > Generate Signed Bundle / APK` → crie um **keystore** (guarde bem! é a
  identidade do app) → escolha **release**. Gera o `.aab` (Play Store) ou `.apk`.

## 5. Quando atualizar o app
- **Mudou só o site (telas, lógica):** nada a fazer — o APK abre a Vercel ao vivo,
  já aparece sozinho. 👍
- **Mudou ícone/splash/nome/config nativa:** rode de novo `npm run app:assets` (se
  mudou ícone) e `npm run app:sync`, e gere o APK novamente.

## Observações
- **Ícone/splash:** já estão em `frontend/assets/icon.png` (1024) e `splash.png` (2732),
  com o logo do lúpulo. `npm run app:assets` gera todos os tamanhos do Android.
- **appId:** `com.cmdconde.hop` (mude em `capacitor.config.ts` se quiser outro).
- **A pasta `android/` não vai pro Git** (é gerada localmente). Se quiser versioná-la
  ou buildar em CI, remova `frontend/android/` do `.gitignore`.
- **Modo offline/empacotado** (opcional): dá pra empacotar o app dentro do APK em vez
  de carregar a Vercel — veja o comentário no fim do `capacitor.config.ts`.
- **Push notifications:** com o Capacitor dá pra adicionar depois
  (`@capacitor/push-notifications` + Firebase). É só pedir que eu preparo.
