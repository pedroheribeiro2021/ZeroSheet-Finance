import { toCurrency } from '../utils/number';

/**
 * Insights do mês — as leituras que os números do dashboard já permitem, mas
 * que ninguém faz de cabeça
 * =========================================================================
 *
 * O dashboard mostrava saldos e um gráfico de barras: quanto entrou, quanto
 * saiu, quanto cada categoria pesou. Todo dado necessário para responder
 * "sobrou ou estourou?" já estava lá — mas a conta ficava com o usuário.
 *
 * Este módulo transforma esses mesmos números em frases com veredito. Duas
 * perguntas mudam conforme a competência exibida:
 *
 *  - competência FECHADA (mês passado): a pergunta é retrospectiva — a
 *    provisão de mercado deu ou não deu? Sobrou quanto?
 *  - competência EM CURSO: perguntar "sobrou?" no dia 4 não quer dizer nada;
 *    a pergunta útil é de RITMO — no passo atual, essa provisão fecha o mês
 *    dentro ou fora?
 *
 * Ritmo é `gasto ÷ fração do ciclo já decorrida`. Simples de propósito: supõe
 * gasto uniforme, que é falso no detalhe (mercado concentra no fim de semana)
 * mas honesto no agregado e, principalmente, explicável — o usuário consegue
 * conferir a conta. A projeção só aparece depois de 20% do ciclo, porque antes
 * disso dividir por uma fração minúscula produz números absurdos.
 *
 * Função pura: recebe o resumo já calculado, devolve uma lista ordenada por
 * urgência. Não faz I/O e não recalcula nada do `calculateSummary`.
 */

export type InsightTone = 'good' | 'warn' | 'bad' | 'neutral';

export type Insight = {
  id: string;
  title: string;
  detail: string;
  tone: InsightTone;
};

export type InsightEnvelope = {
  category: string;
  planned: number;
  used: number;
  remaining: number;
};

export type InsightsInput = {
  today: Date;
  /** A competência exibida é o mês corrente? Muda a pergunta que faz sentido. */
  isCurrentMonth: boolean;
  /** Ciclo da fatura do cartão principal; sem ele, usa o mês da competência. */
  cycle: { start: Date; end: Date } | null;
  /** Competência exibida (mês 1–12) — usada quando não há ciclo. */
  competence: { month: number; year: number };

  envelopes: InsightEnvelope[];

  totalIncome: number;
  fixedCosts: number;
  cardSpending: number;
  installmentSpending: number;
  reserveSpending: number;
  total: number;

  /** Mesmos envelopes da competência anterior, para comparação. */
  previousEnvelopes?: InsightEnvelope[];
};

const BRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Quanto do período já passou, de 0 a 1. Usa o ciclo da fatura quando existe
 * (é o período em que o gasto de cartão realmente acontece) e o mês da
 * competência caso contrário.
 */
export function elapsedFraction(input: InsightsInput): number {
  const today = startOfDay(input.today).getTime();

  const start = input.cycle
    ? startOfDay(input.cycle.start).getTime()
    : new Date(input.competence.year, input.competence.month - 1, 1).getTime();

  const end = input.cycle
    ? startOfDay(input.cycle.end).getTime()
    : new Date(input.competence.year, input.competence.month, 0).getTime();

  if (end <= start) return 1;
  if (today <= start) return 0;
  if (today >= end) return 1;

  return (today - start) / (end - start);
}

/** Abaixo disso a projeção por ritmo é ruído, não previsão. */
const MIN_ELAPSED_FOR_PACE = 0.2;
/** Margem de tolerância antes de chamar de "acima do ritmo". */
const PACE_TOLERANCE = 1.1;

