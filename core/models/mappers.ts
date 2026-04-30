import { DBTransaction } from '../types/database';
import { Transaction } from '../types/finance';

export function mapTransaction(db: DBTransaction): Transaction {
  return {
    id: db.id,
    monthId: db.month_id,
    type: db.type,
    category: db.category,
    amount: db.amount,

    isFixed: db.is_fixed,
    isProvision: db.is_provision,
    card: db.card,
  };
}

export type DBWeek = {
  id: string;
  month_id: string;
  week_number: number;
};

export function mapWeek(db: DBWeek) {
  return {
    id: db.id,
    monthId: db.month_id,
    weekNumber: db.week_number,
  };
}
