import { Transaction } from '../types/finance';

export type DueStatus = 'overdue' | 'today' | 'upcoming' | 'paid' | 'automatic';

export type DueItem = {
  transaction: Transaction;
  dueDate: Date;
  status: DueStatus;
  daysUntil: number;
  /**
   * Presente só quando o item representa o vencimento da FATURA do cartão
   * (não uma transação real) — id do card_snapshot a marcar/desmarcar como
   * pago. Quem renderiza usa isso pra decidir qual serviço chamar.
   */
  cardInvoiceSnapshotId?: string;
  /**
   * Só existe em item de fatura de cartão: false quando o valor da fatura
   * do mês ainda não foi lançado em Cartões — o dia de vencimento é fixo e
   * conhecido de antemão, então o item aparece mesmo assim, só sem valor
   * nem ação de marcar como pago.
   */
  amountKnown?: boolean;
};

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Data de vencimento no mês (year/month, month 1–12) a partir do dia
 * cadastrado (`dueDay`). Clampa para o último dia do mês quando `dueDay`
 * excede os dias do mês (ex.: dia 31 em fevereiro → 28/29).
 */
export function resolveDueDate(
  dueDay: number,
  year: number,
  month: number,
): Date {
  const daysInMonth = new Date(year, month, 0).getDate();
  return new Date(year, month - 1, Math.min(dueDay, daysInMonth));
}

/**
 * Classifica o vencimento em relação a hoje. Nunca retorna `paid` — quem
 * chama decide isso a partir de fora (ver Passo 2, `transaction.paidAt`)
 * e sobrepõe o resultado desta função quando aplicável.
 */
export function classifyDueStatus(
  dueDate: Date,
  today: Date,
): Exclude<DueStatus, 'paid'> {
  const due = startOfDay(dueDate).getTime();
  const now = startOfDay(today).getTime();

  if (due < now) return 'overdue';
  if (due === now) return 'today';
  return 'upcoming';
}

/**
 * Resolve e classifica os vencimentos do mês corrente (mês de `today`) para
 * despesas fixas/recorrentes com `dueDay` definido, ordenados por data.
 * `horizonDays` limita quantos dias à frente entram como `upcoming`
 * (atrasadas e a de hoje sempre entram, independente do horizonte).
 *
 * Despesa vinculada a um cartão (`transaction.card`) é cobrada
 * automaticamente na fatura — não existe "atrasado" nem ação de "marcar como
 * pago" pra ela, então seu status é sempre `automatic` (sobrepõe `paidAt` e a
 * data), e ela nunca é cortada pelo horizonte (é só informativa).
 */
