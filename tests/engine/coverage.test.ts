import { describe, it, expect } from 'vitest';
import {
  calculateCoverage,
  coverageBillsFromTransactions,
  coverageInvoicesFromSnapshots,
  resolveNextPayday,
  resolvePaydayDay,
  suggestCoverageSource,
} from '@/core/engine/coverage';
import { getDueItems } from '@/core/engine/dueDates';
import { Account, AccountReading, Transaction } from '@/core/types/finance';

const tx = (
  data: Partial<Transaction> & Pick<Transaction, 'id' | 'type' | 'category' | 'amount'>,
): Transaction => ({
  monthId: 'm1',
  isFixed: false,
  isProvision: false,
  isRecurring: false,
  createdAt: '2026-07-01',
  ...data,
});

const account = (id: string, name: string, kind: 'corrente' | 'guardado'): Account => ({
  id,
  userId: 'u1',
  name,
  kind,
  color: null,
  isPaymentDefault: kind === 'corrente',
  createdAt: '2026-07-01',
});

const reading = (accountId: string, amount: number): AccountReading => ({
  id: `r-${accountId}`,
  userId: 'u1',
  accountId,
  amount,
  readAt: '2026-07-08T10:00:00Z',
  createdAt: '2026-07-08T10:00:00Z',
});

describe('resolvePaydayDay', () => {
  it('usa o dia da maior entrada com dia cadastrado', () => {
    const day = resolvePaydayDay([
      tx({ id: '1', type: 'income', category: 'Salário', amount: 9000, dueDay: 15 }),
      tx({ id: '2', type: 'income', category: 'Freela', amount: 800, dueDay: 5 }),
      tx({ id: '3', type: 'expense', category: 'Aluguel', amount: 2000, dueDay: 10 }),
    ]);

    expect(day).toBe(15);
  });

  it('ignora reembolso, pausada e entrada sem dia', () => {
    expect(
      resolvePaydayDay([
        tx({
          id: '1',
          type: 'income',
          category: 'Reembolso',
          amount: 20000,
          dueDay: 2,
          isReimbursement: true,
        }),
        tx({
          id: '2',
          type: 'income',
          category: 'Bônus',
          amount: 15000,
          dueDay: 3,
          skipped: true,
        }),
        tx({ id: '3', type: 'income', category: 'Extra', amount: 12000 }),
        tx({ id: '4', type: 'income', category: 'Salário', amount: 9000, dueDay: 15 }),
      ]),
    ).toBe(15);
  });

  it('retorna null quando nenhuma entrada tem dia', () => {
    expect(
      resolvePaydayDay([tx({ id: '1', type: 'income', category: 'Salário', amount: 9000 })]),
    ).toBeNull();
  });

  it('dia numa receita nunca vira conta a pagar', () => {
    const items = getDueItems(
      [
        tx({
          id: '1',
          type: 'income',
          category: 'Salário',
          amount: 9000,
          dueDay: 15,
          isRecurring: true,
        }),
      ],
      new Date(2026, 6, 20),
      { horizonDays: 30 },
    );

    expect(items).toHaveLength(0);
  });
});

describe('resolveNextPayday', () => {
  it('é este mês quando o dia ainda não passou', () => {
    expect(resolveNextPayday(15, new Date(2026, 6, 8))).toEqual(new Date(2026, 6, 15));
  });

  it('inclui o próprio dia do salário', () => {
    expect(resolveNextPayday(15, new Date(2026, 6, 15))).toEqual(new Date(2026, 6, 15));
  });

  it('vira para o mês seguinte quando o dia já passou', () => {
    expect(resolveNextPayday(15, new Date(2026, 6, 20))).toEqual(new Date(2026, 7, 15));
  });

  it('clampa o dia 31 no último dia do mês curto', () => {
    expect(resolveNextPayday(31, new Date(2026, 1, 20))).toEqual(new Date(2026, 1, 28));
  });
});

