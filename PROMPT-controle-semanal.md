# Prompt para Claude Code — Ajuste fino do Acompanhamento Semanal

> Cole tudo abaixo desta linha no Claude Code (terminal do VSCode), com o repo
> `zerosheet-finance` aberto na raiz.

---

Você vai ajustar o Acompanhamento Semanal do ZeroSheet Finance. Leia
`CONTEXT.md` e `TODO.md` antes. Regras gerais:

- **Não altere o schema do banco** (tabela `card_readings` já existe e basta).
- **Não quebre os testes de contrato** (`tests/engine/july-2026.test.ts` e
  `tests/engine/card-linked.test.ts`). Eles passam o número de semanas
  explicitamente ao engine, então as mudanças abaixo não devem afetá-los —
  se afetarem, a mudança está errada.
- Ao final: `npx tsc --noEmit` limpo, `npx vitest run` verde, `TODO.md`
  atualizado. Commits pequenos (repo em OneDrive, risco de sync).

Modelo mental do usuário (não fugir dele): ele concentra gastos no cartão
principal (C6, fecha dia 4). Toda segunda-feira ele olha a fatura atual e o
gasto da semana é a DIFERENÇA para o valor da última atualização. O orçamento
semanal é o saldo do mês dividido pelas semanas que FALTAM até a fatura
fechar de novo — e esse divisor diminui a cada semana que passa.

## 1. Gasto da semana = delta entre leituras (bug atual: primeira leitura conta cheia)

Hoje, `weeklySpendFromReadings` (`core/engine/weekly.ts`) calcula deltas entre
leituras consecutivas, mas a PRIMEIRA leitura usa `prev = 0` — então quem
lança a fatura acumulada (ex.: 995,32) vê tudo como gasto da semana 1.

Corrigir:

- **Primeira leitura do mês = linha de base.** O gasto só passa a contar da
  segunda leitura em diante (`spent_n = leitura_n − leitura_{n−1}`). Na UI,
  exibir a primeira leitura como "Leitura inicial (base)" em vez de uma
  semana com gasto.
- **Atualizou a fatura no módulo Cartões → vira leitura automaticamente.**
  Em `upsertCardSnapshot` (ou no fluxo do `CardSnapshotForm`), ao salvar o
  valor da fatura de um cartão, criar também um registro em `card_readings`
  (mesmo month_id/card_id/valor). Assim o usuário atualiza a fatura UMA vez
  e o histórico semanal se constrói sozinho — sem lançamento duplicado.
  Evitar duplicata exata (mesmo valor no mesmo dia).
- **Semanas indexadas pelo ciclo, não pelo dia do mês.** Hoje o bucket é
  `Math.ceil(diaDoMês/7)`. Com fatura fechando dia 4, a semana 1 do ciclo vai
  de 05/07 a 11/07. Indexar a semana da leitura por
  `ceil(diasDesdeInícioDoCiclo/7)` usando o `closing_day` do cartão
  principal. Criar função pura testada (ex.: `weekIndexInCycle(date,
  closingDay)`), e usar tanto na listagem quanto no gráfico semanal.

## 2. Orçamento semanal decrescente (semanas restantes, não semanas do ciclo)

Hoje o orçamento semanal divide o saldo pelas semanas TOTAIS do ciclo
(`getWeeksInCurrentCycle` → 5). O usuário quer como na planilha dele: passou
uma semana, divide pelas restantes.

- Criar `getWeeksRemainingInCycle(closingDay, from = new Date())`: semanas
  que faltam de `from` até o próximo fechamento = `max(1,
  ceil(diasAtéPróximoFechamento/7))`, com a mesma regra de pular para o
  fechamento seguinte quando o atual está a menos de ~2 dias (fatura
  prestes a virar). Exemplo de aceite: ciclo 04/07→04/08 (5 semanas); em
  06/07, com a semana 1 já consumida/lançada, restam 4 → orçamento = saldo
  atual ÷ 4.
- Se houver leituras no mês, preferir: semanas restantes = semanas do ciclo −
  maior índice de semana com leitura lançada (mínimo 1). Sem leituras, usar o
  cálculo por data acima. Documentar a regra num comentário curto.
- `Dashboard.tsx` passa esse número como `weeksForBudget` ao
  `calculateSummary` (o parâmetro já existe). O subtítulo do card "Orçamento
  Semanal" deve dizer, por ex.: "Saldo ÷ 4 semanas restantes do ciclo (C6
  fecha dia 4)".
- Como o saldo do mês já cai automaticamente quando a fatura sobe, saldo ÷
  semanas restantes reproduz exatamente a atualização manual da planilha.
- Adicionar testes das duas funções novas (casos: início do ciclo = 5,
  após 1 semana = 4, véspera do fechamento = 1, mês curto/fevereiro).

## 3. Coerência visual

- A linha de cada semana mostra: Semana N (datas dd/mm–dd/mm), Orçamento
  (da época? não — usar o orçamento semanal vigente), Gasto (delta) e
  Restante (orçamento − gasto), verde/vermelho como hoje.
- Semana futura/sem leitura: "sem leitura ainda", sem gasto.
- Manter o histórico de leituras com opção de remover (já existe).
