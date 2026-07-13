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

/**
 * Início do ciclo: a última ocorrência do dia de fechamento que é ≤ à data
 * informada — o PRÓPRIO dia do fechamento já conta como início do ciclo
 * novo (não o dia seguinte). Na prática a fatura às vezes fecha antes do
 * dia programado (sem regra clara de quando), então tratar o dia de
 * fechamento como já sendo a virada é a aproximação mais segura.
 */
function cycleStartFor(date: Date, closingDay: number): Date {
  const day = startOfDay(date);
  const y = day.getFullYear();
  let m = day.getMonth();

  let start = new Date(y, m, clampClosingDay(y, m, closingDay));

  if (start.getTime() > day.getTime()) {
    m -= 1;
    start = new Date(y, m, clampClosingDay(y, m, closingDay));
  }

  return start;
}

/**
 * Índice da semana (1-based, blocos de 7 dias) dentro do ciclo da fatura,
 * a partir do closing_day do cartão principal — em vez de usar o dia do mês
 * calendário. Ex.: fecha dia 4 → ciclo começa no próprio dia 4; 04–10/07 =
 * semana 1, 11–17/07 = semana 2 etc.
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
 * Intervalo REAL do ciclo vigente da fatura (início–fim), visto de `from`
 * (padrão hoje) — para mostrar algo como "Ciclo vigente: 04/07–03/08" na UI.
 * Diferente de `weekDateRangeInCycle`, que soma blocos fixos de 7 dias e
 * pode ultrapassar o fechamento real na última semana (ex.: ciclo de 31
 * dias tem uma 5ª semana "cheia" de 7 dias que na verdade só tem 3); aqui o
 * fim é sempre a véspera do início do próximo ciclo.
 */
export function getCycleRange(
  closingDay: number,
  from: Date = new Date(),
): { start: Date; end: Date } {
  const start = cycleStartFor(from, closingDay);

  const nextStart = new Date(
    start.getFullYear(),
    start.getMonth() + 1,
    clampClosingDay(start.getFullYear(), start.getMonth() + 1, closingDay),
  );

  const end = new Date(nextStart);
  end.setDate(end.getDate() - 1);

  return { start, end };
}

/**
 * Calcula o gasto de cada semana do ciclo a partir das leituras da fatura.
 * Cada leitura representa o valor acumulado da fatura naquele momento; a
 * PRIMEIRA leitura de todas (mais antiga) é a ÚNICA linha de base do ciclo
 * e não conta como gasto — toda leitura seguinte gera um delta contra a
 * leitura imediatamente anterior (não contra "a última da semana"), e esse
 * delta é somado à semana em que a leitura mais nova caiu. Isso preserva
 * cada atualização feita pelo usuário, mesmo que várias caiam na mesma
 * semana — nenhum gasto real fica escondido dentro de uma leitura
 * "engolida" pela semana.
 *
 * `isBaseline` marca a semana que contém a leitura inicial do ciclo; ainda
 * assim, `spent` pode ser > 0 nessa mesma semana se houve outras leituras
 * depois da inicial dentro dela (ex.: usuário atualizou a fatura 3x na
 * semana 1 — a leitura inicial não conta, mas os deltas entre as 3
 * seguintes contam e são somados na semana 1).
 *
 * Se `closingDay` for informado, a semana da leitura é calculada pelo ciclo
 * da fatura (`weekIndexInCycle`); sem ele, cai no bucket por dia do mês
 * (Math.ceil(dia / 7)), mantido por compatibilidade.
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

  const [baseline, ...rest] = sorted;
  const baseWeekIndex = weekOf(baseline.read_at);

  const spentByWeek = new Map<number, number>([[baseWeekIndex, 0]]);

  let prevAmount = baseline.amount;
  for (const r of rest) {
    const delta = Math.max(0, r.amount - prevAmount);
    const weekIndex = weekOf(r.read_at);
    spentByWeek.set(
      weekIndex,
      toCurrency((spentByWeek.get(weekIndex) ?? 0) + delta),
    );
    prevAmount = r.amount;
  }

  return [...spentByWeek.entries()]
    .sort(([a], [b]) => a - b)
    .map(([weekIndex, spent]) => ({
      weekIndex,
      spent,
      isBaseline: weekIndex === baseWeekIndex,
    }));
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
 * O próprio dia do fechamento já conta como início do ciclo NOVO (ver
 * `cycleStartFor`) — nele, restam as semanas inteiras do próximo ciclo, não
 * "1 semana" do ciclo que está terminando.
 *
 * Ex.: ciclo 04/07→04/08 (5 semanas); em 04/07 (dia do fechamento, já é o
 * novo ciclo) restam 5; em 12/07 (1 semana depois) restam 4; em 03/08
 * (véspera do próximo fechamento) resta 1.
 */
export function getWeeksRemainingInCycle(
  closingDay: number,
  from: Date = new Date(),
): number {
  const today = startOfDay(from);

  const y = today.getFullYear();
  let m = today.getMonth();

  let nextClosing = new Date(y, m, clampClosingDay(y, m, closingDay));
  if (nextClosing.getTime() <= today.getTime()) {
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
