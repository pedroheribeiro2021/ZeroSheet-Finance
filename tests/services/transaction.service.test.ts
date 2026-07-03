import { describe, it, expect, vi, beforeEach } from 'vitest';
import { copyRecurringTransactions } from '@/core/services/transaction.service';

const mockUser = { id: 'user-1' };

vi.mock('@/core/services/auth.service', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

import { getCurrentUser } from '@/core/services/auth.service';
import { supabase } from '@/lib/supabase';

const makeBuilder = (result: { data?: unknown; error?: unknown }) => {
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
  };
  Object.defineProperty(builder, 'then', {
    get() {
      return (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve(result).then(resolve, reject);
    },
  });
  return builder;
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue(mockUser as never);
});

describe('copyRecurringTransactions', () => {
  it('throws when the user is not authenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    await expect(
      copyRecurringTransactions('m-from', 'm-to'),
    ).rejects.toThrow('Usuário não autenticado');
  });

  it('returns early without inserting when there are no recurring transactions', async () => {
    const selectBuilder = makeBuilder({ data: [], error: null });
    vi.mocked(supabase.from).mockReturnValueOnce(selectBuilder as never);

    await copyRecurringTransactions('m-from', 'm-to');

    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it('inserts only the allowed fields, mapped to the destination month', async () => {
    const recurringTransaction = {
      id: 'original-id',
      created_at: '2026-01-01',
      month_id: 'm-from',
      user_id: 'user-1',
      type: 'expense',
      category: 'Alimentação',
      amount: 100,
      is_fixed: true,
      is_recurring: true,
      is_provision: false,
      due_day: 10,
      card: null,
    };

    const selectBuilder = makeBuilder({ data: [recurringTransaction], error: null });
    const insertBuilder = makeBuilder({ error: null });

    vi.mocked(supabase.from)
      .mockReturnValueOnce(selectBuilder as never)
      .mockReturnValueOnce(insertBuilder as never);

    await copyRecurringTransactions('m-from', 'm-to');

    expect(insertBuilder.insert).toHaveBeenCalledWith([
      {
        month_id: 'm-to',
        user_id: 'user-1',
        type: 'expense',
        category: 'Alimentação',
        amount: 100,
        is_fixed: true,
        is_recurring: true,
        is_provision: false,
        is_reimbursement: false,
        is_reserve: false,
        due_day: 10,
        recurring_until: null,
        card: null,
      },
    ]);
  });

  it('sets due_day and card to null when the source row has undefined for those fields', async () => {
    const recurringTransaction = {
      id: 'x',
      month_id: 'm-from',
      user_id: 'user-1',
      type: 'expense',
      category: 'Outros',
      amount: 50,
      is_fixed: false,
      is_recurring: true,
      is_provision: false,
      due_day: undefined,
      card: undefined,
    };

    const selectBuilder = makeBuilder({ data: [recurringTransaction], error: null });
    const insertBuilder = makeBuilder({ error: null });

    vi.mocked(supabase.from)
      .mockReturnValueOnce(selectBuilder as never)
      .mockReturnValueOnce(insertBuilder as never);

    await copyRecurringTransactions('m-from', 'm-to');

    const inserted = vi.mocked(insertBuilder.insert as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(inserted[0].due_day).toBeNull();
    expect(inserted[0].card).toBeNull();
  });

  it('throws when the select query fails', async () => {
    const selectBuilder = makeBuilder({ data: null, error: new Error('DB error') });
    vi.mocked(supabase.from).mockReturnValueOnce(selectBuilder as never);

    await expect(copyRecurringTransactions('m-from', 'm-to')).rejects.toThrow('DB error');
  });

  it('throws when the insert query fails', async () => {
    const recurringTransaction = {
      id: 'x',
      month_id: 'm-from',
      user_id: 'user-1',
      type: 'expense',
      category: 'Outros',
      amount: 50,
      is_fixed: false,
      is_recurring: true,
      is_provision: false,
      due_day: null,
      card: null,
    };

    const selectBuilder = makeBuilder({ data: [recurringTransaction], error: null });
    const insertBuilder = makeBuilder({ error: new Error('insert failed') });

    vi.mocked(supabase.from)
      .mockReturnValueOnce(selectBuilder as never)
      .mockReturnValueOnce(insertBuilder as never);

    await expect(copyRecurringTransactions('m-from', 'm-to')).rejects.toThrow('insert failed');
  });
});
