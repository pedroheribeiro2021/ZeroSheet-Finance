import { describe, it, expect } from 'vitest';
import {
  calculateCycleSpend,
  occurrenceInCycle,
  weekIndexFromCycleStart,
  CycleCharge,
} from '@/core/engine/cycleSpend';

/** Ciclo real do C6 (fecha dia 4): 04/08–03/09, 31 dias, 5 semanas. */
const cicloAgosto = { start: new Date(2026, 7, 4), end: new Date(2026, 8, 3) };

describe('weekIndexFromCycleStart', () => {
  it('numera as semanas a partir do início do ciclo', () => {
    expect(
      weekIndexFromCycleStart(new Date(2026, 7, 4), cicloAgosto.start, 5),
    ).toBe(1);
    expect(
      weekIndexFromCycleStart(new Date(2026, 7, 10), cicloAgosto.start, 5),
    ).toBe(1);
    expect(
      weekIndexFromCycleStart(new Date(2026, 7, 11), cicloAgosto.start, 5),
    ).toBe(2);
    expect(
      weekIndexFromCycleStart(new Date(2026, 8, 3), cicloAgosto.start, 5),
    ).toBe(5);
  });

  it('data anterior à virada é grampeada na semana 1', () => {
    // A fatura nova ja tinha as parcelas em 03/08, vespera do fechamento
    // nominal. A leitura pertence a este ciclo, so chegou um pouco antes.
    expect(
      weekIndexFromCycleStart(new Date(2026, 7, 3), cicloAgosto.start, 5),
    ).toBe(1);
    expect(
      weekIndexFromCycleStart(new Date(2026, 6, 20), cicloAgosto.start, 5),
    ).toBe(1);
  });

  it('nunca passa do total de semanas', () => {
    expect(
      weekIndexFromCycleStart(new Date(2026, 8, 30), cicloAgosto.start, 5),
    ).toBe(5);
  });
});

describe('occurrenceInCycle', () => {
  it('resolve o dia da assinatura dentro do ciclo, atravessando o mês', () => {
    expect(occurrenceInCycle(16, cicloAgosto)).toEqual(new Date(2026, 7, 16));
    expect(occurrenceInCycle(4, cicloAgosto)).toEqual(new Date(2026, 7, 4));
    // dia 2 no ciclo 04/08–03/09 é 02/09 — 02/08 caiu no ciclo anterior
    expect(occurrenceInCycle(2, cicloAgosto)).toEqual(new Date(2026, 8, 2));
  });

  it('clampa dia 31 ao fim do mês', () => {
    const ciclo = { start: new Date(2026, 0, 4), end: new Date(2026, 1, 3) };
    expect(occurrenceInCycle(31, ciclo)).toEqual(new Date(2026, 0, 31));
  });
});

/**
 * Cenário real de agosto/2026, os números que estavam na tela do usuário:
 * a fatura nova ja nasceu com R$ 791,99 de parcelas e assinaturas, e em 06/08
 * estava em R$ 914,65. O app mostrava "Gasto R$ 0,00".
 */
