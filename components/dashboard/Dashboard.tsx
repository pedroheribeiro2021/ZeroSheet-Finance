'use client';

import { useEffect, useState } from 'react';

import Card from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';

import { getMonths, createMonth } from '@/core/services/month.service';
import { getTransactions } from '@/core/services/transaction.service';
import { createWeeks, getWeeks } from '@/core/services/week.service';

import { mapTransaction, mapWeek } from '@/core/models/mappers';
import { calculateSummary } from '@/core/engine/calculations';
import { calculateWeekly } from '@/core/engine/weekly';
import { getCardSnapshots } from '@/core/services/cardSnapshot.service';
import { groupTransactionsByCategory } from '@/core/utils/groupTransactions';

import { getInstallments } from '@/core/services/installment.service';

export default function Dashboard() {
  const [summary, setSummary] = useState<any>(null);
  const [weeks, setWeeks] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [filteredTransactions, setFilteredTransactions] = useState<any[]>([]);
  const groupedTransactions =
    groupTransactionsByCategory(filteredTransactions);

  const handleCardClick = (type: string) => {
    let filtered: any[] = [];

    switch (type) {
      case 'income':
        filtered = transactions.filter((t) => t.type === 'income');
        break;

      case 'fixed':
        filtered = transactions.filter((t) => t.isFixed);
        break;

      case 'provision':
        filtered = transactions.filter((t) => t.isProvision);
        break;

      case 'real':
        filtered = transactions.filter(
          (t) => t.type === 'expense' && !t.isFixed && !t.isProvision,
        );
        break;

      default:
        filtered = [];
    }

    setFilteredTransactions(filtered);
    setSelectedCard(type);
  };

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

      const snapshots = await getCardSnapshots(latestMonth.id);
      const transactionsDB = await getTransactions(latestMonth.id);
      const weeksDB = await getWeeks(latestMonth.id);

      const transactionsMapped = transactionsDB.map(mapTransaction);
      const mappedWeeks = weeksDB.map(mapWeek);

      const installmentsDB = await getInstallments(latestMonth.id);

      setTransactions(transactionsMapped);

      const result = calculateSummary(
        transactionsMapped,
        mappedWeeks,
        snapshots,
        installmentsDB,
      );

      let finalWeeks = calculateWeekly(
        snapshots,
        transactionsMapped,
        result.total,
        latestMonth.id,
      );

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

  if (!summary) {
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
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <Card
          title="Entradas"
          value={formatCurrency(summary.totalIncome)}
          onClick={() => handleCardClick('income')}
        />

        <Card
          title="Custos Fixos"
          value={formatCurrency(summary.fixedCosts)}
          onClick={() => handleCardClick('fixed')}
        />

        <Card title="Nubank" value={formatCurrency(summary.nubankSpending)} />
        <Card title="C6" value={formatCurrency(summary.c6Spending)} />

        <Card
          title="Total Cartões"
          value={formatCurrency(summary.cardSpending)}
        />

        <Card
          title="Planejado (Provisões)"
          value={formatCurrency(summary.provisionPlanned)}
          onClick={() => handleCardClick('provision')}
        />

        <Card
          title="Gasto Real (Provisões)"
          value={formatCurrency(summary.provisionUsed)}
          onClick={() => handleCardClick('real')}
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
        <h2 className="text-xl font-bold mb-2 text-white">Controle Semanal</h2>

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

      <Modal
        open={!!selectedCard}
        onClose={() => setSelectedCard(null)}
        title="Detalhamento"
      >
        {filteredTransactions.length === 0 && (
          <p className="text-zinc-400">Nenhum registro</p>
        )}

        <div className="grid gap-2">
          {groupedTransactions.map((item: any) => {
            const total = filteredTransactions.reduce(
              (acc, t) => acc + Number(t.amount),
              0,
            );

            const percent =
              total > 0 ? ((item.total / total) * 100).toFixed(1) : '0';

            return (
              <div key={item.category} className="bg-zinc-800 rounded p-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-white font-bold">{item.category}</p>

                    <p className="text-zinc-400 text-sm">
                      {item.count} lançamento(s)
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-white font-bold">
                      {formatCurrency(item.total)}
                    </p>

                    <p className="text-zinc-400 text-sm">{percent}%</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}
