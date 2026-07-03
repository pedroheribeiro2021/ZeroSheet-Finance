# TODO — Zerosheet

Atualizado em 2026-07-03. Checkbox marcado = já implementado (commit/PR
indicado entre parênteses). Itens novos vão sempre no topo da seção
"Pendentes" da categoria correta.

## Pendentes

### Produto
- [ ] Avaliar integração/import de extrato (OFX/CSV) para reduzir lançamento
      manual de gastos de mercado/gasolina — hoje o fluxo é: provisionar e ir
      lançando os gastos reais na mesma categoria (o envelope abate sozinho).
- [ ] Edição de parcelamento (hoje só criar/excluir).
- [ ] Ordenação por arrastar (drag-and-drop) na lista de transações — por ora
      há seletor de ordenação (entradas primeiro/recentes/valor/categoria).

## Feitos em 2026-07-03 — rodada 2 (paridade com a planilha)

### Paridade planilha × app — diferença de R$ 413,90 IDENTIFICADA E ZERADA
- [x] Causa: TotalPass (119,90), Claude (110,00) e gasolina real (184,00)
      estavam DENTRO da fatura do cartão na planilha, mas o app contava de
      novo por fora (sem vínculo transação↔cartão). 119,90+110+184 = 413,90.
- [x] Transações agora podem ser vinculadas a um cartão ("Pago no cartão?"),
      e despesa vinculada a cartão com fatura lançada não conta duas vezes.
- [x] Gasto no cartão CONSOME a provisão da categoria (envelope): provisão de
      gasolina 300 com 184 gastos no cartão → só 116 seguem reservados.
- [x] Teste de paridade `tests/engine/card-linked.test.ts` fixa o saldo de
      julho/2026 em R$ 2.548,44 e orçamento semanal em R$ 509,69.
- [x] Backfill aplicado em produção: TotalPass e Claude → categoria
      'Assinaturas' + vínculo com Nubank; gasolina real → Nubank; reembolso
      Samsung → categoria 'Reembolso', recorrente até nov/2026 (1/5).
      **Conferir se o cartão correto é mesmo o Nubank** (edite na UI se não).

### Transações
- [x] Campo description separado da categoria (migration
      `20260703_02_transactions_description.sql`, aplicada): item "Claude"
      na categoria "Assinaturas".
- [x] Índice único (month_id, category) removido (migration
      `20260703_03_drop_unique_recurring_index.sql`, aplicada) — permitia só
      1 assinatura recorrente por categoria/mês.
- [x] Lista mostra descrição + chip de categoria + badge "💳 na fatura".

### Dashboard
- [x] Card "Salário" separado de "Outras Entradas".
- [x] Card "Assinaturas" (recorrentes no cartão, compõem a fatura).
- [x] "Total do Mês" renomeado para "Saldo do Mês" (com explicação).
- [x] Orçamento semanal = saldo ÷ semanas do ciclo da fatura do cartão
      principal (`getWeeksInCurrentCycle`): fecha dia 4 → ciclo 04/07→04/08 =
      5 semanas → 2.548,44/5 = 509,69.
- [x] Card "Diferença" comentado (informação já está nos envelopes).

