import { Transaction } from '../types/finance';

export function calculateSummary(transactions: Transaction[], weeks: unknown[]) {
  let totalIncome = 0;

  let fixedCosts = 0;
  let cardSpending = 0;
  let provisions = 0;

  for (const t of transactions) {
    if (t.type === 'income') {
      totalIncome += t.amount;
      continue;
    }

    // PROVISÃO (não gasto ainda)
    if (t.isProvision) {
      provisions += t.amount;
      continue;
    }

    // CARTÃO
    if (t.card === 'nubank' || t.card === 'c6') {
      cardSpending += t.amount;
      continue;
    }

    // FIXOS
    if (t.isFixed) {
      fixedCosts += t.amount;
      continue;
    }
  }

  const total = totalIncome - fixedCosts - cardSpending - provisions;

  const weeklyBudget = weeks.length > 0 ? total / weeks.length : total;

  return {
    totalIncome,
    fixedCosts,
    cardSpending,
    provisions,
    total,
    weeklyBudget,
  };
}
