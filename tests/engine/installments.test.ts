import { describe, it, expect } from 'vitest';
import { filterActiveInstallments } from '@/core/engine/installments';

const months = [
  { id: 'm1' },
  { id: 'm2' },
  { id: 'm3' },
  { id: 'm4' },
  { id: 'm5' },
];

describe('filterActiveInstallments', () => {
  it('keeps an installment whose range covers the current month', () => {
    const installments = [
      { id: 'i1', start_month_id: 'm2', total_installments: 3 }, // active on m2, m3, m4
    ];

    expect(
      filterActiveInstallments(installments, months, 'm3').map((i) => i.id),
    ).toEqual(['i1']);
  });

  it('excludes an installment that already finished before the current month', () => {
    const installments = [
      { id: 'i1', start_month_id: 'm1', total_installments: 2 }, // active on m1, m2 only
    ];

    expect(filterActiveInstallments(installments, months, 'm3')).toEqual([]);
  });

  it('excludes an installment that starts after the current month', () => {
    const installments = [
      { id: 'i1', start_month_id: 'm4', total_installments: 2 },
    ];

    expect(filterActiveInstallments(installments, months, 'm2')).toEqual([]);
  });

  it('includes a single-month installment exactly on its start month', () => {
    const installments = [
      { id: 'i1', start_month_id: 'm3', total_installments: 1 },
    ];

    expect(
      filterActiveInstallments(installments, months, 'm3').map((i) => i.id),
    ).toEqual(['i1']);
  });

  it('excludes installments whose start month is not in the months list', () => {
    const installments = [
      { id: 'i1', start_month_id: 'unknown', total_installments: 3 },
    ];

    expect(filterActiveInstallments(installments, months, 'm3')).toEqual([]);
  });

  it('returns an empty array when the current month is not in the months list', () => {
    const installments = [
      { id: 'i1', start_month_id: 'm1', total_installments: 5 },
    ];

    expect(filterActiveInstallments(installments, months, 'unknown')).toEqual(
      [],
    );
  });

  it('exposes the current installment number (started 3 months before current shows 4/N)', () => {
    const installments = [
      { id: 'i1', start_month_id: 'm1', total_installments: 6 }, // active m1..m6
    ];

    const result = filterActiveInstallments(installments, months, 'm4');

    expect(result).toEqual([
      { id: 'i1', start_month_id: 'm1', total_installments: 6, currentInstallment: 4 },
    ]);
  });

  it('shows 1/N on the installment start month', () => {
    const installments = [
      { id: 'i1', start_month_id: 'm3', total_installments: 1 },
    ];

    const result = filterActiveInstallments(installments, months, 'm3');

    expect(result[0].currentInstallment).toBe(1);
  });
});