### Incidente
- [x] OneDrive truncou vários arquivos do working tree durante a sessão
      (sync conflict). Recuperado do git (HEAD = PR #58) + reaplicação das
      mudanças. **Recomendação: commitar com frequência; considerar mover o
      repo para fora do OneDrive ou pausar o sync durante sessões de agente.**

## Feitos em 2026-07-03 (auditoria + ajustes de cálculo e UX)

### Banco de dados
- [x] Migrations `20260629_01/02/03` verificadas: **já estavam aplicadas em
      produção** (is_primary, card_readings, is_reimbursement/is_reserve).
- [x] Backfill de julho/2026 aplicado: Reserva marcada `is_reserve`, reembolso
      Samsung marcado `is_reimbursement`, categoria "Gasolina (Provisão)"
      renomeada para "Gasolina" (religando o envelope ao gasto real).
- [x] Nova migration `20260703_01_transactions_recurring_until.sql` aplicada em
      produção: coluna `recurring_until` (duração da recorrência).

### Cálculo (engine)
- [x] **Dupla contagem parcela × fatura corrigida**: parcela cujo cartão tem
      snapshot no mês não soma de novo no total (já está dentro da fatura).
      `installmentSpending` agora exposto no summary + teste novo.
- [x] Envelopes detalhados no summary (`envelopes[]`: planejado, usado,
      restante por categoria) — gasto real na mesma categoria abate a provisão
      automaticamente (não precisa editar a provisão na mão).
- [x] Recorrência com duração: `recurring_until` respeitado ao copiar
      recorrentes para o novo mês (`core/engine/recurrence.ts` + testes).
- [x] Cópia de recorrentes agora leva `is_reserve`, `is_reimbursement` e
      `recurring_until` (antes as flags se perdiam na virada do mês).
- [x] `parseCurrencyInput` aceita separador de milhar ("1.234,56").

### Transações (UX)
- [x] Tipos de lançamento explícitos: (+) Entrada / (−) Despesa / (↗) Reserva
      — reserva não é despesa nem receita, mas abate das entradas.
- [x] Recorrência disponível também para entradas e reservas, com duração:
      sempre / por N meses / até mês-ano.
- [x] Lista com separação visual: borda e valor coloridos (verde entrada,
      vermelho despesa, azul reserva), sinais + / −, badges com texto
      ("Provisão", "Reserva", "Reembolso", "Fixo", 🔁 com fim da recorrência).
- [x] Ordenação: entradas primeiro por padrão + seletor (recentes, maior
      valor, categoria).
- [x] Campo de valor aceita somente números (sanitização em todos os forms).
- [x] Categorias novas: Mercado, Gasolina, Assinaturas (Amazon, Claude etc.),
      Academia, Saúde etc. (despesa); Salário, Reembolso etc. (entrada);
      Reserva financeira / Investimentos (reserva). Modal de edição ganhou os
      mesmos campos do form.

### Parcelamentos
- [x] Lista mostra parcela vigente ("Parcela vigente: 2/5"), mês de início e
      mês da última parcela, e o cartão.
- [x] Form com rótulos claros, total da compra calculado e aviso de quando a
      1ª parcela conta.
- [x] Dashboard: cada cartão mostra fatura, parcelas comprometidas no mês e
      "Disponível p/ gastar" (limite − comprometido).

### Dashboard
- [x] Card "Reserva / Investimentos" (clicável, com detalhamento).
- [x] Card "Parcelamentos (fora da fatura)".
- [x] Seção "Provisões do mês (envelopes)" com barras de progresso
      (planejado × usado × restante) por categoria.

### Geral
- [x] `cursor: pointer` global em botões, selects, checkboxes e radios
      (`globals.css`); botão desabilitado usa `not-allowed`.


### Banco de dados
- [ ] Definir/marcar o cartão principal (Nubank ou C6) via interface (botão ★
      no CardList) — necessário para o acompanhamento semanal do dashboard.

### Produto / decisão
- [x] Decidir formalmente se a atualização do valor da fatura do cartão
      (`CardSnapshotForm.tsx`) continua manual ou se algum dia o cálculo
      passa a ser automático (somando transações no cartão).
      **Decisão (2026-06-25): fica manual.** O usuário atualiza o valor
      conforme queira. Não há plano de automatizar.

### Dashboard
- [x] **Dashboard mais moderna, com gráficos.** Pedido do usuário
      (2026-06-25). Hoje `components/dashboard/Dashboard.tsx` só mostra
      cards de métrica e uma lista de semanas; sem nenhuma visualização
      gráfica (evolução do saldo, gasto por categoria, etc). Precisa de
      definição de biblioteca de gráficos antes de implementar.
      (branch `feat/dashboard-charts`, Recharts: WeeklyBarChart + CategoryBarChart)

### Qualidade interna (sem impacto visível pro usuário)
- [x] Modelar tipos de domínio reais para `Card`/`CardSnapshot`/`Installment`
      em vez de ler linhas do Supabase como `any`/loosely-typed em vários
      lugares — hoje só `Transaction`/`Week` têm tipo de domínio
      (`core/types/finance.ts`). (branch `chore/domain-types-cards-installments`)
- [x] Cobertura de teste de services/componentes ainda é zero — só
      `core/engine/*` tem teste (`tests/engine/`). (branch `chore/service-tests`,
      testa `copyRecurringTransactions` e `createMonth`)
- [x] Corrigir o `CHECK` legado em `transactions.card`
      (`'nubank'`/`'c6'` apenas) — sobra da migração de cartões mockados,
      hoje inofensivo porque a UI nunca preenche esse campo, mas bloqueia
      qualquer feature futura que precise ligar transação a cartão.
      (branch `chore/drop-card-check-constraint`, migration aplicada em produção)

---

## Resolvidos

### Loop semanal e contrato de julho (PR #55 `feature/loop-semanal`)
- [x] `cards.is_primary` — tipo, serviço `setPrimaryCard()` e botão ★ no
      `CardList`. Inerte até migration `01`.
- [x] `getWeeksInCycle(closingDay)` — semanas pelo ciclo do cartão principal
      em vez de 4 fixo. Dashboard usa o fechamento do cartão principal como
      divisor; cai em `getWeeksInMonth` se não houver principal.
- [x] `card_readings` / `weeklySpendFromReadings` — leituras parciais da
      fatura, delta por semana, seção no dashboard com campo de lançamento.
      Inerte até migration `02`.
- [x] Não-interferência em `calculateSummary`: transação com `card` vinculada
      a cartão que já tem snapshot no mês é ignorada em todos os outros buckets
      (evita "Luz no C6" contar em fixos E na fatura).
- [x] `july-2026.test.ts` — contrato financeiro fixado:
      total −53,76 · fixedCosts 784,75 · cardSpending 2155,93
      envelopeSpending 629,88 · reserveSpending 1000 · weeklyBudget −13,44

### Alta prioridade (PR #47 — `feature/toasts-card-fields-and-auth-fix`)
- [x] Sessão do usuário não atualizava ao trocar de conta sem reload —
      `LayoutShell.tsx` agora usa `supabase.auth.onAuthStateChange`.
- [x] Cartão: `due_day`, `color` e `limit_amount` agora têm UI em
      `CardForm`, além de um fluxo de edição (`EditCardModal.tsx` +
      `CardList.tsx`, que estava morto e foi revivido).
- [x] Feedback visual (toasts) — `components/ui/ToastProvider.tsx`,
      plugado em transações, parcelamentos, cartões, registro e logout.

### Média prioridade (PR #48 — `feature/recurring-transaction-due-day`)
- [x] Vencimento em despesas recorrentes — campo opcional em
      `TransactionForm`/`EditTransactionModal`, persistido em
      `transactions.due_day` e propagado ao copiar para o mês seguinte.
- [x] **Bug real corrigido**: `copyRecurringTransactions()` fazia upsert
      com `onConflict` numa constraint que não existe — toda criação de
      mês com recorrências configuradas falhava (`42P10`). Trocado por
      `insert` simples.
- [x] Botão "Voltar para o login" na tela de cadastro.
- [x] Clareza do campo de dia de fechamento do cartão (labels em todos os
      campos do formulário).

### Paridade com a planilha de finanças (PR #49 — `feature/paridade-planilha-engine`)
- [x] Total desconta `max(planejado, realizado)` por categoria (envelope),
      não só a provisão planejada — `calculateSummary`.
- [x] Receita de reembolso (`isReimbursement`) não soma no total — campo
      novo no tipo/engine; **ainda inerte em produção**, falta migration +
      UI (ver "Qualidade interna" acima, vira tarefa quando for ligado).
- [x] Reserva (`isReserve`) abate o total separada de custos fixos —
      mesma observação: tipo/engine prontos, falta migration + UI.
- [x] Número real de semanas do mês (`getWeeksInMonth`) + variante de
      orçamento `(receita - fixos) / semanas` — implementado no engine.
- [x] Número da parcela atual (`currentInstallment`) exposto por
      `filterActiveInstallments`.
- [x] Normalização de categoria robusta a espaços internos duplicados.
- [x] Split com valor sinalizado (`resolveSplitAmount` + toggle no
      `TransactionForm`), sem precisar de tipo de transação novo.

### Consumo do engine de paridade na UI (`feature/wire-parity-engine-into-ui`)
- [x] `Dashboard.tsx` agora usa `getWeeksInMonth(month, year)` ao chamar
      `calculateWeekly`, em vez de assumir 4 semanas fixas (também no
      fallback que cria as semanas na primeira vez).
- [x] `InstallmentList.tsx` usa `currentInstallment` retornado por
      `filterActiveInstallments` em vez de recalcular o mesmo número
      localmente — removeu a duplicação e as props `months`/
      `currentMonthId`, que ficaram sem uso.

### Infraestrutura
- [x] Deploy em produção na Vercel —
      https://zerosheet-finance.vercel.app (projeto conectado ao GitHub,
      branch de produção `develop`, env vars do Supabase configuradas em
      Production/Preview/Development).
- [x] CI (`.github/workflows/ci.yml`): typecheck, testes, build.

### Já resolvidos antes desta revisão (ver CONTEXT.md §5)
- [x] Bug de matching cartão↔fatura no Dashboard (`card_id` em vez de
      `slug`).
- [x] Duplicação de `normalizeCategory()`.
- [x] `core/engine/installments.ts` como placeholder não usado.
- [x] "Atualização manual do valor do cartão não está mais disponível" —
      a premissa estava errada, o campo nunca saiu do ar.
