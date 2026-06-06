# Aba Produtos — instruções (Grade ✅ feita · Shelf 🟡 pendente do relatório)

Memória de contexto para quando o **relatório de Shelf (produtos próximos do vencimento)**
for enviado. A sub-aba **Grade de Estoque** já está pronta (v3.8.0).

## Contexto dado pelo usuário
- A aba **Produtos** tem sub-abas. **Grade de Estoque** (saldo atual) — pronta.
- **Shelf** = relatório de produtos **próximos do vencimento**, vindo de **outro setor**,
  com acesso **1x por semana**. Entre uma importação e outra, o acompanhamento deve ir
  **diminuindo conforme o produto vai sendo vendido**.

## Conversão HL → unidades (JÁ DESCOBERTO ✅)
- O "fator HL do produto" pedido pelo usuário = coluna **P** da base de produtos =
  **"Fator Hecto Comercial"** (índice 15, 0-based) = **HL de uma caixa/dúzia**.
- Validado: cod 009067 (Antártica Lata 350 cx12) = 0,042 HL; cod 002546 (Original 600 Dz) = 0,072 HL.
- Já está sendo gravado na aba **`produtos_full`** (cod, nome, embalagem, **hl_caixa**).
- **Caixas vendidas = HL vendido ÷ hl_caixa.**

## Lógica do Shelf (a implementar quando o relatório chegar)
1. **Importar o relatório de shelf** → aba `shelf_base` com (a confirmar nas colunas reais):
   `cod, nome, qtd_inicial (caixas/un), data_relatorio, validade?, setor_origem?`.
2. **Decremento automático pelas vendas:** para cada produto, desde `data_relatorio`:
   - `caixas_vendidas = (HL vendido do produto a partir de data_relatorio) ÷ hl_caixa`
   - fonte do HL vendido: `volume_diario` (ou pedidos) filtrando o `cod_produto` e datas ≥ data_relatorio.
3. **Saldo na shelf = max(0, qtd_inicial − caixas_vendidas)**.
4. **Sub-aba Shelf** (frontend, em Produtos) mostra: produto, validade, dias p/ vencer,
   qtd inicial, vendido desde o relatório, **saldo atual na shelf**, ordenável e com busca.
   Destacar quem está perto de vencer / com saldo ainda alto.

## A CONFIRMAR com o usuário quando enviar o arquivo de shelf
- Quais são as **colunas** do relatório (nome do código, quantidade, validade, unidade).
- A quantidade do relatório está em **caixas** ou **unidades**? (define se divido HL por hl_caixa
  direto, ou se preciso converter caixa→unidade pela embalagem).
- Se as vendas a descontar são **de todos os setores** ou de um setor específico.

## Onde está cada coisa (código)
- Processador: `processar_produtos_full` (aba `produtos_full`) e `processar_grade_estoque`
  (aba `grade_estoque`) em `cmd-conde-processor/src/processor.py`.
- Backend: `GET /api/grade` em `backend/src/routes/grade.js`.
- Frontend: `frontend/src/pages/Produtos/index.jsx` (sub-aba Grade pronta; Shelf = placeholder "em breve").
- Imports (Admin › Arquivos): slots **"Grade de Estoque"** e **"Base Produtos (nomes + HL/caixa)"**.
