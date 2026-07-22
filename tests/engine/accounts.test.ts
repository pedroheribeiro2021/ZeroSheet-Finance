import { describe, it, expect } from 'vitest';
import {
  latestReadingByAccount,
  openBillsFromTransactions,
  openInvoicesFromSnapshots,
  pendingReturns,
  projectBalance,
  reconcile,
} from '@/core/engine/accounts';
import { calculateSummary } from '@/core/engine/calculations';
import { AccountReading, Transaction, Transfer } from '@/core/types/finance';

const reading = (
  accountId: string,
  amount: number,
  readAt: string,
): AccountReading => ({
  id: `r-${accountId}-${readAt}`,
  userId: 'u1',
  accountId,
  amount,
  readAt,
  createdAt: readAt,
});

const transfer = (data: Partial<Transfer> & Pick<Transfer, 'id' | 'kind' | 'fromAccountId' | 'toAccountId' | 'amount'>): Transfer => ({
  userId: 'u1',
  linkedTransferId: null,
  note: null,
  transferredAt: '2026-07-10',
  createdAt: '2026-07-10',
  ...data,
});

describe('latestReadingByAccount', () => {
  it('retorna a leitura mais recente por conta', () => {
    const readings = [
      reading('c6', 3000, '2026-07-01T10:00:00Z'),
      reading('c6', 3412, '2026-07-17T10:00:00Z'),
      reading('nu', 28400, '2026-07-05T10:00:00Z'),
    ];

    const map = latestReadingByAccount(readings);

    expect(map.get('c6')?.amount).toBe(3412);
    expect(map.get('nu')?.amount).toBe(28400);
  });

  it('ignora a ordem de entrada — sempre a leitura com read_at maior', () => {
    const readings = [
      reading('c6', 3412, '2026-07-17T10:00:00Z'),
      reading('c6', 3000, '2026-07-01T10:00:00Z'),
    ];

    expect(latestReadingByAccount(readings).get('c6')?.amount).toBe(3412);
  });

  it('mapa vazio para lista vazia', () => {
    expect(latestReadingByAccount([]).size).toBe(0);
  });
});

