export type TransactionType = 'income' | 'expense';

export type Transaction = {
  id: string;
  type: TransactionType;
  category: string;
  amount: number;
  isFixed: boolean;
};

export type Week = {
  weekNumber: number;
  planned: number;
  actual: number;
};

export type Summary = {
  totalIncome: number;
  fixedExpenses: number;
  variableExpenses: number;
  c6: number;
  weeklyBudget: number;
  remaining: number;
};

export type Month = {
  id: string;
  month: number;
  year: number;

  incomes: Transaction[];
  expenses: Transaction[];

  weeks: Week[];

  summary: Summary;
};
