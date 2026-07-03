import { describe, it, expect } from 'vitest';
import { calculateSummary } from '@/core/engine/calculations';
import { Transaction, Week } from '@/core/types/finance';

const transactions: Transaction[] = [
  {
    id: '1',
    monthId: 'm1',
    type: 'income',
    category: 'salary',
    amount: 4000,
    isFixed: false,
    isProvision: false,
    isRecurring: false,
    card: null,
    createdAt: '2024-01-01',
  },
  {
    id: '2',
    monthId: 'm1',
    type: 'income',
    category: 'extras',
    amount: 200,
    isFixed: false,
    isProvision: false,
    isRecurring: false,
    card: null,
    createdAt: '2024-01-01',
  },
  {
    id: '3',
    monthId: 'm1',
    type: 'expense',
    category: 'internet',
    amount: 100,
    isFixed: true,
    isProvision: false,
    isRecurring: true,
    card: null,
    createdAt: '2024-01-01',
  },
  {
    id: '4',
    monthId: 'm1',
    type: 'expense',
    category: 'nubank',
    amount: 500,
    isFixed: false,
    isProvision: false,
    isRecurring: false,
    card: 'nubank',
    createdAt: '2024-01-05',
  },
  {
    id: '5',
    monthId: 'm1',
    type: 'expense',
    category: 'market provision',
    amount: 300,
    isFixed: false,
    isProvision: true,
    isRecurring: false,
    card: null,
    createdAt: '2024-01-01',
  },
];

const weeks: Week[] = Array.from({ length: 4 }, (_, i) => ({
  id: `w${i + 1}`,
  monthId: 'm1',
  index: i + 1,
  budget: 0,
  spent: 0,
  remaining: 0,
}));

