/* eslint-disable @typescript-eslint/no-explicit-any */
export function groupTransactionsByCategory(transactions: any[]) {
  const grouped: Record<
    string,
    {
      category: string;
      total: number;
      count: number;
    }
  > = {};

  for (const t of transactions) {
    const category = t.category || 'Sem categoria';

    if (!grouped[category]) {
      grouped[category] = {
        category,
        total: 0,
        count: 0,
      };
    }

    grouped[category].total += Number(t.amount);
    grouped[category].count += 1;
  }

  return Object.values(grouped).sort((a, b) => b.total - a.total);
}