import { Competence, competenceIndex, nextCompetence } from './month';
import { resolveDueDate } from './dueDates';

/**
 * Ciclo da fatura — a ÚNICA regra de vencimento do app.
 * ------------------------------------------------------
 * A fatura lançada numa competência é sempre paga no mês SEGUINTE, no dia de
 * vencimento cadastrado no cartão:
 *
 *     fatura da competência M  →  vence no dia `due_day` de M+1
 *
 * Ex.: C6 vence dia 10. A fatura de julho/2026 (R$ 4.733,03) é a que vence em
 * 10/08. A de agosto/2026 só vence em 10/09 — em agosto ela ainda está
 * fechando, não é obrigação de caixa do mês.
 *
 * Qualquer lugar que precise saber "quando essa fatura sai do bolso" (calendário
 * de vencimentos, cobertura até o salário, projeção de saldo, faturas atrasadas)
 * deve passar por aqui. Antes cada tela resolvia isso por conta própria — o
 * calendário e a cobertura usavam o `due_day` da PRÓPRIA competência exibida e
 * mostravam em 10/08 a fatura que só vence em 10/09.
 */

export type InvoiceCard = {
  id: string;
  name: string;
  due_day?: number | null;
  closing_day?: number | null;
};

export type InvoiceSnapshot = {
  id: string;
  month_id: string | null;
  card_id: string | null;
  amount: number | string;
  paid_at?: string | null;
};

export type InvoiceMonth = Competence & { id: string };

export type Invoice = {
  /** id do `card_snapshots` — é por ele que se marca/desmarca como paga. */
  snapshotId: string;
  cardId: string | null;
  /** Nome do cartão, ou fallback quando o cartão foi apagado. */
  cardName: string;
  amount: number;
  /** Competência em que a fatura foi lançada (o ciclo de gastos). */
  competence: Competence;
  /** Dia de vencimento cadastrado no cartão. */
  dueDay: number;
  /** Quando o dinheiro sai: `dueDay` da competência SEGUINTE. */
  dueDate: Date;
  paid: boolean;
  paidAt?: string | null;
  /**
   * A fatura não foi lançada em Cartões e o valor veio da última leitura do
   * ciclo — é um piso, ainda pode subir até o fechamento. Não tem
   * `snapshotId` de verdade, então não dá pra marcar como paga.
   */
  estimated?: boolean;
  /** Dia de fechamento do cartão — só usado no aviso de valor estimado. */
  closingDay?: number | null;
};

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Competência em que a fatura de `competence` é efetivamente paga. */
export function paymentCompetence(competence: Competence): Competence {
  return nextCompetence(competence);
}

/**
 * Data de vencimento da fatura lançada em `competence`. Clampa o dia ao último
 * dia do mês de pagamento (dia 31 em fevereiro → 28/29), como `resolveDueDate`.
 */
export function invoiceDueDate(competence: Competence, dueDay: number): Date {
  const payment = paymentCompetence(competence);

  return resolveDueDate(dueDay, payment.year, payment.month);
}

/**
 * Todas as faturas lançadas, já com vencimento resolvido. Cartão sem `due_day`
 * fica de fora (não há como dizer quando sai do bolso) e snapshot de valor
 * zero/negativo também — não é obrigação nenhuma.
 *
 * `snapshots` deve ser o conjunto de TODAS as competências relevantes (não só a
 * exibida): a fatura que vence no mês exibido nasceu na competência anterior.
 */
