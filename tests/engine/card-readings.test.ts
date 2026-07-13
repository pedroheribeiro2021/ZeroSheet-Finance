import { describe, it, expect } from 'vitest';
import { weeklySpendFromReadings, CardReading } from '@/core/engine/weekly';

describe('weeklySpendFromReadings', () => {
  it('retorna array vazio para lista vazia', () => {
    expect(weeklySpendFromReadings([])).toEqual([]);
  });

  it('a primeira leitura é a linha de base (spent 0), a segunda mostra o delta', () => {
    const readings: CardReading[] = [
      { amount: 800, read_at: '2024-07-03T10:00:00Z' },  // dia 3 → semana 1 (base)
      { amount: 1200, read_at: '2024-07-10T10:00:00Z' }, // dia 10 → semana 2
    ];

    const result = weeklySpendFromReadings(readings);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ weekIndex: 1, spent: 0, isBaseline: true });
    expect(result[1]).toEqual({ weekIndex: 2, spent: 400, isBaseline: false });
  });

  it('ordena por read_at antes de calcular o delta (base = leitura mais antiga)', () => {
    const readings: CardReading[] = [
      { amount: 1200, read_at: '2024-07-10T10:00:00Z' },
      { amount: 800, read_at: '2024-07-03T10:00:00Z' },
    ];

    const result = weeklySpendFromReadings(readings);

    expect(result[0]).toEqual({ weekIndex: 1, spent: 0, isBaseline: true });
    expect(result[1]).toEqual({ weekIndex: 2, spent: 400, isBaseline: false });
  });

  it('gasto nunca é negativo (leitura fora de ordem protegida por max(0, delta))', () => {
    const readings: CardReading[] = [
      { amount: 1200, read_at: '2024-07-10T10:00:00Z' },
      { amount: 900, read_at: '2024-07-17T10:00:00Z' }, // menor que anterior (raro mas possível)
    ];

    const result = weeklySpendFromReadings(readings);

    expect(result[1].spent).toBe(0);
  });

  it('leituras na mesma semana somam os deltas em vez de descartar as intermediárias', () => {
    const readings: CardReading[] = [
      { amount: 500, read_at: '2024-07-01T08:00:00Z' }, // dia 1 → semana 1 (base)
      { amount: 700, read_at: '2024-07-03T08:00:00Z' }, // dia 3 → semana 1 (delta 200)
    ];

    const result = weeklySpendFromReadings(readings);

    // continua sendo a semana da leitura inicial (isBaseline), mas o delta
    // da segunda leitura dentro da mesma semana não pode desaparecer.
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ weekIndex: 1, spent: 200, isBaseline: true });
  });

  it('três semanas consecutivas calculam deltas corretamente a partir da base', () => {
    const readings: CardReading[] = [
      { amount: 400, read_at: '2024-07-03T00:00:00Z' },  // semana 1 (base)
      { amount: 900, read_at: '2024-07-10T00:00:00Z' },  // semana 2
      { amount: 1100, read_at: '2024-07-17T00:00:00Z' }, // semana 3
    ];

    const result = weeklySpendFromReadings(readings);

    expect(result[0]).toEqual({ weekIndex: 1, spent: 0, isBaseline: true });
    expect(result[1]).toEqual({ weekIndex: 2, spent: 500, isBaseline: false });
    expect(result[2]).toEqual({ weekIndex: 3, spent: 200, isBaseline: false });
  });

  it('com closingDay, agrupa pela semana do ciclo (não pelo dia do mês calendário)', () => {
    // fecha dia 4 → ciclo começa no próprio dia 4; 04–10/07 = semana 1, 11–17/07 = semana 2
    const readings: CardReading[] = [
      { amount: 995.32, read_at: '2026-07-05T10:00:00Z' }, // leitura inicial da fatura
      { amount: 1200, read_at: '2026-07-14T10:00:00Z' },   // dentro do ciclo, semana 2
    ];

    const result = weeklySpendFromReadings(readings, 4);

    expect(result[0]).toEqual({ weekIndex: 1, spent: 0, isBaseline: true });
    expect(result[1]).toEqual({
      weekIndex: 2,
      spent: 204.68,
      isBaseline: false,
    });
  });

  it('caso real: 4 leituras na semana 1 não podem esconder o gasto (regressão)', () => {
    // Dados reais do C6 (fecha dia 4) em julho/2026: quatro atualizações
    // caíram todas na semana 1 do ciclo (04–10/07) e uma na semana 2
    // (11–17/07). Antes da correção, a semana 1 virava "base" com a última
    // leitura (1275.49) e a semana 2 mostrava só 290.28 — escondendo os
    // 558.79 realmente gastos entre a leitura inicial e a última da semana 1.
    const readings: CardReading[] = [
      { amount: 716.7, read_at: '2026-07-06T15:00:32.912Z' },
      { amount: 1088.48, read_at: '2026-07-07T14:21:32.211Z' },
      { amount: 1157.54, read_at: '2026-07-08T17:40:07.932Z' },
      { amount: 1275.49, read_at: '2026-07-10T13:22:03.1Z' },
      { amount: 1565.77, read_at: '2026-07-12T22:39:37.692Z' },
    ];

    const result = weeklySpendFromReadings(readings, 4);

    expect(result).toEqual([
      { weekIndex: 1, spent: 558.79, isBaseline: true },
      { weekIndex: 2, spent: 290.28, isBaseline: false },
    ]);
  });
});
