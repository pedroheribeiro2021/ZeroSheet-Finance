/**
 * Regras puras de duração de recorrência.
 *
 * `recurringUntil` é a última competência (YYYY-MM-01) em que a transação
 * ainda vale. NULL/undefined = recorre para sempre.
 */

/** A recorrência ainda está ativa na competência alvo (month 1–12)? */
export function isRecurrenceActive(
  recurringUntil: string | null | undefined,
  targetYear: number,
  targetMonth: number,
): boolean {
  if (!recurringUntil) return true;

  const [y, m] = recurringUntil.split('-').map(Number);
  if (!y || !m) return true; // valor malformado: não bloqueia a cópia

  return targetYear < y || (targetYear === y && targetMonth <= m);
}

/**
 * Competência final ao recorrer por N meses a partir de (year, month).
 * N = 1 significa "só este mês". Retorna 'YYYY-MM-01'.
 */
export function recurringUntilFromMonths(
  year: number,
  month: number,
  totalMonths: number,
): string {
  const d = new Date(year, month - 1 + (totalMonths - 1), 1);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-01`;
}
