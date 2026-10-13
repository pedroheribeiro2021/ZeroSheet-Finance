# CONTEXT.md — ZeroSheet Finance

Este documento existe para dar contexto rápido sobre o projeto a qualquer
pessoa (ou agente) que vá trabalhar no código: o que o app faz, como está
organizado e em que ponto o desenvolvimento se encontra. Não documenta API
pública nem decisões de arquitetura definitivas — é um mapa do estado atual.

## 1. O que é o projeto

ZeroSheet Finance é um app de finanças pessoais "baseado em lógica de
planilha": cada usuário tem **meses**, e dentro de cada mês há **transações**
(receitas/despesas), **cartões de crédito** com fatura mensal (snapshot),
**parcelamentos** e uma divisão do orçamento em **semanas**. O dashboard
agrega tudo isso num resumo financeiro do mês.

É multiusuário, com autenticação e isolamento de dados via Supabase
(Auth + Postgres com RLS).

## 2. Stack

- **Next.js 16.2.4** (App Router) — ⚠️ ver `AGENTS.md`: esta versão tem
  breaking changes em relação ao Next.js "clássico"; consultar
  `node_modules/next/dist/docs/` antes de usar APIs do framework.
- **React 19.2.4**
- **Tailwind CSS 4**
- **Supabase** (`@supabase/supabase-js`) — Postgres + Auth + RLS, já em uso
  (não é mais "em breve")
- **Vitest 4** + Testing Library + jsdom — já configurado e em uso
- **TypeScript 5** (modo `strict`)
- ESLint 9 + Prettier

Variáveis de ambiente esperadas em `.env.local` (não commitado):
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## 3. Estrutura de pastas

```
app/                          Rotas (Next.js App Router) — páginas finas que montam components/*
  dashboard/  transactions/  installments/  cards/  accounts/  settings/
  login/  register/  forgot-password/  reset-password/
  layout.tsx, manifest.ts     Root layout (LayoutShell) + manifest PWA

components/
  dashboard/                  Dashboard.tsx (tela principal), WeeklyBarChart, CategoryBarChart,
                              DueDatesPanel (vencimentos), InsightsPanel
  transactions/               TransactionForm, TransactionList, TransactionsView,
                              CategoryField (seletor de categoria padrão + do usuário)
  installments/               InstallmentForm/List/View
  cards/                      CardForm/List, CardsView, CardSnapshotForm (fatura),
                              CardReadingsList (leituras do ciclo), PendingInvoiceForm
  accounts/                   Contas (saldo) e transferências
  settings/                   SettingsView, PaydayForm (dia do salário), ChangePasswordForm
  modals/                     Edit{Transaction,Installment,Card,Account}Modal
  layout/                     LayoutShell (guarda de rota + sessão), Sidebar, Topbar
  ui/                         Card, Modal, MonthSelect, PageLoading, ToastProvider

core/
  services/                   Toda a comunicação com Supabase (uma por tabela/domínio)
  engine/                     Funções puras (sem I/O) — onde ficam as regras de negócio:
    calculations.ts            calculateSummary(): saldo do mês, envelopes de provisão, cartões, parcelas
    cycleSpend.ts              Gasto livre por semana do ciclo da fatura (leituras − cobranças conhecidas)
    weekly.ts                  Ciclo da fatura, semanas restantes, orçamento da semana
    categories.ts              Opções do seletor de categoria (padrão + histórico do usuário)
    coverage.ts / payday.ts    "Cobertura até o salário" e resolução do dia do salário
    dueDates.ts / invoices.ts  Vencimentos e faturas
    accounts.ts, insights.ts, month.ts, recurrence.ts, installments.ts, split.ts
  hooks/useActiveMonth.ts     Mês ativo compartilhado entre as telas
  models/mappers.ts           DB (snake_case) → domínio (camelCase)
  types/                      database.ts (tabelas) e finance.ts (domínio)
  constants/categories.ts     Categorias padrão por tipo de lançamento
  utils/                      normalize, number, groupTransactions

lib/                          Client Supabase + helpers de auth
supabase/migrations/          SQL versionado (aplicado manualmente — ver §7)
supabase/functions/           Edge function send-due-notifications (push de vencimentos)
tests/engine/, tests/services/  Vitest
```

### Modelo de dados (Supabase / Postgres, RLS por `user_id` em todas as tabelas)

- `months` (month, year)
- `transactions` (month_id, type, category, description, amount, card, is_fixed, is_provision,
  is_recurring, due_day, recurring_until, is_reimbursement, is_reserve, paid_at, skipped)
  - `is_reimbursement`: em **entrada** marca reembolso; em **despesa no cartão** marca
    compra que será reembolsada (fora do gasto livre da semana).
