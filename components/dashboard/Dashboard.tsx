'use client';

import { useEffect, useState } from 'react';

import Card from '@/components/ui/Card';
import TransactionForm from '@/components/transactions/TransactionForm';
import TransactionList from '@/components/transactions/TransactionList';

import { getMonths } from '@/core/services/month.service';
import { getTransactions } from '@/core/services/transaction.service';
import { getWeeks } from '@/core/services/week.service';

import { mapTransaction, mapWeek } from '@/core/models/mappers';
import { calculateSummary } from '@/core/engine/calculations';
import { calculateWeeklySpending } from '@/core/engine/weekly';

export default function Dashboard({
  summary: summaryProp,
  weeks: weeksProp,
}: any) {
  const [summary, setSummary] = useState<any>(summaryProp ?? null);
  const [weeks, setWeeks] = useState<any[]>(weeksProp ?? []);
  const [transactions, setTransactions] = useState<any[]>([]);

  const load = async () => {
    try {
      const months = await getMonths();
      if (!months.length) return;

      const latestMonth = months[months.length - 1];

      const transactionsDB = await getTransactions(latestMonth.id);
      const weeksDB = await getWeeks(latestMonth.id);

      const transactionsMapped = transactionsDB.map(mapTransaction);
      const mappedWeeks = weeksDB.map(mapWeek);

      setTransactions(transactionsMapped);

      const result = calculateSummary(transactionsMapped, mappedWeeks);
      const weeksCalculated = calculateWeeklySpending(transactionsMapped);

      setSummary(result);
      setWeeks(weeksCalculated);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (summaryProp && weeksProp) return;
    load();
  }, [summaryProp, weeksProp]);

  if (!summary) {
    return <div className="text-white p-6">Carregando...</div>;
  }

  return (
    <div className="p-6 grid gap-4">
      <TransactionForm onCreated={load} />

      <TransactionList transactions={transactions} />

      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <Card title="Entradas" value={`R$ ${summary.totalIncome}`} />

        <Card title="Custos Fixos" value={`R$ ${summary.fixedCosts}`} />

        <Card title="Nubank" value={`R$ ${summary.nubankSpending}`} />
        <Card title="C6" value={`R$ ${summary.c6Spending}`} />

        <Card title="Total Cartões" value={`R$ ${summary.cardSpending}`} />

        <Card
          title="Planejado (Provisões)"
          value={`R$ ${summary.provisionPlanned}`}
        />

        <Card
          title="Gasto Real (Provisões)"
          value={`R$ ${summary.provisionUsed}`}
        />

        <Card
          title="Diferença"
          value={`R$ ${summary.provisionDiff}`}
          className={
            summary.provisionDiff < 0 ? 'border-red-500' : 'border-green-500'
          }
        />
        <Card title="Provisões" value={`R$ ${summary.provisions}`} />

        <Card title="Total do Mês" value={`R$ ${summary.total}`} />

        <Card title="Orçamento Semanal" value={`R$ ${summary.weeklyBudget}`} />
      </div>

      <div className="mt-6">
        <h2 className="text-xl font-bold mb-2">Controle Semanal</h2>

        <div className="grid grid-cols-2 gap-4">
          {weeks.map((week: any) => (
            <div key={week.id} className="bg-zinc-900 p-4 rounded">
              <p className="font-bold">Semana {week.index}</p>

              <p>Orçamento: R$ {week.budget.toFixed(2)}</p>
              <p>Gasto: R$ {week.spent.toFixed(2)}</p>

              <p
                className={
                  week.remaining < 0 ? 'text-red-500' : 'text-green-500'
                }
              >
                Restante: R$ {week.remaining.toFixed(2)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
