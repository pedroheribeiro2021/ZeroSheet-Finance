import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMonth } from '@/core/services/month.service';

const mockUser = { id: 'user-1' };

vi.mock('@/core/services/auth.service', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

vi.mock('@/core/services/transaction.service', () => ({
  copyRecurringTransactions: vi.fn(),
}));

import { getCurrentUser } from '@/core/services/auth.service';
import { supabase } from '@/lib/supabase';
import { copyRecurringTransactions } from '@/core/services/transaction.service';

const makeBuilder = (result: { data?: unknown; error?: unknown }) => {
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
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
  vi.mocked(copyRecurringTransactions).mockResolvedValue(undefined);
});

describe('createMonth', () => {
  it('throws when the user is not authenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    await expect(createMonth(1, 2026)).rejects.toThrow('Usuário não autenticado');
  });

  it('returns the existing month without inserting when it already exists', async () => {
    const existingMonth = { id: 'm-existing', month: 1, year: 2026 };

    // existingMonth check → found
    const maybeSingleBuilder = makeBuilder({ data: existingMonth, error: null });
    vi.mocked(supabase.from).mockReturnValueOnce(maybeSingleBuilder as never);

    const result = await createMonth(1, 2026);

    expect(result).toEqual(existingMonth);
    expect(supabase.from).toHaveBeenCalledTimes(1);
    expect(copyRecurringTransactions).not.toHaveBeenCalled();
  });

  it('creates a new month and copies recurring transactions from the last month', async () => {
    const lastMonth = { id: 'm-last', month: 12, year: 2025, created_at: '2025-12-01' };
    const newMonth = { id: 'm-new', month: 1, year: 2026 };

    // 1. existingMonth check → not found
    const maybeSingleBuilder = makeBuilder({ data: null, error: null });
    // 2. list existing months → one month
    const listBuilder = makeBuilder({ data: [lastMonth], error: null });
    // 3. insert new month → returns newMonth
    const insertBuilder = makeBuilder({ data: newMonth, error: null });

    vi.mocked(supabase.from)
      .mockReturnValueOnce(maybeSingleBuilder as never)
      .mockReturnValueOnce(listBuilder as never)
      .mockReturnValueOnce(insertBuilder as never);

    const result = await createMonth(1, 2026);

    expect(result).toEqual(newMonth);
    expect(copyRecurringTransactions).toHaveBeenCalledWith('m-last', 'm-new', {
      month: 1,
      year: 2026,
    });
  });

  it('copies from the previous COMPETENCE, not the last row created', async () => {
    // set/2026 foi criado antes de ago/2026 (mês retroativo). A cópia tem que
    // vir de jul/2026, não de setembro.
    const jul = { id: 'm-jul', month: 7, year: 2026, created_at: '2026-07-01' };
    const set = { id: 'm-set', month: 9, year: 2026, created_at: '2026-09-01' };
    const ago = { id: 'm-ago', month: 8, year: 2026 };

    const maybeSingleBuilder = makeBuilder({ data: null, error: null });
    const listBuilder = makeBuilder({ data: [jul, set], error: null });
    const insertBuilder = makeBuilder({ data: ago, error: null });

    vi.mocked(supabase.from)
      .mockReturnValueOnce(maybeSingleBuilder as never)
      .mockReturnValueOnce(listBuilder as never)
      .mockReturnValueOnce(insertBuilder as never);

    await createMonth(8, 2026);

    expect(copyRecurringTransactions).toHaveBeenCalledWith('m-jul', 'm-ago', {
      month: 8,
      year: 2026,
    });
  });

  it('does not copy when every existing month is later than the target', async () => {
    const set = { id: 'm-set', month: 9, year: 2026 };
    const jan = { id: 'm-jan', month: 1, year: 2026 };

    const maybeSingleBuilder = makeBuilder({ data: null, error: null });
    const listBuilder = makeBuilder({ data: [set], error: null });
    const insertBuilder = makeBuilder({ data: jan, error: null });

    vi.mocked(supabase.from)
      .mockReturnValueOnce(maybeSingleBuilder as never)
      .mockReturnValueOnce(listBuilder as never)
      .mockReturnValueOnce(insertBuilder as never);

    await createMonth(1, 2026);

    expect(copyRecurringTransactions).not.toHaveBeenCalled();
  });

  it('creates a new month without copying when there are no previous months', async () => {
    const newMonth = { id: 'm-new', month: 1, year: 2026 };

    const maybeSingleBuilder = makeBuilder({ data: null, error: null });
    const listBuilder = makeBuilder({ data: [], error: null });
    const insertBuilder = makeBuilder({ data: newMonth, error: null });

    vi.mocked(supabase.from)
      .mockReturnValueOnce(maybeSingleBuilder as never)
      .mockReturnValueOnce(listBuilder as never)
      .mockReturnValueOnce(insertBuilder as never);

    const result = await createMonth(1, 2026);

    expect(result).toEqual(newMonth);
    expect(copyRecurringTransactions).not.toHaveBeenCalled();
  });

  it('throws when the duplicate-check query fails', async () => {
    const errorBuilder = makeBuilder({ data: null, error: new Error('DB error') });
    vi.mocked(supabase.from).mockReturnValueOnce(errorBuilder as never);

    await expect(createMonth(1, 2026)).rejects.toThrow('DB error');
  });

  it('throws when the insert query fails', async () => {
    const maybeSingleBuilder = makeBuilder({ data: null, error: null });
    const listBuilder = makeBuilder({ data: [], error: null });
    const insertBuilder = makeBuilder({ data: null, error: new Error('insert failed') });

    vi.mocked(supabase.from)
      .mockReturnValueOnce(maybeSingleBuilder as never)
      .mockReturnValueOnce(listBuilder as never)
      .mockReturnValueOnce(insertBuilder as never);

    await expect(createMonth(1, 2026)).rejects.toThrow('insert failed');
  });
});
