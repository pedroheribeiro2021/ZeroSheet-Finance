import { describe, it, expect } from 'vitest';
import { calculateSummary } from '@/core/engine/calculations';
import { Transaction } from '@/core/types/finance';

const transactions: Transaction[] = [
  {
    id: '1',
    monthId: 'm1',
    type: 'income',
    category: 'salary',
    amount: 4000,
    isFixed: false,
    isProvision: false,
    card: null,
  },
  {
    id: '2',
    monthId: 'm1',
    type: 'income',
    category: 'extras',
    amount: 200,
    isFixed: false,
    isProvision: false,
    card: null,
  },
  {
    id: '3',
    monthId: 'm1',
    type: 'expense',
    category: 'internet',
    amount: 100,
    isFixed: true,
    isProvision: false,
    card: null,
  },
  {
    id: '4',
    monthId: 'm1',
    type: 'expense',
    category: 'nubank',
    amount: 500,
    isFixed: false,
    isProvision: false,
    card: 'nubank',
  },
  {
    id: '5',
    monthId: 'm1',
    type: 'expense',
    category: 'market provision',
    amount: 300,
    isFixed: false,
    isProvision: true,
    card: null,
  },
];

const weeks = [{}, {}, {}, {}];

describe('financial engine v2', () => {
  it('should calculate correct summary', () => {
    const result = calculateSummary(transactions, weeks);

    expect(result.totalIncome).toBe(4200);
    expect(result.fixedCosts).toBe(100);
    expect(result.nubankSpending).toBe(500);
    expect(result.c6Spending).toBe(0);
    expect(result.cardSpending).toBe(500);
    expect(result.provisions).toBe(300);

    expect(result.total).toBe(3300);
    expect(result.weeklyBudget).toBe(825);
  });
});
