# PROMPT — Contas (saldo em conta corrente) + Complementos entre contas

Copie tudo abaixo da linha e cole no Claude Code (terminal do VSCode), na raiz do repo.

---

Implemente a feature **"Contas & Complementos"** no ZeroSheet Finance. Leia `CONTEXT.md` e `AGENTS.md` antes (Next.js 16 App Router tem breaking changes — consulte `node_modules/next/dist/docs/` se precisar de API do framework). Siga as convenções existentes: services com I/O em `core/services/`, funções puras em `core/engine/`, tipos DB (snake_case) em `core/types/database.ts`, tipos de domínio (camelCase) em `core/types/finance.ts`, conversão em `core/models/mappers.ts`, RLS por `user_id`, comentários em pt-BR. Use como referência os padrões já implementados de `card_readings`/`cardReading.service.ts` (leituras), `paid_at` (contas pagas) e `skipped` (pausar mês).

## Objetivo

1. O usuário informa manualmente o saldo de cada conta bancária (como já faz com a leitura de fatura) e o dashboard mostra a composição projetada: saldo informado − contas a pagar em aberto − faturas em aberto − devoluções pendentes = sobra livre. Finalidade: não precisar abrir o app do banco pra saber o saldo.
2. Controlar "complementos": empréstimos entre contas próprias (ex.: pegar 1.055,48 do Nubank Guardado em 10/07 para pagar a fatura no C6 antes do salário do dia 15, e devolver depois). Complemento cria pendência de devolução; devolução vinculada quita. **Transferência entre contas NÃO é receita nem despesa** — não pode alterar nenhum número de `calculateSummary` (saldo do mês, envelopes, fixos etc.). Só afeta a visão de contas.

## 1. Migrations (criar em `supabase/migrations/`, não aplicar — aplico via MCP depois)

`20260721_01_accounts.sql`:

```sql
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('corrente', 'guardado')),
  color text null,
  -- conta de onde saem os pagamentos por padrão (projeção do dashboard)
  is_payment_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.account_readings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  amount numeric not null,
  read_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
```

`20260721_02_transfers.sql`:

```sql
create table public.transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  from_account_id uuid not null references public.accounts(id),
  to_account_id uuid not null references public.accounts(id),
  amount numeric not null check (amount > 0),
  -- complemento = empréstimo entre contas próprias (gera pendência de devolução)
  -- devolucao   = quita (total ou parcialmente) um complemento, via linked_transfer_id
  -- movimentacao = transferência comum, sem pendência
  kind text not null check (kind in ('complemento', 'devolucao', 'movimentacao')),
  linked_transfer_id uuid null references public.transfers(id),
  note text null,
  transferred_at date not null default current_date,
  created_at timestamptz not null default now()
);
```

Nas duas migrations: habilitar RLS e criar policies de owner (select/insert/update/delete com `auth.uid() = user_id`), no mesmo padrão da migration `20260629_02_card_readings.sql`.

## 2. Tipos + mappers

- `DBAccount`, `DBAccountReading`, `DBTransfer` em `core/types/database.ts`.
- `Account`, `AccountReading`, `Transfer` em `core/types/finance.ts` (camelCase).
- Mappers correspondentes em `core/models/mappers.ts`.

## 3. Engine (funções puras + testes)

Criar `core/engine/accounts.ts`:

- `latestReadingByAccount(readings: AccountReading[]): Map<accountId, AccountReading>` — leitura mais recente por conta (por `read_at`).
- `pendingReturns(transfers: Transfer[]): { toAccountId (conta a devolver, = from do complemento), amount, complementId }[]` — para cada `complemento`, soma as `devolucao` com `linked_transfer_id` apontando pra ele e retorna o que falta devolver (nunca negativo; quitações parciais são válidas; complemento quitado não aparece).
- `projectBalance(input): { lines, projected }` — recebe a leitura da conta de pagamento e listas já filtradas de: contas a pagar em aberto (`{label, amount, dueDay}`), faturas em aberto (`{label, amount}`) e devoluções pendentes; retorna as linhas da composição (na ordem: leitura, contas, faturas, devoluções) e o valor final projetado.
- `reconcile(projected: number, newReading: number): number` — diferença (novo − projetado), pra UI avisar "R$ X fora do radar".

