# TODO — Zerosheet

Atualizado em 2026-06-25. Checkbox marcado = já implementado (commit/PR
indicado entre parênteses). Itens novos vão sempre no topo da seção
"Pendentes" da categoria correta.

## Pendentes

### Produto / decisão
- [ ] Decidir formalmente se a atualização do valor da fatura do cartão
      (`CardSnapshotForm.tsx`) continua manual ou se algum dia o cálculo
      passa a ser automático (somando transações no cartão). Hoje é manual
      e funciona — isso é só uma decisão de produto, não um bug. Calcular
      automático exigiria primeiro corrigir `transactions.card`, que ainda
      tem o `CHECK` legado (`'nubank'`/`'c6'`) e nunca é preenchido pela UI
      atual (`TransactionForm` sempre envia `card: null`).

### Dashboard
- [ ] **Dashboard mais moderna, com gráficos.** Pedido do usuário
      (2026-06-25). Hoje `components/dashboard/Dashboard.tsx` só mostra
      cards de métrica e uma lista de semanas; sem nenhuma visualização
      gráfica (evolução do saldo, gasto por categoria, etc). Precisa de
      definição de biblioteca de gráficos antes de implementar.

### Qualidade interna (sem impacto visível pro usuário)
- [ ] Modelar tipos de domínio reais para `Card`/`CardSnapshot`/`Installment`
      em vez de ler linhas do Supabase como `any`/loosely-typed em vários
      lugares — hoje só `Transaction`/`Week` têm tipo de domínio
      (`core/types/finance.ts`).
- [ ] Cobertura de teste de services/componentes ainda é zero — só
      `core/engine/*` tem teste (`tests/engine/`).
- [ ] Corrigir o `CHECK` legado em `transactions.card`
      (`'nubank'`/`'c6'` apenas) — sobra da migração de cartões mockados,
      hoje inofensivo porque a UI nunca preenche esse campo, mas bloqueia
      qualquer feature futura que precise ligar transação a cartão.

---

## Resolvidos

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
