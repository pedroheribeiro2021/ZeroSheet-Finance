# TODO — Zerosheet (itens ainda não realizados)

Revisão feita em 2026-06-24 contra o estado atual do código (branch
`develop`, sincronizada com `origin/develop`). Itens do TODO original que já
estavam implementados foram removidos desta lista — ver CONTEXT.md §5 para o
que mudou desde a última revisão. Status de cada item confirmado por leitura
de código, `npx tsc --noEmit`, `npx vitest run` e smoke test das rotas
(`/login`, `/register`, `/dashboard`, `/transactions`, `/installments`,
`/cards` respondendo 200 no dev server).

## Funcionalidades

### Despesas recorrentes (boletos)
- [ ] Implementar opção de definir a **data de vencimento** em despesas
      recorrentes. `TransactionForm.tsx` só tem o toggle `isRecurring`, sem
      campo de dia/data de vencimento.
- [ ] Permitir que boletos recorrentes sejam gerados automaticamente
      considerando o vencimento configurado. `month.service.ts` hoje só copia
      transações `is_recurring` do mês anterior sem ajustar data de
      vencimento.

### Cartões de crédito
- [ ] Adicionar campo de **dia de vencimento** (`due_day`) no formulário de
      criação de cartão (`CardForm.tsx`). O campo já existe na tabela `cards`
      e em `card.service.ts`, e já é exibido em `app/cards/page.tsx`/
      `CardList.tsx` — falta só a UI para definir/editar.
- [ ] Adicionar campos de **cor** (`color`) e **limite** (`limit_amount`) no
      formulário de cartão — mesma situação do `due_day`: suportados no
      service, sem UI.
- [ ] Criar um formulário/fluxo de **edição** de cartão. Hoje só existe criar
      (`CardForm`) e remover (`CardList`/página de cartões); `updateCard()`
      em `card.service.ts` não é chamado em nenhum lugar da UI.
- [ ] Melhorar o campo de **dia de fechamento** do cartão, tornando-o mais
      claro para o usuário. Hoje é um `<input type="number">` sem label
      (`CardForm.tsx`), só identificável pelo contexto.

## Experiência do usuário (UX)

### Feedback visual
- [ ] Adicionar notificações (toast) após lançamentos, salvamentos,
      atualizações, exclusões e demais ações importantes. Não há nenhuma
      lib de toast no projeto; o feedback de erro atual é `alert()` /
      `console.error()` (`CardForm`, `CardSnapshotForm`, `RegisterPage`,
      `LoginPage` etc.).

### Autenticação
- [ ] Adicionar botão na tela de cadastro (`app/register/page.tsx`) para
      voltar à tela de login. Hoje só existe redirect automático para
      `/login` depois que a conta é criada com sucesso — não há como voltar
      antes disso.
- [ ] Corrigir o problema do usuário autenticado não atualizar ao trocar de
      conta sem recarregar a aplicação. Confirmado em código:
      `components/layout/LayoutShell.tsx` busca o usuário atual uma única vez
      em `useEffect(() => {...}, [])`, sem um listener de
      `supabase.auth.onAuthStateChange` — trocar de conta na mesma aba não
      atualiza o e-mail mostrado na Topbar.

## Correções

### Sessão do usuário
- [ ] Mesmo item da seção de autenticação acima — contexto de auth não é
      atualizado corretamente após troca de usuário sem reload.

## Infraestrutura

### Deploy
- [ ] Verificar se já existe ambiente publicado. Não há `vercel.json`,
      `netlify.toml` ou pasta `.vercel` no repositório, então isso **não é
      verificável a partir do código** — precisa ser checado direto no painel
      do provedor de hosting (Vercel/outro) ou perguntando à pessoa
      responsável pelo deploy.
- [ ] Se não existir: deploy do frontend, deploy do backend (se aplicável —
      hoje toda a lógica de servidor é Supabase, então "backend" aqui é
      essencialmente configurar o projeto Supabase de produção), validar
      variáveis de ambiente (`NEXT_PUBLIC_SUPABASE_URL`,
      `NEXT_PUBLIC_SUPABASE_ANON_KEY`), autenticação e conexão com o banco.

---

## Itens do TODO original já resolvidos (fora desta lista)

- "Reavaliar atualização manual do valor do cartão, pois o campo não está mais
  disponível" — **a premissa não é mais verdadeira**: `CardSnapshotForm.tsx`
  existe, está renderizado em `app/cards/page.tsx` e funciona (upsert de
  fatura por cartão/mês). A decisão formal de manter manual vs. tornar o
  cálculo automático ainda não foi tomada, mas o campo em si voltou.
- Bug de matching cartão↔fatura no Dashboard (`snapshot.card === card.slug`
  vs. `card_id`) — corrigido (`fix(cards): match card snapshots by card_id
  instead of legacy slug`).
- Duplicação de `normalizeCategory()` em `core/utils/category.ts` — arquivo
  removido.
- `core/engine/installments.ts` como placeholder não usado — refatorado para
  `filterActiveInstallments()` e agora é de fato usado por
  `installment.service.ts`.
- Falta de CI — workflow adicionado em `.github/workflows/ci.yml`.

## Prioridade sugerida (ajustada)

### Alta
- Corrigir atualização do usuário logado ao trocar de conta.
- Adicionar campos de cartão faltantes (`due_day`, `color`, `limit_amount`) +
  fluxo de edição.
- Adicionar feedback visual (toasts).

### Média
- Implementar vencimento em despesas recorrentes (campo + geração automática).
- Adicionar botão de voltar para login no Register.
- Melhorar clareza do campo de dia de fechamento do cartão.

### Baixa
- Verificar/decidir sobre deploy (depende de informação externa ao repo).
