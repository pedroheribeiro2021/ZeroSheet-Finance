import { describe, it, expect } from 'vitest';
import { getWeeksRemainingInCycle } from '@/core/engine/weekly';

describe('getWeeksRemainingInCycle', () => {
  it('início do ciclo (05/07, fecha dia 4) → restam 5 semanas', () => {
    expect(getWeeksRemainingInCycle(4, new Date(2026, 6, 5))).toBe(5);
  });

  it('após 1 semana (12/07) → restam 4 semanas', () => {
    expect(getWeeksRemainingInCycle(4, new Date(2026, 6, 12))).toBe(4);
  });

  it('véspera do fechamento (03/08) → resta 1 semana', () => {
    expect(getWeeksRemainingInCycle(4, new Date(2026, 7, 3))).toBe(1);
  });

  it('no próprio dia do fechamento → já é o início do próximo ciclo, restam 5 semanas', () => {
    // o dia do fechamento já conta como o novo ciclo (ver cycleStartFor) —
    // não como a última semana do ciclo que está terminando.
    expect(getWeeksRemainingInCycle(4, new Date(2026, 7, 4))).toBe(5);
  });

  it('mês curto (fevereiro, fecha dia 28): início do ciclo → restam 4 semanas', () => {
    expect(getWeeksRemainingInCycle(28, new Date(2026, 1, 1))).toBe(4);
  });

  it('nunca retorna menos que 1', () => {
    expect(getWeeksRemainingInCycle(4, new Date(2026, 6, 3))).toBeGreaterThanOrEqual(1);
  });
});
