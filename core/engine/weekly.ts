import { Week, Transaction } from '../types/finance';
import { toCurrency } from '../utils/number';

export type CardReading = {
  amount: number;
  read_at: string;
};

export type WeeklySpend = {
  weekIndex: number;
  spent: number;
  /** true = essa é a primeira leitura do conjunto (linha de base, não é gasto). */
  isBaseline: boolean;
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

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Clampa o dia de fechamento aos dias do mês informado (ex.: dia 31 em fevereiro → 28). */
function clampClosingDay(
  year: number,
  monthIndex: number,
  closingDay: number,
): number {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  return Math.min(closingDay, daysInMonth);
}

/** Data do fechamento mais recente que ocorre ANTES do dia informado (o dia do próprio fechamento já pertence ao ciclo anterior). */
function closingBefore(day: Date, closingDay: number): Date {
  const y = day.getFullYear();
  let m = day.getMonth();

  let closing = new Date(y, m, clampClosingDay(y, m, closingDay));

  if (closing.getTime() >= day.getTime()) {
    m -= 1;
    closing = new Date(y, m, clampClosingDay(y, m, closingDay));
  }

  return closing;
}

/** Início do ciclo (dia seguinte ao último fechamento) que contém a data informada. */
function cycleStartFor(date: Date, closingDay: number): Date {
  const closing = closingBefore(startOfDay(date), closingDay);
  return new Date(closing.getFullYear(), closing.getMonth(), closing.getDate() + 1);
}

/**
 * Índice da semana (1-based, blocos de 7 dias) dentro do ciclo da fatura,
 * a partir do closing_day do cartão principal — em vez de usar o dia do mês
 * calendário. Ex.: fecha dia 4 → ciclo começa dia 5; 05–11/07 = semana 1,
 * 12–18/07 = semana 2 etc.
 */
export function weekIndexInCycle(date: Date, closingDay: number): number {
  const day = startOfDay(date);
  const cycleStart = cycleStartFor(day, closingDay);

  const diffDays = Math.round(
    (day.getTime() - cycleStart.getTime()) / 86_400_000,
  );

  return Math.max(1, Math.ceil((diffDays + 1) / 7));
}

/**
 * Intervalo de datas (início–fim) da semana `weekIndex` do ciclo vigente
 * (visto de `from`, por padrão hoje) — usado para exibir "Semana N (dd/mm–dd/mm)".
 */
export function weekDateRangeInCycle(
  weekIndex: number,
  closingDay: number,
  from: Date = new Date(),
): { start: Date; end: Date } {
  const cycleStart = cycleStartFor(from, closingDay);

  const start = new Date(cycleStart);
  start.setDate(start.getDate() + (weekIndex - 1) * 7);

  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  return { start, end };
}

/**
 * Calcula o gasto de cada semana do ciclo a partir das leituras semanais
 * da fatura. Cada leitura representa o valor acumulado da fatura naquele
 * momento; a PRIMEIRA leitura (mais antiga) é a linha de base e não conta
 * como gasto — o gasto da semana i (i > base) = leitura_i − leitura_(i−1).
 *
 * Se `closingDay` for informado, a semana da leitura é calculada pelo ciclo
 * da fatura (`weekIndexInCycle`); sem ele, cai no bucket por dia do mês
 * (Math.ceil(dia / 7)), mantido por compatibilidade.
 *
 * Leituras com a mesma semana são somadas antes de calcular o delta,
 * mantendo coerência se o usuário lançar mais de uma leitura por semana.
 */
export function weeklySpendFromReadings(
  readings: CardReading[],
  closingDay?: number,
): WeeklySpend[] {
  if (readings.length === 0) return [];

  const sorted = [...readings].sort(
    (a, b) => new Date(a.read_at).getTime() - new Date(b.read_at).getTime(),
  );

  const weekOf = (isoDate: string): number => {
    const date = new Date(isoDate);
    return closingDay != null
      ? weekIndexInCycle(date, closingDay)
      : Math.ceil(date.getDate() / 7);
  };

  // agrupa por semana (última leitura da semana prevalece)
  const byWeek = new Map<number, number>();
  for (const r of sorted) {
    byWeek.set(weekOf(r.read_at), r.amount);
  }

  const weekEntries = [...byWeek.entries()].sort(([a], [b]) => a - b);

  const [baseline, ...rest] = weekEntries;
  const [baseWeekIndex, baseAmount] = baseline;

  const result: WeeklySpend[] = [
    { weekIndex: baseWeekIndex, spent: 0, isBaseline: true },
  ];

  let prev = baseAmount;
  for (const [weekIndex, amount] of rest) {
    const spent = toCurrency(Math.max(0, amount - prev));
    result.push({ weekIndex, spent, isBaseline: false });
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

/**
 * Semanas do ciclo vigente da fatura do cartão principal, visto de `from`:
 * conta os dias entre a PRÓXIMA virada da fatura e a virada seguinte e
 * divide por 7 (arredondando pra cima).
 *
 * Ex.: hoje 03/07, fechamento dia 4 → ciclo 04/07→04/08 = 31 dias = 5 semanas.
 * É por esse número que o saldo do mês é dividido no orçamento semanal.
 */
export function getWeeksInCurrentCycle(
  closingDay: number,
  from: Date = new Date(),
): number {
  const y = from.getFullYear();
  let m = from.getMonth();

  let nextClosing = new Date(y, m, clampClosingDay(y, m, closingDay));
  if (nextClosing.getTime() <= from.getTime()) {
    m += 1;
    nextClosing = new Date(y, m, clampClosingDay(y, m, closingDay));
  }

  const followingClosing = new Date(
    nextClosing.getFullYear(),
    nextClosing.getMonth() + 1,
    clampClosingDay(nextClosing.getFullYear(), nextClosing.getMonth() + 1, closingDay),
  );

  const days = Math.round(
    (followingClosing.getTime() - nextClosing.getTime()) / 86_400_000,
  );

  return Math.max(1, Math.ceil(days / 7));
}

/**
 * Semanas que FALTAM até o próximo fechamento da fatura, vistas de `from`
 * (padrão hoje) — divisor decrescente do orçamento semanal: passou uma
 * semana, divide o saldo pelas que restam.
 *
 * `max(1, ...)` garante que o próprio dia do fechamento (ou o dia seguinte,
 * antes da próxima leitura) já conte como "última semana" (1), sem precisar
 * de uma regra extra para o limiar de ~2 dias.
 *
 * Ex.: ciclo 04/07→04/08 (5 semanas); em 05/07 (início) restam 5; em 12/07
 * (1 semana depois) restam 4; em 03/08 (véspera do fechamento) resta 1.
 */
export function getWeeksRemainingInCycle(
  closingDay: number,
  from: Date = new Date(),
): number {
  const today = startOfDay(from);

  const y = today.getFullYear();
  let m = today.getMonth();

  let nextClosing = new Date(y, m, clampClosingDay(y, m, closingDay));
  if (nextClosing.getTime() < today.getTime()) {
    m += 1;
    nextClosing = new Date(y, m, clampClosingDay(y, m, closingDay));
  }

  const daysUntilClosing = Math.round(
    (nextClosing.getTime() - today.getTime()) / 86_400_000,
  );

  return Math.max(1, Math.ceil(daysUntilClosing / 7));
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
