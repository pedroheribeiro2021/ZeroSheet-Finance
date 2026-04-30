export type DBMonth = {
  id: string;
  month: number;
  year: number;
  created_at: string;
};

export type DBTransaction = {
  id: string;
  month_id: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  is_fixed: boolean;
  created_at: string;
};

export type DBWeek = {
  id: string;
  month_id: string;
  week_number: number;
  planned: number;
  actual: number;
};
