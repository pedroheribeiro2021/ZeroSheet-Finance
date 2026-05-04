export type TransactionType = 'income' | 'expense';

export type Transaction = {
  id: string;
  monthId: string;

  type: 'income' | 'expense';

  category: string;
  amount: number;

  isFixed: boolean;
  isProvision: boolean;

  card?: 'c6' | 'nubank' | null;

  createdAt: string; // 👈 ESSENCIAL
};

export type Week = {
  id: string;
  monthId: string;

  index: number; // semana 1,2,3...
  budget: number;

  spent: number;
  remaining: number;
};
