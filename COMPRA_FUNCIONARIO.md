# Compra Funcionário — escopo (rascunho v1, 21/10/2026)

Portal web (celular) onde o colaborador escolhe produtos liberados no mês, assina o termo de
desconto em folha e gera os PDFs para RH, armazém e comercial.

> **Não é parte da HOP.** A HOP é suporte ao RN/GV/diretoria, não venda. O portal é um
> **projeto separado** que só **consome dados da HOP via API** (somente leitura).
> Este arquivo mora aqui só até o repositório próprio existir.

---

## 1. Regras do programa

| Regra | Definição |
|---|---|
| Quem participa | Colaboradores CLT da lista do RH (CPF + nome completo). **Estagiário e aprendiz não.** |
| Limite por pessoa | **R$ 450,00 por ciclo** (30% de R$ 1.500), igual para todos (SG a diretor) |
| Limite por item | Quantidade máxima definida no cadastro do item no ciclo (ex.: até 6 cx) |
| Preço | Definido pelo admin **no cadastro do item** em cada ciclo |
| Pedidos | **1 por CPF por ciclo** (pode editar/cancelar até o fechamento) |
| Pagamento | Desconto em folha, parcela única, com termo assinado (art. 462 CLT + Súmula 342 TST) |
| Fiscal | 1 NF no CPF do dono da revenda; para o colaborador, só recibo |
| Recibo de entrega | **Papel impresso**, assinado na entrega |

> ⚠️ 30% não está escrito na CLT para esse caso — é referência do consignado (Lei 10.820/2003)
> e da jurisprudência. Termo e regra precisam de OK do RH/jurídico antes do 1º ciclo.

## 2. Calendário (D+1, entrega sempre na sexta)

- **Janela de pedido:** a **última quinta-feira até o dia 15** do mês (cai entre os dias 9 e 15).
- **Faturamento + entrega:** a **sexta-feira seguinte** (D+1, dia de expediente reduzido).
- Horário de fechamento sugerido: **quinta 17h**, para o armazém separar e o faturista lançar
  cedo na sexta. *(a confirmar)*

| Ciclo | Janela (qui) | Fatura + entrega (sex) |
|---|---|---|
| Nov/2026 | 12/11 | 13/11 |
| Dez/2026 | 10/12 | 11/12 |
| Jan/2027 | 14/01 | 15/01 |
| Fev/2027 | 11/02 | 12/02 |
| Mar/2027 | 11/03 | 12/03 |

- Feriado na quinta ou na sexta → admin ajusta as datas do ciclo manualmente (o sistema sugere,
  o admin confirma).

## 3. Curadoria dos itens (admin)

O admin monta o ciclo: escolhe os itens, define **preço** e **qtd máxima por pessoa**.

- **Entra:** giro baixo, vencimento próximo (shelf), prioridade de shelf.
- **Não entra:** item vendendo bem, item com estoque baixo.
- O painel **sugere** os candidatos com dados da HOP e **alerta** se o admin escolher algo com
  cobertura baixa ou giro alto (alerta, não bloqueio).

## 4. Integração com a HOP (API somente leitura)

Rota nova na HOP, protegida por **chave própria** (`x-api-key`, variável de ambiente), sem
login de usuário e sem escrita:

`GET /api/externo/compra-func/catalogo` → por produto:

| Campo | Fonte na HOP |
|---|---|
| cod, nome, embalagem, hl_caixa | `produtos_full` |
| foto | `frontend/public/produtos/{cod}.png` (185 fotos, URL pública da HOP) |
| saldo em estoque | `grade_estoque` |
| giro (cx/dia, últimos 30 dias) | `volume_diario` ÷ `hl_caixa` |
| dias de cobertura | saldo ÷ giro |
| validade / dias p/ vencer | **shelf** — ainda pendente na HOP (`PRODUTOS_SHELF.md`) |

- Até o shelf existir, a validade é digitada pelo admin no cadastro do item.
- A HOP não guarda nada do portal (pedidos, CPFs, assinaturas ficam só no portal).

## 5. Arquitetura do portal (proposta)

- **Repo próprio** (ex.: `cmd-conde-compra-func`), mesma stack da HOP: React/Vite na Vercel +
  funções Node.
