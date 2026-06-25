import { describe, it, expect } from 'vitest';
import { normalizeCategory } from '@/core/utils/normalize';

describe('normalizeCategory', () => {
  it('ignores case differences', () => {
    expect(normalizeCategory('Mercado')).toBe(normalizeCategory('MERCADO'));
    expect(normalizeCategory('Mercado')).toBe(normalizeCategory('mercado'));
  });

  it('ignores accent differences', () => {
    expect(normalizeCategory('Mecânico')).toBe(normalizeCategory('MECANICO'));
  });

  it('collapses internal duplicated whitespace', () => {
    expect(normalizeCategory('Mercado  Livre')).toBe(
      normalizeCategory('mercado livre'),
    );
  });

  it('trims leading and trailing whitespace', () => {
    expect(normalizeCategory('  mercado  ')).toBe('mercado');
  });
});
