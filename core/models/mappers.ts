import { DBTransaction, DBWeek } from '../types/database';
import { Transaction, Week } from '../types/finance';

export function mapTransaction(db: DBTransaction): Transaction {
  return {
    id: db.id,
    type: db.type,
    category: db.category,
    amount: Number(db.amount),
    isFixed: db.is_fixed,
  };
}

export function mapWeek(db: DBWeek): Week {
  return {
    weekNumber: db.week_number,
    planned: Number(db.planned),
    actual: Number(db.actual),
  };
}
