import { describe, it, expect } from 'vitest';
import {
  isRecurrenceActive,
  recurringUntilFromMonths,
} from '@/core/engine/recurrence';

describe('isRecurrenceActive', () => {
  it('null/undefined = recorre para sempre', () => {
    expect(isRecurrenceActive(null, 2030, 12)).toBe(true);
    expect(isRecurrenceActive(undefined, 2030, 12)).toBe(true);
  });

  it('ativa quando a competência alvo é anterior ou igual ao limite', () => {
    expect(isRecurrenceActive('2026-12-01', 2026, 11)).toBe(true);
    expect(isRecurrenceActive('2026-12-01', 2026, 12)).toBe(true);
    expect(isRecurrenceActive('2027-01-01', 2026, 12)).toBe(true);
  });

  it('inativa quando a competência alvo passou do limite', () => {
    expect(isRecurrenceActive('2026-12-01', 2027, 1)).toBe(false);
    expect(isRecurrenceActive('2026-07-01', 2026, 8)).toBe(false);
  });

  it('valor malformado não bloqueia a cópia', () => {
    expect(isRecurrenceActive('banana', 2026, 8)).toBe(true);
  });
});

describe('recurringUntilFromMonths', () => {
  it('N=1 significa só este mês', () => {
    expect(recurringUntilFromMonths(2026, 7, 1)).toBe('2026-07-01');
  });

  it('N=6 a partir de jul/2026 termina em dez/2026', () => {
    expect(recurringUntilFromMonths(2026, 7, 6)).toBe('2026-12-01');
  });

  it('vira o ano corretamente', () => {
    expect(recurringUntilFromMonths(2026, 11, 4)).toBe('2027-02-01');
  });
});
