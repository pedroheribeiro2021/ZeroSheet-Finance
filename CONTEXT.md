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
app/                          Rotas (Next.js App Router)
  page.tsx                    "/" → redirect para /dashboard
  layout.tsx                  Root layout, monta <LayoutShell>
  login/page.tsx               Tela de login
  register/page.tsx            Tela de cadastro
  dashboard/page.tsx            Wrapper fino → components/dashboard/Dashboard
  transactions/page.tsx         CRUD de transações
  installments/page.tsx         CRUD de parcelamentos
  cards/page.tsx                 Cadastro de cartões + lançamento de fatura (snapshot)
  globals.css

components/
  dashboard/Dashboard.tsx       Tela principal: busca dados, calcula resumo, renderiza cards/semanas/modal
  transactions/
    TransactionForm.tsx
    TransactionList.tsx
  installments/
    InstallmentForm.tsx
    InstallmentList.tsx
  cards/
    CardForm.tsx                Criar/editar cartão (nome, slug, cor, limite, dia de fechamento/vencimento)
    CardList.tsx
    CardSnapshotForm.tsx         Lançar valor da fatura do mês para um cartão
  layout/
    LayoutShell.tsx              Decide se mostra sidebar/topbar (oculto em /login e /register)
    Sidebar.tsx                  Navegação principal + logout
    Topbar.tsx
  modals/
    EditTransactionModal.tsx
  ui/
    Card.tsx                     Card de métrica clicável (usado no dashboard)
    Modal.tsx

core/                          Camada de domínio (services, regras de negócio, tipos)
  services/                    Toda a comunicação com Supabase vive aqui
    auth.service.ts             getCurrentUser()
    month.service.ts            getMonths/createMonth (cria mês e copia transações recorrentes do mês anterior)
    transaction.service.ts      CRUD de transações + copyRecurringTransactions
    week.service.ts             CRUD de semanas (orçamento semanal por mês)
    card.service.ts             CRUD de cartões (tabela `cards`, dinâmica por usuário)
    cardSnapshot.service.ts     Upsert/get de fatura do cartão no mês (tabela `card_snapshots`, FK `card_id`)
    installment.service.ts      CRUD de parcelamentos + filtro de parcelas ativas no mês
  engine/                      Funções puras de cálculo (sem I/O), são as mais testáveis
    calculations.ts             calculateSummary() — agrega receitas, custos fixos, provisões, cartões, parcelas
    weekly.ts                   calculateWeekly() — divide o orçamento do mês em semanas (snapshots > transações)
    installments.ts             getInstallmentsForMonth() — ⚠️ placeholder simplificado, não é o usado em produção
  models/
    mappers.ts                  Converte tipos DB (snake_case) → tipos de domínio (camelCase)
  types/
    database.ts                  Tipos das tabelas Supabase (DBTransaction, DBMonth, DBWeek)
    finance.ts                    Tipos de domínio (Transaction, Week, CardSnapshot)
  utils/
    normalize.ts / category.ts    normalizeCategory() — duplicada em dois arquivos (ver §5)
    groupTransactions.ts          Agrupa transações por categoria com total/contagem
    number.ts                     toCurrency() etc.
  constants/
    categories.ts                 DEFAULT_CATEGORIES (lista estática curta)
  auth/
    getUser.ts                    Helper de auth (ver duplicação com lib/auth.ts em §5)

lib/
  supabase.ts                   Client Supabase (browser, usa env vars públicas)
  auth.ts                       signIn/signOut/getUser/getCurrentUserId

tests/
  engine/calculations.test.ts   Único arquivo de teste hoje — cobre calculateSummary()
