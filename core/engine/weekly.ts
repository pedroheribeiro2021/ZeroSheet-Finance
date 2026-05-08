import { Week, Transaction } from '../types/finance';

type Snapshot = {
  card: string;
  amount: number;
  created_at: string;
};

export function calculateWeekly(
  snapshots: Snapshot[],
  transactions: Transaction[],
  monthlyBudget: number,
  monthId: string,
  totalWeeks: number = 4,
): Week[] {
  // 🔥 PRIORIDADE 1: snapshots
  if (snapshots.length >= 0) {
    return calculateFromSnapshots(
      snapshots,
      monthlyBudget,
      monthId,
      totalWeeks,
    );
  }

  // 🔥 FALLBACK: transações
  return calculateFromTransactions(
    transactions,
    monthlyBudget,
    monthId,
    totalWeeks,
  );
}

function calculateFromSnapshots(
  snapshots: Snapshot[],
  monthlyBudget: number,
  monthId: string,
  totalWeeks: number,
): Week[] {
  const sorted = [...snapshots].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  const weeks: Week[] = [];
  let prev = 0;

  for (let i = 1; i <= totalWeeks; i++) {
    const weekSnaps = sorted.filter((s) => {
      const day = new Date(s.created_at).getDate();
      return Math.ceil(day / 7) === i;
    });

    const total = weekSnaps.reduce((acc, s) => acc + s.amount, 0);
    const spent = total - prev;

    const budget = monthlyBudget / totalWeeks;

    weeks.push({
      id: crypto.randomUUID(),
      monthId,
      index: i,
      budget,
      spent: spent > 0 ? spent : 0,
      remaining: budget - (spent > 0 ? spent : 0),
    });

    prev = total;
  }

  return weeks;
}

function calculateFromTransactions(
  transactions: Transaction[],
  monthlyBudget: number,
  monthId: string,
  totalWeeks: number,
): Week[] {
  const weeks: Week[] = [];

  for (let i = 1; i <= totalWeeks; i++) {
    const weekTx = transactions.filter((t) => {
      const day = new Date(t.createdAt).getDate();
      return Math.ceil(day / 7) === i;
    });

    const spent = weekTx
      .filter((t) => t.type === 'expense')
      .reduce((acc, t) => acc + t.amount, 0);

    const budget = monthlyBudget / totalWeeks;

    weeks.push({
      id: crypto.randomUUID(),
      monthId,
      index: i,
      budget,
      spent,
      remaining: budget - spent,
    });
  }

  return weeks;
}
