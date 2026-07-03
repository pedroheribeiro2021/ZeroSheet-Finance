import { describe, it, expect } from 'vitest';
import { getWeeksInCurrentCycle } from '@/core/engine/weekly';

describe('getWeeksInCurrentCycle', () => {
  it('caso do usuário: 03/07/2026, fechamento dia 4 → ciclo 04/07→04/08 = 5 semanas', () => {
    expect(getWeeksInCurrentCycle(4, new Date(2026, 6, 3))).toBe(5);
  });

  it('meio do ciclo mantém o mesmo tamanho (10/07 → 04/08→04/09 ≈ 5 semanas)', () => {
    expect(getWeeksInCurrentCycle(4, new Date(2026, 6, 10))).toBe(5);
  });

  it('fechamento dia 28 → ciclo de ~4-5 semanas dependendo do mês', () => {
    // 01/02/2026: próximo fechamento 28/02, seguinte 28/03 = 28 dias = 4 semanas
    expect(getWeeksInCurrentCycle(28, new Date(2026, 1, 1))).toBe(4);
  });

  it('clampa o dia de fechamento em meses curtos (dia 31 em fevereiro)', () => {
    // 15/01/2026: próximo 31/01, seguinte 28/02 = 28 dias = 4 semanas
    expect(getWeeksInCurrentCycle(31, new Date(2026, 0, 15))).toBe(4);
  });

  it('nunca retorna menos que 1', () => {
    expect(getWeeksInCurrentCycle(1, new Date(2026, 6, 3))).toBeGreaterThanOrEqual(1);
  });
});
