import { describe, it, expect } from 'vitest';
import { calculateSummary } from '@/core/engine/calculations';
import { Transaction } from '@/core/types/finance';

const tx = (
  data: Partial<Transaction> &
    Pick<Transaction, 'id' | 'type' | 'category' | 'amount'>,
): Transaction => ({
  monthId: 'm-nov',
  isFixed: false,
  isProvision: false,
  isRecurring: false,
  card: null,
  createdAt: '2026-11-01',
  ...data,
});

const salario = tx({ id: 's', type: 'income', category: 'Salário', amount: 5000 });

/**
 * Caso real: viagem a Foz/Argentina em nov/2026, paga no C6, com dinheiro
 * juntado antes numa reserva. A compra está na fatura (o banco cobra), mas não
 * pode sair do mês — nem do saldo, nem do gasto livre da semana.
 */
describe('despesa no cartão paga com reserva', () => {
  it('cartão sem fatura lançada: entra em cardSpending, mas não muda o saldo', () => {
    const r = calculateSummary(
      [
        salario,
        tx({ id: 'v', type: 'expense', category: 'Viagem', amount: 1884.75, card: 'c6', isReserveFunded: true }),
      ],
      [],
    );
    expect(r.cardSpending).toBe(1884.75);
    expect(r.reserveFundedSpending).toBe(1884.75);
    expect(r.total).toBe(5000);
  });

  it('cartão com fatura (snapshot) que já contém a compra: o saldo só perde o resto da fatura', () => {
    const r = calculateSummary(
      [
        salario,
        tx({ id: 'v', type: 'expense', category: 'Viagem', amount: 800, card: 'c6', isReserveFunded: true }),
      ],
      [],
      [{ amount: 2000, card_id: 'c6' }],
    );
    expect(r.cardSpending).toBe(2000);
    expect(r.total).toBe(5000 - 2000 + 800);
  });

  it('não consome a provisão da mesma categoria', () => {
    const provisaoTransporte = tx({ id: 'p', type: 'expense', category: 'Transporte', amount: 300, isProvision: true });
    const base = calculateSummary([salario, provisaoTransporte], []);
    const comViagem = calculateSummary(
      [
        salario,
        provisaoTransporte,
        tx({ id: 'u', type: 'expense', category: 'Transporte', amount: 90, card: 'c6', isReserveFunded: true }),
      ],
      [],
    );
    expect(comViagem.total).toBe(base.total);
    expect(comViagem.envelopes[0]).toMatchObject({ category: 'Transporte', used: 0, remaining: 300 });
  });

  it('dá o mesmo saldo do jeito antigo (reembolsável + entrada de reembolso casada)', () => {
    const jeitoAntigo = calculateSummary(
      [
        salario,
        tx({ id: 'v', type: 'expense', category: 'Viagem', amount: 500, card: 'c6', isReimbursement: true }),
        tx({ id: 'r', type: 'income', category: 'Reembolso', amount: 500, isReimbursement: true }),
      ],
      [],
    );
    const jeitoNovo = calculateSummary(
      [salario, tx({ id: 'v', type: 'expense', category: 'Viagem', amount: 500, card: 'c6', isReserveFunded: true })],
      [],
    );
    expect(jeitoNovo.total).toBe(jeitoAntigo.total);
    // mas sem inflar as entradas com um "reembolso" que não existiu
    expect(jeitoNovo.totalIncome).toBe(5000);
  });

  it('pausada no mês não conta em nada', () => {
    const r = calculateSummary(
      [salario, tx({ id: 'v', type: 'expense', category: 'Viagem', amount: 500, card: 'c6', isReserveFunded: true, skipped: true })],
      [],
    );
    expect(r.reserveFundedSpending).toBe(0);
    expect(r.cardSpending).toBe(0);
  });
});
