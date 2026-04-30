import { Transaction, Week } from '../types/finance';

export function calculateWeeklySpending(
  transactions: Transaction[],
  weeksCount: number,
): Week[] {
  const weeks: Week[] = [];

  // filtra só gastos em cartão
  const cardTransactions = transactions.filter(
    (t) => t.type === 'expense' && (t.card === 'c6' || t.card === 'nubank'),
  );

  const totalCardSpending = cardTransactions.reduce(
    (acc, t) => acc + t.amount,
    0,
  );

  const weeklyBudget = weeksCount > 0 ? totalCardSpending / weeksCount : 0;

  for (let i = 0; i < weeksCount; i++) {
    weeks.push({
      id: `week-${i}`,
      monthId: '',
      index: i + 1,
      budget: weeklyBudget,
      spent: 0,
      remaining: weeklyBudget,
    });
  }

  // distribuição simples por ordem (MVP)
  cardTransactions.forEach((t, i) => {
    const weekIndex = i % weeksCount;
    weeks[weekIndex].spent += t.amount;
    weeks[weekIndex].remaining =
      weeks[weekIndex].budget - weeks[weekIndex].spent;
  });

  return weeks;
}
