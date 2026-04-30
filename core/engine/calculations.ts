import { Transaction, Summary, Week } from '../types/finance';

/**
 * Soma valores baseado em tipo
 */
export function sumTransactions(
  transactions: Transaction[],
  type: 'income' | 'expense',
): number {
  return transactions
    .filter((t) => t.type === type)
    .reduce((acc, t) => acc + t.amount, 0);
}

/**
 * Soma despesas fixas
 */
export function calculateFixedExpenses(transactions: Transaction[]): number {
  return transactions
    .filter((t) => t.type === 'expense' && t.isFixed)
    .reduce((acc, t) => acc + t.amount, 0);
}

/**
 * Soma despesas variáveis
 */
export function calculateVariableExpenses(transactions: Transaction[]): number {
  return transactions
    .filter((t) => t.type === 'expense' && !t.isFixed)
    .reduce((acc, t) => acc + t.amount, 0);
}

/**
 * C6 = totalIncome - (fixed + variable)
 */
export function calculateC6(
  totalIncome: number,
  fixedExpenses: number,
  variableExpenses: number,
): number {
  return totalIncome - (fixedExpenses + variableExpenses);
}

/**
 * Orçamento semanal
 */
export function calculateWeeklyBudget(c6: number, weeksCount: number): number {
  if (weeksCount <= 0) return 0;
  return c6 / weeksCount;
}

/**
 * Saldo restante da semana
 */
export function calculateRemaining(planned: number, actual: number): number {
  return planned - actual;
}

/**
 * Calcula resumo completo
 */
export function calculateSummary(
  transactions: Transaction[],
  weeks: Week[],
): Summary {
  const totalIncome = sumTransactions(transactions, 'income');
  const fixedExpenses = calculateFixedExpenses(transactions);
  const variableExpenses = calculateVariableExpenses(transactions);

  const c6 = calculateC6(totalIncome, fixedExpenses, variableExpenses);

  const weeksCount = weeks.length;
  const weeklyBudget = calculateWeeklyBudget(c6, weeksCount);

  const totalActualSpent = weeks.reduce((acc, w) => acc + w.actual, 0);

  const remaining = c6 - totalActualSpent;

  return {
    totalIncome,
    fixedExpenses,
    variableExpenses,
    c6,
    weeklyBudget,
    remaining,
  };
}