describe('calculateCoverage', () => {
  const base = {
    today: new Date(2026, 6, 8), // 08/07/2026
    paydayDay: 15,
    balance: 1200,
    bills: [
      { id: 'b1', label: 'Aluguel', amount: 1800, dueDay: 10 },
      { id: 'b2', label: 'Internet', amount: 120, dueDay: 20 }, // depois do salário
    ],
    invoices: [{ id: 'i1', label: 'Fatura C6', amount: 2400, dueDay: 12 }],
  };

  it('soma só o que vence antes do salário', () => {
    const result = calculateCoverage(base);

    expect(result.items.map((i) => i.id)).toEqual(['b1', 'i1']);
    expect(result.dueBeforePayday).toBe(4200);
    expect(result.daysUntilPayday).toBe(7);
  });

  it('falta cobrir = obrigações − saldo', () => {
    expect(calculateCoverage(base).shortfall).toBe(3000);
  });

  it('não aponta falta quando o saldo cobre tudo', () => {
    const result = calculateCoverage({ ...base, balance: 5000 });

    expect(result.shortfall).toBe(0);
    expect(result.leftover).toBe(800);
  });

  it('conta atrasada em aberto continua na janela', () => {
    const result = calculateCoverage({
      ...base,
      today: new Date(2026, 6, 11),
      bills: [{ id: 'b1', label: 'Aluguel', amount: 1800, dueDay: 10 }],
      invoices: [],
    });

    expect(result.items[0].overdue).toBe(true);
    expect(result.dueBeforePayday).toBe(1800);
  });

  it('o que vence no dia do salário não precisa de cobertura', () => {
    const result = calculateCoverage({
      ...base,
      bills: [{ id: 'b1', label: 'Cartão', amount: 3000, dueDay: 15 }],
      invoices: [],
    });

    expect(result.items).toHaveLength(0);
    expect(result.shortfall).toBe(0);
  });

  it('sem dia de salário não calcula janela', () => {
    const result = calculateCoverage({ ...base, paydayDay: null });

    expect(result.hasPayday).toBe(false);
    expect(result.payday).toBeNull();
    expect(result.shortfall).toBe(0);
  });

  it('sem leitura de saldo trata como zero', () => {
    expect(calculateCoverage({ ...base, balance: null }).shortfall).toBe(4200);
  });

  it('marca a fonte como insuficiente quando o guardado não cobre', () => {
    const result = calculateCoverage({
      ...base,
      source: { accountId: 'nu', accountName: 'Nubank', available: 500 },
    });

    expect(result.source?.insufficient).toBe(true);
  });

  it('fonte suficiente não é marcada', () => {
    const result = calculateCoverage({
      ...base,
      source: { accountId: 'nu', accountName: 'Nubank', available: 28000 },
    });

    expect(result.source?.insufficient).toBe(false);
  });

  it('depois do complemento entrar na leitura, a falta zera', () => {
    // saldo já com os 3.000 puxados do Nubank e complemento em aberto
    const result = calculateCoverage({ ...base, balance: 4200, borrowed: 3000 });

    expect(result.shortfall).toBe(0);
    expect(result.borrowed).toBe(3000);
  });
});

describe('coverageBillsFromTransactions', () => {
  it('ignora paga, pausada, com cartão, sem dia e receita', () => {
    const bills = coverageBillsFromTransactions([
      tx({ id: '1', type: 'expense', category: 'Aluguel', amount: 1800, dueDay: 10 }),
      tx({
        id: '2',
        type: 'expense',
        category: 'Luz',
        amount: 200,
        dueDay: 12,
        paidAt: '2026-07-05',
      }),
      tx({
        id: '3',
        type: 'expense',
        category: 'Água',
        amount: 90,
        dueDay: 12,
        skipped: true,
      }),
      tx({
        id: '4',
        type: 'expense',
        category: 'Claude',
        amount: 100,
        dueDay: 12,
        card: 'c6',
      }),
      tx({ id: '5', type: 'expense', category: 'Avulso', amount: 50 }),
      tx({ id: '6', type: 'income', category: 'Salário', amount: 9000, dueDay: 15 }),
    ]);

    expect(bills.map((b) => b.id)).toEqual(['1']);
  });
});

describe('coverageInvoicesFromSnapshots', () => {
  const cards = [
    { id: 'c6', name: 'C6', due_day: 12 },
    { id: 'nu', name: 'Nubank', due_day: null },
  ];

  it('só fatura em aberto, com valor e com dia de vencimento no cartão', () => {
    const invoices = coverageInvoicesFromSnapshots(cards, [
      { id: 's1', card_id: 'c6', amount: 2400, paid_at: null },
      { id: 's2', card_id: 'c6', amount: 900, paid_at: '2026-07-02' },
      { id: 's3', card_id: 'c6', amount: 0, paid_at: null },
      { id: 's4', card_id: 'nu', amount: 700, paid_at: null },
    ]);

    expect(invoices).toEqual([
      { id: 's1', label: 'Fatura C6', amount: 2400, dueDay: 12 },
    ]);
  });
});

describe('suggestCoverageSource', () => {
  const accounts = [
    account('c6', 'C6', 'corrente'),
    account('nu', 'Nubank', 'guardado'),
    account('itau', 'Itaú', 'guardado'),
  ];

  it('sugere a conta guardada com maior leitura', () => {
    const source = suggestCoverageSource(
      accounts,
      new Map([
        ['c6', reading('c6', 90000)],
        ['nu', reading('nu', 28400)],
        ['itau', reading('itau', 1200)],
      ]),
    );

    expect(source).toEqual({ accountId: 'nu', accountName: 'Nubank', available: 28400 });
  });

  it('conta guardada sem leitura não é candidata', () => {
    const source = suggestCoverageSource(accounts, new Map([['itau', reading('itau', 1200)]]));

    expect(source?.accountId).toBe('itau');
  });

  it('retorna null sem conta guardada com leitura', () => {
    expect(suggestCoverageSource(accounts, new Map())).toBeNull();
  });
});
