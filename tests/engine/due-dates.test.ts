import { describe, it, expect } from 'vitest';
import {
  resolveDueDate,
  classifyDueStatus,
  getDueItems,
} from '@/core/engine/dueDates';
import { Transaction } from '@/core/types/finance';

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 't1',
    monthId: 'm1',
    type: 'expense',
    category: 'internet',
    amount: 100,
    isFixed: true,
    isProvision: false,
    isRecurring: false,
    card: null,
    createdAt: '2026-07-01',
    ...overrides,
  };
}

describe('resolveDueDate', () => {
  it('resolve o dia informado dentro do mês', () => {
    const date = resolveDueDate(10, 2026, 7);
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(6); // julho (0-based)
    expect(date.getDate()).toBe(10);
  });

  it('clampa dia 31 para fevereiro (28 dias em 2026)', () => {
    const date = resolveDueDate(31, 2026, 2);
    expect(date.getMonth()).toBe(1); // fevereiro
    expect(date.getDate()).toBe(28);
  });

  it('clampa dia 31 para abril (30 dias)', () => {
    const date = resolveDueDate(31, 2026, 4);
    expect(date.getDate()).toBe(30);
  });
});

describe('classifyDueStatus', () => {
  const today = new Date(2026, 6, 10);

  it('data anterior a hoje → overdue', () => {
    expect(classifyDueStatus(new Date(2026, 6, 5), today)).toBe('overdue');
  });

  it('data igual a hoje → today', () => {
    expect(classifyDueStatus(new Date(2026, 6, 10), today)).toBe('today');
  });

  it('data futura → upcoming', () => {
    expect(classifyDueStatus(new Date(2026, 6, 15), today)).toBe('upcoming');
  });
});

describe('getDueItems', () => {
  const today = new Date(2026, 6, 10); // 10/07/2026

  it('classifica atrasado, hoje e próximos dentro do horizonte, ordenados por data', () => {
    const transactions: Transaction[] = [
      makeTransaction({ id: 'overdue', dueDay: 5 }),
      makeTransaction({ id: 'today', dueDay: 10 }),
      makeTransaction({ id: 'upcoming', dueDay: 15 }),
    ];

    const items = getDueItems(transactions, today, { horizonDays: 7 });

    expect(items.map((i) => i.transaction.id)).toEqual([
      'overdue',
      'today',
      'upcoming',
    ]);
    expect(items[0].status).toBe('overdue');
    expect(items[0].daysUntil).toBe(-5);
    expect(items[1].status).toBe('today');
    expect(items[1].daysUntil).toBe(0);
    expect(items[2].status).toBe('upcoming');
    expect(items[2].daysUntil).toBe(5);
  });

  it('exclui upcoming além do horizonte, mas atrasado/hoje sempre entram', () => {
    const transactions: Transaction[] = [
      makeTransaction({ id: 'far', dueDay: 30 }), // 20 dias à frente
    ];

    const items = getDueItems(transactions, today, { horizonDays: 7 });
    expect(items).toHaveLength(0);
  });

  it('ignora transação sem dueDay', () => {
    const transactions: Transaction[] = [
      makeTransaction({ id: 'no-due', dueDay: undefined }),
    ];

    expect(getDueItems(transactions, today)).toHaveLength(0);
  });

  it('ignora receitas mesmo com dueDay', () => {
    const transactions: Transaction[] = [
      makeTransaction({ id: 'income', type: 'income', dueDay: 10 }),
    ];

    expect(getDueItems(transactions, today)).toHaveLength(0);
  });

  it('ignora despesa não fixa e não recorrente', () => {
    const transactions: Transaction[] = [
      makeTransaction({
        id: 'one-off',
        dueDay: 10,
        isFixed: false,
        isRecurring: false,
      }),
    ];

    expect(getDueItems(transactions, today)).toHaveLength(0);
  });

  it('inclui despesa recorrente (não fixa) com dueDay', () => {
    const transactions: Transaction[] = [
      makeTransaction({
        id: 'recurring',
        dueDay: 10,
        isFixed: false,
        isRecurring: true,
      }),
    ];

    expect(getDueItems(transactions, today)).toHaveLength(1);
  });

  it('paidAt sobrepõe o status calculado por data, mesmo atrasada', () => {
    const transactions: Transaction[] = [
      makeTransaction({ id: 'paid-overdue', dueDay: 5, paidAt: '2026-07-06T10:00:00Z' }),
    ];

    const items = getDueItems(transactions, today);
    expect(items[0].status).toBe('paid');
  });
});
