# PROMPT — Controle de vencimento das despesas fixas (calendário + lembrete + push)

Cole o texto abaixo no Claude Code. Ele já assume o padrão do repo
(Next.js custom em `node_modules/next/dist/docs/`, engine puro em
`core/engine/`, services em `core/services/`, migrations em
`supabase/migrations/`, testes com Vitest em `tests/`).

---

Implemente a feature "Controle de vencimento das despesas fixas" descrita no
topo de `TODO.md` (Pendentes › Produto). Antes de escrever qualquer código,
leia `AGENTS.md`, `CONTEXT.md` e a doc relevante em `node_modules/next/dist/docs/`
(esta versão do Next tem breaking changes — não confie na memória).

## Contexto do que já existe (não reinventar)
- A data de vencimento já é modelada: `Transaction.dueDay` em
  `core/types/finance.ts`, coluna `transactions.due_day` (migration
  `20260703_01`... na verdade veio no PR #48), propagada na virada do mês por
  `core/engine/recurrence.ts` / `core/services/month.service.ts`.
- Despesas fixas/recorrentes têm flags `isFixed` / `isRecurring` / `isProvision`.
- Dashboard: `components/dashboard/Dashboard.tsx`. Services de transação:
  `core/services/transaction.service.ts`. Cliente Supabase: `lib/supabase.ts`.
- Categorias em `core/constants/categories.ts`; normalização em
  `core/utils/normalize.ts`; Toasts em `components/ui/ToastProvider.tsx`.

## Objetivo (dois usos)
1. **Gerencial** — ver os vencimentos por data e uma lista de "despesas a vencer".
2. **Lembrete** — avisar o que vence HOJE (in-app e, se possível, push).

## Entregar em passos, cada um com teste

### Passo 1 — Engine puro (sem I/O, 100% testável)
Crie `core/engine/dueDates.ts` com funções puras que, dado o mês corrente
(month/year) e a lista de transações, resolvem para cada despesa com `dueDay`
a data de vencimento no mês e classificam o status:
- `resolveDueDate(dueDay, year, month)` → `Date` (clamp para o último dia do mês
  quando `dueDay` > dias do mês, ex.: dia 31 em fevereiro).
- `classifyDueStatus(dueDate, today)` → `'overdue' | 'today' | 'upcoming' | 'paid'`
  (o `paid` vem de fora; ver Passo 2).
- `getDueItems(transactions, today, { horizonDays })` → lista ordenada por data
  com `{ transaction, dueDate, status, daysUntil }`, considerando só despesas
  (`type === 'expense'`) fixas/recorrentes com `dueDay` definido.
Escreva `tests/engine/due-dates.test.ts` cobrindo: dia clampado, hoje, atrasado,
próximos N dias, e transação sem `dueDay` ignorada. Rode `npm test`.

### Passo 2 — "Pago" (migration + service)
Adicione a noção de pagamento do vencimento do mês. Preferir coluna nova
`transactions.paid_at timestamptz null` (nada de reaproveitar flag de outra
semântica). Crie a migration em `supabase/migrations/` seguindo a nomenclatura
`AAAAMMDD_NN_...sql`, atualize `core/types/finance.ts` (`paidAt?: string | null`),
o mapper em `core/models/mappers.ts` e um método
`markTransactionPaid(id, paidAt)` / `unmark` em `transaction.service.ts`.
NÃO aplique a migration em produção sem eu confirmar — deixe-a pronta e me avise.

### Passo 3 — UI gerencial no dashboard
Novo componente `components/dashboard/DueDatesPanel.tsx`, plugado no
`Dashboard.tsx`:
- Lista "A vencer" agrupada por status (Vence hoje / Próximos 7 dias / Vencido /
  Pago), com descrição, categoria (chip), valor e o dia do vencimento.
- Botão "marcar como pago" por item (usa Passo 2 + Toast).
- Uma visão calendário/agenda simples do mês destacando o dia de hoje e os dias
  com vencimento (pode ser grade de dias, sem lib externa nova de calendário).
Reaproveite estilos de `components/ui/Card.tsx` e o padrão dos cards existentes.

### Passo 4 — Lembrete in-app (fallback sem push)
Ao abrir o dashboard, se houver item com status `today`, mostrar um aviso/badge
(Toast ou banner). Este passo não depende de push e deve funcionar sozinho.

### Passo 5 — Notificações push (Web Push)
Só depois dos passos acima funcionando:
- Service worker em `public/` + registro no client; pedir permissão de
  notificação a partir de um botão explícito (não no load).
- Web Push com VAPID: nova tabela `push_subscriptions` (migration, user_id +
  subscription json), service para salvar/remover subscription, chaves VAPID em
  env vars (documente em `.env.local` quais adicionar — NÃO commitar segredos).
- Disparo diário: Supabase Edge Function agendada (cron) que lê os `due_day` do
  dia e envia push para as subscriptions do usuário. Deixe a função e o SQL do
  agendamento prontos; me diga o comando/passo para eu ativar em produção.
- Documente no `TODO.md` o que ficou pronto e o que depende de eu aplicar
  migration/ativar cron/definir VAPID.

## Regras
- Um passo por vez; rode `npm test` e o typecheck a cada passo.
- Não aplique migrations nem toque em produção sem minha confirmação explícita.
- Ao terminar, atualize `TODO.md`: mova o item para "Feitos" com o que foi
  implementado e deixe explícito o que ainda depende de mim (migrations, VAPID,
  cron).

## Git — Conventional Commits, branches e commits (obrigatório)
- **Uma branch por passo/tarefa**, a partir da branch de trabalho atual:
  `feat/<slug>` para funcionalidade, `fix/<slug>` para correção,
  `refactor/<slug>`, `docs/<slug>`, `chore/<slug>`, `test/<slug>`.
  Ex.: `feat/due-dates-engine`, `feat/due-dates-panel`, `feat/push-notifications`.
- **Commits no padrão Conventional Commits**: `tipo(escopo): descrição no
  imperativo`. Tipos: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`,
  `style`. Escopo = domínio (`dueDates`, `dashboard`, `transactions`, `push`,
  `db`, `ui`, `docs`). Um commit por unidade lógica; não amontoe passos.
  - Ex.: `feat(dueDates): engine puro de vencimento com status por data`
  - Ex.: `feat(db): coluna paid_at em transactions (migration)`
  - Ex.: `feat(dashboard): painel A vencer com marcar como pago`
  - Ex.: `test(dueDates): cobrir clamp de dia, hoje, atrasado e próximos`
- Commits **pequenos e frequentes** (o repo está no OneDrive — risco de truncar
  arquivo em sync; commitar cedo protege o trabalho).
- Não faça merge na branch de produção; ao final de cada passo me avise para eu
  revisar/abrir PR.
