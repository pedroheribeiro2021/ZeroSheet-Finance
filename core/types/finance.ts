export type TransactionType = 'income' | 'expense';

export type Transaction = {
  id: string;
  monthId: string;

  type: 'income' | 'expense';

  category: string;
  amount: number;

  isFixed: boolean;
  isProvision: boolean;
  isRecurring: boolean;
  dueDay?: number | null;

  /** Receita que aparece no resumo mas não soma no total (ex.: reembolso). */
  isReimbursement?: boolean;

  /** Reserva/poupança: abate do total, mas separado de custos fixos. */
  isReserve?: boolean;

  card?: string | null;

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

export interface CardSnapshot {
  id: string;
  monthId: string;
  card: string;
  amount: number;
}
