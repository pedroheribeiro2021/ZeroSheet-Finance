import { describe, it, expect } from 'vitest';
import { calculateSummary } from '@/core/engine/calculations';
import { resolvePaydayDay } from '@/core/engine/coverage';
import { Transaction } from '@/core/types/finance';

const tx = (
  data: Partial<Transaction> &
    Pick<Transaction, 'id' | 'type' | 'category' | 'amount'>,
): Transaction => ({
  monthId: 'm-ago',
  isFixed: false,
  isProvision: false,
  isRecurring: false,
  card: null,
  createdAt: '2026-08-01',
  ...data,
});

/**
 * Reembolso é dinheiro que entra para cobrir uma despesa que JÁ foi contada.
 * O caso que expôs o bug: passagem comprada no C6 para pontuar milhas, paga
 * com dinheiro separado para a viagem. A passagem sobe a fatura (e portanto
 * `cardSpending`); o reembolso precisa entrar do outro lado, senão a mesma
 * despesa some do saldo duas vezes.
 */
describe('reembolso soma no saldo', () => {
  const semReembolso = [
    tx({
      id: 's',
      type: 'income',
      category: 'Salário',
      amount: 5000,
      dueDay: 15,
    }),
    tx({ id: 'c', type: 'expense', category: 'Passagem', amount: 427.49 }),
  ];

  const comReembolso = [
    ...semReembolso,
    tx({
      id: 'r',
      type: 'income',
      category: 'Reembolso',
      description: 'Tarifa Smiles passagem Argentina',
      amount: 427.49,
      isReimbursement: true,
    }),
  ];

  it('a despesa sozinha derruba o saldo', () => {
    expect(calculateSummary(semReembolso, []).total).toBe(4572.51);
  });

  it('o reembolso devolve exatamente o que a despesa tirou', () => {
    expect(calculateSummary(comReembolso, []).total).toBe(5000);
  });

  it('entra em totalIncome, não num balde à parte', () => {
    const r = calculateSummary(comReembolso, []);

    expect(r.totalIncome).toBe(5427.49);
    expect(r.reimbursementIncome).toBe(427.49);
  });

  it('não é confundido com salário, mas conta como outra entrada', () => {
    const r = calculateSummary(comReembolso, []);

    expect(r.salaryIncome).toBe(5000);
    expect(r.otherIncome).toBe(427.49);
  });

  it('ajusta o orçamento semanal em cascata', () => {
    const sem = calculateSummary(semReembolso, [], undefined, [], 'total', 5);
    const com = calculateSummary(comReembolso, [], undefined, [], 'total', 5);

    expect(com.weeklyBudget - sem.weeklyBudget).toBeCloseTo(427.49 / 5, 2);
  });

  it('marcar ou não marcar o flag dá o mesmo saldo', () => {
    // O usuário lançou três reembolsos sem o flag e um com. Antes, só o
    // marcado sumia do saldo — a inconsistência que motivou a correção.
    const semFlag = comReembolso.map((t) =>
      t.id === 'r' ? { ...t, isReimbursement: false } : t,
    );

    expect(calculateSummary(semFlag, []).total).toBe(
      calculateSummary(comReembolso, []).total,
    );
  });

  it('mas segue fora da detecção do dia do salário', () => {
    // Ali o flag está certo: reembolso não é a entrada recorrente que define
    // até quando a cobertura precisa durar.
    expect(resolvePaydayDay(comReembolso)).toBe(15);

    const soReembolso = [
      tx({
        id: 'r',
        type: 'income',
        category: 'Reembolso',
        amount: 9999,
        dueDay: 3,
        isReimbursement: true,
      }),
      tx({
        id: 's',
        type: 'income',
        category: 'Salário',
        amount: 5000,
        dueDay: 15,
      }),
    ];

    expect(resolvePaydayDay(soReembolso)).toBe(15);
  });
});

/**
 * Paridade com a planilha de agosto/2026: o "Rendimento total" de R$ 6.130,69
 * é salário + os dois reembolsos. O app mostrava R$ 5.703,20 — exatamente os
 * R$ 427,49 do reembolso marcado a menos.
 */
describe('paridade — agosto/2026', () => {
  const entradas = [
    tx({
      id: 's',
      type: 'income',
      category: 'Salário',
      amount: 5000,
      dueDay: 15,
    }),
    tx({
      id: 'r1',
      type: 'income',
      category: 'Reembolso',
      description: 'Reembolso compras Samsung',
      amount: 703.2,
      dueDay: 10,
      isReimbursement: false,
    }),
    tx({
      id: 'r2',
      type: 'income',
      category: 'Reembolso',
      description: 'Tarifa Smiles passagem Argentina - Brasília',
      amount: 427.49,
      isReimbursement: true,
    }),
  ];

  it('entradas batem com o Rendimento total da planilha', () => {
    expect(calculateSummary(entradas, []).totalIncome).toBe(6130.69);
  });
});
