import { Transaction } from '../types/finance';

export function calculateSummary(transactions: Transaction[], weeks: unknown[]) {
  let totalIncome = 0;

  let fixedCosts = 0;
  let nubankSpending = 0;
  let c6Spending = 0;
  let provisions = 0;

  for (const t of transactions) {
    if (t.type === 'income') {
      totalIncome += t.amount;
      continue;
    }

    if (t.isProvision) {
      provisions += t.amount;
      continue;
    }

    if (t.card === 'nubank') {
      nubankSpending += t.amount;
      continue;
    }

    if (t.card === 'c6') {
      c6Spending += t.amount;
      continue;
    }

    if (t.isFixed) {
      fixedCosts += t.amount;
      continue;
    }
  }

  const cardSpending = nubankSpending + c6Spending;

  const total = totalIncome - fixedCosts - cardSpending - provisions;

  const weeklyBudget = weeks.length > 0 ? total / weeks.length : total;

  return {
    totalIncome,
    fixedCosts,

    nubankSpending,
    c6Spending,
    cardSpending,

    provisions,
    total,
    weeklyBudget,
  };
}
