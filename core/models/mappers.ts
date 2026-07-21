import { DBAccount, DBAccountReading, DBTransaction, DBTransfer } from '../types/database';
import { Account, AccountReading, Transaction, Transfer } from '../types/finance';

export function mapTransaction(db: DBTransaction): Transaction {
  return {
    id: db.id,
    monthId: db.month_id,

    type: db.type,
    category: db.category,
    description: db.description ?? null,
    amount: db.amount,

    isFixed: db.is_fixed,
    isProvision: db.is_provision,
    isRecurring: db.is_recurring,
    dueDay: db.due_day,
    recurringUntil: db.recurring_until ?? null,
    isReimbursement: db.is_reimbursement ?? false,
    isReserve: db.is_reserve ?? false,
    paidAt: db.paid_at ?? null,
    skipped: db.skipped ?? false,

    card: db.card,

    createdAt: db.created_at,
  };
}

export function mapAccount(db: DBAccount): Account {
  return {
    id: db.id,
    userId: db.user_id,

    name: db.name,
    kind: db.kind,
    color: db.color,

    isPaymentDefault: db.is_payment_default,

    createdAt: db.created_at,
  };
}

export function mapAccountReading(db: DBAccountReading): AccountReading {
  return {
    id: db.id,
    userId: db.user_id,
    accountId: db.account_id,
    amount: db.amount,
    readAt: db.read_at,
    createdAt: db.created_at,
  };
}

export function mapTransfer(db: DBTransfer): Transfer {
  return {
    id: db.id,
    userId: db.user_id,

    fromAccountId: db.from_account_id,
    toAccountId: db.to_account_id,
    amount: db.amount,

    kind: db.kind,
    linkedTransferId: db.linked_transfer_id,
    note: db.note,
    transferredAt: db.transferred_at,

    createdAt: db.created_at,
  };
}
