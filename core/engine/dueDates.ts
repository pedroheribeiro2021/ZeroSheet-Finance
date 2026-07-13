import { Transaction } from '../types/finance';

export type DueStatus = 'overdue' | 'today' | 'upcoming' | 'paid' | 'automatic';

export type DueItem = {
  transaction: Transaction;
  dueDate: Date;
  status: DueStatus;
  daysUntil: number;
};

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Data de vencimento no mês (year/month, month 1–12) a partir do dia
 * cadastrado (`dueDay`). Clampa para o último dia do mês quando `dueDay`
 * excede os dias do mês (ex.: dia 31 em fevereiro → 28/29).
 */
export function resolveDueDate(dueDay: number, year: number, month: number): Date {
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
