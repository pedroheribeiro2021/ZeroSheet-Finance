# Paridade com a planilha — ajustes no motor de cálculo

Objetivo: fazer o ZeroSheet calcular igual à planilha "Finanças Mensais"
(meses 2025/2026). Lista pensada para execução direta. Cada item tem
**o quê**, **onde** e **critério de aceite**.

## 1. Descontar gasto REALIZADO do total (não só provisão planejada)
- **Onde:** `core/engine/calculations.ts` → `calculateSummary`
- **Problema:** despesa variável (não fixa, não provisão) hoje só afeta
  `provisionMap`/`provisionUsed`; nunca entra em `total`. Na planilha o gasto
  real abate o saldo.
- **Mudança:** por categoria, subtrair do total `max(provisãoPlanejada, gastoRealizado)`
  (provisão vira meta; quando o gasto real a ultrapassa, vale o real).
  `total = receitas − fixos − cartões − parcelas − Σ_categoria max(planejado, realizado)`.
- **Aceite:** categoria com provisão = 0 e gasto = 700 → total cai 700; com
  provisão 100 e gasto 416 → total cai 416.
### Pseudocódigo da nova calculateSummary (item 1)

function calculateSummary(transactions, weeks, snapshots?, installments=[]):
  totalIncome = 0; fixedCosts = 0; cardSpending = 0
  provisionPlanned: Map<cat,number> = {}   // is_provision
  realizedSpend:    Map<cat,number> = {}   // gasto variável (não fixo, não provisão)
  hasSnapshots = snapshots && snapshots.length > 0

  for t of transactions:
    cat = normalizeCategory(t.category)
    if t.type === 'income': totalIncome += t.amount; continue
    if t.isProvision: provisionPlanned[cat] = (provisionPlanned[cat] ?? 0) + t.amount; continue
    if t.isFixed: fixedCosts += t.amount; continue
    if !hasSnapshots && t.card: cardSpending += t.amount; continue   // sem fatura: cartão entra aqui
    if hasSnapshots && t.card: continue                             // já coberto pela fatura (snapshot)
    realizedSpend[cat] = (realizedSpend[cat] ?? 0) + t.amount       // gasto variável solto (sem cartão)

  if hasSnapshots: cardSpending = sum(snapshots, s => Number(s.amount))

  // ENVELOPE: por categoria, vale o MAIOR entre planejado e realizado
  envelopeSpending = 0; provisionMap = {}; plannedTotal = 0; usedTotal = 0
  for cat of union(keys(provisionPlanned), keys(realizedSpend)):
    planned  = provisionPlanned[cat] ?? 0
    realized = realizedSpend[cat]    ?? 0
    envelopeSpending += Math.max(planned, realized)
    provisionMap[cat] = planned - realized      // saldo do envelope (negativo = estourou)
    plannedTotal += planned; usedTotal += realized

  installmentSpending = sum(installments, i => i.installment_amount)

  total = toCurrency(totalIncome - fixedCosts - cardSpending - envelopeSpending - installmentSpending)
  weeklyBudget = weeks.length > 0 ? toCurrency(total / weeks.length) : total

  return {
    totalIncome, fixedCosts, cardSpending,
    provisionPlanned: plannedTotal, provisionUsed: usedTotal,
    provisionDiff: plannedTotal - usedTotal, envelopeSpending,
    total, weeklyBudget, provisionMap,
  }

// Mantém as chaves de retorno atuais (provisionPlanned/Used/Diff/Map) p/ não quebrar
// componentes e testes; só MUDA o total (passa a descontar gasto realizado via envelope).
// Aceite: junho importado deve fechar em -39,17 depois dos itens 1+2.

## 2. Receita não-disponível (Extras/Reembolsos)
- **Onde:** `core/types/finance.ts` + `core/types/database.ts` + `calculateSummary`
- **Problema:** toda `income` soma no total; na planilha "Extras/Reembolsos"
  aparece mas NÃO entra no Total.
- **Mudança:** adicionar flag (ex.: `countsInTotal: boolean` / `is_reimbursement`)
  para receitas que aparecem no resumo mas não somam em `totalIncome` do cálculo.
- **Aceite:** lançar reembolso de 465,92 não altera o total final.

## 3. Reserva como poupança (não despesa comum)
- **Onde:** tipos + `calculateSummary` (e idealmente novo conceito de saldo)
- **Problema:** "Reserva" hoje só pode virar despesa fixa qualquer.
- **Mudança (mínima):** flag `is_reserve` — abate do total como saída, mas é
  classificada/exibida como poupança no resumo, separada de "custos fixos".
  (Evolução futura: saldo de reserva acumulado entre meses.)
- **Aceite:** Reserva de 1.000 abate o total e aparece em bloco próprio, fora de fixos.

## 4. Nº de semanas real do mês + variante de orçamento
- **Onde:** `core/engine/weekly.ts` (`calculateWeekly` usa `totalWeeks = 4` fixo)
  e `calculateSummary` (`weeklyBudget = total / weeks.length`)
- **Problema:** semanas fixas em 4; planilha usa 4 ou 5 conforme o mês, e às
  vezes a variante `(receita − fixos) / semanas`.
- **Mudança:** calcular o nº real de semanas do mês (pela data) em vez de 4 fixo;
  adicionar opção de orçamento `(receita − fixos) / semanas`.
- **Aceite:** mês com 5 semanas divide o orçamento por 5; alternar a variante muda o valor.

## 5. Número da parcela no mês corrente
- **Onde:** `core/engine/installments.ts` → `filterActiveInstallments`
- **Problema:** filtra parcela ativa por range, mas não calcula o nº da parcela
  do mês (planilha mostra "2/5", "1/6").
- **Mudança:** computar e expor `parcelaAtual = currentMonthIndex − startIndex + 1`
  junto com `total_installments`.
- **Aceite:** parcela iniciada 3 meses antes mostra "4/N" no mês atual.

## 6. Normalização consistente de categorias
- **Onde:** `core/utils/normalize.ts` + `provisionMap` em `calculations.ts`
- **Problema:** categorias livres geram "mercado/Mercado/MERCADO",
  "mecânico/MECANICO", quebrando o casamento provisão↔gasto.
- **Mudança:** normalizar case + acento ao agrupar e ao casar envelopes.
- **Aceite:** "mercado" e "Mercado" caem no mesmo envelope.

## 7. (+/-) Split com sinal
- **Onde:** form de transação + cálculo
- **Problema:** "Split" pode ser + ou −; hoje exige escolher income/expense.
- **Mudança:** permitir um lançamento único com valor sinalizado que soma ou
  subtrai do mês.
- **Aceite:** Split −63,56 subtrai; +51,00 soma — sem trocar o tipo manualmente.
