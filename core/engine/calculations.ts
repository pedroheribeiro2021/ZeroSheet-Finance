/* eslint-disable @typescript-eslint/no-explicit-any */
import { Transaction, Week } from '../types/finance';
import { toCurrency } from '../utils/number';
import { normalizeCategory } from '../utils/normalize';

export function calculateSummary(
  transactions: Transaction[],
  weeks: Week[],
  snapshots?: { card: string; amount: number }[],
  installments: any[] = [],
  weeklyBudgetVariant: 'total' | 'incomeMinusFixed' = 'total',
) {
  let totalIncome = 0;
  let fixedCosts = 0;
  let cardSpending = 0;
  let reimbursementIncome = 0;
  let reserveSpending = 0;

  const provisionPlanned: Record<string, number> = {};
  const realizedSpend: Record<string, number> = {};

  const hasSnapshots = !!snapshots && snapshots.length > 0;

  for (const t of transactions) {
    const cat = normalizeCategory(t.category);

    if (t.type === 'income') {
      if (t.isReimbursement) {
        reimbursementIncome += t.amount;
      } else {
        totalIncome += t.amount;
      }
      continue;
    }

    if (t.isProvision) {
      provisionPlanned[cat] = (provisionPlanned[cat] ?? 0) + t.amount;
      continue;
    }

    if (t.isReserve) {
      reserveSpending += t.amount;
      continue;
    }

    if (t.isFixed) {
      fixedCosts += t.amount;
      continue;
    }

    if (!hasSnapshots && t.card) {
      cardSpending += t.amount;
      continue;
    }

    if (hasSnapshots && t.card) {
      continue;
    }

    realizedSpend[cat] = (realizedSpend[cat] ?? 0) + t.amount;
  }

  if (hasSnapshots) {
    cardSpending = snapshots!.reduce((acc, s) => acc + Number(s.amount), 0);
  }

  // ENVELOPE: por categoria, vale o MAIOR entre planejado e realizado
  let envelopeSpending = 0;
  const provisionMap: Record<string, number> = {};
  let plannedTotal = 0;
  let usedTotal = 0;

  const categories = new Set([
    ...Object.keys(provisionPlanned),
    ...Object.keys(realizedSpend),
  ]);

  for (const cat of categories) {
    const planned = provisionPlanned[cat] ?? 0;
    const realized = realizedSpend[cat] ?? 0;

    envelopeSpending += Math.max(planned, realized);
    provisionMap[cat] = planned - realized;
    plannedTotal += planned;
    usedTotal += realized;
  }

  const installmentSpending = installments.reduce(
    (acc, i) => acc + i.installment_amount,
    0,
  );

  const total = toCurrency(
    totalIncome -
      fixedCosts -
      cardSpending -
      envelopeSpending -
      installmentSpending -
      reserveSpending,
  );

  const weeklyBudgetBase =
    weeklyBudgetVariant === 'incomeMinusFixed'
      ? totalIncome - fixedCosts
      : total;

  const weeklyBudget =
    weeks.length > 0
      ? toCurrency(weeklyBudgetBase / weeks.length)
      : toCurrency(weeklyBudgetBase);

  return {
    totalIncome,
    fixedCosts,

    cardSpending,
    reimbursementIncome,
    reserveSpending,

    provisionPlanned: plannedTotal,
    provisionUsed: usedTotal,
    provisionDiff: plannedTotal - usedTotal,
    envelopeSpending,

    total,
    weeklyBudget,

    provisionMap,
  };
}
