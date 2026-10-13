import { describe, it, expect } from 'vitest';
import { categoryOptions, UsedCategory } from '@/core/engine/categories';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  RESERVE_CATEGORIES,
} from '@/core/constants/categories';

const despesa = (category: string): UsedCategory => ({
  category,
  type: 'expense',
});

describe('categoryOptions', () => {
  it('sem histórico, só as padrão', () => {
    expect(categoryOptions('expense', [])).toEqual({
      defaults: EXPENSE_CATEGORIES,
      custom: [],
    });
  });

  it('categoria criada pelo usuário aparece nas próprias, em ordem alfabética', () => {
    const { custom } = categoryOptions('expense', [
      despesa('Seguro'),
      despesa('Mercado / Alimentação'),
      despesa('Mercado / Alimentação'),
    ]);

    expect(custom).toEqual(['Mercado / Alimentação', 'Seguro']);
  });

  it('grafia diferente da padrão não vira categoria nova', () => {
    const { custom } = categoryOptions('expense', [
      despesa('mercado'),
      despesa(' Saude '),
      despesa('Água'),
    ]);

    expect(custom).toEqual([]);
  });

  it('mesma categoria com grafias diferentes: vale a mais recente (primeira da lista)', () => {
    const { custom } = categoryOptions('expense', [
      despesa('Mercado / Alimentação'),
      despesa('mercado / alimentacao'),
    ]);

    expect(custom).toEqual(['Mercado / Alimentação']);
  });

  it('separa por tipo: entrada, despesa e reserva não se misturam', () => {
    const used: UsedCategory[] = [
      despesa('Seguro'),
      { category: 'Venda de usados', type: 'income' },
      { category: 'Tesouro Selic', type: 'expense', is_reserve: true },
    ];

    expect(categoryOptions('expense', used).custom).toEqual(['Seguro']);
    expect(categoryOptions('income', used)).toEqual({
      defaults: INCOME_CATEGORIES,
      custom: ['Venda de usados'],
    });
    expect(categoryOptions('reserve', used)).toEqual({
      defaults: RESERVE_CATEGORIES,
      custom: ['Tesouro Selic'],
    });
  });

  it('o valor atual do lançamento sempre aparece', () => {
    expect(categoryOptions('expense', [], 'Pet').custom).toEqual(['Pet']);
    expect(categoryOptions('expense', [], 'Mercado').custom).toEqual([]);
  });

  it('ignora categoria vazia', () => {
    expect(categoryOptions('expense', [despesa('  ')], '').custom).toEqual([]);
  });
});
