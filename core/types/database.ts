export type DBTransaction = {
  id: string;
  created_at: string;

  month_id: string;

  type: 'income' | 'expense';
  category: string;
  amount: number;

  is_fixed: boolean;

  // 🔥 NOVOS CAMPOS
  is_provision: boolean;
  card: 'nubank' | 'c6' | null;
};

export type DBMonth = {
  id: string;
  month: number;
  year: number;
  created_at: string;
};

export type DBWeek = {
  id: string;
  month_id: string;

  index: number;
  budget: number;
  spent: number;
  remaining: number;

  created_at: string;
};
