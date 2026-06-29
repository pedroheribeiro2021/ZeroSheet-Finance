import { Week, Transaction } from '../types/finance';

export type CardReading = {
  amount: number;
  read_at: string;
};

type Snapshot = {
  amount: number;
  created_at: string | null;
};

/**
 * Número real de semanas do mês, usando o mesmo critério de bucket por dia
 * (Math.ceil(dia/7)) já usado para distribuir transações/snapshots entre
 * semanas — meses com 28 dias caem em 4 semanas, os demais em 5.
 */
export function getWeeksInMonth(month: number, year: number): number {
  const daysInMonth = new Date(year, month, 0).getDate();

  return Math.ceil(daysInMonth / 7);
}

/**
 * Calcula o gasto de cada semana do ciclo a partir das leituras semanais
 * da fatura. Cada leitura representa o valor acumulado da fatura naquele
 * momento; o gasto da semana i = leitura_i − leitura_(i−1).
 *
 * Retorna um array de { weekIndex, spent } onde weekIndex é o bloco de 7 dias
 * (Math.ceil(dia / 7)) da data de leitura.
 *
 * Leituras com a mesma semana são somadas antes de calcular o delta,
 * mantendo coerência se o usuário lançar mais de uma leitura por semana.
 */
export function weeklySpendFromReadings(
  readings: CardReading[],
): { weekIndex: number; spent: number }[] {
  if (readings.length === 0) return [];

  const sorted = [...readings].sort(
    (a, b) => new Date(a.read_at).getTime() - new Date(b.read_at).getTime(),
  );

  // agrupa por semana (bloco de 7 dias pelo dia-do-mês)
  const byWeek = new Map<number, number>();
  for (const r of sorted) {
    const day = new Date(r.read_at).getDate();
    const week = Math.ceil(day / 7);
    // última leitura da semana prevalece (sobrescreve a anterior do mesmo bloco)
    byWeek.set(week, r.amount);
  }

  const weekEntries = [...byWeek.entries()].sort(([a], [b]) => a - b);

  const result: { weekIndex: number; spent: number }[] = [];
  let prev = 0;

  for (const [weekIndex, amount] of weekEntries) {
    const spent = Math.max(0, amount - prev);
    result.push({ weekIndex, spent });
    prev = amount;
  }

  return result;
}

/**
 * Número de blocos de 7 dias do início do ciclo do cartão até o closing_day.
 * O ciclo começa no dia seguinte ao fechamento anterior; o comprimento
 * varia com o mês (28–31 dias), então usamos closing_day diretamente:
 * se fecha no dia 28, o ciclo tem 28 dias → 4 semanas.
 * Mínimo retornado é 1.
 */
export function getWeeksInCycle(closingDay: number): number {
  return Math.max(1, Math.ceil(closingDay / 7));
}

export function calculateWeekly(
  snapshots: Snapshot[],
  transactions: Transaction[],
  monthlyBudget: number,
  monthId: string,
  totalWeeks: number = 4,
): Week[] {
  // 🔥 PRIORIDADE 1: snapshots
  if (snapshots.length > 0) {
    return calculateFromSnapshots(
      snapshots,
      monthlyBudget,
      monthId,
      totalWeeks,
    );
  }

  // 🔥 FALLBACK: transações
  return calculateFromTransactions(
    transactions,
    monthlyBudget,
    monthId,
    totalWeeks,
  );
}

function calculateFromSnapshots(
  snapshots: Snapshot[],
  monthlyBudget: number,
  monthId: string,
  totalWeeks: number,
): Week[] {
  const sorted = [...snapshots].sort(
    (a, b) =>
      new Date(a.created_at ?? 0).getTime() -
      new Date(b.created_at ?? 0).getTime(),
  );

  const weeks: Week[] = [];
  let prev = 0;

  for (let i = 1; i <= totalWeeks; i++) {
    const weekSnaps = sorted.filter((s) => {
      const day = new Date(s.created_at ?? 0).getDate();
      return Math.ceil(day / 7) === i;
    });

    const total = weekSnaps.reduce((acc, s) => acc + s.amount, 0);
    const spent = total - prev;

    const budget = monthlyBudget / totalWeeks;

    weeks.push({
      id: crypto.randomUUID(),
      monthId,
      index: i,
      budget,
      spent: spent > 0 ? spent : 0,
      remaining: budget - (spent > 0 ? spent : 0),
    });

    prev = total;
  }

  return weeks;
}

function calculateFromTransactions(
  transactions: Transaction[],
  monthlyBudget: number,
  monthId: string,
  totalWeeks: number,
): Week[] {
  const weeks: Week[] = [];

  for (let i = 1; i <= totalWeeks; i++) {
    const weekTx = transactions.filter((t) => {
      const day = new Date(t.createdAt).getDate();
      return Math.ceil(day / 7) === i;
    });

    const spent = weekTx
      .filter((t) => t.type === 'expense')
      .reduce((acc, t) => acc + t.amount, 0);

    const budget = monthlyBudget / totalWeeks;

    weeks.push({
      id: crypto.randomUUID(),
      monthId,
      index: i,
      budget,
      spent,
      remaining: budget - spent,
    });
  }

  return weeks;
}
