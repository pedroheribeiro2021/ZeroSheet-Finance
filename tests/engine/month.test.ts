import { describe, it, expect } from 'vitest';
import {
  carriedOverInvoices,
  competenceIndex,
  competenceKey,
  findPreviousMonth,
  latestCompetence,
  nextCompetence,
  nextMonthToOpen,
  sortByCompetence,
} from '@/core/engine/month';

describe('nextCompetence', () => {
  it('avança dentro do mesmo ano', () => {
    expect(nextCompetence({ month: 7, year: 2026 })).toEqual({
      month: 8,
      year: 2026,
    });
  });

  it('vira o ano em dezembro', () => {
    expect(nextCompetence({ month: 12, year: 2026 })).toEqual({
      month: 1,
      year: 2027,
    });
  });
});

describe('competenceIndex / competenceKey', () => {
  it('ordena dezembro antes de janeiro do ano seguinte', () => {
    expect(competenceIndex({ month: 12, year: 2026 })).toBeLessThan(
      competenceIndex({ month: 1, year: 2027 }),
    );
  });

  it('formata a chave com mês zero-padded', () => {
    expect(competenceKey({ month: 8, year: 2026 })).toBe('2026-08');
    expect(competenceKey({ month: 11, year: 2026 })).toBe('2026-11');
  });
});

describe('sortByCompetence', () => {
  it('ordena por competência e não muta a entrada', () => {
    const input = [
      { month: 1, year: 2027 },
      { month: 7, year: 2026 },
      { month: 12, year: 2026 },
    ];

    expect(sortByCompetence(input)).toEqual([
      { month: 7, year: 2026 },
      { month: 12, year: 2026 },
      { month: 1, year: 2027 },
    ]);
    expect(input[0]).toEqual({ month: 1, year: 2027 });
  });
});

describe('latestCompetence', () => {
  it('retorna null para lista vazia', () => {
    expect(latestCompetence([])).toBeNull();
  });

  it('retorna a maior competência mesmo fora de ordem', () => {
    expect(
      latestCompetence([
        { month: 12, year: 2026 },
        { month: 7, year: 2026 },
      ]),
    ).toEqual({ month: 12, year: 2026 });
  });
});

describe('findPreviousMonth', () => {
  const months = [
    { id: 'jun', month: 6, year: 2026 },
    { id: 'jul', month: 7, year: 2026 },
    { id: 'set', month: 9, year: 2026 },
  ];

  it('acha o mês imediatamente anterior por competência', () => {
    expect(findPreviousMonth(months, { month: 8, year: 2026 })?.id).toBe('jul');
  });

  it('ignora meses de competência igual ou posterior', () => {
    // agosto criado DEPOIS de setembro não pode puxar recorrência de setembro
    expect(findPreviousMonth(months, { month: 7, year: 2026 })?.id).toBe('jun');
  });

  it('retorna null quando não há mês anterior', () => {
    expect(findPreviousMonth(months, { month: 1, year: 2026 })).toBeNull();
    expect(findPreviousMonth([], { month: 8, year: 2026 })).toBeNull();
  });

  it('não depende da ordem de inserção da lista', () => {
    const shuffled = [months[2], months[0], months[1]];
    expect(findPreviousMonth(shuffled, { month: 8, year: 2026 })?.id).toBe('jul');
  });
});

describe('nextMonthToOpen', () => {
  it('é a competência seguinte à mais recente', () => {
    expect(
      nextMonthToOpen([
        { month: 6, year: 2026 },
        { month: 7, year: 2026 },
      ]),
    ).toEqual({ month: 8, year: 2026 });
  });

  it('retorna null quando não há mês nenhum', () => {
    expect(nextMonthToOpen([])).toBeNull();
  });
});

describe('carriedOverInvoices', () => {
  const months = [
    { id: 'jun', month: 6, year: 2026 },
    { id: 'jul', month: 7, year: 2026 },
    { id: 'ago', month: 8, year: 2026 },
  ];
  const cards = [
    { id: 'c1', name: 'Nubank' },
    { id: 'c2', name: 'C6' },
  ];
  const current = { month: 8, year: 2026 };

  it('traz faturas não pagas de competências anteriores', () => {
    const result = carriedOverInvoices({
      months,
      cards,
      current,
      snapshots: [
        { id: 's1', month_id: 'jul', card_id: 'c1', amount: 1200, paid_at: null },
      ],
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      snapshotId: 's1',
      cardName: 'Nubank',
      amount: 1200,
      competence: { month: 7, year: 2026 },
    });
  });

  it('ignora fatura já paga', () => {
    expect(
      carriedOverInvoices({
        months,
        cards,
        current,
        snapshots: [
          {
            id: 's1',
            month_id: 'jul',
            card_id: 'c1',
            amount: 1200,
            paid_at: '2026-08-01',
          },
        ],
      }),
    ).toEqual([]);
  });

  it('ignora a fatura da própria competência exibida', () => {
    expect(
      carriedOverInvoices({
        months,
        cards,
        current,
        snapshots: [
          { id: 's1', month_id: 'ago', card_id: 'c1', amount: 900, paid_at: null },
        ],
      }),
    ).toEqual([]);
  });

  it('ignora fatura de competência futura', () => {
    expect(
      carriedOverInvoices({
        months,
        cards,
        current: { month: 7, year: 2026 },
        snapshots: [
          { id: 's1', month_id: 'ago', card_id: 'c1', amount: 900, paid_at: null },
        ],
      }),
    ).toEqual([]);
  });

  it('ignora valor zero ou negativo', () => {
    expect(
      carriedOverInvoices({
        months,
        cards,
        current,
        snapshots: [
          { id: 's1', month_id: 'jul', card_id: 'c1', amount: 0, paid_at: null },
          { id: 's2', month_id: 'jun', card_id: 'c1', amount: -50, paid_at: null },
        ],
      }),
    ).toEqual([]);
  });

  it('aceita amount vindo como string do Postgres', () => {
    const result = carriedOverInvoices({
      months,
      cards,
      current,
      snapshots: [
        { id: 's1', month_id: 'jul', card_id: 'c1', amount: '1200.50', paid_at: null },
      ],
    });

    expect(result[0].amount).toBe(1200.5);
  });

  it('ordena da fatura mais antiga para a mais recente', () => {
    const result = carriedOverInvoices({
      months,
      cards,
      current,
      snapshots: [
        { id: 's-jul', month_id: 'jul', card_id: 'c1', amount: 100, paid_at: null },
        { id: 's-jun', month_id: 'jun', card_id: 'c2', amount: 200, paid_at: null },
      ],
    });

    expect(result.map((r) => r.snapshotId)).toEqual(['s-jun', 's-jul']);
  });

  it('usa fallback quando o cartão não existe mais', () => {
    const result = carriedOverInvoices({
      months,
      cards,
      current,
      snapshots: [
        { id: 's1', month_id: 'jul', card_id: 'apagado', amount: 300, paid_at: null },
      ],
    });

    expect(result[0].cardName).toBe('Cartão');
  });

  it('ignora snapshot cujo mês não está na lista', () => {
    expect(
      carriedOverInvoices({
        months,
        cards,
        current,
        snapshots: [
          { id: 's1', month_id: 'inexistente', card_id: 'c1', amount: 300, paid_at: null },
        ],
      }),
    ).toEqual([]);
  });
});