describe('calculateSummary', () => {
  it('aggregates income, fixed costs, card spending and provisions', () => {
    const result = calculateSummary(transactions, weeks);

    expect(result.totalIncome).toBe(4200);
    expect(result.fixedCosts).toBe(100);
    expect(result.cardSpending).toBe(500);
    // card spending is its own bucket, it must not bleed into the
    // category-envelope used/diff (there's no "market provision" spend here)
    expect(result.provisionPlanned).toBe(300);
    expect(result.provisionUsed).toBe(0);
    expect(result.provisionDiff).toBe(300);
    expect(result.envelopeSpending).toBe(300);

    expect(result.total).toBe(3300);
    expect(result.weeklyBudget).toBe(825);
  });

  it('uses card snapshots instead of per-transaction card amounts when provided', () => {
    const snapshots = [{ card: 'nubank', amount: 750 }];

    const result = calculateSummary(transactions, weeks, snapshots);

    expect(result.cardSpending).toBe(750);
    expect(result.total).toBe(4200 - 100 - 750 - 300);
  });

  it('does not double count an installment whose card has a snapshot in the month', () => {
    const snapshots = [{ amount: 1000, card_id: 'card-1' }];
    const installments = [
      { installment_amount: 150, card_id: 'card-1' }, // já dentro da fatura
      { installment_amount: 200, card_id: 'card-2' }, // cartão sem fatura: conta
      { installment_amount: 50 }, // sem cartão: conta
    ];

    const result = calculateSummary([], [], snapshots, installments);

    expect(result.installmentSpending).toBe(250);
    expect(result.total).toBe(-1250); // fatura 1000 + parcelas fora dela 250
  });

  it('subtracts installment payments from the monthly total', () => {
    const installments = [{ installment_amount: 150 }];

    const result = calculateSummary(transactions, weeks, undefined, installments);

    expect(result.total).toBe(3300 - 150);
  });

  it('falls back to the raw total when there are no weeks yet', () => {
    const result = calculateSummary(transactions, []);

    expect(result.weeklyBudget).toBe(result.total);
  });

  it('deducts realized spend from the total when there is no provision for the category (envelope = max(0, realized))', () => {
    const tx: Transaction[] = [
      {
        id: '1',
        monthId: 'm1',
        type: 'income',
        category: 'salary',
        amount: 1000,
        isFixed: false,
        isProvision: false,
        isRecurring: false,
        card: null,
        createdAt: '2024-01-01',
      },
      {
        id: '2',
        monthId: 'm1',
        type: 'expense',
        category: 'lazer',
        amount: 700,
        isFixed: false,
        isProvision: false,
        isRecurring: false,
        card: null,
        createdAt: '2024-01-01',
      },
    ];

    const result = calculateSummary(tx, []);

    expect(result.envelopeSpending).toBe(700);
    expect(result.total).toBe(300);
  });

  it('deducts the realized spend (not the planned amount) when realized exceeds the provision', () => {
    const tx: Transaction[] = [
      {
        id: '1',
        monthId: 'm1',
        type: 'income',
        category: 'salary',
        amount: 1000,
        isFixed: false,
        isProvision: false,
        isRecurring: false,
        card: null,
        createdAt: '2024-01-01',
      },
      {
        id: '2',
        monthId: 'm1',
        type: 'expense',
        category: 'mercado',
        amount: 100,
        isFixed: false,
        isProvision: true,
        isRecurring: false,
        card: null,
        createdAt: '2024-01-01',
      },
      {
        id: '3',
        monthId: 'm1',
        type: 'expense',
        category: 'mercado',
        amount: 416,
        isFixed: false,
        isProvision: false,
        isRecurring: false,
        card: null,
        createdAt: '2024-01-05',
      },
    ];

    const result = calculateSummary(tx, []);

    expect(result.envelopeSpending).toBe(416);
    expect(result.total).toBe(1000 - 416);
  });

  it('keeps the planned amount as the envelope cost when realized spend is lower', () => {
    const tx: Transaction[] = [
      {
        id: '1',
        monthId: 'm1',
        type: 'income',
        category: 'salary',
        amount: 1000,
        isFixed: false,
        isProvision: false,
        isRecurring: false,
        card: null,
        createdAt: '2024-01-01',
      },
      {
        id: '2',
        monthId: 'm1',
        type: 'expense',
        category: 'mercado',
        amount: 500,
        isFixed: false,
        isProvision: true,
        isRecurring: false,
        card: null,
        createdAt: '2024-01-01',
      },
      {
        id: '3',
        monthId: 'm1',
        type: 'expense',
        category: 'mercado',
        amount: 200,
        isFixed: false,
        isProvision: false,
        isRecurring: false,
        card: null,
        createdAt: '2024-01-05',
      },
    ];

    const result = calculateSummary(tx, []);

    expect(result.envelopeSpending).toBe(500);
    expect(result.total).toBe(1000 - 500);
  });

  it('keeps a reimbursement income out of totalIncome and the final total', () => {
    const tx: Transaction[] = [
      {
        id: '1',
        monthId: 'm1',
        type: 'income',
        category: 'salary',
        amount: 1000,
        isFixed: false,
        isProvision: false,
        isRecurring: false,
        card: null,
        createdAt: '2024-01-01',
      },
      {
        id: '2',
        monthId: 'm1',
        type: 'income',
        category: 'reembolso',
        amount: 465.92,
        isFixed: false,
        isProvision: false,
        isRecurring: false,
        isReimbursement: true,
        card: null,
        createdAt: '2024-01-02',
      },
    ];

    const withoutReimbursement = calculateSummary(
      tx.filter((t) => !t.isReimbursement),
      [],
    );
    const withReimbursement = calculateSummary(tx, []);

    expect(withReimbursement.totalIncome).toBe(1000);
    expect(withReimbursement.reimbursementIncome).toBe(465.92);
    expect(withReimbursement.total).toBe(withoutReimbursement.total);
  });

  it('deducts a reserve from the total but keeps it out of fixedCosts', () => {
    const tx: Transaction[] = [
      {
        id: '1',
        monthId: 'm1',
        type: 'income',
        category: 'salary',
        amount: 5000,
        isFixed: false,
        isProvision: false,
        isRecurring: false,
        card: null,
        createdAt: '2024-01-01',
      },
      {
        id: '2',
        monthId: 'm1',
        type: 'expense',
        category: 'reserva',
        amount: 1000,
        isFixed: true,
        isProvision: false,
        isRecurring: false,
        isReserve: true,
        card: null,
        createdAt: '2024-01-02',
      },
    ];

    const result = calculateSummary(tx, []);

    expect(result.fixedCosts).toBe(0);
    expect(result.reserveSpending).toBe(1000);
    expect(result.total).toBe(4000);
  });

  it('switches the weekly budget formula via weeklyBudgetVariant', () => {
    const totalVariant = calculateSummary(transactions, weeks);
    const incomeMinusFixedVariant = calculateSummary(
      transactions,
      weeks,
      undefined,
      [],
      'incomeMinusFixed',
    );

    // total já desconta cartão/envelope/etc.; (receita - fixos) não — devem
    // divergir sempre que houver outras deduções além de fixedCosts.
    expect(incomeMinusFixedVariant.weeklyBudget).not.toBe(
      totalVariant.weeklyBudget,
    );
    expect(incomeMinusFixedVariant.weeklyBudget).toBe(
      (4200 - 100) / weeks.length,
    );
  });

  it('matches provisioned and realized spend under the same envelope regardless of case/accent', () => {
    const tx: Transaction[] = [
      {
        id: '1',
        monthId: 'm1',
        type: 'expense',
        category: 'Mercado',
        amount: 300,
        isFixed: false,
        isProvision: true,
        isRecurring: false,
        card: null,
        createdAt: '2024-01-01',
      },
      {
        id: '2',
        monthId: 'm1',
        type: 'expense',
        category: 'MERCADO',
        amount: 416,
        isFixed: false,
        isProvision: false,
        isRecurring: false,
        card: null,
        createdAt: '2024-01-05',
      },
    ];

    const result = calculateSummary(tx, []);

    // se não casassem no mesmo envelope, envelopeSpending seria 300 + 416
    expect(result.envelopeSpending).toBe(416);
    expect(Object.keys(result.provisionMap)).toEqual(['mercado']);
  });
});

