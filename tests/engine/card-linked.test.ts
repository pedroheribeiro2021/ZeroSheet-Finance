/**
 * Regras de transações vinculadas a cartão (compõem a fatura) e
 * separação salário × outras entradas — paridade com a planilha
 * verificada em 2026-07-03 (saldo de julho: R$ 2.548,44).
 */
import { describe, it, expect } from 'vitest';
import { calculateSummary } from '@/core/engine/calculations';
import { Transaction } from '@/core/types/finance';

const NUBANK = 'card-nubank';
const C6 = 'card-c6';

const tx = (partial: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(36).slice(2),
  monthId: 'julho-2026',
  type: 'expense',
  category: 'Outros',
  amount: 0,
  isFixed: false,
  isProvision: false,
  isRecurring: false,
  card: null,
  createdAt: '2026-07-01',
  ...partial,
});

describe('salário × outras entradas', () => {
  it('separa salaryIncome de otherIncome; reembolso entra em otherIncome', () => {
    const result = calculateSummary(
      [
        tx({ type: 'income', category: 'Salário', amount: 5000 }),
        tx({ type: 'income', category: 'Freelance/Extras', amount: 700 }),
        tx({
          type: 'income',
          category: 'Reembolso',
          amount: 120,
          isReimbursement: true,
        }),
      ],
      [],
    );

    expect(result.salaryIncome).toBe(5000);
    // reembolso soma no total e, nao sendo salario, cai em otherIncome
    expect(result.otherIncome).toBe(820);
    expect(result.totalIncome).toBe(5820);
    expect(result.reimbursementIncome).toBe(120);
  });
});

describe('despesas vinculadas a cartão com fatura (snapshot)', () => {
  const snapshots = [{ amount: 407.07, card_id: NUBANK }];

  it('assinatura no cartão não conta duas vezes (já está na fatura)', () => {
    const result = calculateSummary(
      [
        tx({ type: 'income', category: 'Salário', amount: 5000 }),
        tx({
          category: 'Assinaturas',
          description: 'Claude',
          amount: 110,
          isRecurring: true,
          card: NUBANK,
        }),
      ],
      [],
      snapshots,
    );

    // total = 5000 − fatura 407.07; a assinatura não é subtraída de novo
    expect(result.total).toBe(4592.93);
  });

  it('gasto no cartão CONSOME a provisão da categoria (envelope)', () => {
    const result = calculateSummary(
      [
        tx({ type: 'income', category: 'Salário', amount: 5000 }),
        tx({ category: 'Gasolina', amount: 300, isProvision: true }),
        tx({ category: 'Gasolina', amount: 184, card: NUBANK }),
      ],
      [],
      snapshots,
    );

    // envelope gasolina: planejado 300, executado 184 (dentro da fatura)
    // → falta reservar só 116; total = 5000 − 407.07 − 116
    expect(result.envelopeSpending).toBe(116);
    expect(result.total).toBe(4476.93);

    const gasolina = result.envelopes.find((e) => e.category === 'Gasolina');
    expect(gasolina?.used).toBe(184);
    expect(gasolina?.remaining).toBe(116);
  });

  it('gasto no cartão que ESTOURA a provisão não subtrai o excesso de novo', () => {
    const result = calculateSummary(
      [
        tx({ type: 'income', category: 'Salário', amount: 1000 }),
        tx({ category: 'Gasolina', amount: 100, isProvision: true }),
        tx({ category: 'Gasolina', amount: 150, card: NUBANK }),
      ],
      [],
      snapshots,
    );

    // excesso (150 > 100) já está na fatura; envelope restante = 0
    expect(result.envelopeSpending).toBe(0);
    expect(result.total).toBe(592.93);
  });

  it('paridade julho/2026: reproduz o saldo da planilha (R$ 2.548,44)', () => {
    const transactions: Transaction[] = [
      tx({ type: 'income', category: 'Salário', amount: 5000 }),
      tx({ type: 'income', category: 'Reembolso', amount: 703.2 }),
      // boletos (fora do cartão)
      tx({ category: 'Internet', amount: 130, isFixed: true }),
      tx({ category: 'Água', amount: 40, isFixed: true }),
      tx({ category: 'Energia', amount: 150, isFixed: true }),
      tx({ category: 'Telefone', amount: 74.99, isFixed: true }),
      // assinaturas no cartão (dentro da fatura)
      tx({
        category: 'Assinaturas',
        description: 'TotalPass',
        amount: 119.9,
        isFixed: true,
        card: NUBANK,
      }),
      tx({
        category: 'Assinaturas',
        description: 'Claude',
        amount: 110,
        card: NUBANK,
      }),
      // envelopes
      tx({ category: 'Mercado', amount: 520, isProvision: true }),
      tx({ category: 'Gasolina', amount: 300, isProvision: true }),
      tx({ category: 'Gasolina', amount: 184, card: NUBANK }),
      // reserva
      tx({ category: 'Reserva', amount: 1000, isReserve: true }),
    ];

    const julySnapshots = [
      { amount: 407.07, card_id: NUBANK },
      { amount: 716.7, card_id: C6 },
    ];

    // parcelamento Samsung no C6: já está dentro da fatura do C6
    const installments = [{ installment_amount: 703.2, card_id: C6 }];

    const result = calculateSummary(
      transactions,
      [],
      julySnapshots,
      installments,
      'total',
      5, // ciclo da fatura: 5 semanas
    );

    expect(result.total).toBe(2548.44);
    expect(result.weeklyBudget).toBe(509.69);
    expect(result.salaryIncome).toBe(5000);
    expect(result.otherIncome).toBe(703.2);
    expect(result.installmentSpending).toBe(0);
  });
});
