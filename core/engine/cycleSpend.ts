import { toCurrency } from '../utils/number';

/**
 * Gasto livre por semana do ciclo da fatura.
 * ------------------------------------------
 * A pergunta que este módulo responde é "quanto eu torrei de livre nesta
 * semana?" — e livre exclui o que já era compromisso assumido: parcelas de
 * compras antigas e assinaturas. Esses valores já foram abatidos do Saldo do
 * Mês em `calculateSummary`; contá-los de novo aqui puniria o usuário duas
 * vezes pela mesma despesa.
 *
 * A única fonte de "quanto a fatura subiu" são as leituras: cada uma é o valor
 * acumulado da fatura naquele instante, e a diferença entre leituras
 * consecutivas é o quanto entrou no intervalo.
 *
 * Três regras de posicionamento, todas aprendidas de dados reais:
 *
 * 1. **O ciclo nasce zerado.** Quando a fatura fecha, a seguinte começa do
 *    zero. Se o app já vinha lendo o cartão no ciclo anterior, ele SABE que a
 *    virada aconteceu — então a primeira leitura do ciclo novo é gasto, não
 *    linha de base. A base só faz sentido na primeiríssima leitura do cartão,
 *    quando a fatura já tinha um valor que ninguém acompanhou.
 *
 * 2. **Parcela entra na virada.** Parcelamento não é cobrança nova: a compra
 *    aconteceu uma vez e o banco fatiou. Cada parcela é uma linha que já nasce
 *    com a fatura, sem dia próprio. O `billing_day` cadastrado não descreve
 *    isso — no C6 uma parcela de "dia 20" apareceu na fatura no dia da virada.
 *
 * 3. **Assinatura entra no dia da renovação**, resolvido DENTRO do ciclo. O
 *    ciclo atravessa a virada do mês (04/08–03/09), então uma assinatura de dia
 *    2 pertence a 02/09, não a 02/08 — esta última caiu no ciclo anterior.
 *
 * E uma trava contra mascarar gasto: o desconto nunca passa do quanto a fatura
 * de fato subiu na semana. O que não couber vira `unappliedCharges`, para a UI
 * conseguir dizer que descontou menos do que devia em vez de exibir um R$ 0,00
 * silencioso — que é exatamente como um erro de data se disfarçava antes.
 */

export type CycleReading = {
  amount: number | string;
  read_at: string;
};

export type CycleChargeKind = 'installment' | 'subscription';

export type CycleCharge = {
  label: string;
  amount: number;
  kind: CycleChargeKind;
  /**
   * Dia da renovação, só para `subscription`. Parcela ignora — ela entra na
   * virada do ciclo, não num dia do mês.
   */
  day?: number | null;
};

export type CycleWeek = {
  weekIndex: number;
  /** Quanto a fatura subiu na semana, antes de qualquer desconto. */
  invoiceDelta: number;
  /** Cobranças conhecidas que couberam no delta e foram descontadas. */
  appliedCharges: number;
  /**
   * Parte do desconto que NÃO coube no delta — a fatura não subiu o
   * suficiente. Sinal de que a data de alguma cobrança está errada.
   */
  unappliedCharges: number;
  /** Gasto livre: delta − cobranças aplicadas. Nunca negativo. */
  spent: number;
  /** Esta semana contém a leitura tratada como linha de base. */
  isBaseline: boolean;
  /** Houve alguma leitura nesta semana. */
  hasReading: boolean;
};

export type CycleSpend = {
  weeks: CycleWeek[];
  /** Valor da última leitura do ciclo (0 sem leitura nenhuma). */
  invoiceTotal: number;
  /** Ponto de partida: 0 num ciclo que nasceu zerado. */
  baseline: number;
  /** Soma dos deltas — quanto a fatura subiu no ciclo todo. */
  totalDelta: number;
  /** Soma do gasto livre do ciclo. */
  totalSpent: number;
  /** Soma das cobranças conhecidas efetivamente descontadas. */
  totalApplied: number;
  /** Soma do que não coube. > 0 = alguma data provavelmente está errada. */
  totalUnapplied: number;
};

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Dia do mês clampado ao último dia daquele mês (31 em fevereiro → 28/29). */
function dayInMonth(year: number, monthIndex: number, day: number): Date {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  return new Date(year, monthIndex, Math.min(day, daysInMonth));
}

/**
 * Semana (1-based) de uma data dentro do ciclo, medida a partir do INÍCIO do
 * ciclo exibido — não do ciclo em que a data cairia por conta própria.
 *
 * Data anterior ao início do ciclo é grampeada na semana 1: é o caso da
 * leitura lançada na véspera da virada, quando a fatura nova já tinha as
 * parcelas do mês. Ela pertence a este ciclo (o usuário disse isso ao marcar a
 * competência), só chegou um pouco antes do dia nominal de fechamento.
 */
export function weekIndexFromCycleStart(
  date: Date,
  cycleStart: Date,
  totalWeeks: number,
): number {
  const diffDays = Math.round(
    (startOfDay(date).getTime() - startOfDay(cycleStart).getTime()) /
      86_400_000,
  );

  const index = Math.ceil((diffDays + 1) / 7);

  return Math.min(totalWeeks, Math.max(1, index));
}

