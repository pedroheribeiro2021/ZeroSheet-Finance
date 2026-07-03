'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import Card from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';

import { getMonths, createMonth } from '@/core/services/month.service';
import { getTransactions } from '@/core/services/transaction.service';
import { createWeeks, getWeeks } from '@/core/services/week.service';

import { mapTransaction, mapWeek } from '@/core/models/mappers';
import { calculateSummary } from '@/core/engine/calculations';
import { calculateWeekly, getWeeksInCurrentCycle, getWeeksInMonth } from '@/core/engine/weekly';
import { normalizeCategory } from '@/core/utils/normalize';
import { getCardSnapshots } from '@/core/services/cardSnapshot.service';
import { groupTransactionsByCategory } from '@/core/utils/groupTransactions';

import { getInstallments } from '@/core/services/installment.service';
import type { ActiveInstallment } from '@/core/services/installment.service';
import { getCards } from '@/core/services/card.service';
import { getReadings, addReading, deleteReading } from '@/core/services/cardReading.service';
import { weeklySpendFromReadings } from '@/core/engine/weekly';
import { sanitizeAmountInput } from '@/core/utils/number';
import { DBCard, DBCardSnapshot, DBCardReading, DBMonth } from '@/core/types/database';
import { Transaction, Week } from '@/core/types/finance';
import WeeklyBarChart from './WeeklyBarChart';
import CategoryBarChart from './CategoryBarChart';

function formatMonthLabel(month: number, year: number): string {
  const raw = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1));

  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function monthKey(m: { month: number; year: number }): string {
  return `${m.year}-${String(m.month).padStart(2, '0')}`;
}

