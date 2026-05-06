/* eslint-disable @typescript-eslint/no-explicit-any */
import { Transaction, Week } from '../types/finance';
import { toCurrency } from '../utils/number';
import { normalizeCategory } from '../utils/normalize';

export function calculateSummary(
  transactions: Transaction[],
  weeks: Week[],
  snapshots?: { card: string; amount: number }[],
  installments: any[] = [],
) {
  let totalIncome = 0;
  let fixedCosts = 0;

  let provisionPlanned = 0;
  let provisionUsed = 0;

  let nubankSpending = 0;
  let c6Spending = 0;

  const provisionMap: Record<string, number> = {};

  for (const t of transactions) {
    const category = normalizeCategory(t.category);

    if (t.type === 'income') {
      totalIncome += t.amount;
      continue;
    }

    if (t.isProvision) {
      provisionPlanned += t.amount;
      provisionMap[category] = (provisionMap[category] || 0) + t.amount;
      continue;
    }

    if (!t.isFixed && !t.isProvision && t.type === 'expense') {
      provisionUsed += t.amount;
      provisionMap[category] = (provisionMap[category] || 0) - t.amount;
    }

    if (!snapshots || snapshots.length === 0) {
      if (t.card === 'nubank') {
        nubankSpending += t.amount;
        continue;
      }

      if (t.card === 'c6') {
        c6Spending += t.amount;
        continue;
      }
    }

    if (t.isFixed) {
      fixedCosts += t.amount;
      continue;
    }
  }

  // SNAPSHOT
  if (snapshots && snapshots.length > 0) {
    const nubankSnapshot = snapshots.find((s) => s.card === 'nubank');
    const c6Snapshot = snapshots.find((s) => s.card === 'c6');

    if (nubankSnapshot) nubankSpending = nubankSnapshot.amount;
    if (c6Snapshot) c6Spending = c6Snapshot.amount;
  }

  const cardSpending = nubankSpending + c6Spending;

  const provisionDiff = provisionPlanned - provisionUsed;

  const installmentSpending = installments.reduce(
    (acc, i) => acc + i.installment_amount,
    0,
  );

  const total = toCurrency(
    totalIncome -
      fixedCosts -
      cardSpending -
      provisionPlanned -
      installmentSpending,
  );

  const weeklyBudget =
    weeks.length > 0 ? toCurrency(total / weeks.length) : total;

  return {
    totalIncome,
    fixedCosts,

    nubankSpending,
    c6Spending,
    cardSpending,

    provisionPlanned,
    provisionUsed,
    provisionDiff,

    total,
    weeklyBudget,

    provisionMap,
  };
}