- `cards` (name, slug, color, limit_amount, closing_day, due_day, is_primary)
- `card_snapshots` (month_id, card_id, amount, paid_at) — fatura fechada do cartão no mês
- `card_readings` (month_id, card_id, amount, read_at) — leituras parciais da fatura (gasto semanal)
- `installments` (description, card_id, total_amount, installment_amount, total_installments,
  current_installment, start_month_id, billing_day)
- `accounts`, `account_readings`, `transfers` — contas e movimentações entre elas
- `user_settings` (payday_mode, payday_day), `push_subscriptions`, `weeks` (orçamento semanal congelado)

## 4. Fluxo de autenticação e navegação

- Supabase Auth (email/senha), com cadastro, "esqueci a senha" e troca de senha.
- `LayoutShell` é a guarda de rota: sem sessão, redireciona para `/login`; esconde
  sidebar/topbar nas telas de auth. O topbar mostra o nome do usuário.
- Sidebar: Dashboard, Transações, Parcelamentos, Cartões, Contas, Configurações.
- Services chamam `getCurrentUser()` e filtram por `user_id`; a RLS no banco é a
  barreira final (políticas "allow all" removidas em 2026-09-09).

## 5. Estado atual do desenvolvimento

Branch base: `develop` (deploy automático na Vercel em
https://zerosheet-finance.vercel.app). Todo trabalho vai por branch + PR para
`develop`; `main` recebe merges a partir dela.

### Principais regras de negócio (detalhes nos comentários de `core/engine/*`)
- **Saldo do mês** (`calculateSummary`): entradas − fixos − cartões (fatura ou gasto
  pendente) − envelopes de provisão (maior entre planejado e realizado) − parcelas −
  reserva. Reembolso soma nas entradas e anula a despesa que cobre.
- **Acompanhamento semanal**: semanas do ciclo da fatura do cartão principal; gasto
  da semana = quanto a fatura subiu entre leituras, menos cobranças já comprometidas
  (parcelas na virada, assinaturas no dia da renovação, provisões até o teto, despesas
  reembolsáveis na primeira leitura após a compra). Orçamento semanal = saldo ÷
  semanas restantes; semana em curso compara com o recalculado, semana fechada com o
  congelado.
- **Categorias**: padrão + as que o usuário já usou (derivadas do histórico, sem tabela).
- Vencimentos com "pago", push (Web Push/VAPID), cobertura até o salário, contas e
  transferências, virada de mês com cópia de recorrentes.

### Qualidade
- CI (`.github/workflows/ci.yml`): `tsc --noEmit`, `vitest run`, lint e `next build`.
- 31 arquivos de teste / 355 testes (2026-10-13), concentrados em `core/engine/*`
  com contratos de meses reais (`july-2026`, `agosto-2026`).

### Inconsistências conhecidas
- Tipagem solta (`any`) em `Dashboard.tsx` e em alguns services/componentes.
- Componentes e hooks sem teste; services só `month` e `transaction`.
- `Dashboard.tsx` concentra muita orquestração (~76 KB).
- Pendências de produto: ver `TODO.md` (seção "Pendentes").

### Histórico recente (mais novo primeiro)
- 2026-10-13 PR #95 — despesa reembolsável fora do gasto livre + categorias do usuário.
- 2026-09-15 PR #94 — provisão descontada do gasto semanal; orçamento recalculado na semana atual.
- 2026-09-09 PRs #87–#93 — RLS sem "allow all", troca/recuperação de senha, guarda de
  rota/logout, ajustes de fatura e nome no topbar.
- 2026-08 PRs #79–#85 — virada de mês, vencimento da fatura, ciclo da fatura, semanas restantes.
- 2026-07 PRs #55–#78 — loop semanal, push, vencimentos, contas, cobertura até o salário.

O registro detalhado de cada sessão fica em `TODO.md` ("Feitos em …").

## 6. Como rodar

```bash
npm install
npm run dev          # http://localhost:3000
npm run lint
npm test              # vitest
npm run test:watch
npm run test:coverage
npm run build && npm start
```

Requer um projeto Supabase com as tabelas do §3 e RLS por `user_id`, mais as
variáveis em `.env.local` (§2).

## 7. Migrations

Arquivos em `supabase/migrations/`, aplicados manualmente no projeto Supabase.
**Todas aplicadas em produção** (conferido em 2026-10-13 via MCP do Supabase:
colunas `is_primary`, `billing_day`, `card_snapshots.paid_at`, tabelas de contas,
`user_settings`, `push_subscriptions` e nenhuma política "allow all" restante).
