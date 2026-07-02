'use client';

import { useEffect, useState } from 'react';

import Card from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';

import { getMonths, createMonth } from '@/core/services/month.service';
import { getTransactions } from '@/core/services/transaction.service';
import { createWeeks, getWeeks } from '@/core/services/week.service';

import { mapTransaction, mapWeek } from '@/core/models/mappers';
import { calculateSummary } from '@/core/engine/calculations';
import { calculateWeekly, getWeeksInCycle, getWeeksInMonth } from '@/core/engine/weekly';
import { getCardSnapshots } from '@/core/services/cardSnapshot.service';
import { groupTransactionsByCategory } from '@/core/utils/groupTransactions';

import { getInstallments } from '@/core/services/installment.service';
import { getCards } from '@/core/services/card.service';
import { getReadings, addReading, deleteReading } from '@/core/services/cardReading.service';
import { weeklySpendFromReadings } from '@/core/engine/weekly';
import { DBCard, DBCardSnapshot, DBCardReading } from '@/core/types/database';
import { Transaction, Week } from '@/core/types/finance';
import WeeklyBarChart from './WeeklyBarChart';
import CategoryBarChart from './CategoryBarChart';

export default function Dashboard() {
  const [summary, setSummary] = useState<ReturnType<
    typeof calculateSummary
  > | null>(null);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [filteredTransactions, setFilteredTransactions] = useState<
    Transaction[]
  >([]);
  const groupedTransactions = groupTransactionsByCategory(filteredTransactions);
  const [cards, setCards] = useState<DBCard[]>([]);
  const [snapshots, setSnapshots] = useState<DBCardSnapshot[]>([]);
  const [readings, setReadings] = useState<DBCardReading[]>([]);
  const [weeklySpend, setWeeklySpend] = useState<{ weekIndex: number; spent: number }[]>([]);
  const [readingAmount, setReadingAmount] = useState('');
  const [currentMonthId, setCurrentMonthId] = useState<string | null>(null);
  const [primaryCard, setPrimaryCardState] = useState<DBCard | null>(null);

  const handleCardClick = (type: string) => {
    let filtered: Transaction[] = [];

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

      const snapshotsData = await getCardSnapshots(latestMonth.id);
      setSnapshots(snapshotsData);
      const cardsDB = await getCards();

      setCards(cardsDB);
      const transactionsDB = await getTransactions(latestMonth.id);
      const weeksDB = await getWeeks(latestMonth.id);

      const transactionsMapped = transactionsDB.map(mapTransaction);
      const mappedWeeks = weeksDB.map(mapWeek);

      const installmentsDB = await getInstallments(latestMonth.id);

      setTransactions(transactionsMapped);

      const result = calculateSummary(
        transactionsMapped,
        mappedWeeks,
        snapshotsData,
        installmentsDB,
      );

      const primary = cardsDB.find((c) => c.is_primary === true) ?? null;
      setPrimaryCardState(primary);
      setCurrentMonthId(latestMonth.id);

      // leituras do cartão principal no mês corrente
      if (primary) {
        const readingsData = await getReadings(latestMonth.id, primary.id);
        setReadings(readingsData);
        setWeeklySpend(weeklySpendFromReadings(readingsData));
      }

      const weeksInMonth = primary?.closing_day != null
        ? getWeeksInCycle(primary.closing_day)
        : getWeeksInMonth(latestMonth.month, latestMonth.year);

      let finalWeeks = calculateWeekly(
        snapshotsData,
        transactionsMapped,
        result.total,
        latestMonth.id,
        weeksInMonth,
      );

      if (!finalWeeks.length) {
        finalWeeks = Array.from({ length: weeksInMonth }).map((_, i) => ({
          id: crypto.randomUUID(),
          monthId: latestMonth.id,
          index: i + 1,
          budget: result.total / weeksInMonth,
          spent: 0,
          remaining: result.total / weeksInMonth,
        }));

        await createWeeks(latestMonth.id, finalWeeks);
      }

      setSummary(result);
      setWeeks(finalWeeks);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddReading = async () => {
    if (!primaryCard || !currentMonthId) return;
    const amount = parseFloat(readingAmount.replace(',', '.'));
    if (isNaN(amount) || amount < 0) return;
    try {
      await addReading({ month_id: currentMonthId, card_id: primaryCard.id, amount });
      setReadingAmount('');
      const updated = await getReadings(currentMonthId, primaryCard.id);
      setReadings(updated);
      setWeeklySpend(weeklySpendFromReadings(updated));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteReading = async (id: string) => {
    if (!primaryCard || !currentMonthId) return;
    try {
      await deleteReading(id);
      const updated = await getReadings(currentMonthId, primaryCard.id);
      setReadings(updated);
      setWeeklySpend(weeklySpendFromReadings(updated));
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

        {cards.map((card) => {
          const snapshot = snapshots.find((s) => s.card_id === card.id);

          return (
            <Card
              key={card.id}
              title={card.name}
              value={formatCurrency(Number(snapshot?.amount ?? 0))}
            />
          );
        })}

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
          {weeks.map((week) => (
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

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="bg-zinc-900 p-5 rounded-xl">
          <h2 className="text-base font-semibold text-white mb-4">
            Orçamento × Gasto por Semana
          </h2>
          <WeeklyBarChart weeks={weeks} formatCurrency={formatCurrency} />
        </div>

        <div className="bg-zinc-900 p-5 rounded-xl">
          <h2 className="text-base font-semibold text-white mb-4">
            Despesas por Categoria
          </h2>
          <CategoryBarChart
            transactions={transactions}
            formatCurrency={formatCurrency}
          />
        </div>
      </div>

      {primaryCard && (
        <div className="mt-6 bg-zinc-900 p-5 rounded-xl">
          <h2 className="text-base font-semibold text-white mb-4">
            Acompanhamento semanal — {primaryCard.name}
          </h2>

          <div className="grid gap-2 mb-4">
            {weeklySpend.length === 0 && (
              <p className="text-zinc-400 text-sm">Nenhuma leitura lançada ainda.</p>
            )}
            {weeklySpend.map(({ weekIndex, spent }) => {
              const diff = summary.weeklyBudget - spent;
              return (
                <div key={weekIndex} className="bg-zinc-800 rounded p-3 flex justify-between items-center">
                  <span className="text-white text-sm">Semana {weekIndex}</span>
                  <span className="text-zinc-400 text-sm">
                    Orçamento: {formatCurrency(summary.weeklyBudget)}
                  </span>
                  <span className="text-white font-bold text-sm">
                    Gasto: {formatCurrency(spent)}
                  </span>
                  <span className={`font-bold text-sm ${diff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {diff >= 0 ? '+' : ''}{formatCurrency(diff)}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex gap-2 items-center mb-4">
            <input
              type="text"
              placeholder="Valor atual da fatura (ex.: 1200,50)"
              value={readingAmount}
              onChange={(e) => setReadingAmount(e.target.value)}
              className="bg-zinc-800 text-white rounded px-3 py-2 text-sm flex-1 outline-none"
            />
            <button
              onClick={handleAddReading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
            >
              Lançar leitura
            </button>
          </div>

          {readings.length > 0 && (
            <div className="grid gap-1">
              <p className="text-zinc-500 text-xs mb-1">Histórico de leituras</p>
              {readings.map((r) => (
                <div key={r.id} className="bg-zinc-800 rounded px-3 py-2 flex justify-between items-center">
                  <span className="text-zinc-400 text-xs">
                    {new Date(r.read_at).toLocaleDateString('pt-BR')}
                  </span>
                  <span className="text-white text-sm font-bold">{formatCurrency(Number(r.amount))}</span>
                  <button
                    onClick={() => handleDeleteReading(r.id)}
                    className="text-red-500 hover:text-red-700 text-xs"
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Modal
        open={!!selectedCard}
        onClose={() => setSelectedCard(null)}
        title="Detalhamento"
      >
        {filteredTransactions.length === 0 && (
          <p className="text-zinc-400">Nenhum registro</p>
        )}

        <div className="grid gap-2">
          {groupedTransactions.map((item) => {
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
