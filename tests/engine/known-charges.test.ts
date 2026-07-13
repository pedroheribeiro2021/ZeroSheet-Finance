import { describe, it, expect } from 'vitest';
import {
  knownChargesByWeek,
  adjustWeeklySpendForKnownCharges,
  KnownCharge,
} from '@/core/engine/weekly';

describe('knownChargesByWeek', () => {
  it('agrupa assinaturas/parcelas pela semana do ciclo em que caem', () => {
    // fecha dia 4 → ciclo começa no próprio dia 4; 04–10/07 = semana 1, 11–17/07 = semana 2
    const charges: KnownCharge[] = [
      { amount: 39.9, day: 5 }, // 05/07 → semana 1
      { amount: 110, day: 15 }, // 15/07 → semana 2
    ];

    const result = knownChargesByWeek(charges, 2026, 7, 4);

    expect(result.get(1)).toBe(39.9);
    expect(result.get(2)).toBe(110);
  });

  it('soma múltiplas cargas que caem na mesma semana', () => {
    const charges: KnownCharge[] = [
      { amount: 39.9, day: 5 },
      { amount: 30, day: 6 },
    ];

    const result = knownChargesByWeek(charges, 2026, 7, 4);

    expect(result.get(1)).toBe(69.9);
  });

  it('ignora cargas sem dia definido ou com valor zero/negativo', () => {
    const charges: KnownCharge[] = [
      { amount: 39.9, day: null },
      { amount: 0, day: 10 },
      { amount: -5, day: 12 },
    ];

    const result = knownChargesByWeek(charges, 2026, 7, 4);

    expect(result.size).toBe(0);
  });

  it('clampa o dia aos dias do mês (ex.: dia 31 em fevereiro)', () => {
    const charges: KnownCharge[] = [{ amount: 50, day: 31 }];

    // fevereiro/2026 tem 28 dias; não deve lançar exceção nem sumir a carga.
    const result = knownChargesByWeek(charges, 2026, 2, 4);

    expect([...result.values()].reduce((a, b) => a + b, 0)).toBe(50);
  });
});

describe('adjustWeeklySpendForKnownCharges', () => {
  it('desconta as cargas conhecidas do gasto bruto da semana correspondente', () => {
    const weeklySpend = [
      { weekIndex: 1, spent: 100, isBaseline: true },
      { weekIndex: 2, spent: 300, isBaseline: false },
    ];
    const knownCharges = new Map([[2, 110]]);

    const result = adjustWeeklySpendForKnownCharges(weeklySpend, knownCharges);

    expect(result).toEqual([
      { weekIndex: 1, spent: 100, isBaseline: true },
      { weekIndex: 2, spent: 190, isBaseline: false },
    ]);
  });

  it('nunca fica negativo quando a carga conhecida é maior que o delta', () => {
    const weeklySpend = [{ weekIndex: 1, spent: 50, isBaseline: true }];
    const knownCharges = new Map([[1, 200]]);

    const result = adjustWeeklySpendForKnownCharges(weeklySpend, knownCharges);

    expect(result[0].spent).toBe(0);
  });

  it('semana sem carga conhecida permanece inalterada', () => {
    const weeklySpend = [{ weekIndex: 1, spent: 50, isBaseline: true }];

    const result = adjustWeeklySpendForKnownCharges(weeklySpend, new Map());

    expect(result[0].spent).toBe(50);
  });
});
