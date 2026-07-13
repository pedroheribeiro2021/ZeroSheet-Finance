import { describe, it, expect } from 'vitest';
import { getCycleRange } from '@/core/engine/weekly';

describe('getCycleRange', () => {
  it('fecha dia 4: visto de 12/07 → ciclo real 04/07–03/08', () => {
    const { start, end } = getCycleRange(4, new Date(2026, 6, 12));

    expect(start).toEqual(new Date(2026, 6, 4));
    expect(end).toEqual(new Date(2026, 7, 3));
  });

  it('fecha dia 4: no próprio dia do fechamento (04/07) já é o início do ciclo', () => {
    const { start, end } = getCycleRange(4, new Date(2026, 6, 4));

    expect(start).toEqual(new Date(2026, 6, 4));
    expect(end).toEqual(new Date(2026, 7, 3));
  });

  it('não ultrapassa o fechamento real mesmo quando a última semana (bloco de 7 dias) sobraria incompleta', () => {
    // fecha dia 28: ciclo 28/01→27/02 tem 31 dias (5 blocos de 7, o último
    // incompleto) — o fim real é sempre a véspera do próximo fechamento,
    // não "início + 5×7 dias" (que passaria de 27/02).
    const { start, end } = getCycleRange(28, new Date(2026, 1, 1));

    expect(start).toEqual(new Date(2026, 0, 28));
    expect(end).toEqual(new Date(2026, 1, 27));
  });

  it('clampa o dia de fechamento em meses curtos (fecha dia 31)', () => {
    const { start, end } = getCycleRange(31, new Date(2026, 1, 3));

    expect(start).toEqual(new Date(2026, 0, 31));
    expect(end).toEqual(new Date(2026, 1, 27)); // fevereiro clampado em 28, véspera = 27
  });
});
