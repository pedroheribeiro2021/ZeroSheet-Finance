export type DBTransaction = {
  id: string;
  created_at: string;

  month_id: string;

  type: 'income' | 'expense';
  category: string;
  amount: number;

  is_fixed: boolean;
  is_provision: boolean;

  is_recurring: boolean;
  due_day: number | null;

  /**
   * Ainda não existe no schema do Supabase (ver PARIDADE-PLANILHA.md item 2)
   * — opcional até a migration ser aplicada; mapTransaction trata ausência
   * como `false` para não alterar o comportamento de dados existentes.
   */
  is_reimbursement?: boolean | null;

  /** Idem is_reimbursement: ainda não existe no schema (item 3). */
  is_reserve?: boolean | null;

  card: string | null;
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
