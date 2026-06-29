import { describe, it, expect } from 'vitest';
import { weeklySpendFromReadings, CardReading } from '@/core/engine/weekly';

describe('weeklySpendFromReadings', () => {
  it('retorna array vazio para lista vazia', () => {
    expect(weeklySpendFromReadings([])).toEqual([]);
  });

  it('semana 2 mostra gasto 400 quando leitura1=800 e leitura2=1200', () => {
    const readings: CardReading[] = [
      { amount: 800, read_at: '2024-07-03T10:00:00Z' },  // dia 3 → semana 1
      { amount: 1200, read_at: '2024-07-10T10:00:00Z' }, // dia 10 → semana 2
    ];

    const result = weeklySpendFromReadings(readings);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ weekIndex: 1, spent: 800 });
    expect(result[1]).toEqual({ weekIndex: 2, spent: 400 });
  });

  it('ordena por read_at antes de calcular o delta', () => {
    const readings: CardReading[] = [
      { amount: 1200, read_at: '2024-07-10T10:00:00Z' },
      { amount: 800, read_at: '2024-07-03T10:00:00Z' },
    ];

    const result = weeklySpendFromReadings(readings);

    expect(result[0]).toEqual({ weekIndex: 1, spent: 800 });
    expect(result[1]).toEqual({ weekIndex: 2, spent: 400 });
  });

  it('gasto nunca é negativo (leitura fora de ordem protegida por max(0, delta))', () => {
    const readings: CardReading[] = [
      { amount: 1200, read_at: '2024-07-10T10:00:00Z' },
      { amount: 900, read_at: '2024-07-17T10:00:00Z' }, // menor que anterior (raro mas possível)
    ];

    const result = weeklySpendFromReadings(readings);

    expect(result[1].spent).toBe(0);
  });

  it('leituras na mesma semana usam a última (maior read_at) para o cálculo do bloco', () => {
    const readings: CardReading[] = [
      { amount: 500, read_at: '2024-07-01T08:00:00Z' }, // dia 1 → semana 1
      { amount: 700, read_at: '2024-07-03T08:00:00Z' }, // dia 3 → semana 1 (sobrescreve)
    ];

    const result = weeklySpendFromReadings(readings);

    // só 1 semana, gasto = 700 (último valor da semana 1, sem prev)
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ weekIndex: 1, spent: 700 });
  });

  it('três semanas consecutivas calculam deltas corretamente', () => {
    const readings: CardReading[] = [
      { amount: 400, read_at: '2024-07-03T00:00:00Z' },  // semana 1
      { amount: 900, read_at: '2024-07-10T00:00:00Z' },  // semana 2
      { amount: 1100, read_at: '2024-07-17T00:00:00Z' }, // semana 3
    ];

    const result = weeklySpendFromReadings(readings);

    expect(result[0]).toEqual({ weekIndex: 1, spent: 400 });
    expect(result[1]).toEqual({ weekIndex: 2, spent: 500 });
    expect(result[2]).toEqual({ weekIndex: 3, spent: 200 });
  });
});
