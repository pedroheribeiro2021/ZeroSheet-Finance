// core/utils/number.ts

export function toCurrency(value: number) {
  return Number(value.toFixed(2));
}

// ✅ NOVO: parse inteligente (aceita vírgula ou ponto)
export function parseCurrencyInput(value: string): number {
  if (!value) return 0;

  // remove espaços
  const clean = value.trim();

  // troca vírgula por ponto
  const normalized = clean.replace(',', '.');

  const parsed = Number(normalized);

  if (isNaN(parsed)) return 0;

  return parsed;
}
