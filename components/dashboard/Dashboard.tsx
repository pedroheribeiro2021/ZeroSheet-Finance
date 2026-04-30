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

export default function Dashboard() {
  const [summary, setSummary] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);

  const load = async () => {
    try {
      const months = await getMonths();
      if (!months.length) return;

      const latestMonth = months[months.length - 1];

      const transactionsDB = await getTransactions(latestMonth.id);
      const weeksDB = await getWeeks(latestMonth.id);

      const transactionsMapped = transactionsDB.map(mapTransaction);
      const weeks = weeksDB.map(mapWeek);

      setTransactions(transactionsMapped);

      const result = calculateSummary(transactionsMapped, weeks);
      setSummary(result);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (!summary) {
    return <div className="text-white p-6">Carregando...</div>;
  }

  return (
    <div className="p-6 grid gap-4">
      <TransactionForm onCreated={load} />

      <TransactionList transactions={transactions} />

      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <Card title="Receitas" value={`R$ ${summary.totalIncome}`} />
        <Card title="Despesas Fixas" value={`R$ ${summary.fixedExpenses}`} />
        <Card
          title="Despesas Variáveis"
          value={`R$ ${summary.variableExpenses}`}
        />
        <Card title="Saldo (C6)" value={`R$ ${summary.c6}`} />
        <Card title="Orçamento Semanal" value={`R$ ${summary.weeklyBudget}`} />
        <Card title="Restante" value={`R$ ${summary.remaining}`} />
      </div>
    </div>
  );
}
