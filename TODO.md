# TODO — Zerosheet

Atualizado em 2026-07-12. Checkbox marcado = já implementado (commit/PR
indicado entre parênteses). Itens novos vão sempre no topo da seção
"Pendentes" da categoria correta.

## Pendentes

### Produto
- [ ] Avaliar integração/import de extrato (OFX/CSV) para reduzir lançamento
      manual de gastos de mercado/gasolina — hoje o fluxo é: provisionar e ir
      lançando os gastos reais na mesma categoria (o envelope abate sozinho).
- [ ] Edição de parcelamento (hoje só criar/excluir) — agora inclui também o
      campo novo `billing_day` (dia de lançamento na fatura).
- [ ] Ordenação por arrastar (drag-and-drop) na lista de transações — por ora
      há seletor de ordenação (entradas primeiro/recentes/valor/categoria).

## Feitos em 2026-07-12 — Assinaturas/parcelas não contam como gasto livre da semana

Pedido do usuário (2026-07-12): assinaturas e parcelamentos lançados na
fatura estavam inflando o "gasto da semana" do Acompanhamento Semanal, que é
puramente o delta bruto entre leituras da fatura (`weeklySpendFromReadings`)
— esse delta não distinguia gasto discricionário de um compromisso fixo já
descontado à parte no saldo do mês (`fixedCosts`/`installmentSpending` em
`calculateSummary`).

- [x] Novo campo `installments.billing_day` (dia do mês, 1-31, nullable) —
      dia em que a parcela é lançada na fatura. Migration
      `supabase/migrations/20260712_01_installments_billing_day.sql`
      (`ADD COLUMN IF NOT EXISTS` + CHECK idempotente via `DO $$`).
      **APLICADA EM PRODUÇÃO** (2026-07-12, via MCP, a pedido do usuário).
- [x] `DBInstallment.billing_day` em `core/types/database.ts`;
      `createInstallment` (`installment.service.ts`) aceita o campo opcional.
- [x] `InstallmentForm.tsx`: campo "Dia em que cai na fatura (opcional)";
      `InstallmentList.tsx`: badge "Cai na fatura dia N" quando preenchido.
- [x] `core/engine/weekly.ts`: `knownChargesByWeek(charges, year, month,
      closingDay)` resolve o dia (`dueDay`/`billing_day`) dentro do mês
      corrente (mesma aproximação de `resolveDueDate` em `dueDates.ts`) e soma
      por semana do ciclo (`weekIndexInCycle`); `adjustWeeklySpendForKnownCharges`
      desconta esse valor do delta bruto por semana (nunca negativo).
      Testado em `tests/engine/known-charges.test.ts`.
- [x] `Dashboard.tsx` (`loadMonthData`): monta as cargas conhecidas a partir
      de transações fixas/recorrentes de despesa com `dueDay` E parcelas
      ativas com `billing_day`, **só as vinculadas ao cartão principal**
      (`card`/`card_id` === id do cartão principal), e ajusta
      `weeklySpend` antes de exibir. Seção "Acompanhamento Semanal" mostra
      uma nota "(não conta R$ X de assinaturas/parcelas lançadas na fatura)"
      quando há desconto na semana.
- [x] Limitação conhecida: só funciona para quem preencher `dueDay`
      (assinatura) ou `billing_day` (parcelamento) — sem essa data, o valor
      continua contando como gasto da semana até o usuário preencher.

## Feitos em 2026-07-10 — Controle de vencimento das despesas fixas

Pedido do usuário (2026-07-10), implementado em 5 passos/branches a partir de
`develop` (`feat/due-dates-engine` → `feat/paid-at-transactions` →
`feat/due-dates-panel` → `feat/due-today-banner` → `feat/push-notifications`).

### Passo 1 — Engine puro
- [x] `core/engine/dueDates.ts`: `resolveDueDate` (clamp de dia no mês),
      `classifyDueStatus` (overdue/today/upcoming) e `getDueItems` (resolve +
      classifica despesas fixas/recorrentes com `dueDay`, dentro de um
      horizonte de dias). 12 testes em `tests/engine/due-dates.test.ts`.

### Passo 2 — "Pago"
- [x] Coluna `transactions.paid_at timestamptz null` (migration
      `20260710_01_transactions_paid_at.sql`) — **APLICADA EM PRODUÇÃO**
      (2026-07-10, via MCP, a pedido do usuário).
