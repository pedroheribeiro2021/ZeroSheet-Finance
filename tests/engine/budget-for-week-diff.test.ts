import { describe, it, expect } from 'vitest';
import { budgetForWeekDiff } from '@/core/engine/weekly';

/**
 * Cenário real que motivou a função: semana 2 congelou R$ 507,55 no dia em
 * que começou; dias depois, o saldo do mês caiu e o orçamento recalculado é
 * R$ 430,28. Gasto na semana: R$ 304,07.
 */
describe('budgetForWeekDiff', () => {
  it('semana em curso usa o recalculado, não o congelado — a armadilha que motivou a mudança', () => {
    const budget = budgetForWeekDiff(2, 2, 507.55, 430.28);

    expect(budget).toBe(430.28);
    expect(budget - 304.07).toBeCloseTo(126.21, 2);
    // o congelado dava uma folga que já não existia mais
    expect(507.55 - 304.07).toBeCloseTo(203.48, 2);
  });

  it('semana já fechada usa o congelado — veredito não muda com fatura de dias depois', () => {
    expect(budgetForWeekDiff(1, 2, 600, 430.28)).toBe(600);
  });

  it('sem congelamento ainda (semana nunca foi a atual), cai no recalculado', () => {
    expect(budgetForWeekDiff(3, 2, null, 430.28)).toBe(430.28);
  });

  it('sem semana atual definida (fora do ciclo vigente — mês passado/futuro), usa o congelado ou o recalculado como fallback', () => {
    expect(budgetForWeekDiff(1, null, 600, 430.28)).toBe(600);
    expect(budgetForWeekDiff(1, null, null, 430.28)).toBe(430.28);
  });
});
