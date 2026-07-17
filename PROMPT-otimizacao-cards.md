# Prompt para Claude Code — Otimização de cards do dashboard + filtros

> Cole tudo abaixo desta linha no Claude Code (terminal do VSCode), com o repo
> `zerosheet-finance` aberto na raiz.

---

Você vai trabalhar no ZeroSheet Finance (Next.js 16 + React 19 + Tailwind 4 +
Supabase). Leia `CONTEXT.md` e `TODO.md` antes de começar. Regras gerais:

- **Não altere o banco**: todas as migrations já estão aplicadas em produção.
  Nenhuma mudança desta tarefa exige schema novo.
- **Não quebre os testes de contrato**: `tests/engine/july-2026.test.ts` e
  `tests/engine/card-linked.test.ts` fixam o saldo de julho/2026 em
  **R$ 2.548,44** e o orçamento semanal em **R$ 509,69** (saldo ÷ 5 semanas do
  ciclo da fatura do C6, que fecha dia 4). Esses números não podem mudar.
- Ao final: `npx tsc --noEmit` limpo e `npx vitest run` 100% verde. Atualize
  `TODO.md` marcando o que foi feito.
- O usuário concentra os gastos no cartão de crédito principal (C6) e
  acompanha semanalmente pela variação da fatura. Reflita esse modelo mental.

## 1. Padrão de dashboard: menos cards, detalhe no clique

O dashboard (`components/dashboard/Dashboard.tsx`) tem cards demais. O padrão
deve ser: **um card enxuto por conceito; clicar abre o modal de detalhamento**
(já existe: `handleCardClick` + `Modal` com transações agrupadas). Aplicar:

- **Entradas — voltar a ser UM card só.** Remover os cards "Salário" e
  "Outras Entradas". O card único "Entradas" mostra `summary.totalIncome` e,
  no clique, lista TODAS as entradas individualmente (salário, extras,
  reembolsos — cada lançamento com descrição/categoria/valor), não apenas
  agrupadas por categoria. Se necessário, evolua o modal para listar
  transações individuais além do agrupamento.
- **Cartões — unificar em UM card.** Remover os cards individuais por cartão
  (`💳 Nubank`, `💳 C6`) e o card "Total Cartões". Um único card "Cartões"
  com `summary.cardSpending` (soma das faturas). No clique, mostrar o
  detalhamento por cartão: nome, fatura atual (snapshot), parcelas do mês no
  cartão, limite e disponível (limite − fatura) — os dados já são calculados
  hoje inline no map de cards; mova essa lógica para o conteúdo do modal.
- **Parcelamentos — trocar o card "Parcelamentos (fora da fatura)".** O
  usuário não vê utilidade em "fora da fatura". Substituir por um card
  "Parcelamentos" que mostra a soma das parcelas ATIVAS no mês (o mesmo
  dado do módulo Parcelamentos: `getInstallments(monthId)` →
  `installment_amount` somados). No clique, listar cada parcelamento como no
  módulo: descrição, parcela vigente (2/5), valor/mês, cartão, início e fim.
  Obs.: no cálculo do SALDO continua valendo a regra atual do engine (parcela
  de cartão com fatura lançada não soma de novo — não mexa em
  `calculateSummary` nesse ponto); o card é informativo/gerencial.
- **Enxugar o restante.** Manter apenas: Entradas, Custos Fixos, Cartões,
  Parcelamentos, Assinaturas, Reserva/Investimentos, Saldo do Mês e Orçamento
  Semanal. Os cards "Planejado (Provisões)" e "Gasto Real (Provisões)" saem —
  essa informação já está completa na seção "Provisões do mês (envelopes)"
  (mantenha a seção). Todo card que sobrar deve ser clicável e abrir seu
  detalhamento.

## 2. Controle Semanal — usar SÓ o cartão principal

Bug conceitual: o card "Semana 1" mostra Gasto R$ 1.123,77 = soma das DUAS
faturas (Nubank 407,07 + C6 716,70), porque `calculateWeekly` em
`core/engine/weekly.ts` distribui TODOS os snapshots por semana (bucket
`Math.ceil(dia/7)` do `created_at`), e ambos os snapshots foram criados na
semana 1.

Regra correta (o usuário já explicou várias vezes): **o acompanhamento
semanal é baseado puramente nos GASTOS do cartão de crédito principal**, não
em despesas nem em faturas somadas. O gasto da semana é o DELTA entre
leituras semanais da fatura do cartão principal (`card_readings`), que já
existe implementado em `weeklySpendFromReadings` e na seção "Acompanhamento
semanal".

Fazer:

- Unificar "Controle Semanal" e "Acompanhamento semanal — {cartão}" numa
  seção só, alimentada por `weeklySpendFromReadings(readings)` do cartão
  principal. Orçamento de cada semana = `summary.weeklyBudget` (509,69).
  Semana sem leitura lançada = sem gasto ainda (mostrar "sem leitura").
- Parar de usar `calculateWeekly`/snapshots para o "spent" semanal exibido.
  Se `weeks` persistidas no banco ficarem sem uso, pare de criar
  (`createWeeks`) — avalie e remova código morto com cuidado.
- Manter o campo de lançar leitura da fatura (input + histórico) dentro da
  seção unificada.
- Se não houver cartão principal definido, mostrar aviso pedindo para marcar
  o ★ na tela de Cartões.
- Ajustar o gráfico "Orçamento × Gasto por Semana" (`WeeklyBarChart`) para a
  mesma fonte de dados (leituras do cartão principal).

## 3. Filtros para melhorar o gerencial

Na tela de Transações (`app/transactions/page.tsx` +
`components/transactions/TransactionList.tsx`), adicionar barra de filtros
combináveis (client-side, sem mudar services):

- Tipo: todas | entradas | despesas | reservas
- Categoria: select com as categorias presentes no mês
- Cartão: todas | sem cartão | por cartão (usa o campo `card`)
- Flags: provisão, fixo, recorrente, assinatura (categoria 'Assinaturas')
- Busca por texto (descrição/categoria, case/acento-insensitive — use
  `normalizeCategory` de `core/utils/normalize.ts` como referência)
- Mostrar contagem e SOMA do que está filtrado (ex.: "7 lançamentos •
  − R$ 1.234,56") — isso é o valor gerencial do filtro.
- Manter o seletor de ordenação existente funcionando em conjunto.

No dashboard, o seletor de mês já existe; não precisa de mais filtros lá além
dos cards clicáveis.

## Avisos operacionais

- O repo fica dentro do OneDrive e já houve truncamento de arquivos por
  conflito de sync. **Commite em passos pequenos** durante o trabalho.
- Arquivos usam CRLF (Windows) — não converta fim de linha em massa; respeite
  o `.prettierrc`.
- Rode `npx vitest run` e `npx tsc --noEmit` antes de finalizar e reporte o
  resultado. Se um teste de contrato quebrar, o erro é seu — reveja a mudança
  em vez de editar o valor esperado.
