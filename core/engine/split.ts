import { TransactionType } from '../types/finance';

/**
 * Resolve um lançamento "Split" (valor único sinalizado) no par
 * type/amount que o resto do sistema já entende — sem precisar de um novo
 * tipo de transação nem de coluna no banco. Negativo subtrai do mês
 * (expense), positivo soma (income).
 */
export function resolveSplitAmount(amount: number): {
  type: TransactionType;
  amount: number;
} {
  return amount < 0
    ? { type: 'expense', amount: Math.abs(amount) }
    : { type: 'income', amount };
}
