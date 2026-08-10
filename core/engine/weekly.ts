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
 *
 * ⚠️ SUPERSEDIDA por `engine/cycleSpend.calculateCycleSpend`, que o app usa.
 * Esta versão trata a primeira leitura como linha de base sempre — inclusive
 * num ciclo que nasceu zerado, onde essa leitura é gasto de verdade. Era o que
 * fazia a semana 1 exibir R$ 0,00 tendo havido gasto. Mantida por
 * compatibilidade com os testes existentes.
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
 * ⚠️ NÃO use para nada novo — o app não usa mais. Prefira
 * `cycleLengthInWeeks(getCycleRange(closingDay, data))`, que mede o ciclo real
 * (28–31 dias, variando com o mês) em vez de aproximar por `closing_day`.
 *
 * Esta aproximação diverge do ciclo real sempre que eles não coincidem: com
 * `closing_day` 28 ela diz 4 semanas, mas o ciclo 28/01–27/02 tem 31 dias, ou
 * seja 5 — e são 5 barras que a tela desenha. Manter duas noções de "semanas
 * do ciclo" no mesmo módulo foi o que permitiu o divisor do orçamento semanal
 * discordar das semanas exibidas. Mantida só por compatibilidade com testes.
 *
 * Número de blocos de 7 dias a partir do `closing_day`. Mínimo 1.
 */
export function getWeeksInCycle(closingDay: number): number {
  return Math.max(1, Math.ceil(closingDay / 7));
}

/**
 * ⚠️ NÃO use para nada novo — o app não usa mais. Prefira
 * `cycleLengthInWeeks(getCycleRange(closingDay, data))`.
 *
 * Mede o ciclo SEGUINTE ao de `from` (do próximo fechamento até o outro),
 * não o ciclo em que `from` está — o que a torna sutilmente diferente de
 * `getCycleRange`. Mantida só por compatibilidade com testes.
 *
 * Ex.: hoje 03/07, fechamento dia 4 → ciclo 04/07→04/08 = 31 dias = 5 semanas.
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
    clampClosingDay(
      nextClosing.getFullYear(),
      nextClosing.getMonth() + 1,
      closingDay,
    ),
  );

  const days = Math.round(
    (followingClosing.getTime() - nextClosing.getTime()) / 86_400_000,
  );

  return Math.max(1, Math.ceil(days / 7));
}

/**
 * Semanas do intervalo, inclusive nas duas pontas — mesmo critério de bucket
 * (blocos de 7 dias) do resto do engine. Ex.: ciclo 04/08–03/09 = 31 dias =
 * 5 semanas.
 */
export function cycleLengthInWeeks(range: { start: Date; end: Date }): number {
  const days =
    Math.round((range.end.getTime() - range.start.getTime()) / 86_400_000) + 1;

  return Math.max(1, Math.ceil(days / 7));
}

/**
 * Semanas que ainda FALTAM no ciclo, vistas de `from` (padrão hoje) — divisor
 * decrescente do orçamento semanal.
 *
 * A conta é derivada de `weekIndexInCycle`, a MESMA função que numera as
 * semanas na tela ("Semana 1 (04/08–10/08)") e que agrupa o gasto de cada
 * leitura:
 *
 *     restantes = total do ciclo − semana atual + 1
 *
 * O `+ 1` é o ponto: estar NA semana 1 significa que restam todas as 5, porque
 * a semana em que você está ainda não acabou. A versão anterior contava dias
 * corridos até o próximo fechamento e dividia por 7, o que fazia o número cair
 * no meio da semana — em 07/08 já dizia 4 embora a tela ainda mostrasse
 * "Semana 1". Como o orçamento é `saldo ÷ restantes`, cair cedo demais inflava
 * o valor semanal e dava mais folga do que existia.
 *
 * O próprio dia do fechamento já conta como início do ciclo NOVO (ver
 * `cycleStartFor`) — nele restam todas as semanas do ciclo que começa.
 *
 * Ex.: ciclo 04/08–03/09 (5 semanas); de 04/08 a 10/08 (semana 1) restam 5;
 * em 11/08 (começa a semana 2) restam 4; em 03/09 (último dia) resta 1.
 */