describe('contrato — ciclo 04/08–03/09 do C6', () => {
  const readings = [
    { amount: 791.99, read_at: '2026-08-03T19:52:58Z' }, // vespera da virada
    { amount: 914.65, read_at: '2026-08-06T18:00:17Z' },
  ];

  const charges: CycleCharge[] = [
    { label: 'Samsung compras', amount: 703.2, kind: 'installment' },
    { label: 'Presente carlos e mariana', amount: 75.29, kind: 'installment' },
    { label: 'Smart Nutri', amount: 13.52, kind: 'subscription', day: 4 },
    { label: 'Amazon prime', amount: 19.9, kind: 'subscription', day: 5 },
    { label: 'Claude', amount: 110, kind: 'subscription', day: 16 },
    { label: 'TotalPass', amount: 119.9, kind: 'subscription', day: 21 },
  ];

  const result = calculateCycleSpend({
    cycle: cicloAgosto,
    totalWeeks: 5,
    readings,
    charges,
    startsAtZero: true,
  });

  const semana1 = result.weeks[0];

  it('a leitura da vespera entra no ciclo, na semana 1', () => {
    expect(semana1.hasReading).toBe(true);
    expect(
      result.weeks.filter((w) => w.hasReading).map((w) => w.weekIndex),
    ).toEqual([1]);
  });

  it('o ciclo nasceu zerado: a fatura subiu os R$ 914,65 inteiros', () => {
    expect(result.baseline).toBe(0);
    expect(semana1.invoiceDelta).toBe(914.65);
    expect(result.totalDelta).toBe(914.65);
  });

  it('desconta parcelas e as assinaturas que ja renovaram — nao as futuras', () => {
    // Samsung 703,20 + Presente 75,29 (ambas na virada) + Smart Nutri 13,52
    // (dia 4) + Amazon 19,90 (dia 5) = 811,91.
    // Claude (dia 16) e TotalPass (dia 21) ainda nao cairam em 06/08.
    expect(semana1.appliedCharges).toBe(811.91);
  });

  it('sobra R$ 102,74 de gasto livre — nao R$ 0,00', () => {
    expect(semana1.spent).toBe(102.74);
  });

  it('nada foi truncado, entao nenhum aviso', () => {
    expect(result.totalUnapplied).toBe(0);
  });

  it('a parcela de dia 20 e descontada na semana 1, nao na semana 3', () => {
    // Presente carlos e mariana tem billing_day 20 cadastrado, mas apareceu na
    // fatura em 03/08. Se fosse posicionada pelo dia, o gasto livre da semana 1
    // ficaria R$ 75,29 maior do que a realidade.
    const semDesconto = calculateCycleSpend({
      cycle: cicloAgosto,
      totalWeeks: 5,
      readings,
      charges: charges.map((c) =>
        c.label === 'Presente carlos e mariana'
          ? { ...c, kind: 'subscription' as const, day: 20 }
          : c,
      ),
      startsAtZero: true,
    });

    expect(semDesconto.weeks[0].spent).toBe(178.03);
    expect(semDesconto.weeks[0].spent - semana1.spent).toBeCloseTo(75.29, 2);
  });
});

describe('invariante do ciclo', () => {
  /**
   * A garantia que impede dinheiro de sumir do acompanhamento sem ninguem
   * perceber: tudo que a fatura subiu tem que estar classificado como gasto
   * livre ou como cobranca conhecida descontada. Se essa igualdade quebrar,
   * algum valor evaporou no caminho.
   */
  const cenarios = [
    {
      nome: 'ciclo zerado com parcelas e assinaturas',
      readings: [
        { amount: 791.99, read_at: '2026-08-03T19:52:00Z' },
        { amount: 914.65, read_at: '2026-08-06T18:00:00Z' },
        { amount: 1500.4, read_at: '2026-08-19T10:00:00Z' },
        { amount: 2100.0, read_at: '2026-08-28T10:00:00Z' },
      ],
      charges: [
        { label: 'p1', amount: 703.2, kind: 'installment' as const },
        { label: 'a1', amount: 110, kind: 'subscription' as const, day: 16 },
        { label: 'a2', amount: 119.9, kind: 'subscription' as const, day: 21 },
      ],
      startsAtZero: true,
    },
    {
      nome: 'primeira leitura da vida do cartao (com linha de base)',
      readings: [
        { amount: 500, read_at: '2026-08-06T10:00:00Z' },
        { amount: 900, read_at: '2026-08-20T10:00:00Z' },
      ],
      charges: [
        { label: 'a1', amount: 110, kind: 'subscription' as const, day: 16 },
      ],
      startsAtZero: false,
    },
    {
      nome: 'sem leitura nenhuma',
      readings: [],
      charges: [{ label: 'p1', amount: 703.2, kind: 'installment' as const }],
      startsAtZero: true,
    },
    {
      nome: 'cobranca maior que o quanto a fatura subiu',
      readings: [
        { amount: 50, read_at: '2026-08-05T10:00:00Z' },
        { amount: 60, read_at: '2026-08-06T10:00:00Z' },
      ],
      charges: [{ label: 'p1', amount: 703.2, kind: 'installment' as const }],
      startsAtZero: true,
    },
  ];

  for (const cenario of cenarios) {
    it(`${cenario.nome}: gasto livre + descontos = quanto a fatura subiu`, () => {
      const r = calculateCycleSpend({
        cycle: cicloAgosto,
        totalWeeks: 5,
        readings: cenario.readings,
        charges: cenario.charges,
        startsAtZero: cenario.startsAtZero,
      });

      expect(r.totalSpent + r.totalApplied).toBeCloseTo(r.totalDelta, 2);

      for (const w of r.weeks) {
        expect(w.spent + w.appliedCharges).toBeCloseTo(w.invoiceDelta, 2);
        expect(w.spent).toBeGreaterThanOrEqual(0);
        expect(w.appliedCharges).toBeLessThanOrEqual(w.invoiceDelta);
      }
    });

    it(`${cenario.nome}: o que a fatura subiu bate com a ultima leitura`, () => {
      const r = calculateCycleSpend({
        cycle: cicloAgosto,
        totalWeeks: 5,
        readings: cenario.readings,
        charges: cenario.charges,
        startsAtZero: cenario.startsAtZero,
      });

      expect(r.totalDelta).toBeCloseTo(r.invoiceTotal - r.baseline, 2);
    });
  }
});

