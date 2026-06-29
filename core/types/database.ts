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

export type DBCard = {
  id: string;
  user_id: string;

  name: string;
  slug: string | null;
  color: string | null;
  limit_amount: number;
  closing_day: number | null;
  due_day: number | null;

  /**
   * Ainda não existe no schema — aguardando migration (Item A).
   * Ausência/null é tratada como false para não alterar dados existentes.
   */
  is_primary?: boolean | null;

  created_at: string | null;
};

export type DBCardSnapshot = {
  id: string;
  month_id: string | null;
  card_id: string | null;
  user_id: string | null;

  amount: number;

  created_at: string | null;
};

/**
 * Leitura parcial da fatura — lançada toda semana para acompanhar o ciclo.
 * Tabela card_readings ainda não existe (aguardando migration do Item C).
 */
export type DBCardReading = {
  id: string;
  user_id: string;
  month_id: string | null;
  card_id: string | null;
  amount: number;
  read_at: string;
  created_at: string | null;
};

export type DBInstallment = {
  id: string;
  user_id: string | null;
  card_id: string | null;

  description: string;
  total_amount: number;
  installment_amount: number;
  total_installments: number;
  current_installment: number | null;
  start_month_id: string | null;

  created_at: string | null;

  /** Relação trazida pelo select de installment.service.ts (`cards (id, name)`). */
  cards?: { id: string; name: string } | null;
};
