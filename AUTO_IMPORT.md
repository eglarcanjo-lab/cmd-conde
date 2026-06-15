# Auto-import por e-mail (Apps Script + zip)

Importação automática: você manda **1 e-mail com 1 .zip** (a pasta com todos os
relatórios) → um **Google Apps Script** vigia a caixa → envia o zip pro processador
→ ele **detecta cada arquivo pelo nome** e importa na ordem certa.
A caixa de entrada vira o **histórico de todas as versões**.

## Convenção de nomes (o nome define a importação)

### Promax (CSV) — o número da rotina no nome (já vem assim)
| Nome começa com | Importa como |
|---|---|
| `03014701` (03.01.47.01) | Pedidos |
| `0105070402` | Clientes |
| `0111` | Base de Produtos |
| `030509` | Faturamento Mktp |
| `120601` | Inadimplência |
| `030204` | Devoluções |
| `020304` | Grade de Estoque |

### BI (xlsx) — `#item` (o número do painel) ou palavra-chave
| Nome contém | Importa como |
|---|---|
| `#1` | Visitação GV |
| `#2` | Rota Coaching |
| `#5` | Atendimento Produtivo |
| `#6` | DTO GC |
| `#7` | Aba Promoção |
| `#12` | Score 5 |
| `#19` | Pedido Alone |
| `#20` | +RGB |
| `#21` | Cupons Digitais |
| `#22` | Loja Ideal |
| `#23` | Scanntech |
| `#24` | Portfólio Ideal |
| `task` | Tasks |
| `pontos` ou `bees` | Pontos Bees |

Arquivo que não casar com nada é **ignorado** (volta na resposta em `ignorados`).
Ordem de importação é automática (clientes/produtos antes de pedidos; pedidos antes da RV).

## Setup (1x)
1. Use uma conta **Gmail dedicada** (ex: `importacao.cmdconde@gmail.com`) — só pra isso.
2. Abra **script.google.com** → **Novo projeto** → cole o código abaixo.
3. Em `PROCESSOR_TOKEN`, cole o token (mesmo `PROCESSOR_TOKEN` do backend/processador).
4. Rode a função **`criarGatilho`** uma vez (autorize o acesso ao Gmail) — cria o
   gatilho que roda a cada 15 min.
5. Pronto. A partir daí, mande os relatórios zipados pra esse Gmail.

## Como enviar
- Zipe a pasta com os relatórios (pode ser todos juntos num zip só).
- Renomeie os **BI** conforme a convenção (`#7.xlsx`, `task.xlsx`, `pontos.xlsx`…).
  Os **Promax** já vêm com o número da rotina, não precisa renomear.
- Mande **1 e-mail** com o zip anexado pra conta de importação. Em até ~15 min importa.

## Código do Apps Script
```javascript
// === Configuração ===
const PROCESSOR_URL = "https://cmd-conde-processor.onrender.com/api/processar/zip";
const PROCESSOR_TOKEN = "COLE_AQUI_O_PROCESSOR_TOKEN";
const BUSCA = "is:unread has:attachment"; // dica: crie um filtro/rótulo e use "label:importar is:unread"

function importarRelatorios() {
  const threads = GmailApp.search(BUSCA, 0, 20);
  threads.forEach(function (th) {
    th.getMessages().forEach(function (msg) {
      if (!msg.isUnread()) return;
      let processou = false;
      msg.getAttachments().forEach(function (a) {
        if (!/\.zip$/i.test(a.getName())) return;
        try {
          const resp = UrlFetchApp.fetch(PROCESSOR_URL, {
            method: "post",
            headers: { "X-Processor-Token": PROCESSOR_TOKEN },
            payload: { arquivo: a.copyBlob() },
            muteHttpExceptions: true,
          });
          Logger.log(a.getName() + " => " + resp.getResponseCode() + " " + resp.getContentText().slice(0, 500));
          processou = true;
        } catch (e) {
          Logger.log("erro " + a.getName() + ": " + e);
        }
      });
      if (processou) msg.markRead(); // marca lido p/ não reprocessar (o e-mail fica arquivado)
    });
  });
}

// Rode UMA vez para criar o gatilho de 15 min:
function criarGatilho() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "importarRelatorios") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("importarRelatorios").timeBased().everyMinutes(15).create();
}
```

## Observações
- **Limite do Gmail:** anexo até **25 MB**. O pedidos zipado fica ~5 MB, então o zip
  da pasta toda passa tranquilo. Se um dia estourar 25 MB, separe em 2 e-mails.
- **Cold start do Render:** o processador "dorme" após ~15 min; a 1ª importação do dia
  pode demorar ~30-50s a mais (o Apps Script espera).
- **Mês de referência:** o auto-import usa o **mês atual** (não tem seletor). Para
  importar dados de mês passado, use o **Admin › Arquivos** manual.
- **Reprocessamento:** o e-mail é marcado como **lido** após importar. Não abra os
  e-mails dessa conta antes do gatilho rodar (ou use o rótulo `importar`).
- **Segurança:** o `PROCESSOR_TOKEN` fica só no Apps Script (conta sua). Não comite ele.