export function getWeeksRemainingInCycle(
  closingDay: number,
  from: Date = new Date(),
): number {
  const total = cycleLengthInWeeks(getCycleRange(closingDay, from));
  const current = weekIndexInCycle(from, closingDay);

  return Math.max(1, Math.min(total, total - current + 1));
}

export type KnownCharge = {
  /** Valor da assinatura/parcela conhecida (já é compromisso fixo). */
  amount: number;
  /** Dia do mês (1-31) em que ela é lançada na fatura (dueDay/billing_day). */
  day: number | null | undefined;
};

/**
 * Soma, por semana do ciclo, os valores de assinaturas/parcelas com dia de
 * lançamento conhecido (`dueDay` em transações recorrentes/fixas,
 * `billing_day` em parcelamentos) que caem no cartão principal. O dia é
 * resolvido dentro do mês/ano informado (mesma aproximação de
 * `resolveDueDate` em `core/engine/dueDates.ts` — não tenta encaixar o dia
 * num ciclo que atravesse a virada do mês).
 *
 * `asOf`, quando informado, ignora cobrança cujo dia resolvido ainda não
 * chegou (dia > `asOf`) — sem isso, uma assinatura/parcela que só vai cair
 * na fatura dali a alguns dias já é descontada do gasto da semana corrente,
 * zerando gasto que JÁ aconteceu (a leitura mais recente da fatura ainda
 * nem inclui essa cobrança futura). Use a data da leitura mais recente da
 * fatura, não "hoje" — a leitura é o que efetivamente confirma o que já
 * está lançado.
 *
 * `baseline`, quando informado, ignora cobrança cujo dia resolvido é ≤ à
 * data da PRIMEIRA leitura do ciclo — essa cobrança já está DENTRO do valor
 * da leitura inicial (que não conta como gasto), então nunca aparece em
 * nenhum delta. Descontá-la de novo apagaria gasto livre real da semana.
 * Ex.: baseline de 716,70 em 06/07 já contém a parcela do dia 4; sem esse
 * corte, a parcela seria descontada do delta da semana 1, zerando gasto
 * que de fato aconteceu depois da leitura inicial.
 */
/**
 * ⚠️ SUPERSEDIDA por `engine/cycleSpend.calculateCycleSpend`, que o app usa.
 * Posiciona toda cobrança pelo dia cadastrado, inclusive parcelamento — que na
 * prática entra na virada do ciclo, sem dia próprio. E resolve o dia dentro da
 * competência, não do ciclo, então uma assinatura de dia 2 caía no ciclo
 * errado. Mantida por compatibilidade com os testes existentes.
 */
export function knownChargesByWeek(
  charges: KnownCharge[],
  year: number,
  month: number,
  closingDay: number,
  asOf?: Date,
  baseline?: Date,
): Map<number, number> {
  const daysInMonth = new Date(year, month, 0).getDate();
  const byWeek = new Map<number, number>();
  const cutoff = asOf ? startOfDay(asOf).getTime() : null;
  const baselineCut = baseline ? startOfDay(baseline).getTime() : null;

  for (const charge of charges) {
    if (!charge.day || charge.amount <= 0) continue;

    const date = new Date(year, month - 1, Math.min(charge.day, daysInMonth));
    if (cutoff != null && date.getTime() > cutoff) continue;
    if (baselineCut != null && date.getTime() <= baselineCut) continue;

    const weekIndex = weekIndexInCycle(date, closingDay);

    byWeek.set(
      weekIndex,
      toCurrency((byWeek.get(weekIndex) ?? 0) + charge.amount),
    );
  }

  return byWeek;
}

/**
 * Desconta do gasto bruto (delta de leituras) as assinaturas/parcelas
 * conhecidas que caíram na mesma semana — o que sobra é o gasto livre/
 * variável, comparável ao orçamento semanal (que já exclui esses valores no
 * cálculo mensal). Nunca fica negativo.
 */
export function adjustWeeklySpendForKnownCharges(
  weeklySpend: WeeklySpend[],
  knownCharges: Map<number, number>,
): WeeklySpend[] {
  return weeklySpend.map((w) => ({
    ...w,
    spent: toCurrency(
      Math.max(0, w.spent - (knownCharges.get(w.weekIndex) ?? 0)),
    ),
  }));
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
