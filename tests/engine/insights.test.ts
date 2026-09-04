import { describe, it, expect } from 'vitest';
import {
  InsightsInput,
  buildInsights,
  elapsedFraction,
} from '@/core/engine/insights';

const base: InsightsInput = {
  today: new Date(2026, 8, 4),
  isCurrentMonth: true,
  cycle: { start: new Date(2026, 8, 1), end: new Date(2026, 8, 30) },
  competence: { month: 9, year: 2026 },
  envelopes: [],
  totalIncome: 5000,
  fixedCosts: 500,
  cardSpending: 800,
  installmentSpending: 0,
  reserveSpending: 1000,
  total: 1200,
};

const find = (input: InsightsInput, id: string) =>
  buildInsights(input).find((i) => i.id === id);

describe('elapsedFraction', () => {
  it('usa o ciclo da fatura quando existe', () => {
    expect(
      elapsedFraction({
        ...base,
        cycle: { start: new Date(2026, 8, 1), end: new Date(2026, 8, 11) },
        today: new Date(2026, 8, 6),
      }),
    ).toBeCloseTo(0.5, 2);
  });

  it('cai para o mês da competência sem ciclo', () => {
    expect(
      elapsedFraction({ ...base, cycle: null, today: new Date(2026, 8, 1) }),
    ).toBe(0);
  });

  it('nunca passa de 1', () => {
    expect(
      elapsedFraction({ ...base, today: new Date(2026, 9, 20) }),
    ).toBe(1);
  });
});

describe('envelope em competência fechada', () => {
  const closed: InsightsInput = {
    ...base,
    isCurrentMonth: false,
    envelopes: [
      { category: 'Mercado', planned: 600, used: 575, remaining: 25 },
      { category: 'Gasolina', planned: 350, used: 361.04, remaining: -11.04 },
    ],
  };

  it('diz quanto sobrou quando a provisão bastou', () => {
    const mercado = find(closed, 'envelope-Mercado');

    expect(mercado?.tone).toBe('good');
    expect(mercado?.title).toContain('sobrou');
    expect(mercado?.title).toContain('25,00');
  });

  it('diz quanto estourou quando não bastou', () => {
    const gasolina = find(closed, 'envelope-Gasolina');

    expect(gasolina?.tone).toBe('bad');
    expect(gasolina?.title).toContain('estourou');
    expect(gasolina?.title).toContain('11,04');
  });
});

describe('envelope em competência em curso', () => {
  it('não projeta nada no comecinho do ciclo', () => {
    // 04/09 num ciclo 01/09–30/09 é ~10% — dividir por 0,1 daria número
    // absurdo, então a projeção fica calada.
    const insight = find(
      {
        ...base,
        envelopes: [
          { category: 'Mercado', planned: 600, used: 44.25, remaining: 555.75 },
        ],
      },
      'envelope-Mercado',
    );

    expect(insight).toBeUndefined();
  });

  it('avisa quando o ritmo projeta estouro', () => {
    const insight = find(
      {
        ...base,
        today: new Date(2026, 8, 16), // ~52% do ciclo
        envelopes: [
          { category: 'Mercado', planned: 600, used: 450, remaining: 150 },
        ],
      },
      'envelope-Mercado',
    );

    expect(insight?.tone).toBe('warn');
    expect(insight?.title).toContain('acima');
  });

  it('tranquiliza quando o ritmo fecha dentro', () => {
    const insight = find(
      {
        ...base,
        today: new Date(2026, 8, 16),
        envelopes: [
          { category: 'Mercado', planned: 600, used: 250, remaining: 350 },
        ],
      },
      'envelope-Mercado',
    );

    expect(insight?.tone).toBe('good');
    expect(insight?.title).toContain('fecha dentro');
  });

  it('estouro no meio do mês é reportado como estouro, sem projeção', () => {
    const insight = find(
      {
        ...base,
        today: new Date(2026, 8, 16),
        envelopes: [
          { category: 'Mercado', planned: 600, used: 700, remaining: -100 },
        ],
      },
      'envelope-Mercado',
    );

    expect(insight?.tone).toBe('bad');
    expect(insight?.title).toContain('já estourou');
  });
});

describe('comparação com a competência anterior', () => {
  it('reporta a maior variação por categoria', () => {
    const insight = find(
      {
        ...base,
        envelopes: [
          { category: 'Mercado', planned: 600, used: 700, remaining: -100 },
          { category: 'Gasolina', planned: 350, used: 340, remaining: 10 },
        ],
        previousEnvelopes: [
          { category: 'Mercado', planned: 600, used: 520, remaining: 80 },
          { category: 'Gasolina', planned: 350, used: 335, remaining: 15 },
        ],
      },
      'compare-previous',
    );

    expect(insight?.title).toContain('Mercado');
    expect(insight?.title).toContain('acima');
    expect(insight?.title).toContain('180,00');
  });
});

describe('comprometimento e fechamento', () => {
  it('mede quanto das entradas já está comprometido', () => {
    const insight = find(base, 'committed');

    // 500 + 800 + 0 + 1000 = 2300 de 5000 → 46%
    expect(insight?.title).toContain('46%');
    expect(insight?.tone).toBe('good');
  });

  it('marca vermelho quando a competência fecha negativa', () => {
    const insight = find({ ...base, total: -300 }, 'closing');

    expect(insight?.tone).toBe('bad');
    expect(insight?.title).toContain('vermelho');
  });

  it('estouro vem antes de tudo na ordem', () => {
    const list = buildInsights({
      ...base,
      isCurrentMonth: false,
      envelopes: [
        { category: 'Gasolina', planned: 350, used: 400, remaining: -50 },
        { category: 'Mercado', planned: 600, used: 500, remaining: 100 },
      ],
    });

    expect(list[0].tone).toBe('bad');
  });
});
