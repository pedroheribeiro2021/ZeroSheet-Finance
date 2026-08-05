import { describe, it, expect } from 'vitest';
import {
  calculateCoverage,
  coverageBillsFromTransactions,
  coverageInvoicesFromOpen,
  resolveNextPayday,
  resolveOccurrence,
  resolvePaydayDay,
  suggestCoverageSource,
} from '@/core/engine/coverage';
import { getDueItems } from '@/core/engine/dueDates';
import { Account, AccountReading, Transaction } from '@/core/types/finance';

const tx = (
  data: Partial<Transaction> &
    Pick<Transaction, 'id' | 'type' | 'category' | 'amount'>,
): Transaction => ({
  monthId: 'm1',
  isFixed: false,
  isProvision: false,
  isRecurring: false,
  createdAt: '2026-07-01',
  ...data,
});

const account = (
  id: string,
  name: string,
  kind: 'corrente' | 'guardado',
): Account => ({
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
      tx({
        id: '1',
        type: 'income',
        category: 'Salário',
        amount: 9000,
        dueDay: 15,
      }),
      tx({
        id: '2',
        type: 'income',
        category: 'Freela',
        amount: 800,
        dueDay: 5,
      }),
      tx({
        id: '3',
        type: 'expense',
        category: 'Aluguel',
        amount: 2000,
        dueDay: 10,
      }),
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
        tx({
          id: '4',
          type: 'income',
          category: 'Salário',
          amount: 9000,
          dueDay: 15,
        }),
      ]),
    ).toBe(15);
  });

  it('retorna null quando nenhuma entrada tem dia', () => {
    expect(
      resolvePaydayDay([
        tx({ id: '1', type: 'income', category: 'Salário', amount: 9000 }),
      ]),
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

describe('resolveOccurrence', () => {
  it('em aberto usa a competência corrente, mesmo já vencida', () => {
    expect(resolveOccurrence(10, new Date(2026, 6, 30), false)).toEqual(
      new Date(2026, 6, 10),
    );
  });

  it('já paga pula para a competência seguinte', () => {
    expect(resolveOccurrence(10, new Date(2026, 6, 30), true)).toEqual(
      new Date(2026, 7, 10),
    );
  });

  it('vira o ano corretamente', () => {
    expect(resolveOccurrence(2, new Date(2026, 11, 30), true)).toEqual(
      new Date(2027, 0, 2),
    );
  });

  it('clampa dia 31 na competência curta', () => {
    expect(resolveOccurrence(31, new Date(2026, 0, 31), true)).toEqual(
      new Date(2026, 1, 28),
    );
  });
});

describe('resolveNextPayday', () => {
  it('é este mês quando o dia ainda não passou', () => {
    expect(resolveNextPayday(15, new Date(2026, 6, 8))).toEqual(
      new Date(2026, 6, 15),
    );
  });

  it('inclui o próprio dia do salário', () => {
    expect(resolveNextPayday(15, new Date(2026, 6, 15))).toEqual(
      new Date(2026, 6, 15),
    );
  });

  it('vira para o mês seguinte quando o dia já passou', () => {
    expect(resolveNextPayday(15, new Date(2026, 6, 20))).toEqual(
      new Date(2026, 7, 15),
    );
  });

  it('clampa o dia 31 no último dia do mês curto', () => {
    expect(resolveNextPayday(31, new Date(2026, 1, 20))).toEqual(
      new Date(2026, 1, 28),
    );
  });
});

describe('calculateCoverage', () => {
  const base = {
    today: new Date(2026, 6, 8), // 08/07/2026
    paydayDay: 15,
    balance: 1200,
    bills: [
      {
        id: 'b1',
        label: 'Aluguel',
        amount: 1800,
        dueDay: 10,
        paid: false,
        recurring: true,
      },
      {
        id: 'b2',
        label: 'Internet',
        amount: 120,
        dueDay: 20, // depois do salário
        paid: false,
        recurring: true,
      },
    ],
    invoices: [
      {
        id: 'i1',
        label: 'Fatura C6',
        amount: 2400,
        dueDate: new Date(2026, 6, 12),
        partial: false,
      },
    ],
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
      invoices: [],
    });

    expect(result.items[0].overdue).toBe(true);
    expect(result.dueBeforePayday).toBe(1800);
  });

  it('conta já paga volta na competência seguinte, dentro da janela', () => {
    // 30/07: salário só em 15/08, e a internet (paga em julho) vence 10/08.
    const result = calculateCoverage({
      ...base,
      today: new Date(2026, 6, 30),
      bills: [
        {
          id: 'b1',
          label: 'Internet',
          amount: 130,
          dueDay: 10,
          paid: true,
          recurring: true,
        },
      ],
      invoices: [],
    });

    expect(result.payday).toEqual(new Date(2026, 7, 15));
    expect(result.items[0].dueDate).toEqual(new Date(2026, 7, 10));
    expect(result.dueBeforePayday).toBe(130);
    expect(result.hasPartial).toBe(true);
  });

  it('despesa avulsa paga não reaparece', () => {
    const result = calculateCoverage({
      ...base,
      today: new Date(2026, 6, 30),
      bills: [
        {
          id: 'b1',
          label: 'Presente',
          amount: 300,
          dueDay: 10,
          paid: true,
          recurring: false,
        },
      ],
      invoices: [],
    });

    expect(result.items).toHaveLength(0);
  });

  it('o que vence no dia do salário não precisa de cobertura', () => {
    const result = calculateCoverage({
      ...base,
      bills: [
        {
          id: 'b1',
          label: 'Cartão',
          amount: 3000,
          dueDay: 15,
          paid: false,
          recurring: true,
        },
      ],
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
    const result = calculateCoverage({
      ...base,
      balance: 4200,
      borrowed: 3000,
    });

    expect(result.shortfall).toBe(0);
    expect(result.borrowed).toBe(3000);
  });

  it('hasPartial é falso quando todo valor está fechado', () => {
    expect(calculateCoverage(base).hasPartial).toBe(false);
  });
});

describe('coverageInvoicesFromOpen', () => {
  const invoice = (
    over: Partial<{
      snapshotId: string;
      cardId: string | null;
      cardName: string;
      amount: number;
      dueDate: Date;
      paid: boolean;
      estimated: boolean;
      closingDay: number | null;
    }> = {},
  ) => ({
    snapshotId: 's1',
    cardId: 'c6',
    cardName: 'C6',
    amount: 4733.03,
    dueDate: new Date(2026, 7, 10),
    paid: false,
    ...over,
  });

  it('traduz a fatura em aberto sem recalcular ciclo nenhum', () => {
    expect(coverageInvoicesFromOpen([invoice()])).toEqual([
      {
        id: 's1',
        label: 'Fatura C6',
        amount: 4733.03,
        dueDate: new Date(2026, 7, 10),
        partial: false,
        closingDay: null,
      },
    ]);
  });

  it('fatura paga sai da lista e nada toma o lugar dela', () => {
    expect(coverageInvoicesFromOpen([invoice({ paid: true })])).toEqual([]);
  });

  it('fatura estimada (sem snapshot) entra como parcial', () => {
    const [item] = coverageInvoicesFromOpen([
      invoice({ snapshotId: '', estimated: true, closingDay: 4 }),
    ]);

    expect(item.id).toBe('card-c6');
    expect(item.partial).toBe(true);
    expect(item.closingDay).toBe(4);
  });

  it('ignora valor zerado', () => {
    expect(coverageInvoicesFromOpen([invoice({ amount: 0 })])).toEqual([]);
  });
});

describe('coverageBillsFromTransactions', () => {
  it('mantém a paga (volta na competência seguinte) e ignora pausada, cartão, sem dia e receita', () => {
    const bills = coverageBillsFromTransactions([
      tx({
        id: '1',
        type: 'expense',
        category: 'Aluguel',
        amount: 1800,
        dueDay: 10,
        isRecurring: true,
      }),
      tx({
        id: '2',
        type: 'expense',
        category: 'Luz',
        amount: 200,
        dueDay: 12,
        paidAt: '2026-07-05',
        isRecurring: true,
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
      tx({
        id: '6',
        type: 'income',
        category: 'Salário',
        amount: 9000,
        dueDay: 15,
      }),
    ]);

    expect(bills.map((b) => b.id)).toEqual(['1', '2']);
    expect(bills[1].paid).toBe(true);
    expect(bills[1].recurring).toBe(true);
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

    expect(source).toEqual({
      accountId: 'nu',
      accountName: 'Nubank',
      available: 28400,
    });
  });

  it('conta guardada sem leitura não é candidata', () => {
    const source = suggestCoverageSource(
      accounts,
      new Map([['itau', reading('itau', 1200)]]),
    );

    expect(source?.accountId).toBe('itau');
  });

  it('retorna null sem conta guardada com leitura', () => {
    expect(suggestCoverageSource(accounts, new Map())).toBeNull();
  });
});

/**
 * Contrato do cenário real de 04/08/2026 — o que estava errado na tela:
 * a cobertura mostrava a fatura C6 de AGOSTO (R$ 791,99) como se vencesse em
 * 10/08 e dizia "Coberto". A fatura que de fato vence em 10/08 é a de JULHO
 * (R$ 4.733,03), e com ela o saldo não cobre: falta tirar da conta guardada.
 */
describe('contrato — 04/08/2026', () => {
  const today = new Date(2026, 7, 4);

  // faturas já resolvidas por engine/invoices: competência M vence em M+1
  const openInvoices = [
    {
      snapshotId: 's-c6-jul',
      cardId: 'c6',
      cardName: 'C6',
      amount: 4733.03,
      dueDate: new Date(2026, 7, 10), // julho vence 10/08
      paid: false,
    },
    {
      snapshotId: 's-nu-jul',
      cardId: 'nu',
      cardName: 'Nubank',
      amount: 588.92,
      dueDate: new Date(2026, 7, 2), // julho vence 02/08
      paid: true, // paga em 16/07
    },
  ];

  const transactions = [
    tx({
      id: 't-internet',
      type: 'expense',
      category: 'Internet',
      amount: 130,
      dueDay: 10,
      isRecurring: true,
    }),
    tx({
      id: 't-telefone',
      type: 'expense',
      category: 'Telefone',
      amount: 74.99,
      dueDay: 15,
      isRecurring: true,
    }),
    tx({
      id: 't-claude',
      type: 'expense',
      category: 'Assinaturas',
      amount: 110,
      dueDay: 16,
      card: 'c6',
      isRecurring: true,
    }),
    tx({
      id: 't-salario',
      type: 'income',
      category: 'Salário',
      amount: 5703.2,
      dueDay: 15,
      isRecurring: true,
    }),
  ];

  const coverage = calculateCoverage({
    today,
    paydayDay: resolvePaydayDay(transactions),
    balance: 3763.71,
    bills: coverageBillsFromTransactions(transactions),
    invoices: coverageInvoicesFromOpen(openInvoices),
  });

  it('a janela vai até 15/08', () => {
    expect(coverage.payday).toEqual(new Date(2026, 7, 15));
  });

  it('a fatura que entra é a de julho, vencendo 10/08 — não a de agosto', () => {
    const invoices = coverage.items.filter((i) => i.kind === 'invoice');

    expect(invoices).toHaveLength(1);
    expect(invoices[0].amount).toBe(4733.03);
    expect(invoices[0].dueDate).toEqual(new Date(2026, 7, 10));
  });

  it('a fatura marcada como paga não reaparece pelo ciclo seguinte', () => {
    expect(coverage.items.some((i) => i.label === 'Fatura Nubank')).toBe(false);
  });

  it('a internet de 10/08 entra e o telefone de 15/08 fica fora', () => {
    const bills = coverage.items.filter((i) => i.kind === 'bill');

    expect(bills.map((b) => b.id)).toEqual(['t-internet']);
  });

  it('o saldo NÃO cobre: falta tirar da conta guardada', () => {
    expect(coverage.dueBeforePayday).toBe(4863.03);
    expect(coverage.shortfall).toBe(1099.32);
    expect(coverage.leftover).toBe(0);
  });

  it('despesa lançada no cartão não é contada à parte', () => {
    expect(coverage.items.some((i) => i.id === 't-claude')).toBe(false);
  });
});
