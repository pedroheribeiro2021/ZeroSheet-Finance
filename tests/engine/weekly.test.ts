import { describe, it, expect } from 'vitest';
import { calculateWeekly } from '@/core/engine/weekly';
import { Transaction } from '@/core/types/finance';

const transactions: Transaction[] = [
  {
    id: '1',
    monthId: 'm1',
    type: 'expense',
    category: 'market',
    amount: 100,
    isFixed: false,
    isProvision: false,
    isRecurring: false,
    card: null,
    createdAt: '2024-01-03',
  },
  {
    id: '2',
    monthId: 'm1',
    type: 'expense',
    category: 'market',
    amount: 50,
    isFixed: false,
    isProvision: false,
    isRecurring: false,
    card: null,
    createdAt: '2024-01-10',
  },
  {
    id: '3',
    monthId: 'm1',
    type: 'income',
    category: 'salary',
    amount: 999,
    isFixed: false,
    isProvision: false,
    isRecurring: false,
    card: null,
    createdAt: '2024-01-03',
  },
];

describe('calculateWeekly', () => {
  it('falls back to transaction-based weekly spending when there are no card snapshots', () => {
    const weeks = calculateWeekly([], transactions, 400, 'm1');

    expect(weeks).toHaveLength(4);
    expect(weeks[0]).toMatchObject({ index: 1, budget: 100, spent: 100, remaining: 0 });
    expect(weeks[1]).toMatchObject({ index: 2, budget: 100, spent: 50, remaining: 50 });
    expect(weeks[2]).toMatchObject({ index: 3, budget: 100, spent: 0, remaining: 100 });
    expect(weeks[3]).toMatchObject({ index: 4, budget: 100, spent: 0, remaining: 100 });
  });

  it('prioritizes card snapshots over transactions when snapshots exist', () => {
    const snapshots = [
      { card: 'nubank', amount: 100, created_at: '2024-01-03' },
      { card: 'nubank', amount: 250, created_at: '2024-01-10' },
    ];

    const weeks = calculateWeekly(snapshots, transactions, 400, 'm1');

    expect(weeks[0]).toMatchObject({ index: 1, spent: 100 });
    expect(weeks[1]).toMatchObject({ index: 2, spent: 150 });
  });
});
