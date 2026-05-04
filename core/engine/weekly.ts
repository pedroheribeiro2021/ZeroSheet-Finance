import { Transaction, Week } from '../types/finance';

function getWeekIndex(date: Date) {
  const day = date.getDate();

  if (day <= 7) return 0;
  if (day <= 14) return 1;
  if (day <= 21) return 2;
  if (day <= 28) return 3;

  return 4;
}

export function calculateWeeklySpending(transactions: Transaction[]): Week[] {
  const weeksCount = 5;

  const weeks: Week[] = Array.from({ length: weeksCount }).map((_, i) => ({
    id: `week-${i}`,
    monthId: '',
    index: i + 1,
    budget: 0,
    spent: 0,
    remaining: 0,
  }));

  // filtra apenas gastos de cartão
  const cardTransactions = transactions.filter(
    (t) => t.type === 'expense' && (t.card === 'c6' || t.card === 'nubank'),
  );

  // total disponível para cartão (C6 + Nubank)
  const totalCardSpending = cardTransactions.reduce(
    (acc, t) => acc + t.amount,
    0,
  );

  const weeklyBudget = totalCardSpending / weeksCount;

  weeks.forEach((w) => {
    w.budget = weeklyBudget;
  });

  // distribuição por data real
  cardTransactions.forEach((t) => {
    const date = new Date(t.createdAt);
    const index = getWeekIndex(date);

    const week = weeks[index];

    week.spent += t.amount;
  });

  weeks.forEach((w) => {
    w.remaining = w.budget - w.spent;
  });

  return weeks;
}