- [x] `paidAt` em `core/types/finance.ts`, mapper e
      `markTransactionPaid`/`unmarkTransactionPaid` em
      `transaction.service.ts` (testados em `tests/services/`).
- [x] `getDueItems` usa `paidAt` para sobrepor o status calculado por data.

### Passo 3 — UI gerencial
- [x] `components/dashboard/DueDatesPanel.tsx`: grade de dias do mês
      (destaca hoje, ponto colorido por status) + lista agrupada (vence hoje /
      próximos 7 dias / vencido / pago) com marcar/desmarcar pago. Plugado no
      `Dashboard.tsx`, só quando o mês visualizado é o mês corrente real.
      Verificado manualmente no navegador (login real, toggle pago/despago).

### Passo 4 — Lembrete in-app
- [x] Banner "🔔 Vence hoje: ..." no topo do dashboard quando há item com
      status `today` no mês corrente. Não depende de push. Verificado
      manualmente no navegador.

### Passo 5 — Notificações push (Web Push/VAPID)
- [x] Service worker `public/sw.js` (push + notificationclick) e
      `core/services/push.service.ts` (registro, permissão via clique
      explícito em "🔔 Ativar notificações" no `DueDatesPanel`, subscribe/
      unsubscribe) + `core/services/pushSubscription.service.ts` (CRUD
      Supabase).
- [x] Migration `supabase/migrations/20260710_02_push_subscriptions.sql`
      (tabela `push_subscriptions`, RLS por usuário) — **APLICADA em
      produção** (2026-07-12).
- [x] `supabase/functions/send-due-notifications/index.ts` (Edge Function
      Deno): lê `due_day` do dia no mês corrente de cada usuário (não pago),
      envia Web Push via `npm:web-push` com as chaves VAPID. Autenticação
      própria via `CRON_SECRET` (header `Authorization: Bearer`), com
      `verify_jwt=false` — a service_role key nunca fica em texto puro na
      tabela `cron.job`. **IMPLANTADA** (2026-07-12).
- [x] `supabase/functions/send-due-notifications/schedule.sql`: SQL de
      agendamento via `pg_cron`/`pg_net`. **EXECUTADO em produção**
      (2026-07-12), job `send-due-notifications-daily` às 11:00 UTC
      (08:00 America/Sao_Paulo).
