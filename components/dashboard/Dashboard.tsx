'use client';

import { useEffect, useState } from 'react';

import Card from '@/components/ui/Card';
import TransactionForm from '@/components/transactions/TransactionForm';
import TransactionList from '@/components/transactions/TransactionList';

import { getMonths, createMonth } from '@/core/services/month.service';
import { getTransactions } from '@/core/services/transaction.service';
import {
  createWeeks,
  getWeeks,
  updateWeek,
} from '@/core/services/week.service';

import { mapTransaction, mapWeek } from '@/core/models/mappers';
import { calculateSummary } from '@/core/engine/calculations';
import { calculateWeekly } from '@/core/engine/weekly';
import { getCardSnapshots } from '@/core/services/cardSnapshot.service';
import CardSnapshotForm from '../cards/CardSnapshotForm';
import { getInstallments } from '@/core/services/installment.service';
import InstallmentForm from '../transactions/InstallmentForm';

export default function Dashboard({
  summary: summaryProp,
  weeks: weeksProp,
}: any) {
  const [summary, setSummary] = useState<any>(summaryProp ?? null);
  const [weeks, setWeeks] = useState<any[]>(weeksProp ?? []);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [monthId, setMonthId] = useState<string | null>(null);

  const load = async () => {
    try {
      let months = await getMonths();

      // 🔥 CRIA MÊS AUTOMATICAMENTE
      if (!months.length) {
        const now = new Date();

        const newMonth = await createMonth(
          now.getMonth() + 1,
          now.getFullYear(),
        );

        months = [newMonth];
      }

      const latestMonth = months[months.length - 1];

      setMonthId(latestMonth.id);

      const snapshots = await getCardSnapshots(latestMonth.id);

      const transactionsDB = await getTransactions(latestMonth.id);
      const weeksDB = await getWeeks(latestMonth.id);

      const transactionsMapped = transactionsDB.map(mapTransaction);
      const mappedWeeks = weeksDB.map(mapWeek);

      const installments = await getInstallments();

      setTransactions(transactionsMapped);

      const result = calculateSummary(
        transactionsMapped,
        mappedWeeks,
        snapshots,
        installments,
      );

      let finalWeeks = mappedWeeks;

      finalWeeks = calculateWeekly(
        snapshots,
        transactionsMapped,
        result.total,
        latestMonth.id,
      );

      // 🔥 fallback: cria semanas vazias se não houver nada
      if (!finalWeeks.length) {
        finalWeeks = Array.from({ length: 4 }).map((_, i) => ({
          id: crypto.randomUUID(),
          monthId: latestMonth.id,
          index: i + 1,
          budget: result.total / 4,
          spent: 0,
          remaining: result.total / 4,
        }));

        await createWeeks(latestMonth.id, finalWeeks);
      }

      setSummary(result);
      setWeeks(finalWeeks);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (!summary || !monthId) {
    return <div className="text-white p-6">Carregando...</div>;
  }

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="p-6 grid gap-4">
      <CardSnapshotForm monthId={monthId} onUpdated={load} />

      <TransactionForm monthId={monthId} onCreated={load} />
      <InstallmentForm onCreated={load} />
      <TransactionList transactions={transactions} onUpdated={load} />

      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <Card title="Entradas" value={formatCurrency(summary.totalIncome)} />

        <Card title="Custos Fixos" value={formatCurrency(summary.fixedCosts)} />

        <Card title="Nubank" value={formatCurrency(summary.nubankSpending)} />
        <Card title="C6" value={formatCurrency(summary.c6Spending)} />

        <Card
          title="Total Cartões"
          value={formatCurrency(summary.cardSpending)}
        />

        <Card
          title="Planejado (Provisões)"
          value={formatCurrency(summary.provisionPlanned)}
        />

        <Card
          title="Gasto Real (Provisões)"
          value={formatCurrency(summary.provisionUsed)}
        />

        <Card
          title="Diferença"
          value={formatCurrency(summary.provisionDiff)}
          className={
            summary.provisionDiff < 0 ? 'border-red-500' : 'border-green-500'
          }
        />

        <Card title="Total do Mês" value={formatCurrency(summary.total)} />

        <Card
          title="Orçamento Semanal"
          value={formatCurrency(summary.weeklyBudget)}
        />
      </div>

      <div className="mt-6">
        <h2 className="text-xl font-bold mb-2">Controle Semanal</h2>

        <div className="grid grid-cols-2 gap-4">
          {weeks.map((week: any) => (
            <div key={week.id} className="bg-zinc-900 p-4 rounded">
              <p className="font-bold text-white">Semana {week.index}</p>

              <p className="text-zinc-400">
                Orçamento: {formatCurrency(week.budget)}
              </p>
              <p className="text-white">Gasto: {formatCurrency(week.spent)}</p>

              <p
                className={
                  week.remaining < 0 ? 'text-red-500' : 'text-green-500'
                }
              >
                Restante: {formatCurrency(week.remaining)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