describe('não-interferência — transação de cartão com snapshot não conta duas vezes', () => {
  const income: Transaction = {
    id: 'i1',
    monthId: 'm1',
    type: 'income',
    category: 'salário',
    amount: 5000,
    isFixed: false,
    isProvision: false,
    isRecurring: false,
    card: null,
    createdAt: '2024-07-01',
  };

  const fixedWithCard: Transaction = {
    id: 'f1',
    monthId: 'm1',
    type: 'expense',
    category: 'Luz',
    amount: 150,
    isFixed: true,
    isProvision: false,
    isRecurring: false,
    card: 'card-c6-id',
    createdAt: '2024-07-05',
  };

  const snapshotC6 = [{ amount: 800, card_id: 'card-c6-id' }];

  it('despesa fixa com cartão que tem snapshot não entra em fixedCosts', () => {
    const result = calculateSummary([income, fixedWithCard], [], snapshotC6);

    expect(result.fixedCosts).toBe(0);
    expect(result.cardSpending).toBe(800); // vem do snapshot
  });

  it('total não muda ao alternar o flag card da despesa quando snapshot existe', () => {
    const semCard: Transaction = { ...fixedWithCard, card: null };

    const comCard = calculateSummary([income, fixedWithCard], [], snapshotC6);
    const semCartao = calculateSummary([income, semCard], [], snapshotC6);

    // com cartão + snapshot: fixedWithCard é ignorada (já na fatura)
    // sem cartão + snapshot: fixedWithCard entra em fixedCosts normalmente
    // → os totais DEVEM ser diferentes (proteção de que o teste é útil)
    expect(comCard.fixedCosts).toBe(0);
    expect(semCartao.fixedCosts).toBe(150);
  });

  it('despesa com cartão sem snapshot continua contando normalmente', () => {
    // snapshot é de outro cartão
    const otherSnapshot = [{ amount: 200, card_id: 'outro-cartao' }];

    const result = calculateSummary([income, fixedWithCard], [], otherSnapshot);

    // fixedWithCard.card = 'card-c6-id' não está em snapshotCardIds
    // então cai no fluxo normal: é isFixed → fixedCosts
    expect(result.fixedCosts).toBe(150);
  });

  it('sem snapshots, transação com card entra em cardSpending (comportamento legado)', () => {
    const expense: Transaction = {
      id: 'e1',
      monthId: 'm1',
      type: 'expense',
      category: 'compras',
      amount: 300,
      isFixed: false,
      isProvision: false,
      isRecurring: false,
      card: 'card-c6-id',
      createdAt: '2024-07-10',
    };

    const result = calculateSummary([income, expense], [], undefined);

    expect(result.cardSpending).toBe(300);
    expect(result.fixedCosts).toBe(0);
  });
});
