# TODO — Zerosheet

Revisão feita em 2026-06-24 contra o estado atual do código (branch
`develop`). Todos os itens de prioridade Alta e Média do levantamento
original já foram implementados — ver seção "Resolvidos" abaixo para o que
foi feito e onde. O que resta é só de baixa prioridade / decisões de produto.

## Itens ainda não realizados

### Baixa prioridade
- [ ] Decidir formalmente se a atualização do valor da fatura do cartão
      (`CardSnapshotForm.tsx`) continua manual ou se algum dia o cálculo
      passa a ser automático (somando transações no cartão). Hoje é manual
      e funciona; isso é só uma decisão de produto, não um bug.

Nada mais ficou pendente da lista original. Itens novos que aparecerem
devem ser adicionados aqui.

---

## Resolvidos

### Alta prioridade (PR #47 — `feature/toasts-card-fields-and-auth-fix`)
- Sessão do usuário não atualizava ao trocar de conta sem reload —
  `LayoutShell.tsx` agora usa `supabase.auth.onAuthStateChange`.
- Cartão: `due_day`, `color` e `limit_amount` agora têm UI em `CardForm`,
  além de um fluxo de edição (`EditCardModal.tsx` + `CardList.tsx`, que
  estava morto e foi revivido).
- Feedback visual (toasts) — `components/ui/ToastProvider.tsx`, plugado em
  transações, parcelamentos, cartões, registro e logout.

### Média prioridade (PR atual — `feature/recurring-transaction-due-day`)
- Vencimento em despesas recorrentes: `TransactionForm.tsx` e
  `EditTransactionModal.tsx` ganharam um campo "Dia de vencimento" quando a
  transação é recorrente (coluna `due_day` adicionada à tabela
  `transactions` via migration); `TransactionList.tsx` exibe o dia junto do
  ícone 🔁.
- **Bug real encontrado e corrigido durante o teste end-to-end desta
  feature**: `copyRecurringTransactions()` (em `transaction.service.ts`)
  fazia `.upsert(payload, { onConflict: 'month_id,category,user_id' })`,
  mas não existe (e não deveria existir — categorias se repetem entre
  transações do mesmo mês) nenhuma constraint única nessas colunas. Isso
  fazia a cópia de recorrentes para o mês novo falhar com
  `42P10 (no unique or exclusion constraint matching the ON CONFLICT
  specification)` sempre que havia ao menos uma transação recorrente —
  ou seja, **criar um novo mês com recorrências configuradas estava
  quebrado em produção antes desta correção**. Trocado para `.insert()`
  simples; validado de ponta a ponta contra o banco real (criar
  recorrente com vencimento → copiar para o mês seguinte → vencimento
  preservado).
- Botão de voltar para o login na tela de cadastro (`app/register/page.tsx`).
- Clareza do campo de dia de fechamento do cartão — resolvido como parte do
  trabalho de campos de cartão do PR #47 (labels adicionados a todos os
  campos do formulário).

### Infraestrutura
- Deploy: aplicação publicada em produção na Vercel —
  https://zerosheet-finance.vercel.app (projeto `zerosheet-finance`,
  conectado ao repositório GitHub, branch de produção `develop`). Env vars
  `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` configuradas.

### Já resolvidos antes desta revisão (ver CONTEXT.md §5)
- Bug de matching cartão↔fatura no Dashboard (`card_id` em vez de `slug`).
- Duplicação de `normalizeCategory()`.
- `core/engine/installments.ts` como placeholder não usado.
- Falta de CI (`.github/workflows/ci.yml`).
- "Atualização manual do valor do cartão não está mais disponível" — a
  premissa estava errada, o campo nunca saiu do ar.
