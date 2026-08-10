import { describe, it, expect } from 'vitest';
import { calculateCycleSpend, CycleCharge } from '@/core/engine/cycleSpend';
import {
  cycleLengthInWeeks,
  getCycleRange,
  getWeeksRemainingInCycle,
} from '@/core/engine/weekly';

/**
 * Contrato de ponta a ponta do ciclo 04/08–03/09 do C6, com os dados que
 * estavam de fato no banco em 06/08/2026. É o cenário que expôs a cadeia
 * inteira de bugs do acompanhamento semanal:
 *
 * - o app dizia "Gasto: R$ 0,00" na semana 1, tendo havido gasto;
 * - a leitura de 03/08 (véspera da virada, quando a fatura nova já nasce com
 *   as parcelas do mês) era descartada por cair fora do intervalo do ciclo;
 * - sobrando uma leitura só, ela virava linha de base e nada era medido;
 * - e o divisor do orçamento semanal caía de 5 para 4 no meio da semana 1.
 */
describe('contrato ponta a ponta — agosto/2026, C6', () => {
  const CLOSING_DAY = 4;
  const hoje = new Date(2026, 7, 6); // 06/08/2026

  const cycle = getCycleRange(CLOSING_DAY, hoje);
  const totalWeeks = cycleLengthInWeeks(cycle);

  // card_readings do C6 na competência agosto
  const readings = [
    { amount: 791.99, read_at: '2026-08-03T19:52:58.572Z' },
    { amount: 914.65, read_at: '2026-08-06T18:00:17.500Z' },
  ];

  // installments com card_id = C6
  // transactions de agosto, expense, card = C6, recorrentes
  const charges: CycleCharge[] = [
    { label: 'Samsung compras', amount: 703.2, kind: 'installment' },
    { label: 'Presente carlos e mariana', amount: 75.29, kind: 'installment' },
    { label: 'Smart Nutri', amount: 13.52, kind: 'subscription', day: 4 },
    { label: 'Amazon prime', amount: 19.9, kind: 'subscription', day: 5 },
    { label: 'Claude', amount: 110, kind: 'subscription', day: 16 },
    { label: 'TotalPass', amount: 119.9, kind: 'subscription', day: 21 },
  ];

  const spend = calculateCycleSpend({
    cycle,
    totalWeeks,
    readings,
    // havia leituras do C6 em julho, então o ciclo de agosto nasceu zerado
    startsAtZero: true,
    charges,
  });

  it('o ciclo é 04/08–03/09 com 5 semanas', () => {
    expect(cycle.start).toEqual(new Date(2026, 7, 4));
    expect(cycle.end).toEqual(new Date(2026, 8, 3));
    expect(totalWeeks).toBe(5);
  });

  it('em 06/08 ainda restam 5 semanas — a semana 1 não acabou', () => {
    expect(getWeeksRemainingInCycle(CLOSING_DAY, hoje)).toBe(5);
  });

  it('as duas leituras entram, e as duas caem na semana 1', () => {
    expect(spend.weeks[0].hasReading).toBe(true);
    expect(spend.weeks.filter((w) => w.hasReading)).toHaveLength(1);
  });

  it('a fatura subiu R$ 914,65 no ciclo (nasceu zerada)', () => {
    expect(spend.baseline).toBe(0);
    expect(spend.invoiceTotal).toBe(914.65);
    expect(spend.totalDelta).toBe(914.65);
  });

  it('R$ 811,91 sao parcelas e assinaturas ja lancadas', () => {
    // Samsung 703,20 + Presente 75,29 (virada) + Smart Nutri 13,52 (dia 4)
    // + Amazon prime 19,90 (dia 5). Claude (16) e TotalPass (21) ainda nao.
    expect(spend.totalApplied).toBe(811.91);
  });

  it('o gasto livre da semana 1 e R$ 102,74 — nao R$ 0,00', () => {
    expect(spend.weeks[0].spent).toBe(102.74);
  });

  it('nada foi truncado: nenhum aviso de data errada', () => {
    expect(spend.totalUnapplied).toBe(0);
  });

  it('invariante: gasto livre + descontos = quanto a fatura subiu', () => {
    expect(spend.totalSpent + spend.totalApplied).toBeCloseTo(
      spend.totalDelta,
      2,
    );
  });

  it('as semanas 2 a 5 seguem sem leitura, sem inventar gasto', () => {
    for (const week of spend.weeks.slice(1)) {
      expect(week.hasReading).toBe(false);
      expect(week.spent).toBe(0);
      expect(week.invoiceDelta).toBe(0);
    }
  });
});
