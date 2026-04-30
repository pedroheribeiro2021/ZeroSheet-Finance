'use client';

import { useEffect } from 'react';
import { calculateSummary } from '@/core/engine/calculations';
import { Transaction, Week } from '@/core/types/finance';

export default function Home() {
  useEffect(() => {
    const transactions: Transaction[] = [
      {
        id: '1',
        type: 'income',
        category: 'salario',
        amount: 4000,
        isFixed: false,
      },
      {
        id: '2',
        type: 'income',
        category: 'extra',
        amount: 500,
        isFixed: false,
      },

      {
        id: '3',
        type: 'expense',
        category: 'nubank',
        amount: 1000,
        isFixed: true,
      },
      {
        id: '4',
        type: 'expense',
        category: 'seguro',
        amount: 200,
        isFixed: true,
      },

      {
        id: '5',
        type: 'expense',
        category: 'gasolina',
        amount: 400,
        isFixed: false,
      },
    ];

    const weeks: Week[] = [
      { weekNumber: 1, planned: 0, actual: 200 },
      { weekNumber: 2, planned: 0, actual: 300 },
    ];

    const summary = calculateSummary(transactions, weeks);

    console.log('SUMMARY:', summary);
  }, []);

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center">
      <h1>Engine funcionando</h1>
    </main>
  );
}
