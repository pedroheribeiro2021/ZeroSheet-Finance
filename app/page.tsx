'use client';

import { useEffect } from 'react';
import { createMonth, getMonths } from '@/core/services/month.service';
import {
  createTransaction,
  getTransactions,
} from '@/core/services/transaction.service';
import { calculateSummary } from '@/core/engine/calculations';
import { mapTransaction } from '@/core/models/mappers';

export default function Home() {
  useEffect(() => {
    const run = async () => {
      try {
        // 1. Criar mês
        const month = await createMonth(4, 2026);

        // 2. Criar transações
        await createTransaction({
          month_id: month.id,
          type: 'income',
          category: 'salary',
          amount: 4000,
          is_fixed: false,
        });

        await createTransaction({
          month_id: month.id,
          type: 'expense',
          category: 'rent',
          amount: 1500,
          is_fixed: true,
        });

        // 3. Buscar dados
        const transactionsDB = await getTransactions(month.id);

        const transactions = transactionsDB.map(mapTransaction);

        // 4. Rodar engine
        const summary = calculateSummary(transactions, []);

        console.log('SUMMARY REAL:', summary);
      } catch (err) {
        console.error(err);
      }
    };

    run();
  }, []);

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center">
      <h1>Database integrado</h1>
    </main>
  );
}