- **Banco próprio** (schema separado no Supabase ou projeto novo):
  `colaboradores`, `ciclos`, `ciclo_itens`, `pedidos`, `pedido_itens`, `assinaturas`.
- **PDF** gerado no servidor (termo com assinatura embutida).
- **WhatsApp:** robô da Lia (`cmd-conde-whatsapp`) puxa do portal no fechamento e envia.

## 6. Fluxo do colaborador (celular)

1. Abre o link → fora da janela mostra "próxima abertura: dd/mm".
2. Informa **CPF** → sistema confere na lista do RH e preenche o nome; ele informa a **função**.
3. Vê os itens (foto, preço, máx.) → ajusta quantidades com **+ / −** → total ao vivo; ao chegar
   em R$ 450 ou no máx. do item, o **+** trava.
4. Lê o termo e marca **"li e aceito"**.
5. Confirmar → tela de **assinatura com o dedo** → salvar.
6. Recebe o PDF do termo (download / tela de confirmação).

## 7. Saídas

| Quando | Para quem | O quê |
|---|---|---|
| A cada pedido confirmado | Colaborador | PDF do termo assinado |
| Fechamento (qui 17h) | **RH** | PDFs individuais dos termos + consolidado p/ folha (CPF, nome, valor) |
| Fechamento | **Armazém** | Pedido a pedido para separação + **recibo de entrega já preenchido p/ imprimir** + consolidado p/ faturista |
| Fechamento | **Comercial (Eduardo)** | Consolidado por SKU para lançar o pedido no CPF do dono |

## 8. Textos

### Termo (assinado no pedido)

> **TERMO DE CIÊNCIA E AUTORIZAÇÃO DE DESCONTO EM FOLHA – COMPRA FUNCIONÁRIO**
>
> Eu, **[NOME]**, CPF **[CPF]**, função **[FUNÇÃO]**, colaborador(a) da **[EMPRESA]**, declaro que:
> 1. Aderi **voluntariamente** ao programa Compra Funcionário, ciclo **[MÊS/ANO]**, sem qualquer
>    coação, não sendo a adesão condição para manutenção do meu contrato de trabalho.
> 2. Solicitei os produtos abaixo, no valor total de **R$ [VALOR]**: **[LISTA]**.
> 3. **Autorizo expressamente**, nos termos do art. 462 da CLT e da Súmula 342 do TST, o desconto
>    integral desse valor em minha folha de pagamento de **[MÊS]**, em parcela única.
> 4. Estou ciente de que o valor respeita o limite do programa, de R$ 450,00 por ciclo.
> 5. Em caso de encerramento do contrato antes do desconto, autorizo o desconto do saldo nas verbas
>    rescisórias, observado o limite do art. 477, §5º, da CLT.
> 6. Os produtos destinam-se a consumo próprio ou familiar, sendo vedada a revenda.
> 7. Posso cancelar este pedido e esta autorização até o fechamento do período.
> 8. Autorizo o tratamento dos meus dados (nome, CPF e assinatura) exclusivamente para operacionalizar
>    este programa, inclusive o envio ao RH e à logística, nos termos da LGPD (Lei 13.709/2018).
>
> [Cidade], [data/hora] – Assinatura: [assinatura digital]

### Recibo de entrega (impresso, assinado na sexta)

> **RECIBO DE ENTREGA – COMPRA FUNCIONÁRIO**
>
> Eu, **[NOME]**, CPF **[CPF]**, declaro ter recebido em ___/___/______, em perfeito estado, os
> produtos **[LISTA]**, referentes à Compra Funcionário ciclo **[MÊS/ANO]**, no valor total de
> **R$ [VALOR]**, ciente de que esse valor será **descontado em minha folha de pagamento**, conforme
> Termo de Autorização assinado em **[DATA DO PEDIDO]**.
>
> Assinatura: ______________________

## 9. Em aberto

- [ ] Confirmar regra da janela: "última quinta-feira até o dia 15".
- [ ] Horário de fechamento (sugestão: quinta 17h).
- [ ] RH recebe os termos um a um durante o dia ou em lote no fechamento?
- [ ] Banco: schema separado no Supabase da HOP ou projeto Supabase novo?
- [ ] Nome da empresa/razão social para o termo e o recibo.
- [ ] OK do RH/jurídico no termo e no limite de R$ 450.
- [ ] OK do contábil na operação (1 NF no CPF do dono + recibos).
