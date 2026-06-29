# Plano de build — Loop semanal, cartão principal e não-interferência

Objetivo: reproduzir no ZeroSheet o jeito como eu realmente uso a planilha —
um **orçamento semanal** acompanhado toda semana pela leitura da fatura do
cartão principal — e garantir que cada controle do mês some uma única vez
(nenhum interfere na matemática do outro).

Execução: um item por vez, na ordem; um commit por item (conventional commits
em pt); `npx tsc --noEmit && npx vitest run` verde antes de avançar; funções de
cálculo puras em `core/engine`; nada de `any` novo. As migrations estão na
seção "Migrations" — **não aplicar sem revisão**; o restante é só código.

---

## Conceito (a regra que rege tudo)

- O **cartão principal** define o ciclo do orçamento. O nº de semanas vem do
  `closing_day` dele (semanas até a fatura virar), não de 4 fixo.
- O **orçamento semanal** = sobra do mês ÷ semanas do ciclo. É "quanto posso
  gastar por semana".
- O **gasto da semana** = leitura atual da fatura − leitura da semana anterior.
  Toda segunda eu lanço o valor atual da fatura; o app mostra se gastei mais ou
  menos do que o orçamento da semana.
- **Não-interferência:** cada gasto pertence a UM bucket e é contado UMA vez.
  O que está no cartão (principal ou não) é contado pela fatura/leituras; o que
  NÃO está no cartão (contas em boleto, parcelas fora do cartão) é contado à
  parte. Nada entra duas vezes.

---

## Item A — Cartão principal (`is_primary`)
- **Migration:** `ALTER TABLE cards ADD COLUMN is_primary boolean NOT NULL DEFAULT false;`
  (índice parcial único por usuário para garantir só 1 principal — ver Migrations).
- **Onde:** `core/types/database.ts` (`DBCard` + `is_primary`),
  `core/services/card.service.ts` (nova `setPrimaryCard(id)` que põe `is_primary=true`
  no cartão e `false` nos demais do usuário), UI em `app/cards/page.tsx`
  (estrela/toggle "principal" na lista).
- **Aceite:** marcar um cartão como principal desmarca o anterior; sempre no
  máximo um principal por usuário.

## Item B — Semanas pelo ciclo do cartão principal
- **Onde:** `core/engine/weekly.ts`. Hoje `getWeeksInMonth(month, year)` conta
  semanas-calendário. Adicionar `getWeeksInCycle(closingDay: number): number`
  = nº de blocos de 7 dias do início do ciclo até `closing_day`
  (mín. 1; cobrir meses de 28–31 dias).
- **Onde:** `components/dashboard/Dashboard.tsx` — usar o `closing_day` do cartão
  principal para o nº de semanas; se não houver principal, cair no
  `getWeeksInMonth` atual (fallback).
- **Aceite:** com cartão principal fechando dia 28, julho usa o nº de semanas do
  ciclo; sem principal, comportamento atual inalterado.

## Item C — Leituras semanais da fatura (o coração do loop)
- **Migration:** nova tabela `card_readings` (id, user_id, month_id, card_id,
  amount numeric, read_at timestamptz default now(), created_at) com RLS por
  `user_id` (ver Migrations). NÃO mexer em `card_snapshots` (snapshot = fatura
  fechada do mês; reading = leitura parcial no meio do mês — controles separados).
- **Onde (service):** `core/services/cardReading.service.ts` — `addReading`,
  `getReadings(monthId, cardId)`, `deleteReading`.
- **Onde (engine):** `core/engine/weekly.ts` — `weeklySpendFromReadings(readings)`:
  ordena por `read_at`, calcula gasto de cada semana = leitura − leitura anterior
  (mesma lógica já existente em `calculateFromSnapshots`, generalizada para
  leituras). Semana de cada leitura = índice do bloco de 7 dias dentro do ciclo.
- **Onde (UI):** seção no dashboard "Acompanhamento semanal": uma linha por
  semana com orçamento, gasto (da leitura) e diferença (verde/vermelho), e um
  campo pra lançar a leitura da semana atual.
- **Aceite:** lançar leitura 1 = 800 e leitura 2 = 1.200 → semana 2 mostra gasto
  400, comparado ao orçamento semanal.

## Item D — Não-interferência no `calculateSummary`
- **Onde:** `core/engine/calculations.ts`.
- **Regra:** transação com `card` que tenha snapshot/fatura no mês NÃO entra em
  `fixedCosts` nem no envelope — ela já está dentro da fatura do cartão.
  (Corrige o caso "Luz no C6" sendo contada em fixos E na fatura.)
- **Aceite:** despesa fixa marcada com cartão que tem snapshot não é somada duas
  vezes; total não muda ao alternar só o flag `card` dela.

---

## Migrations (revisar antes de aplicar — não rodar automaticamente)

```sql
-- Item A: cartão principal
ALTER TABLE cards ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS cards_one_primary_per_user
  ON cards (user_id) WHERE is_primary;

-- Item C: leituras semanais da fatura
CREATE TABLE IF NOT EXISTS card_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  month_id uuid REFERENCES months(id) ON DELETE CASCADE,
  card_id uuid REFERENCES cards(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  read_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE card_readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY card_readings_owner ON card_readings
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Itens 2 e 3 do PARIDADE-PLANILHA (ativar reembolso e reserva)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_reimbursement boolean DEFAULT false;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_reserve boolean DEFAULT false;
```

Depois da migration dos itens 2/3, marcar os dados já importados (faz junho
fechar em −39,17 e separa a Reserva de julho):

```sql
UPDATE transactions SET is_reimbursement = true
 WHERE category = 'Extras/Reembolsos' AND type = 'income';
UPDATE transactions SET is_reserve = true
 WHERE category = 'Reserva' AND type = 'expense';
```
