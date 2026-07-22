export type TransactionType = 'income' | 'expense';

export type Transaction = {
  id: string;
  monthId: string;

  type: 'income' | 'expense';

  category: string;
  /** Nome do lançamento (ex.: 'Claude'); category agrupa (ex.: 'Assinaturas'). */
  description?: string | null;
  amount: number;

  isFixed: boolean;
  isProvision: boolean;
  isRecurring: boolean;
  dueDay?: number | null;

  /** Última competência (YYYY-MM-01) da recorrência; null = para sempre. */
  recurringUntil?: string | null;

  /** Receita que aparece no resumo mas não soma no total (ex.: reembolso). */
  isReimbursement?: boolean;

  /** Reserva/poupança: abate do total, mas separado de custos fixos. */
  isReserve?: boolean;

  /** Vencimento do mês pago (controle de vencimento); null/undefined = não pago. */
  paidAt?: string | null;

  /** "Pausado neste mês": não conta em nenhum cálculo; volta ativo no mês seguinte. */
  skipped?: boolean;

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

export type AccountKind = 'corrente' | 'guardado';

export type Account = {
  id: string;
  userId: string;

  name: string;
  kind: AccountKind;
  color: string | null;

  /** Conta de onde saem os pagamentos por padrão (projeção do dashboard). */
  isPaymentDefault: boolean;

  createdAt: string;
};

export type AccountReading = {
  id: string;
  userId: string;
  accountId: string;
  amount: number;
  readAt: string;
  createdAt: string;
};

export type TransferKind = 'complemento' | 'devolucao' | 'movimentacao';

export type Transfer = {
  id: string;
  userId: string;

  fromAccountId: string;
  toAccountId: string;
  amount: number;

  kind: TransferKind;
  linkedTransferId: string | null;
  note: string | null;
  transferredAt: string;

  createdAt: string;
};
