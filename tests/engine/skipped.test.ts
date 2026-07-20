import { describe, it, expect } from 'vitest';
import { calculateSummary } from '@/core/engine/calculations';
import { getDueItems } from '@/core/engine/dueDates';
import { Transaction } from '@/core/types/finance';

const base = {
  monthId: 'm1',
  isFixed: false,
  isProvision: false,
  isRecurring: false,
  card: null,
  createdAt: '2026-07-01',
};

const salario: Transaction = {
  ...base,
  id: 's1',
  type: 'income',
  category: 'Salário',
  amount: 5000,
};

const reserva: Transaction = {
  ...base,
  id: 'rv1',
  type: 'expense',
  category: 'Reserva',
  amount: 1000,
  isRecurring: true,
  isReserve: true,
};

describe('pausar este mês (skipped)', () => {
  it('lançamento pausado não conta em nenhum bucket do summary', () => {
    const ativo = calculateSummary([salario, reserva], []);
    const pausado = calculateSummary(
      [salario, { ...reserva, skipped: true }],
      [],
    );

    expect(ativo.reserveSpending).toBe(1000);
    expect(ativo.total).toBe(4000);

    expect(pausado.reserveSpending).toBe(0);
    expect(pausado.total).toBe(5000); // a reserva pausada devolve 1.000 ao saldo
  });

  it('custo fixo pausado sai de fixedCosts', () => {
    const fixo: Transaction = {
      ...base,
      id: 'f1',
      type: 'expense',
      category: 'Internet',
      amount: 130,
      isFixed: true,
      isRecurring: true,
      skipped: true,
    };

    const result = calculateSummary([salario, fixo], []);

    expect(result.fixedCosts).toBe(0);
    expect(result.total).toBe(5000);
  });

  it('provisão pausada não cria envelope', () => {
    const provisao: Transaction = {
      ...base,
      id: 'p1',
      type: 'expense',
      category: 'Mercado',
      amount: 520,
      isProvision: true,
      skipped: true,
    };

    const result = calculateSummary([salario, provisao], []);

    expect(result.envelopeSpending).toBe(0);
    expect(result.envelopes).toHaveLength(0);
  });

  it('receita pausada não soma nas entradas', () => {
    const result = calculateSummary([{ ...salario, skipped: true }], []);

    expect(result.totalIncome).toBe(0);
  });

  it('despesa pausada não aparece no calendário de vencimentos', () => {
    const conta: Transaction = {
      ...base,
      id: 'c1',
      type: 'expense',
      category: 'Energia',
      amount: 150,
      isFixed: true,
      isRecurring: true,
      dueDay: 18,
      skipped: true,
    };

    const items = getDueItems([conta], new Date(2026, 6, 17));

    expect(items).toHaveLength(0);
  });
});