describe('pendingReturns', () => {
  it('complemento sem devolução: pendência cheia', () => {
    const transfers: Transfer[] = [
      transfer({
        id: 'comp1',
        kind: 'complemento',
        fromAccountId: 'nu-guardado',
        toAccountId: 'c6-corrente',
        amount: 1055.48,
      }),
    ];

    const result = pendingReturns(transfers);

    expect(result).toEqual([
      {
        complementId: 'comp1',
        toAccountId: 'nu-guardado',
        holdingAccountId: 'c6-corrente',
        amount: 1055.48,
      },
    ]);
  });

  it('devolução parcial: 1.055,48 emprestado, devolveu 500 → pende 555,48', () => {
    const transfers: Transfer[] = [
      transfer({
        id: 'comp1',
        kind: 'complemento',
        fromAccountId: 'nu-guardado',
        toAccountId: 'c6-corrente',
        amount: 1055.48,
      }),
      transfer({
        id: 'dev1',
        kind: 'devolucao',
        fromAccountId: 'c6-corrente',
        toAccountId: 'nu-guardado',
        amount: 500,
        linkedTransferId: 'comp1',
      }),
    ];

    const result = pendingReturns(transfers);

    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(555.48);
  });

  it('devolução total: o complemento some da lista', () => {
    const transfers: Transfer[] = [
      transfer({
        id: 'comp1',
        kind: 'complemento',
        fromAccountId: 'nu-guardado',
        toAccountId: 'c6-corrente',
        amount: 1055.48,
      }),
      transfer({
        id: 'dev1',
        kind: 'devolucao',
        fromAccountId: 'c6-corrente',
        toAccountId: 'nu-guardado',
        amount: 1055.48,
        linkedTransferId: 'comp1',
      }),
    ];

    expect(pendingReturns(transfers)).toEqual([]);
  });

  it('devolução que ultrapassa o valor emprestado não vira pendência negativa', () => {
    const transfers: Transfer[] = [
      transfer({
        id: 'comp1',
        kind: 'complemento',
        fromAccountId: 'nu-guardado',
        toAccountId: 'c6-corrente',
        amount: 500,
      }),
      transfer({
        id: 'dev1',
        kind: 'devolucao',
        fromAccountId: 'c6-corrente',
        toAccountId: 'nu-guardado',
        amount: 600,
        linkedTransferId: 'comp1',
      }),
    ];

    expect(pendingReturns(transfers)).toEqual([]);
  });

  it('movimentação comum nunca gera pendência', () => {
    const transfers: Transfer[] = [
      transfer({
        id: 'mov1',
        kind: 'movimentacao',
        fromAccountId: 'nu-guardado',
        toAccountId: 'c6-corrente',
        amount: 300,
      }),
    ];

    expect(pendingReturns(transfers)).toEqual([]);
  });

  it('múltiplos complementos: cada um mantém sua própria pendência', () => {
    const transfers: Transfer[] = [
      transfer({
        id: 'comp1',
        kind: 'complemento',
        fromAccountId: 'nu-guardado',
        toAccountId: 'c6-corrente',
        amount: 1000,
      }),
      transfer({
        id: 'comp2',
        kind: 'complemento',
        fromAccountId: 'c6-guardado',
        toAccountId: 'c6-corrente',
        amount: 200,
      }),
      transfer({
        id: 'dev1',
        kind: 'devolucao',
        fromAccountId: 'c6-corrente',
        toAccountId: 'nu-guardado',
        amount: 1000,
        linkedTransferId: 'comp1',
      }),
    ];

    const result = pendingReturns(transfers);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      complementId: 'comp2',
      toAccountId: 'c6-guardado',
      holdingAccountId: 'c6-corrente',
      amount: 200,
    });
  });
});

describe('projectBalance', () => {
  it('cenário real de julho/2026: leitura C6 + contas em aberto + fatura em aberto + devolução pendente', () => {
    const result = projectBalance({
      reading: { label: 'C6 Corrente', amount: 4000 },
      openBills: [
        { label: 'Internet', amount: 130, dueDay: 15 },
        { label: 'Água', amount: 90, dueDay: 20 },
      ],
      openInvoices: [{ label: 'Fatura C6', amount: 1200 }],
      pendingReturns: [{ label: 'Devolver p/ Nubank Guardado', amount: 1055.48 }],
    });

    expect(result.lines).toEqual([
      { label: 'C6 Corrente', amount: 4000 },
      { label: 'Internet', amount: -130 },
      { label: 'Água', amount: -90 },
      { label: 'Fatura C6', amount: -1200 },
      { label: 'Devolver p/ Nubank Guardado', amount: -1055.48 },
    ]);
    expect(result.projected).toBe(1524.52);
  });

  it('sem leitura ainda: usa 0 como base', () => {
    const result = projectBalance({
      reading: null,
      openBills: [],
      openInvoices: [],
      pendingReturns: [],
    });

    expect(result.projected).toBe(0);
  });

  it('sem deduções: projeção é a própria leitura', () => {
    const result = projectBalance({
      reading: { label: 'C6 Corrente', amount: 3412 },
      openBills: [],
      openInvoices: [],
      pendingReturns: [],
    });

    expect(result.projected).toBe(3412);
  });
});

describe('reconcile', () => {
  it('positivo: nova leitura maior que a projeção (sobrou dinheiro fora do radar)', () => {
    expect(reconcile(1000, 1034)).toBe(34);
  });

  it('negativo: nova leitura menor que a projeção (gasto fora do radar)', () => {
    expect(reconcile(1000, 966)).toBe(-34);
  });

  it('zero quando bate exatamente', () => {
    expect(reconcile(1000, 1000)).toBe(0);
  });
});