export default function Dashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [months, setMonths] = useState<DBMonth[]>([]);
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
  const [installments, setInstallments] = useState<ActiveInstallment[]>([]);

  const handleCardClick = (type: string) => {
    let filtered: Transaction[] = [];

    switch (type) {
      case 'income':
        filtered = transactions.filter((t) => t.type === 'income');
        break;

      case 'salary':
        filtered = transactions.filter(
          (t) =>
            t.type === 'income' &&
            normalizeCategory(t.category) === 'salario' &&
            !t.isReimbursement,
        );
        break;

      case 'other-income':
        filtered = transactions.filter(
          (t) =>
            t.type === 'income' && normalizeCategory(t.category) !== 'salario',
        );
        break;

      case 'subscriptions':
        filtered = transactions.filter(
          (t) =>
            t.type === 'expense' &&
            normalizeCategory(t.category) === 'assinaturas',
        );
        break;

      case 'fixed':
        filtered = transactions.filter((t) => t.isFixed);
        break;

      case 'provision':
        filtered = transactions.filter((t) => t.isProvision);
        break;

      case 'real':
        filtered = transactions.filter(
          (t) =>
            t.type === 'expense' &&
            !t.isFixed &&
            !t.isProvision &&
            !t.isReserve,
        );
        break;

      case 'reserve':
        filtered = transactions.filter((t) => t.isReserve);
        break;

      default:
        filtered = [];
    }

    setFilteredTransactions(filtered);
    setSelectedCard(type);
  };

  const loadMonthsList = async () => {
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

      setMonths(monthsData);
    } catch (err) {
      console.error(err);
    }
  };

  const loadMonthData = async (month: DBMonth) => {
    try {
      const snapshotsData = await getCardSnapshots(month.id);
      setSnapshots(snapshotsData);
      const cardsDB = await getCards();

      setCards(cardsDB);
      const transactionsDB = await getTransactions(month.id);
      const weeksDB = await getWeeks(month.id);

      const transactionsMapped = transactionsDB.map(mapTransaction);
      const mappedWeeks = weeksDB.map(mapWeek);

      const installmentsDB = await getInstallments(month.id);
      setInstallments(installmentsDB);

      setTransactions(transactionsMapped);

      const primary = cardsDB.find((c) => c.is_primary === true) ?? null;
      setPrimaryCardState(primary);
      setCurrentMonthId(month.id);

      // Semanas do ciclo da fatura do cartão principal: é por esse número
      // que o saldo do mês é dividido (ex.: fecha dia 4 → ciclo de ~5 semanas).
      const weeksInMonth =
        primary?.closing_day != null
          ? getWeeksInCurrentCycle(primary.closing_day)
          : getWeeksInMonth(month.month, month.year);

      const result = calculateSummary(
        transactionsMapped,
        mappedWeeks,
        snapshotsData,
        installmentsDB,
        'total',
        weeksInMonth,
      );

      // leituras do cartão principal no mês corrente
      if (primary) {
        const readingsData = await getReadings(month.id, primary.id);
        setReadings(readingsData);
        setWeeklySpend(weeklySpendFromReadings(readingsData));
      }

      let finalWeeks = calculateWeekly(
        snapshotsData,
        transactionsMapped,
        result.total,
        month.id,
        weeksInMonth,
      );

      if (!finalWeeks.length) {
        finalWeeks = Array.from({ length: weeksInMonth }).map((_, i) => ({
          id: crypto.randomUUID(),
          monthId: month.id,
          index: i + 1,
          budget: result.total / weeksInMonth,
          spent: 0,
          remaining: result.total / weeksInMonth,
        }));

        await createWeeks(month.id, finalWeeks);
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
    loadMonthsList();
  }, []);

  // mês ativo: vem da URL (?month=YYYY-MM); sem parâmetro, usa o mais recente
  const activeMonth = useMemo(() => {
    if (!months.length) return null;

    const param = searchParams.get('month');

    if (param) {
      const found = months.find((m) => monthKey(m) === param);
      if (found) return found;
    }

    return months[months.length - 1];
  }, [months, searchParams]);

  // mantém a URL sincronizada com o mês ativo (ex.: sem ?month, canoniza pro mais recente)
  useEffect(() => {
    if (!activeMonth) return;

    const key = monthKey(activeMonth);
    if (searchParams.get('month') !== key) {
      router.replace(`${pathname}?month=${key}`);
    }
  }, [activeMonth, pathname, router, searchParams]);

  // recarrega tudo (transações, snapshots, leituras, semanas, parcelas, summary) ao trocar de mês
  useEffect(() => {
    if (!activeMonth) return;

    loadMonthData(activeMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMonth?.id]);

  const goToMonth = (month: DBMonth) => {
    router.push(`${pathname}?month=${monthKey(month)}`);
  };

  const activeIndex = activeMonth
    ? months.findIndex((m) => m.id === activeMonth.id)
    : -1;
  const prevMonth = activeIndex > 0 ? months[activeIndex - 1] : null;
  const nextMonth =
    activeIndex >= 0 && activeIndex < months.length - 1
      ? months[activeIndex + 1]
      : null;

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
      {activeMonth && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => prevMonth && goToMonth(prevMonth)}
              disabled={!prevMonth}
              className="rounded bg-zinc-900 px-3 py-2 text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Mês anterior"
            >
              ‹
            </button>

            <h1 className="text-2xl font-bold text-white">
              {formatMonthLabel(activeMonth.month, activeMonth.year)}
            </h1>

            <button
              onClick={() => nextMonth && goToMonth(nextMonth)}
              disabled={!nextMonth}
              className="rounded bg-zinc-900 px-3 py-2 text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Próximo mês"
            >
              ›
            </button>
          </div>

          <select
            value={monthKey(activeMonth)}
            onChange={(e) => {
              const found = months.find((m) => monthKey(m) === e.target.value);
              if (found) goToMonth(found);
            }}
            className="rounded bg-zinc-900 px-3 py-2 text-sm text-white outline-none"
            aria-label="Selecionar mês"
          >
            {months.map((m) => (
              <option key={m.id} value={monthKey(m)}>
                {formatMonthLabel(m.month, m.year)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <Card
          title="Salário"
          value={formatCurrency(summary.salaryIncome)}
          subtitle="Fonte de renda principal"
          onClick={() => handleCardClick('salary')}
          className="border border-green-800"
        />

        <Card
          title="Outras Entradas"
          value={formatCurrency(summary.otherIncome)}
          subtitle={`Total de entradas: ${formatCurrency(summary.totalIncome)}`}
          onClick={() => handleCardClick('other-income')}
        />

        <Card
          title="Custos Fixos"
          value={formatCurrency(summary.fixedCosts)}
          onClick={() => handleCardClick('fixed')}
        />

        {cards.map((card) => {
          const snapshot = snapshots.find((s) => s.card_id === card.id);
          const fatura = Number(snapshot?.amount ?? 0);

          const cardInstallments = installments
            .filter((i) => i.card_id === card.id)
            .reduce((acc, i) => acc + Number(i.installment_amount), 0);

          // O comprometido do mês no cartão: a fatura (que já inclui as
          // parcelas lançadas nela) ou, sem fatura ainda, as parcelas.
          const comprometido = Math.max(fatura, cardInstallments);
          const limite = Number(card.limit_amount ?? 0);
          const disponivel = limite > 0 ? limite - comprometido : null;

          return (
            <Card
              key={card.id}
              title={`💳 ${card.name}`}
              value={formatCurrency(fatura)}
              subtitle={`Parcelas no mês: ${formatCurrency(cardInstallments)}${
                disponivel != null
                  ? ` • Disponível p/ gastar: ${formatCurrency(disponivel)}`
                  : ''
              }`}
            />
          );
        })}

        <Card
          title="Total Cartões"
          value={formatCurrency(summary.cardSpending)}
        />

        <Card
          title="Parcelamentos (fora da fatura)"
          value={formatCurrency(summary.installmentSpending)}
          subtitle="Parcelas de cartões sem fatura lançada no mês — as demais já estão dentro da fatura"
        />

        <Card
          title="Assinaturas"
          value={formatCurrency(
            transactions
              .filter(
                (t) =>
                  t.type === 'expense' &&
                  normalizeCategory(t.category) === 'assinaturas',
              )
              .reduce((acc, t) => acc + Number(t.amount), 0),
          )}
          subtitle="Recorrentes no cartão — compõem a fatura"
          onClick={() => handleCardClick('subscriptions')}
        />

        <Card
          title="Reserva / Investimentos"
          value={formatCurrency(summary.reserveSpending)}
          subtitle="Abate das entradas, mas é patrimônio seu"
          onClick={() => handleCardClick('reserve')}
          className="border border-sky-700"
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

        {/* Card "Diferença" (provisão planejada − gasto real) comentado a
            pedido do usuário em 2026-07-03 — a informação já aparece por
            categoria na seção "Provisões do mês (envelopes)". */}

        <Card
          title="Saldo do Mês"
          value={formatCurrency(summary.total)}
          subtitle="O que ainda dá pra gastar: entradas − fixos − faturas − parcelas − provisões − reserva"
          className={
            summary.total < 0
              ? 'border border-red-700'
              : 'border border-green-800'
          }
        />

        <Card
          title="Orçamento Semanal"
          value={formatCurrency(summary.weeklyBudget)}
          subtitle={
            primaryCard?.closing_day != null
              ? `Saldo ÷ ${weeks.length} semanas do ciclo da fatura (${primaryCard.name} fecha dia ${primaryCard.closing_day})`
              : 'Saldo ÷ semanas do mês (defina um cartão principal ★ para usar o ciclo da fatura)'
          }
        />
      </div>

      {summary.envelopes.length > 0 && (
        <div className="mt-6 bg-zinc-900 p-5 rounded-xl">
          <h2 className="text-base font-semibold text-white mb-1">
            Provisões do mês (envelopes)
          </h2>
          <p className="text-zinc-500 text-xs mb-4">
            Cada gasto real lançado na mesma categoria abate automaticamente da
            provisão — não precisa atualizar o valor na mão.
          </p>

          <div className="grid gap-3">
            {summary.envelopes.map((env) => {
              const pct =
                env.planned > 0
                  ? Math.min(100, (env.used / env.planned) * 100)
                  : 0;
              const over = env.remaining < 0;

              return (
                <div key={env.category} className="grid gap-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-white font-medium">
                      {env.category}
                    </span>
                    <span className={over ? 'text-red-400' : 'text-zinc-400'}>
                      {formatCurrency(env.used)} de{' '}
                      {formatCurrency(env.planned)}
                      {' — '}
                      {over
                        ? `estourou ${formatCurrency(Math.abs(env.remaining))}`
                        : `resta ${formatCurrency(env.remaining)}`}
                    </span>
                  </div>
                  <div className="h-2 rounded bg-zinc-800 overflow-hidden">
                    <div
                      className={`h-full rounded ${
                        over
                          ? 'bg-red-500'
                          : pct > 80
                            ? 'bg-amber-500'
                            : 'bg-green-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
              onChange={(e) =>
                setReadingAmount(sanitizeAmountInput(e.target.value))
              }
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