describe('trava contra mascarar gasto', () => {
  it('desconto nao passa do delta e o excedente vira aviso', () => {
    const r = calculateCycleSpend({
      cycle: cicloAgosto,
      totalWeeks: 5,
      readings: [{ amount: 100, read_at: '2026-08-06T10:00:00Z' }],
      charges: [{ label: 'parcela gorda', amount: 703.2, kind: 'installment' }],
      startsAtZero: true,
    });

    expect(r.weeks[0].invoiceDelta).toBe(100);
    expect(r.weeks[0].appliedCharges).toBe(100);
    expect(r.weeks[0].spent).toBe(0);
    // sem isso o R$ 0,00 seria indistinguivel de "nao gastei nada"
    expect(r.weeks[0].unappliedCharges).toBe(603.2);
    expect(r.totalUnapplied).toBe(603.2);
  });

  it('gasto livre nunca fica negativo', () => {
    const r = calculateCycleSpend({
      cycle: cicloAgosto,
      totalWeeks: 5,
      readings: [{ amount: 10, read_at: '2026-08-06T10:00:00Z' }],
      charges: [{ label: 'p', amount: 5000, kind: 'installment' }],
      startsAtZero: true,
    });

    expect(r.weeks.every((w) => w.spent >= 0)).toBe(true);
  });
});

describe('linha de base', () => {
  it('ciclo zerado nao tem base: a primeira leitura ja e gasto', () => {
    const r = calculateCycleSpend({
      cycle: cicloAgosto,
      totalWeeks: 5,
      readings: [{ amount: 300, read_at: '2026-08-06T10:00:00Z' }],
      charges: [],
      startsAtZero: true,
    });

    expect(r.baseline).toBe(0);
    expect(r.weeks[0].spent).toBe(300);
    expect(r.weeks.some((w) => w.isBaseline)).toBe(false);
  });

  it('primeira leitura da vida do cartao vira base e nao conta como gasto', () => {
    const r = calculateCycleSpend({
      cycle: cicloAgosto,
      totalWeeks: 5,
      readings: [
        { amount: 300, read_at: '2026-08-06T10:00:00Z' },
        { amount: 450, read_at: '2026-08-13T10:00:00Z' },
      ],
      charges: [],
      startsAtZero: false,
    });

    expect(r.baseline).toBe(300);
    expect(r.weeks[0].spent).toBe(0);
    expect(r.weeks[0].isBaseline).toBe(true);
    expect(r.weeks[1].spent).toBe(150);
  });
});