```

### Modelo de dados (Supabase / Postgres, todas as tabelas com RLS por `user_id`)

- `months` (month, year, user_id)
- `weeks` (month_id, index, budget, spent, remaining)
- `transactions` (month_id, type, category, amount, is_fixed, is_provision, is_recurring, card)
- `cards` (name, slug, color, limit_amount, closing_day, due_day, user_id)
- `card_snapshots` (month_id, card_id, amount, user_id) — fatura do cartão naquele mês
- `installments` (description, card_id, total_amount, installment_amount, total_installments, current_installment, start_month_id, user_id)

## 4. Fluxo de autenticação e navegação

- Supabase Auth (email/senha) via `lib/auth.ts` e `core/services/auth.service.ts`.
- `LayoutShell` esconde sidebar/topbar em `/login` e `/register`; nas demais
  rotas mostra `Sidebar` (Dashboard, Transações, Parcelamentos, Cartões) e
  `Topbar`.
- Logout é feito direto na `Sidebar` (`supabase.auth.signOut()` + redirect).
- Cada service de domínio chama `getCurrentUser()` e lança erro
  `'Usuário não autenticado'` se não houver sessão — não há um guard central
  de rota (proteção acontece a nível de chamada de dados + RLS no banco).

## 5. Estado atual do desenvolvimento

Branch atual: `develop` (sincronizada com `origin/develop`; é a branch base
para as `feature/*` — `main` recebe merges a partir dela).

### O que está pronto e funcionando
- Autenticação multiusuário (login/registro) com isolamento de dados por RLS.
- CRUD completo de transações, parcelamentos e cartões.
- Cartões e suas faturas (`card_snapshots`) usam a tabela dinâmica `cards` por
  usuário (sem mais valores mockados/hardcoded de Nubank, C6 etc.).
- **Bug de matching cartão↔fatura corrigido**: `Dashboard.tsx` agora casa
  snapshot e cartão via `snapshot.card_id === card.id`, igual ao resto do app
  (`fix(cards): match card snapshots by card_id instead of legacy slug`).
- Dashboard agrega receitas, custos fixos, provisões (planejado vs. realizado),
  gasto em cartões e parcelas, e quebra o orçamento do mês em semanas.
- Recorrência: ao criar um novo mês, transações marcadas `is_recurring` são
  copiadas automaticamente do mês anterior (sem suporte a dia de vencimento —
  ver TODO.md).
- `core/engine/installments.ts` deixou de ser placeholder: agora exporta
  `filterActiveInstallments()`, função pura testada
  (`tests/engine/installments.test.ts`) e efetivamente usada por
  `core/services/installment.service.ts:getInstallments`.
- `core/utils/category.ts` (duplicata de `normalizeCategory`) e o código morto
  de `core/models/mappers.ts` foram removidos
  (`chore: remove dead code left from cards normalization migration`).
- CI configurado em `.github/workflows/ci.yml`: typecheck (`tsc --noEmit`),
  `vitest run`, lint (`continue-on-error: true`) e `next build` em PRs/pushes
  para `develop` e `main`.
- Cobertura de testes ampliada: 3 arquivos / 12 testes
  (`calculations.test.ts`, `weekly.test.ts`, `installments.test.ts`) —
  confirmado rodando localmente (`npx vitest run` → 12 passed) e
  `npx tsc --noEmit` limpo.

### Trabalho em andamento / inconsistências conhecidas
- Tipagem solta: `any[]`/`any` ainda generalizado em `Dashboard.tsx`,
  `transaction.service.ts`, `week.service.ts`, `groupTransactions.ts` e na
  maioria dos componentes (`TransactionForm`, `InstallmentForm`,
  `InstallmentList`, `CardList`, `CardSnapshotForm`, `Modal`, `Card` etc.).
  Várias dessas áreas têm
  `/* eslint-disable @typescript-eslint/no-explicit-any */` no topo do
  arquivo — não houve progresso aqui desde a última revisão.
- Cobertura de testes ainda é só de `core/engine/*` (funções puras) — services,
  hooks e componentes continuam sem teste.
- `components/cards/CardList.tsx` não é importado em lugar nenhum
  (`app/cards/page.tsx` renderiza a lista de cartões inline) — candidato a
  remoção ou a voltar a ser usado.
- `CardForm.tsx` (criação de cartão) só coleta `name` e `closing_day`, embora
  `cards` (tabela e `card.service.ts`) já suportem `due_day`, `color` e
  `limit_amount` — esses campos não têm UI nenhuma para serem definidos, e não
  existe formulário de edição de cartão (só criar e remover). Ver TODO.md.
- Bug de sessão confirmado por leitura de código: `LayoutShell.tsx` busca o
  usuário atual uma única vez em `useEffect(..., [])`, sem listener
  `supabase.auth.onAuthStateChange`. Trocar de conta na mesma aba sem recarregar
  a página não atualiza o e-mail exibido na Topbar. Ver TODO.md.
- Não há sistema de toast/notificação (`alert()`/`console.error` ainda é o
  feedback usado em `CardForm`, `CardSnapshotForm`, `RegisterPage` etc.).
- Não há arquivo `vercel.json`/`netlify.toml`/`.vercel` no repo — não é
  possível confirmar pela árvore de arquivos se existe um ambiente publicado;
  isso só é verificável no painel do provedor de hosting.

### Histórico recente (mais novo primeiro, a partir do que o CONTEXT.md anterior já cobria)
refactor: extrai filtro de parcelas ativas para `core/engine` → chore: workflow
de CI (typecheck/test/build) → chore: remoção de código morto da normalização
de cartões → fix: teste de `calculateSummary` defasado + bug de fallback em
`calculateWeekly` → fix: matching de fatura por `card_id` em vez do `slug`
legado → docs: CONTEXT.md inicial → normalização de relações de cartão →
cartões dinâmicos por usuário (substituindo hardcode) → parcelamentos
migrados para cartões dinâmicos.

Há muitas outras branches `feature/*` antigas no repositório remoto que já
foram incorporadas via merge e podem ser candidatas a limpeza
(`git branch -a` lista ~35 branches feature, a maioria provavelmente obsoleta).

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

Requer um projeto Supabase configurado com as tabelas do §3 e RLS habilitada
por `user_id`, mais as variáveis em `.env.local` (§2).
