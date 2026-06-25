import { describe, it, expect } from 'vitest';
import { resolveSplitAmount } from '@/core/engine/split';

describe('resolveSplitAmount', () => {
  it('resolves a negative split as an expense with the absolute amount', () => {
    expect(resolveSplitAmount(-63.56)).toEqual({
      type: 'expense',
      amount: 63.56,
    });
  });

  it('resolves a positive split as income, keeping the amount as-is', () => {
    expect(resolveSplitAmount(51)).toEqual({ type: 'income', amount: 51 });
  });

  it('resolves zero as income with a zero amount', () => {
    expect(resolveSplitAmount(0)).toEqual({ type: 'income', amount: 0 });
  });
});
