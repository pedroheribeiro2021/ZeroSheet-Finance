import { DBTransaction, DBWeek } from '../types/database';
import { Transaction } from '../types/finance';
import { Week } from '../types/finance';

export function mapWeek(db: DBWeek): Week {
  return {
    id: db.id,
    monthId: db.month_id,

    index: db.index,
    budget: db.budget,
    spent: db.spent,
    remaining: db.remaining,
  };
}

export function mapTransaction(db: DBTransaction): Transaction {
  return {
    id: db.id,
    monthId: db.month_id,

    type: db.type,
    category: db.category,
    amount: db.amount,

    isFixed: db.is_fixed,
    isProvision: db.is_provision,
    isRecurring: db.is_recurring,
    dueDay: db.due_day,
    isReimbursement: db.is_reimbursement ?? false,

    card: db.card,

    createdAt: db.created_at,
  };
}
