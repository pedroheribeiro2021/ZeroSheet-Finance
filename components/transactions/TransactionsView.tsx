'use client';

import { useEffect, useState } from 'react';

import TransactionForm from '@/components/transactions/TransactionForm';
import TransactionList from '@/components/transactions/TransactionList';
import MonthSelect from '@/components/ui/MonthSelect';
import PageLoading from '@/components/ui/PageLoading';
import { mapTransaction } from '@/core/models/mappers';
import { getTransactions } from '@/core/services/transaction.service';
import { getCards } from '@/core/services/card.service';
import { useActiveMonth } from '@/core/hooks/useActiveMonth';
import { Transaction } from '@/core/types/finance';
import { DBCard } from '@/core/types/database';

export default function TransactionsView() {
  const { months, activeMonth, goToMonth } = useActiveMonth();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cardNames, setCardNames] = useState<Record<string, string>>({});

  const load = async (monthId: string) => {
    try {
      const [transactionsDB, cardsDB] = await Promise.all([
        getTransactions(monthId),
        getCards(),
      ]);

      setTransactions(transactionsDB.map(mapTransaction));
      setCardNames(Object.fromEntries(cardsDB.map((c: DBCard) => [c.id, c.name])));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!activeMonth) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(activeMonth.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMonth?.id]);

  if (!activeMonth) {
    return <PageLoading />;
  }

  const handleReload = () => load(activeMonth.id);

  return (
    <div className="grid gap-4 p-4 sm:gap-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-white sm:text-2xl">Transações</h1>
        <MonthSelect months={months} activeMonth={activeMonth} onChange={goToMonth} />
      </div>

      <TransactionForm
        monthId={activeMonth.id}
        month={{ month: activeMonth.month, year: activeMonth.year }}
        onCreated={handleReload}
      />
      <TransactionList
        transactions={transactions}
        cardNames={cardNames}
        onUpdated={handleReload}
      />
    </div>
  );
}
