export type TransactionType = 'income' | 'expense';

export type Transaction = {
  id: string;
  monthId: string;

  type: TransactionType;

  category: string;

  amount: number;

  // NOVO
  isFixed: boolean; // água, luz, etc
  isProvision: boolean; // mercado provisão, gasolina provisão

  // NOVO (cartão)
  card?: 'nubank' | 'c6' | null;
};

export type Week = {
  id: string;
  monthId: string;

  index: number; // semana 1,2,3...
  budget: number;

  spent: number;
  remaining: number;
};
