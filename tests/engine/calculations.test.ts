import {
  sumTransactions,
  calculateFixedExpenses,
  calculateVariableExpenses,
  calculateC6,
  calculateWeeklyBudget,
  calculateSummary,
} from '@/core/engine/calculations';

import { Transaction, Week } from '@/core/types/finance';

describe('Financial Engine', () => {
  const transactions: Transaction[] = [
    {
      id: '1',
      type: 'income',
      category: 'salario',
      amount: 4000,
      isFixed: false,
    },
    { id: '2', type: 'income', category: 'extra', amount: 500, isFixed: false },

    {
      id: '3',
      type: 'expense',
      category: 'nubank',
      amount: 1000,
      isFixed: true,
    },
    {
      id: '4',
      type: 'expense',
      category: 'seguro',
      amount: 200,
      isFixed: true,
    },

    {
      id: '5',
      type: 'expense',
      category: 'gasolina',
      amount: 400,
      isFixed: false,
    },
  ];

  const weeks: Week[] = [
    { weekNumber: 1, planned: 0, actual: 200 },
    { weekNumber: 2, planned: 0, actual: 300 },
  ];

  it('should sum incomes correctly', () => {
    const result = sumTransactions(transactions, 'income');
    expect(result).toBe(4500);
  });

  it('should calculate fixed expenses', () => {
    const result = calculateFixedExpenses(transactions);
    expect(result).toBe(1200);
  });

  it('should calculate variable expenses', () => {
    const result = calculateVariableExpenses(transactions);
    expect(result).toBe(400);
  });

  it('should calculate C6 correctly', () => {
    const c6 = calculateC6(4500, 1200, 400);
    expect(c6).toBe(2900);
  });

  it('should calculate weekly budget', () => {
    const weekly = calculateWeeklyBudget(2900, 2);
    expect(weekly).toBe(1450);
  });

  it('should calculate summary correctly', () => {
    const summary = calculateSummary(transactions, weeks);

    expect(summary.totalIncome).toBe(4500);
    expect(summary.fixedExpenses).toBe(1200);
    expect(summary.variableExpenses).toBe(400);
    expect(summary.c6).toBe(2900);
    expect(summary.weeklyBudget).toBe(1450);
    expect(summary.remaining).toBe(2400);
  });
});