describe('openBillsFromTransactions', () => {
  const base: Omit<Transaction, 'id' | 'type' | 'category' | 'amount'> = {
    monthId: 'm1',
    isFixed: true,
    isProvision: false,
    isRecurring: true,
    card: null,
    createdAt: '2026-07-01',
  };

  it('inclui despesa com vencimento, não paga, não pausada e sem cartão', () => {
    const t: Transaction = {
      ...base,
      id: 't1',
      type: 'expense',
      category: 'Internet',
      amount: 130,
      dueDay: 15,
    };

    expect(openBillsFromTransactions([t])).toEqual([
      { label: 'Internet', amount: 130, dueDay: 15 },
    ]);
  });

  it('exclui paga, pausada, sem vencimento ou com cartão', () => {
    const paga: Transaction = { ...base, id: 't2', type: 'expense', category: 'Água', amount: 90, dueDay: 10, paidAt: '2026-07-05' };
    const pausada: Transaction = { ...base, id: 't3', type: 'expense', category: 'Gás', amount: 50, dueDay: 12, skipped: true };
    const semVencimento: Transaction = { ...base, id: 't4', type: 'expense', category: 'Streaming', amount: 40 };
    const comCartao: Transaction = { ...base, id: 't5', type: 'expense', category: 'Assinatura', amount: 60, dueDay: 8, card: 'card-1' };
    const receita: Transaction = { ...base, id: 't6', type: 'income', category: 'Salário', amount: 5000, dueDay: 5 };

    expect(
      openBillsFromTransactions([paga, pausada, semVencimento, comCartao, receita]),
    ).toEqual([]);
  });
});

describe('openInvoicesFromSnapshots', () => {
  it('inclui fatura não paga com valor positivo, rotulada com o nome do cartão', () => {
    const result = openInvoicesFromSnapshots(
      [{ id: 'c6', name: 'C6' }],
      [{ card_id: 'c6', amount: 1200, paid_at: null }],
    );

    expect(result).toEqual([{ label: 'Fatura C6', amount: 1200 }]);
  });

  it('exclui fatura paga ou zerada', () => {
    const result = openInvoicesFromSnapshots(
      [{ id: 'c6', name: 'C6' }],
      [
        { card_id: 'c6', amount: 1200, paid_at: '2026-07-10' },
        { card_id: 'c6', amount: 0, paid_at: null },
      ],
    );

    expect(result).toEqual([]);
  });
});

describe('transferências não afetam calculateSummary', () => {
  it('calculateSummary não recebe transfers — o mesmo conjunto de transações produz o mesmo resumo independentemente de complementos/devoluções existirem', () => {
    const base: Omit<Transaction, 'id' | 'type' | 'category' | 'amount'> = {
      monthId: 'm1',
      isFixed: false,
      isProvision: false,
      isRecurring: false,
      card: null,
      createdAt: '2026-07-01',
    };

    const transactions: Transaction[] = [
      { ...base, id: 't1', type: 'income', category: 'Salário', amount: 5000 },
      { ...base, id: 't2', type: 'expense', category: 'Internet', amount: 130, isFixed: true },
    ];

    const before = calculateSummary(transactions, []);

    // Simula a existência de complementos/devoluções que movimentam valores
    // bem maiores que o resumo do mês — se por engano fossem somados ao
    // summary, o total mudaria. calculateSummary nem aceita esse parâmetro.
    const transfers: Transfer[] = [
      transfer({
        id: 'comp1',
        kind: 'complemento',
        fromAccountId: 'nu-guardado',
        toAccountId: 'c6-corrente',
        amount: 1055.48,
      }),
    ];
    void transfers;

    const after = calculateSummary(transactions, []);

    expect(after).toEqual(before);
    expect(after.total).toBe(4870);
  });
});