export function getDueItems(
  transactions: Transaction[],
  today: Date,
  { horizonDays = 7 }: { horizonDays?: number } = {},
): DueItem[] {
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const now = startOfDay(today);

  const items: DueItem[] = [];

  for (const transaction of transactions) {
    if (transaction.skipped) continue; // pausado neste mês: sem vencimento
    if (transaction.type !== 'expense') continue;
    if (!transaction.dueDay) continue;
    if (!transaction.isFixed && !transaction.isRecurring) continue;

    const dueDate = resolveDueDate(transaction.dueDay, year, month);
    const daysUntil = Math.round(
      (startOfDay(dueDate).getTime() - now.getTime()) / 86_400_000,
    );

    const status: DueStatus = transaction.card
      ? 'automatic'
      : transaction.paidAt
        ? 'paid'
        : classifyDueStatus(dueDate, today);

    if (status === 'upcoming' && daysUntil > horizonDays) continue;

    items.push({ transaction, dueDate, status, daysUntil });
  }

  return items.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

export type InstallmentCharge = {
  id: string;
  description: string;
  amount: number;
  cardId: string | null;
  billingDay?: number | null;
};

/**
 * Parcelamentos são uma entidade separada de `transactions` (tabela
 * `installments`), então nunca passam pelo filtro de `getDueItems`. Toda
 * parcela ativa no mês é lançada sozinha na fatura do cartão — sempre
 * `automatic`, igual a uma despesa recorrente vinculada a cartão — e nunca
 * cortada por horizonte, pelos mesmos motivos de `getDueItems`.
 *
 * Sem `billingDay` cadastrado o item ainda entra na lista (o usuário pediu
 * pra aparecer mesmo sem o dia certo), mas com `dueDate` no dia 1 do mês só
 * para fins de ordenação — quem for plotar num calendário deve tratar esse
 * caso à parte (ver `dayKnown`).
 */
export function getInstallmentDueItems(
  installments: InstallmentCharge[],
  year: number,
  month: number,
): (DueItem & { dayKnown: boolean })[] {
  return installments
    .filter((i) => i.cardId)
    .map((i) => {
      const dayKnown = i.billingDay != null;
      const dueDate = dayKnown
        ? resolveDueDate(i.billingDay as number, year, month)
        : new Date(year, month - 1, 1);

      return {
        transaction: {
          id: `installment-${i.id}`,
          monthId: '',
          type: 'expense',
          category: 'Parcelamento',
          description: i.description,
          amount: i.amount,
          isFixed: false,
          isProvision: false,
          isRecurring: false,
          dueDay: i.billingDay ?? null,
          card: i.cardId,
          createdAt: '',
        },
        dueDate,
        status: 'automatic',
        daysUntil: 0,
        dayKnown,
      };
    });
}

export type CardInvoiceCharge = {
  cardId: string | null;
  cardName: string;
  dueDay: number;
  /**
   * Quando a fatura é efetivamente paga — já resolvido por
   * `engine/invoices.invoiceDueDate` (competência M → dia do cartão em M+1).
   * Esta função NÃO deriva mais a data do mês exibido: era isso que fazia o
   * calendário de agosto mostrar em 10/08 a fatura que só vence em 10/09.
   */
  dueDate: Date;
  /** id do card_snapshot — necessário pra marcar/desmarcar como paga. */
  snapshotId: string;
  amount: number;
  paidAt?: string | null;
  /** Competência de origem da fatura, ex.: "Julho de 2026". */
  competenceLabel?: string;
  /** Valor veio de leitura, não do snapshot: é piso, e não dá pra pagar. */
  estimated?: boolean;
};

/**
 * Vencimento da FATURA do cartão em si (o pagamento que o usuário faz de
 * fato pro banco), diferente das despesas/parcelas lançadas NA fatura, que já
 * são `automatic` porque pagar a fatura cobre todas elas de uma vez.
 *
 * A data vem pronta em `charge.dueDate`; aqui só se classifica em relação a
 * hoje. `paidAt` (do snapshot, quando existe) sobrepõe o status por data, como
 * em `getDueItems`. Fatura estimada (sem snapshot) entra com
 * `amountKnown: false` e sem ação de marcar como paga.
 */
export function getCardInvoiceDueItems(
  charges: CardInvoiceCharge[],
  today: Date,
  { horizonDays = 7 }: { horizonDays?: number } = {},
): DueItem[] {
  const now = startOfDay(today);

  const items: DueItem[] = [];

  for (const charge of charges) {
    const dueDate = charge.dueDate;
    const daysUntil = Math.round(
      (startOfDay(dueDate).getTime() - now.getTime()) / 86_400_000,
    );

    const amountKnown = Boolean(charge.snapshotId) && !charge.estimated;

    const status: DueStatus = charge.paidAt
      ? 'paid'
      : classifyDueStatus(dueDate, today);

    if (status === 'upcoming' && daysUntil > horizonDays) continue;

    items.push({
      transaction: {
        id: `card-invoice-${charge.cardId}-${charge.dueDate.getTime()}`,
        monthId: '',
        type: 'expense',
        category: charge.competenceLabel
          ? `Fatura ${charge.competenceLabel}`
          : 'Fatura do cartão',
        description: charge.cardName,
        amount: charge.amount,
        isFixed: false,
        isProvision: false,
        isRecurring: false,
        dueDay: charge.dueDay,
        card: charge.cardId,
        createdAt: '',
      },
      dueDate,
      status,
      daysUntil,
      cardInvoiceSnapshotId: charge.snapshotId || undefined,
      amountKnown,
    });
  }

  return items.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}
