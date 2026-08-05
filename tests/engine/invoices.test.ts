import { describe, it, expect } from 'vitest';
import {
  buildInvoices,
  estimateMissingInvoices,
  invoiceDueDate,
  invoicesDueInCompetence,
  openInvoicesUpTo,
  overdueInvoices,
} from '@/core/engine/invoices';

/**
 * Dados reais do usuário: C6 fecha dia 4 e vence dia 10; Nubank fecha 26 e
 * vence dia 2. A regra é a mesma pros dois — a fatura de uma competência é
 * paga no mês seguinte, no dia de vencimento do cartão.
 */
const cards = [
  { id: 'c6', name: 'C6', due_day: 10, closing_day: 4 },
  { id: 'nu', name: 'Nubank', due_day: 2, closing_day: 26 },
];

const months = [
  { id: 'm-jun', month: 6, year: 2026 },
  { id: 'm-jul', month: 7, year: 2026 },
  { id: 'm-ago', month: 8, year: 2026 },
];

const snapshots = [
  {
    id: 's-c6-jul',
    month_id: 'm-jul',
    card_id: 'c6',
    amount: 4733.03,
    paid_at: null,
  },
  {
    id: 's-nu-jul',
    month_id: 'm-jul',
    card_id: 'nu',
    amount: 588.92,
    paid_at: '2026-07-16T15:35:14Z',
  },
  {
    id: 's-c6-ago',
    month_id: 'm-ago',
    card_id: 'c6',
    amount: 791.99,
    paid_at: null,
  },
  {
    id: 's-nu-ago',
    month_id: 'm-ago',
    card_id: 'nu',
    amount: 46.27,
    paid_at: null,
  },
];

describe('invoiceDueDate', () => {
  it('a fatura da competência vence no mês seguinte', () => {
    expect(invoiceDueDate({ month: 7, year: 2026 }, 10)).toEqual(
      new Date(2026, 7, 10),
    );
    expect(invoiceDueDate({ month: 8, year: 2026 }, 10)).toEqual(
      new Date(2026, 8, 10),
    );
    expect(invoiceDueDate({ month: 7, year: 2026 }, 2)).toEqual(
      new Date(2026, 7, 2),
    );
  });

  it('vira o ano em dezembro', () => {
    expect(invoiceDueDate({ month: 12, year: 2026 }, 10)).toEqual(
      new Date(2027, 0, 10),
    );
  });

  it('clampa o dia ao último dia do mês de pagamento', () => {
    expect(invoiceDueDate({ month: 1, year: 2026 }, 31)).toEqual(
      new Date(2026, 1, 28),
    );
  });
});

describe('buildInvoices', () => {
  const invoices = buildInvoices({ months, snapshots, cards });

  it('resolve o vencimento de cada fatura pelo mês seguinte à competência', () => {
    const byId = new Map(invoices.map((i) => [i.snapshotId, i]));

    expect(byId.get('s-c6-jul')?.dueDate).toEqual(new Date(2026, 7, 10));
    expect(byId.get('s-c6-ago')?.dueDate).toEqual(new Date(2026, 8, 10));
    expect(byId.get('s-nu-jul')?.dueDate).toEqual(new Date(2026, 7, 2));
    expect(byId.get('s-nu-ago')?.dueDate).toEqual(new Date(2026, 8, 2));
  });

  it('ignora cartão sem due_day e snapshot zerado', () => {
    const result = buildInvoices({
      months,
      snapshots: [
        {
          id: 'x',
          month_id: 'm-jul',
          card_id: 'sem-venc',
          amount: 100,
          paid_at: null,
        },
        { id: 'y', month_id: 'm-jul', card_id: 'c6', amount: 0, paid_at: null },
      ],
      cards: [...cards, { id: 'sem-venc', name: 'Sem venc.', due_day: null }],
    });

    expect(result).toEqual([]);
  });
});

describe('invoicesDueInCompetence', () => {
  const invoices = buildInvoices({ months, snapshots, cards });

  it('em agosto vencem as faturas de JULHO, não as de agosto', () => {
    const due = invoicesDueInCompetence(invoices, { month: 8, year: 2026 });

    expect(due.map((i) => i.snapshotId).sort()).toEqual([
      's-c6-jul',
      's-nu-jul',
    ]);
    expect(due.every((i) => i.competence.month === 7)).toBe(true);
  });

  it('as faturas de agosto só aparecem no calendário de setembro', () => {
    const due = invoicesDueInCompetence(invoices, { month: 9, year: 2026 });

    expect(due.map((i) => i.snapshotId).sort()).toEqual([
      's-c6-ago',
      's-nu-ago',
    ]);
  });
});

describe('openInvoicesUpTo', () => {
  const invoices = buildInvoices({ months, snapshots, cards });

  it('em agosto pesa a fatura de julho em aberto; a de agosto fica de fora', () => {
    const open = openInvoicesUpTo(invoices, { month: 8, year: 2026 });

    expect(open.map((i) => i.snapshotId)).toEqual(['s-c6-jul']);
  });

  it('a paga não entra', () => {
    const open = openInvoicesUpTo(invoices, { month: 8, year: 2026 });

    expect(open.some((i) => i.snapshotId === 's-nu-jul')).toBe(false);
  });
});

describe('overdueInvoices', () => {
  const invoices = buildInvoices({ months, snapshots, cards });
  const open = openInvoicesUpTo(invoices, { month: 8, year: 2026 });

  it('em 04/08 a fatura que vence 10/08 ainda não é atraso', () => {
    expect(overdueInvoices(open, new Date(2026, 7, 4))).toEqual([]);
  });

  it('em 11/08 ela passa a ser atraso', () => {
    expect(
      overdueInvoices(open, new Date(2026, 7, 11)).map((i) => i.snapshotId),
    ).toEqual(['s-c6-jul']);
  });
});

describe('estimateMissingInvoices', () => {
  it('estima pela última leitura do mês quando a fatura não foi lançada', () => {
    const invoices = buildInvoices({
      months,
      snapshots: snapshots.filter((s) => s.id !== 's-c6-jul'),
      cards,
    });

    const estimates = estimateMissingInvoices({
      invoices,
      cards: [cards[0]],
      month: months[1], // julho
      readings: [
        {
          card_id: 'c6',
          month_id: 'm-jul',
          amount: 2920.13,
          read_at: '2026-07-25T11:05:00Z',
        },
        {
          card_id: 'c6',
          month_id: 'm-jul',
          amount: 4700.5,
          read_at: '2026-07-29T17:32:00Z',
        },
        {
          card_id: 'c6',
          month_id: 'm-ago',
          amount: 91.2,
          read_at: '2026-08-02T10:00:00Z',
        },
      ],
    });

    expect(estimates).toHaveLength(1);
    expect(estimates[0].amount).toBe(4700.5);
    expect(estimates[0].dueDate).toEqual(new Date(2026, 7, 10));
    expect(estimates[0].estimated).toBe(true);
    expect(estimates[0].snapshotId).toBe('');
  });

  it('não estima quando a fatura já foi lançada', () => {
    const invoices = buildInvoices({ months, snapshots, cards });

    const estimates = estimateMissingInvoices({
      invoices,
      cards,
      month: months[1],
      readings: [
        {
          card_id: 'c6',
          month_id: 'm-jul',
          amount: 999,
          read_at: '2026-07-29T17:32:00Z',
        },
      ],
    });

    expect(estimates).toEqual([]);
  });
});
