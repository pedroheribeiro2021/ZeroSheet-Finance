import { DBTransaction } from '../types/database';
import { Transaction } from '../types/finance';

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
