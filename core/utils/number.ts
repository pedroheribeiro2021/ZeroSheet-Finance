// core/utils/number.ts

export function toCurrency(value: number) {
  return Number(value.toFixed(2));
}

/**
 * Sanitiza o texto digitado num campo de valor: mantém apenas dígitos,
 * vírgula e ponto (e sinal +/- no início quando `allowSign`).
 * Use no onChange para impedir letras no campo de valor.
 */
export function sanitizeAmountInput(value: string, allowSign = false): string {
  let clean = value.replace(allowSign ? /[^\d.,+-]/g : /[^\d.,]/g, '');

  if (allowSign) {
    // sinal só é permitido no primeiro caractere
    clean = clean.charAt(0) + clean.slice(1).replace(/[+-]/g, '');
  }

  return clean;
}

/**
 * Parse de valor monetário digitado: aceita vírgula ou ponto decimal e
 * separador de milhar ("1.234,56", "1234.56", "1000,50").
 */
export function parseCurrencyInput(value: string): number {
  if (!value) return 0;

  let clean = value.trim();

  const hasComma = clean.includes(',');
  const hasDot = clean.includes('.');

  if (hasComma && hasDot) {
    // "1.234,56" → ponto é milhar, vírgula é decimal
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    clean = clean.replace(',', '.');
  }

  const parsed = Number(clean);

  if (isNaN(parsed)) return 0;

  return parsed;
}

export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}