/**
 * Ocorrência do dia de renovação dentro do ciclo. O ciclo cobre no máximo dois
 * meses do calendário, então basta testar o dia no mês de início e no seguinte.
 * Null quando o dia não cai no ciclo (só acontece com ciclo mais curto que um
 * mês, por clamp de fim de mês).
 */
export function occurrenceInCycle(
  day: number,
  cycle: { start: Date; end: Date },
): Date | null {
  const start = startOfDay(cycle.start).getTime();
  const end = startOfDay(cycle.end).getTime();

  const candidates = [
    dayInMonth(cycle.start.getFullYear(), cycle.start.getMonth(), day),
    dayInMonth(cycle.start.getFullYear(), cycle.start.getMonth() + 1, day),
  ];

  for (const candidate of candidates) {
    const time = startOfDay(candidate).getTime();
    if (time >= start && time <= end) return candidate;
  }

  return null;
}

export type CycleSpendInput = {
  cycle: { start: Date; end: Date };
  totalWeeks: number;
  readings: CycleReading[];
  charges: CycleCharge[];
  /**
   * O ciclo nasceu zerado — havia acompanhamento do cartão antes da virada.
   * Falso só quando esta é a primeira vez que o cartão é lido.
   */
  startsAtZero: boolean;
};

export function calculateCycleSpend(input: CycleSpendInput): CycleSpend {
  const totalWeeks = Math.max(1, input.totalWeeks);

  const sorted = [...input.readings]
    .map((r) => ({ amount: Number(r.amount), readAt: new Date(r.read_at) }))
    .filter((r) => Number.isFinite(r.amount))
    .sort((a, b) => a.readAt.getTime() - b.readAt.getTime());

  const weekOf = (date: Date) =>
    weekIndexFromCycleStart(date, input.cycle.start, totalWeeks);

  const deltaByWeek = new Map<number, number>();
  const readingWeeks = new Set<number>();

  // Ciclo zerado: nada de linha de base, a primeira leitura já é gasto.
  let previous = 0;
  let baselineWeek: number | null = null;

  if (!input.startsAtZero && sorted.length > 0) {
    previous = sorted[0].amount;
    baselineWeek = weekOf(sorted[0].readAt);
    readingWeeks.add(baselineWeek);
  }

  const rest = input.startsAtZero ? sorted : sorted.slice(1);

  for (const reading of rest) {
    const week = weekOf(reading.readAt);
    const delta = Math.max(0, reading.amount - previous);

    deltaByWeek.set(week, toCurrency((deltaByWeek.get(week) ?? 0) + delta));
    readingWeeks.add(week);
    previous = reading.amount;
  }

  // Só desconta o que a fatura já teria registrado: cobrança cujo dia ainda não
  // chegou (visto pela leitura mais recente) não está lá para ser descontada.
  const lastReadingAt = sorted.length ? sorted[sorted.length - 1].readAt : null;

  const chargeByWeek = new Map<number, number>();

  for (const charge of input.charges) {
    if (!(charge.amount > 0)) continue;

    let when: Date | null;

    if (charge.kind === 'installment') {
      // Regra 2: parcela nasce com a fatura.
      when = input.cycle.start;
    } else {
      if (charge.day == null) continue;
      when = occurrenceInCycle(charge.day, input.cycle);
      if (!when) continue;
    }

    if (
      lastReadingAt &&
      startOfDay(when).getTime() > startOfDay(lastReadingAt).getTime()
    ) {
      continue;
    }

    const week = weekOf(when);
    chargeByWeek.set(
      week,
      toCurrency((chargeByWeek.get(week) ?? 0) + charge.amount),
    );
  }

  const weeks: CycleWeek[] = Array.from({ length: totalWeeks }, (_, i) => {
    const weekIndex = i + 1;
    const invoiceDelta = toCurrency(deltaByWeek.get(weekIndex) ?? 0);
    const wanted = toCurrency(chargeByWeek.get(weekIndex) ?? 0);

    // A trava: desconto nunca maior que o quanto a fatura subiu.
    const appliedCharges = toCurrency(Math.min(wanted, invoiceDelta));
    const unappliedCharges = toCurrency(wanted - appliedCharges);

    return {
      weekIndex,
      invoiceDelta,
      appliedCharges,
      unappliedCharges,
      spent: toCurrency(invoiceDelta - appliedCharges),
      isBaseline: baselineWeek === weekIndex,
      hasReading: readingWeeks.has(weekIndex),
    };
  });

  const sum = (pick: (w: CycleWeek) => number) =>
    toCurrency(weeks.reduce((acc, w) => acc + pick(w), 0));

  return {
    weeks,
    invoiceTotal: sorted.length
      ? toCurrency(sorted[sorted.length - 1].amount)
      : 0,
    baseline: toCurrency(input.startsAtZero ? 0 : (sorted[0]?.amount ?? 0)),
    totalDelta: sum((w) => w.invoiceDelta),
    totalSpent: sum((w) => w.spent),
    totalApplied: sum((w) => w.appliedCharges),
    totalUnapplied: sum((w) => w.unappliedCharges),
  };
}
