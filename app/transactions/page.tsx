'use client';

import { useEffect, useState } from 'react';

import TransactionForm from '@/components/transactions/TransactionForm';
import TransactionList from '@/components/transactions/TransactionList';
import { mapTransaction } from '@/core/models/mappers';
import { createMonth, getMonths } from '@/core/services/month.service';
import { getTransactions } from '@/core/services/transaction.service';

export default function TransactionsPage() {
  const [monthId, setMonthId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);

  const load = async () => {
    try {
      let monthsData = await getMonths();

      if (!monthsData.length) {
        const now = new Date();
        const newMonth = await createMonth(
          now.getMonth() + 1,
          now.getFullYear(),
        );

        monthsData = [newMonth];
      }

      const latestMonth = monthsData[monthsData.length - 1];
      setMonthId(latestMonth.id);

      const transactionsDB = await getTransactions(latestMonth.id);
      setTransactions(transactionsDB.map(mapTransaction));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (!monthId) {
    return <div className="p-6 text-white">Carregando...</div>;
  }

  return (
    <div className="p-6 grid gap-4">
      <h1 className="text-2xl font-bold text-white">Transações</h1>

      <TransactionForm monthId={monthId} onCreated={load} />
      <TransactionList transactions={transactions} onUpdated={load} />
    </div>
  );
}