export function buildInsights(input: InsightsInput): Insight[] {
  const insights: Insight[] = [];
  const elapsed = elapsedFraction(input);
  const closed = !input.isCurrentMonth || elapsed >= 1;

  // ---------------------------------------------------------------- envelopes
  for (const env of input.envelopes) {
    if (env.planned <= 0) continue;

    const id = `envelope-${env.category}`;
    const pct = Math.round((env.used / env.planned) * 100);

    if (closed) {
      // Competência fechada: veredito direto.
      insights.push(
        env.remaining < 0
          ? {
              id,
              tone: 'bad',
              title: `${env.category}: estourou ${BRL(Math.abs(env.remaining))}`,
              detail: `Gastou ${BRL(env.used)} para uma provisão de ${BRL(env.planned)} (${pct}%).`,
            }
          : {
              id,
              tone: 'good',
              title: `${env.category}: sobrou ${BRL(env.remaining)}`,
              detail: `Gastou ${BRL(env.used)} dos ${BRL(env.planned)} provisionados (${pct}%).`,
            },
      );
      continue;
    }

    if (env.remaining < 0) {
      insights.push({
        id,
        tone: 'bad',
        title: `${env.category}: já estourou ${BRL(Math.abs(env.remaining))}`,
        detail: `E ainda faltam ${Math.round((1 - elapsed) * 100)}% do período. Tudo daqui para frente sai de outro lugar.`,
      });
      continue;
    }

    if (elapsed < MIN_ELAPSED_FOR_PACE) continue;

    // Ritmo: no passo atual, onde essa provisão fecha?
    const projected = toCurrency(env.used / elapsed);
    const over = projected - env.planned;

    if (over > 0 && projected > env.planned * PACE_TOLERANCE) {
      insights.push({
        id,
        tone: 'warn',
        title: `${env.category}: no ritmo atual fecha ${BRL(over)} acima`,
        detail: `${BRL(env.used)} gastos com ${Math.round(elapsed * 100)}% do período — projeta ${BRL(projected)} contra ${BRL(env.planned)} de provisão.`,
      });
    } else {
      insights.push({
        id,
        tone: 'good',
        title: `${env.category}: no ritmo, fecha dentro`,
        detail: `${BRL(env.used)} de ${BRL(env.planned)} com ${Math.round(elapsed * 100)}% do período — projeta ${BRL(projected)}.`,
      });
    }
  }

  // -------------------------------------------------- comparação com o mês anterior
  if (input.previousEnvelopes?.length) {
    const previousByCategory = new Map(
      input.previousEnvelopes.map((e) => [e.category, e]),
    );

    // Só a maior variação: uma lista de todas viraria ruído.
    let biggest: { category: string; delta: number; before: number; now: number } | null =
      null;

    for (const env of input.envelopes) {
      const before = previousByCategory.get(env.category);
      if (!before || before.used <= 0) continue;

      const delta = env.used - before.used;
      if (!biggest || Math.abs(delta) > Math.abs(biggest.delta)) {
        biggest = {
          category: env.category,
          delta,
          before: before.used,
          now: env.used,
        };
      }
    }

    if (biggest && Math.abs(biggest.delta) >= 1) {
      const up = biggest.delta > 0;

      insights.push({
        id: 'compare-previous',
        tone: 'neutral',
        title: `${biggest.category}: ${up ? 'acima' : 'abaixo'} do mês passado em ${BRL(Math.abs(biggest.delta))}`,
        detail: `${BRL(biggest.now)} agora contra ${BRL(biggest.before)} na competência anterior${closed ? '' : ' — e este mês ainda não fechou'}.`,
      });
    }
  }

  // ------------------------------------------------------- comprometimento das entradas
  if (input.totalIncome > 0) {
    const committed =
      input.fixedCosts +
      input.cardSpending +
      input.installmentSpending +
      input.reserveSpending;

    const pct = Math.round((committed / input.totalIncome) * 100);

    insights.push({
      id: 'committed',
      tone: pct >= 90 ? 'bad' : pct >= 75 ? 'warn' : 'good',
      title: `${pct}% das entradas já estão comprometidas`,
      detail: `${BRL(committed)} entre custos fixos, faturas, parcelas e reserva, de ${BRL(input.totalIncome)} que entraram. O resto é o que sobra para viver.`,
    });
  }

  // ------------------------------------------------------------------- fechamento
  insights.push(
    input.total < 0
      ? {
          id: 'closing',
          tone: 'bad',
          title: `A competência ${closed ? 'fechou' : 'está'} ${BRL(Math.abs(input.total))} no vermelho`,
          detail:
            'Entradas menos fixos, faturas, parcelas, provisões e reserva. Cobrir isso significa tirar da reserva ou estourar o cartão.',
        }
      : {
          id: 'closing',
          tone: 'good',
          title: `${closed ? 'Fechou' : 'Ainda dá para gastar'} ${BRL(input.total)}`,
          detail:
            'Entradas menos fixos, faturas, parcelas, provisões e reserva — o que resta livre na competência.',
        },
  );

  // Mais urgente primeiro: estouro, depois risco, depois o resto.
  const order: Record<InsightTone, number> = {
    bad: 0,
    warn: 1,
    good: 2,
    neutral: 3,
  };

  return insights.sort((a, b) => order[a.tone] - order[b.tone]);
}
