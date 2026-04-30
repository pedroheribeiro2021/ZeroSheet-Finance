'use client';

import { useEffect, useState } from 'react';

import Card from '@/components/ui/Card';

import { getMonths } from '@/core/services/month.service';
import { getTransactions } from '@/core/services/transaction.service';
import { getWeeks } from '@/core/services/week.service';

import { mapTransaction, mapWeek } from '@/core/models/mappers';
import { calculateSummary } from '@/core/engine/calculations';

export default function Dashboard() {
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const months = await getMonths();

        if (!months.length) return;

        const latestMonth = months[months.length - 1];

        const transactionsDB = await getTransactions(latestMonth.id);
        const weeksDB = await getWeeks(latestMonth.id);

        const transactions = transactionsDB.map(mapTransaction);
        const weeks = weeksDB.map(mapWeek);

        const result = calculateSummary(transactions, weeks);

        setSummary(result);
      } catch (err) {
        console.error(err);
      }
    };

    load();
  }, []);

  if (!summary) {
    return (
      <div className="text-white text-center mt-10">Carregando dados...</div>
    );
  }

  return (
    <div className="p-6 grid gap-4 grid-cols-1 md:grid-cols-3">
      <Card title="Total Income" value={`R$ ${summary.totalIncome}`} />
      <Card title="Fixed Expenses" value={`R$ ${summary.fixedExpenses}`} />
      <Card
        title="Variable Expenses"
        value={`R$ ${summary.variableExpenses}`}
      />
      <Card title="C6 Balance" value={`R$ ${summary.c6}`} />
      <Card title="Weekly Budget" value={`R$ ${summary.weeklyBudget}`} />
      <Card title="Remaining" value={`R$ ${summary.remaining}`} />
    </div>
  );
}
