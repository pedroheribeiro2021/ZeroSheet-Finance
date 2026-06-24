import { describe, it, expect } from 'vitest';
import { calculateSummary } from '@/core/engine/calculations';
import { Transaction, Week } from '@/core/types/finance';

const transactions: Transaction[] = [
  {
    id: '1',
    monthId: 'm1',
    type: 'income',
    category: 'salary',
    amount: 4000,
    isFixed: false,
    isProvision: false,
    isRecurring: false,
    card: null,
    createdAt: '2024-01-01',
  },
  {
    id: '2',
    monthId: 'm1',
    type: 'income',
    category: 'extras',
    amount: 200,
    isFixed: false,
    isProvision: false,
    isRecurring: false,
    card: null,
    createdAt: '2024-01-01',
  },
  {
    id: '3',
    monthId: 'm1',
    type: 'expense',
    category: 'internet',
    amount: 100,
    isFixed: true,
    isProvision: false,
    isRecurring: true,
    card: null,
    createdAt: '2024-01-01',
  },
  {
    id: '4',
    monthId: 'm1',
    type: 'expense',
    category: 'nubank',
    amount: 500,
    isFixed: false,
    isProvision: false,
    isRecurring: false,
    card: 'nubank',
    createdAt: '2024-01-05',
  },
  {
    id: '5',
    monthId: 'm1',
    type: 'expense',
    category: 'market provision',
    amount: 300,
    isFixed: false,
    isProvision: true,
    isRecurring: false,
    card: null,
    createdAt: '2024-01-01',
  },
];

const weeks: Week[] = Array.from({ length: 4 }, (_, i) => ({
  id: `w${i + 1}`,
  monthId: 'm1',
  index: i + 1,
  budget: 0,
  spent: 0,
  remaining: 0,
}));

describe('calculateSummary', () => {
  it('aggregates income, fixed costs, card spending and provisions', () => {
    const result = calculateSummary(transactions, weeks);

    expect(result.totalIncome).toBe(4200);
    expect(result.fixedCosts).toBe(100);
    expect(result.cardSpending).toBe(500);
    // card spending is its own bucket, it must not bleed into the
    // category-envelope used/diff (there's no "market provision" spend here)
    expect(result.provisionPlanned).toBe(300);
    expect(result.provisionUsed).toBe(0);
    expect(result.provisionDiff).toBe(300);
    expect(result.envelopeSpending).toBe(300);

    expect(result.total).toBe(3300);
    expect(result.weeklyBudget).toBe(825);
  });

  it('uses card snapshots instead of per-transaction card amounts when provided', () => {
    const snapshots = [{ card: 'nubank', amount: 750 }];

    const result = calculateSummary(transactions, weeks, snapshots);

    expect(result.cardSpending).toBe(750);
    expect(result.total).toBe(4200 - 100 - 750 - 300);
  });

  it('subtracts installment payments from the monthly total', () => {
    const installments = [{ installment_amount: 150 }];

    const result = calculateSummary(transactions, weeks, undefined, installments);

    expect(result.total).toBe(3300 - 150);
  });

  it('falls back to the raw total when there are no weeks yet', () => {
    const result = calculateSummary(transactions, []);

    expect(result.weeklyBudget).toBe(result.total);
  });

  it('deducts realized spend from the total when there is no provision for the category (envelope = max(0, realized))', () => {
    const tx: Transaction[] = [
      {
        id: '1',
        monthId: 'm1',
        type: 'income',
        category: 'salary',
        amount: 1000,
        isFixed: false,
        isProvision: false,
        isRecurring: false,
        card: null,
        createdAt: '2024-01-01',
      },
      {
        id: '2',
        monthId: 'm1',
        type: 'expense',
        category: 'lazer',
        amount: 700,
        isFixed: false,
        isProvision: false,
        isRecurring: false,
        card: null,
        createdAt: '2024-01-01',
      },
    ];

    const result = calculateSummary(tx, []);

    expect(result.envelopeSpending).toBe(700);
    expect(result.total).toBe(300);
  });

  it('deducts the realized spend (not the planned amount) when realized exceeds the provision', () => {
    const tx: Transaction[] = [
      {
        id: '1',
        monthId: 'm1',
        type: 'income',
        category: 'salary',
        amount: 1000,
        isFixed: false,
        isProvision: false,
        isRecurring: false,
        card: null,
        createdAt: '2024-01-01',
      },
      {
        id: '2',
        monthId: 'm1',
        type: 'expense',
        category: 'mercado',
        amount: 100,
        isFixed: false,
        isProvision: true,
        isRecurring: false,
        card: null,
        createdAt: '2024-01-01',
      },
      {
        id: '3',
        monthId: 'm1',
        type: 'expense',
        category: 'mercado',
        amount: 416,
        isFixed: false,
        isProvision: false,
        isRecurring: false,
        card: null,
        createdAt: '2024-01-05',
      },
    ];

    const result = calculateSummary(tx, []);

    expect(result.envelopeSpending).toBe(416);
    expect(result.total).toBe(1000 - 416);
  });

  it('keeps the planned amount as the envelope cost when realized spend is lower', () => {
    const tx: Transaction[] = [
      {
        id: '1',
        monthId: 'm1',
        type: 'income',
        category: 'salary',
        amount: 1000,
        isFixed: false,
        isProvision: false,
        isRecurring: false,
        card: null,
        createdAt: '2024-01-01',
      },
      {
        id: '2',
        monthId: 'm1',
        type: 'expense',
        category: 'mercado',
        amount: 500,
        isFixed: false,
        isProvision: true,
        isRecurring: false,
        card: null,
        createdAt: '2024-01-01',
      },
      {
        id: '3',
        monthId: 'm1',
        type: 'expense',
        category: 'mercado',
        amount: 200,
        isFixed: false,
        isProvision: false,
        isRecurring: false,
        card: null,
        createdAt: '2024-01-05',
      },
    ];

    const result = calculateSummary(tx, []);

    expect(result.envelopeSpending).toBe(500);
    expect(result.total).toBe(1000 - 500);
  });
});