- [x] Chaves VAPID geradas, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` preenchida no
      `.env.local` e nas env vars da Vercel (production/preview/dev).
      Secrets da função (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
      `VAPID_SUBJECT`, `CRON_SECRET`) setados via `supabase secrets set`.
      pg_cron/pg_net habilitados no projeto.
- [ ] Não testado ponta a ponta em produção (sem ambiente Deno local) —
      confirmar no dia de um vencimento real que a notificação chega, e
      revisar logs da função (`supabase functions logs
      send-due-notifications`) após a primeira execução agendada.

## Feitos em 2026-07-06 — ajuste fino do Acompanhamento Semanal

### Gasto da semana = delta entre leituras (bug da 1ª leitura corrigido)
- [x] `weeklySpendFromReadings` trata a primeira leitura (mais antiga) como
      linha de base (`isBaseline: true`, `spent: 0`) em vez de contá-la como
      gasto cheio; o gasto real só é computado a partir da segunda leitura em
      diante. UI mostra "Leitura inicial (base)" para a semana da leitura
      inicial.
- [x] Atualizar a fatura de um cartão em Cartões (`CardSnapshotForm`) agora
      também lança uma leitura automaticamente (`recordSnapshotAsReading`),
      evitando duplicata exata (mesmo valor no mesmo dia) — o usuário
      atualiza a fatura uma vez só e o histórico semanal se constrói sozinho.
- [x] Nova função pura `weekIndexInCycle(date, closingDay)` indexa a semana
      pelo ciclo da fatura (dia seguinte ao fechamento = início da semana 1),
      em vez do dia do mês calendário — usada tanto na listagem quanto no
      gráfico semanal quando o cartão principal tem `closing_day` definido.

### Orçamento semanal decrescente (semanas restantes, não semanas do ciclo)
- [x] Nova função pura `getWeeksRemainingInCycle(closingDay, from)`: semanas
      que faltam até o próximo fechamento, por data. Quando há leituras no
      mês, o Dashboard prefere `semanas do ciclo − maior índice de semana já
      lançada` (mínimo 1); sem leituras, cai no cálculo por data.
- [x] `Dashboard.tsx` passa esse número (`weeksRemaining`) como
      `weeksForBudget` a `calculateSummary`, em vez do total de semanas do
      ciclo. Subtítulo do card "Orçamento Semanal" e o modal de detalhe
      atualizados para "semanas restantes do ciclo".
- [x] Lançar ou remover uma leitura recarrega o mês inteiro (`loadMonthData`)
      para que o orçamento semanal reflita a nova contagem de semanas
      restantes.

### Coerência visual
- [x] Cada linha de semana no Acompanhamento Semanal mostra o intervalo de
      datas do ciclo (`weekDateRangeInCycle`, ex. "Semana 1 (05/07–11/07)").
- [x] Semana sem leitura mostra "sem leitura ainda" (antes: "sem leitura").
- [x] Testes novos: `tests/engine/week-index-in-cycle.test.ts`,
      `tests/engine/weeks-remaining.test.ts`; `card-readings.test.ts`
      reescrito para a semântica de linha de base.
- [x] Não afeta os contratos fixados em `july-2026.test.ts` e
      `card-linked.test.ts` (ambos passam o número de semanas explicitamente
      ao engine).

## Feitos em 2026-07-03 — rodada 3 (otimização de cards + filtros)

### Dashboard: menos cards, detalhe no clique
- [x] Entradas volta a ser UM card só (`summary.totalIncome`); no clique lista
      cada lançamento individual (descrição/categoria/valor), sem agrupar.
- [x] Cartões unificado num card só (`summary.cardSpending`); no clique
      mostra por cartão: fatura atual, parcelas no mês, limite e disponível
      (limite − fatura). Removidos os cards por cartão e "Total Cartões".
- [x] "Parcelamentos (fora da fatura)" virou card "Parcelamentos" = soma das
      parcelas ativas no mês (mesmo dado do módulo Parcelamentos); no clique
      lista cada parcelamento (descrição, parcela vigente, valor/mês, cartão,
      início/fim). `calculateSummary`/`installmentSpending` não mudou.
- [x] Cards "Planejado (Provisões)" e "Gasto Real (Provisões)" removidos — já
      cobertos pela seção "Provisões do mês (envelopes)".
- [x] Todo card que sobrou é clicável: Entradas, Custos Fixos, Cartões,
      Parcelamentos, Assinaturas, Reserva/Investimentos, Saldo do Mês (mostra
      a composição do cálculo) e Orçamento Semanal (mostra saldo ÷ semanas).

### Controle semanal: só o cartão principal
- [x] "Controle Semanal" (baseado em `calculateWeekly`/snapshots, somava as
      DUAS faturas por semana) e "Acompanhamento semanal — {cartão}" foram
      mesclados numa seção única, alimentada só por
      `weeklySpendFromReadings(readings)` do cartão principal. Semana sem
      leitura mostra "sem leitura" em vez de gasto zerado.
- [x] `WeeklyBarChart` passou a receber as semanas construídas a partir das
      leituras (não mais de `calculateWeekly`/snapshots).
- [x] Dashboard parou de chamar `createWeeks`/`getWeeks`; código morto
      removido: `core/services/week.service.ts`, `mapWeek`, `DBWeek`
      (`calculateWeekly` continua em `core/engine/weekly.ts`, ainda coberto
      por `tests/engine/weekly.test.ts`). A tabela `weeks` no banco não foi
      alterada, só deixou de ser escrita.
- [x] Sem cartão principal definido: aviso pedindo para marcar o ★ na tela de
      Cartões, sem exibir semanas.

### Transações: filtros combináveis
- [x] `TransactionList.tsx` ganhou barra de filtros client-side: tipo
      (todas/entradas/despesas/reservas), categoria, cartão (todas/sem
      cartão/por cartão), flags (provisão/fixo/recorrente/assinatura) e busca
      por texto (`normalizeCategory` para ignorar acento/caixa) — todos
      combináveis (AND) e aplicados antes da ordenação existente.
- [x] Contagem e soma do que está filtrado exibidas acima da lista.

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
