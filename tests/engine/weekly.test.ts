import { describe, it, expect } from 'vitest';
import { calculateWeekly, getWeeksInCycle, getWeeksInMonth } from '@/core/engine/weekly';
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

  it('respects a real (non-default) number of weeks when passed explicitly', () => {
    const weeks = calculateWeekly([], [], 500, 'm1', 5);

    expect(weeks).toHaveLength(5);
    expect(weeks[4]).toMatchObject({ index: 5, budget: 100 });
  });
});

describe('getWeeksInCycle', () => {
  it('retorna 4 para fechamento no dia 28 (28 ÷ 7 = 4)', () => {
    expect(getWeeksInCycle(28)).toBe(4);
  });

  it('retorna 5 para fechamento no dia 29', () => {
    expect(getWeeksInCycle(29)).toBe(5);
  });

  it('retorna 5 para fechamento no dia 31', () => {
    expect(getWeeksInCycle(31)).toBe(5);
  });

  it('retorna 1 para fechamento no dia 1 (mínimo)', () => {
    expect(getWeeksInCycle(1)).toBe(1);
  });

  it('retorna 1 para closingDay 0 (proteção contra valores inválidos)', () => {
    expect(getWeeksInCycle(0)).toBe(1);
  });
});

describe('getWeeksInMonth', () => {
  it('returns 4 for a 28-day February', () => {
    expect(getWeeksInMonth(2, 2026)).toBe(4); // 2026 não é bissexto
  });

  it('returns 5 for a 31-day month', () => {
    expect(getWeeksInMonth(1, 2026)).toBe(5); // Janeiro, 31 dias
  });

  it('returns 5 for a 30-day month', () => {
    expect(getWeeksInMonth(4, 2026)).toBe(5); // Abril, 30 dias
  });
});