Testes em `tests/engine/accounts.test.ts` cobrindo: leitura mais recente; complemento sem devolução (pendência cheia); devolução parcial (ex.: complemento 1.055,48, devolveu 500 → pende 555,48); devolução total (some); projeção com o cenário real de julho/2026 (leitura C6 + contas não pagas + fatura em aberto + devolução pendente de 1.055,48); reconcile positivo/negativo.

**Não altere `calculateSummary`** — nenhum número mensal muda com esta feature. Adicione um teste garantindo isso se fizer sentido estrutural (transfers nem chegam ao summary).

## 4. Services

- `core/services/account.service.ts`: `getAccounts()`, `createAccount()`, `updateAccount()`, `deleteAccount()`, `getAccountReadings(accountId?)`, `addAccountReading(accountId, amount, readAt?)`, `deleteAccountReading(id)`.
- `core/services/transfer.service.ts`: `getTransfers()`, `createTransfer({ fromAccountId, toAccountId, amount, kind, linkedTransferId?, note?, transferredAt? })`, `deleteTransfer(id)`.
- Mesmo padrão dos services existentes: `getCurrentUser()` + erro `'Usuário não autenticado'`.

## 5. UI

**Página nova `/accounts` ("Contas")**, no padrão visual das existentes (`surface`, `field`, `btn-*`), com item novo na `Sidebar`:

- CRUD de contas (nome, tipo corrente/guardado, cor, toggle "conta de pagamento" — só uma pode ser default; ao marcar, desmarca a anterior, como o ★ do cartão principal).
- Lançar leitura de saldo por conta (valor + data, default agora) e histórico de leituras com remover — espelhar a UX do histórico de leituras de fatura do Dashboard.
- Lançar transferência: origem, destino, valor, tipo (complemento / devolução / movimentação), observação. Ao escolher "devolução", mostrar select dos complementos em aberto para vincular (exibindo quanto falta de cada um). Lista das transferências do mês com badge por tipo e "falta devolver R$ X" nos complementos abertos.

**Dashboard — card novo "Contas"** (grid dos cards, `onClick` abre modal como os demais):

- Valor principal: saldo projetado da conta de pagamento default.
- Subtítulo: composição resumida (ex.: "C6 3.412 · Nu Guardado 28.400 · devolver 1.055") — truncar com bom senso.
- Modal: uma linha por conta com última leitura e data ("C6 Corrente — R$ 3.412,00 · lida em 17/07"); bloco de projeção da conta default linha a linha (leitura → cada conta a pagar em aberto → cada fatura em aberto → devoluções pendentes → **sobra projetada**); bloco "Complementos em aberto" com "Devolver p/ {conta}: R$ X".
- Insumos da projeção (dados que o Dashboard já carrega): transações `expense` com `due_day`, `paid_at` null, `!skipped` e sem `card`; `card_snapshots` com `paid_at` null (valor da fatura); pendências de `pendingReturns`.
- Conciliação: no form de leitura (página Contas), se existir projeção anterior para aquela conta, mostrar aviso não bloqueante com o `reconcile` ("R$ 34,00 fora do radar desde a última leitura").

## 6. Qualidade

- TypeScript estrito, sem `any` novo.
- Rodar `npx tsc --noEmit` e `npx vitest run` — tudo verde (hoje: 10+ arquivos de teste passando; não quebrar nenhum).
- Commit sugerido:

```
feat(accounts): saldo em conta com projeção + complementos entre contas

- accounts/account_readings: leitura manual de saldo por conta (RLS owner)
- transfers: complemento gera pendência de devolução; devolução vinculada
  quita (parcial ou total); movimentação comum sem pendência
- engine accounts.ts: latestReadingByAccount, pendingReturns,
  projectBalance (saldo − contas a pagar − faturas − devoluções) e
  reconcile — funções puras testadas
- página /accounts: CRUD de contas, leituras e transferências
- dashboard: card Contas com saldo projetado, composição e pendências
- transferências não tocam calculateSummary (não são receita/despesa)
```

## Critério de aceite (cenário real)

1. Criar contas: C6 Corrente (pagamento default), C6 Guardado, Nubank Corrente, Nubank Guardado.
2. Lançar leitura do C6 Corrente.
3. Lançar complemento Nubank Guardado → C6 Corrente de 1.055,48 em 10/07 → card mostra "Devolver p/ Nubank Guardado: 1.055,48" e a projeção do C6 desconta esse valor.
4. Lançar devolução vinculada de 1.055,48 em 15/07 → pendência some.
5. Saldo do Mês, envelopes e acompanhamento semanal: exatamente os mesmos valores de antes da feature.