export function buildInvoices(input: {
  months: InvoiceMonth[];
  snapshots: InvoiceSnapshot[];
  cards: InvoiceCard[];
}): Invoice[] {
  const monthById = new Map(input.months.map((m) => [m.id, m]));
  const cardById = new Map(input.cards.map((c) => [c.id, c]));

  const invoices: Invoice[] = [];

  for (const snapshot of input.snapshots) {
    const amount = Number(snapshot.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;

    const month = snapshot.month_id
      ? monthById.get(snapshot.month_id)
      : undefined;
    if (!month) continue;

    const card = snapshot.card_id ? cardById.get(snapshot.card_id) : undefined;
    const dueDay = card?.due_day;
    if (dueDay == null) continue;

    const competence = { month: month.month, year: month.year };

    invoices.push({
      snapshotId: snapshot.id,
      cardId: snapshot.card_id,
      cardName: card?.name ?? 'Cartão',
      amount,
      competence,
      dueDay,
      dueDate: invoiceDueDate(competence, dueDay),
      paid: !!snapshot.paid_at,
      paidAt: snapshot.paid_at ?? null,
    });
  }

  return invoices.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

export type InvoiceReading = {
  card_id: string | null;
  month_id: string | null;
  amount: number | string;
  read_at: string;
};

/**
 * Faturas da competência `month` que o usuário ainda não lançou em Cartões,
 * estimadas pela última leitura do mês. Sem isso, a fatura que vence agora
 * simplesmente sumiria da cobertura e do calendário só porque o valor final
 * ainda não foi digitado — que é justamente quando saber o valor importa.
 *
 * O resultado vem marcado como `estimated`: é piso, não valor fechado.
 */
export function estimateMissingInvoices(input: {
  invoices: Invoice[];
  cards: InvoiceCard[];
  month: InvoiceMonth;
  readings: InvoiceReading[];
}): Invoice[] {
  const competence = { month: input.month.month, year: input.month.year };

  const alreadyLaunched = new Set(
    input.invoices
      .filter(
        (i) => competenceIndex(i.competence) === competenceIndex(competence),
      )
      .map((i) => i.cardId),
  );

  const estimates: Invoice[] = [];

  for (const card of input.cards) {
    if (card.due_day == null) continue;
    if (alreadyLaunched.has(card.id)) continue;

    const latest = input.readings
      .filter((r) => r.card_id === card.id && r.month_id === input.month.id)
      .reduce<InvoiceReading | null>(
        (best, r) =>
          !best || new Date(r.read_at) > new Date(best.read_at) ? r : best,
        null,
      );

    const amount = Number(latest?.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) continue;

    estimates.push({
      snapshotId: '',
      cardId: card.id,
      cardName: card.name,
      amount,
      competence,
      dueDay: card.due_day,
      dueDate: invoiceDueDate(competence, card.due_day),
      paid: false,
      paidAt: null,
      estimated: true,
      closingDay: card.closing_day ?? null,
    });
  }

  return estimates;
}

/**
 * Faturas que VENCEM na competência informada — o que o calendário do mês deve
 * plotar. Em agosto isso traz a fatura de julho (vence 10/08) e não a de agosto
 * (que só vence 10/09).
 */
export function invoicesDueInCompetence(
  invoices: Invoice[],
  competence: Competence,
): Invoice[] {
  return invoices.filter(
    (invoice) =>
      competenceIndex({
        month: invoice.dueDate.getMonth() + 1,
        year: invoice.dueDate.getFullYear(),
      }) === competenceIndex(competence),
  );
}

/**
 * Faturas ainda não pagas cujo vencimento já passou. São as únicas que merecem
 * o aviso de atraso — uma fatura de competência anterior que vence no dia 10 do
 * mês exibido não está atrasada no dia 4, está só a vencer.
 */
export function overdueInvoices(invoices: Invoice[], today: Date): Invoice[] {
  const now = startOfDay(today).getTime();

  return invoices.filter(
    (invoice) => !invoice.paid && startOfDay(invoice.dueDate).getTime() < now,
  );
}

/**
 * Faturas em aberto que pesam no caixa da competência exibida: tudo que ainda
 * não foi pago e vence até o fim desse mês. A fatura da própria competência
 * exibida fica de fora — ela só vence no mês seguinte, então não é obrigação
 * deste mês (é isso que evita contar a mesma fatura duas vezes na projeção).
 */
export function openInvoicesUpTo(
  invoices: Invoice[],
  competence: Competence,
): Invoice[] {
  const limit = competenceIndex(competence);

  return invoices.filter((invoice) => {
    if (invoice.paid) return false;

    const due = competenceIndex({
      month: invoice.dueDate.getMonth() + 1,
      year: invoice.dueDate.getFullYear(),
    });

    return due <= limit;
  });
}
