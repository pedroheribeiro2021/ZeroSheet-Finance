'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import Card from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';

import { getMonths, createMonth } from '@/core/services/month.service';
import { getTransactions } from '@/core/services/transaction.service';

import { mapTransaction } from '@/core/models/mappers';
import { calculateSummary } from '@/core/engine/calculations';
import {
  getWeeksInCurrentCycle,
  getWeeksInMonth,
  getWeeksRemainingInCycle,
  weekDateRangeInCycle,
  weeklySpendFromReadings,
  WeeklySpend,
} from '@/core/engine/weekly';
import { normalizeCategory } from '@/core/utils/normalize';
import { getCardSnapshots } from '@/core/services/cardSnapshot.service';
import { groupTransactionsByCategory } from '@/core/utils/groupTransactions';

import { getInstallments } from '@/core/services/installment.service';
import type { ActiveInstallment } from '@/core/services/installment.service';
import { getCards } from '@/core/services/card.service';
import { getReadings, addReading, deleteReading } from '@/core/services/cardReading.service';
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

function installmentMonthLabel(
  m: { month: number; year: number } | null,
): string | null {
  if (!m) return null;
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'short',
    year: 'numeric',
  }).format(new Date(m.year, m.month - 1, 1));
}

function installmentEndLabel(
  start: { month: number; year: number } | null,
  totalInstallments: number,
): string | null {
  if (!start) return null;
  const d = new Date(start.year, start.month - 1 + totalInstallments - 1, 1);
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'short',
    year: 'numeric',
  }).format(d);
}

const MODAL_TITLES: Record<string, string> = {
  income: 'Entradas',
  cards: 'Cartões',
  installments: 'Parcelamentos',
  fixed: 'Custos Fixos',
  subscriptions: 'Assinaturas',
  reserve: 'Reserva / Investimentos',
  balance: 'Saldo do Mês',
  'weekly-budget': 'Orçamento Semanal',
};

export default function Dashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [months, setMonths] = useState<DBMonth[]>([]);
  const [summary, setSummary] = useState<ReturnType<
    typeof calculateSummary
  > | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [filteredTransactions, setFilteredTransactions] = useState<
    Transaction[]
  >([]);
  const groupedTransactions = groupTransactionsByCategory(filteredTransactions);
  const [cards, setCards] = useState<DBCard[]>([]);
  const [snapshots, setSnapshots] = useState<DBCardSnapshot[]>([]);
  const [readings, setReadings] = useState<DBCardReading[]>([]);
  const [weeklySpend, setWeeklySpend] = useState<WeeklySpend[]>([]);
  const [cycleWeeks, setCycleWeeks] = useState(0);
  const [weeksRemaining, setWeeksRemaining] = useState(0);
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
      const transactionsMapped = transactionsDB.map(mapTransaction);

      const installmentsDB = await getInstallments(month.id);
      setInstallments(installmentsDB);

      setTransactions(transactionsMapped);

      const primary = cardsDB.find((c) => c.is_primary === true) ?? null;
      setPrimaryCardState(primary);
      setCurrentMonthId(month.id);

      // Semanas do ciclo da fatura do cartão principal: é o total de linhas
      // exibidas no acompanhamento semanal (ex.: fecha dia 4 → ciclo de ~5 semanas).
      const weeksInCycle =
        primary?.closing_day != null
          ? getWeeksInCurrentCycle(primary.closing_day)
          : getWeeksInMonth(month.month, month.year);
      setCycleWeeks(weeksInCycle);

      // leituras do cartão principal no mês corrente — única fonte do
      // acompanhamento semanal exibido (nunca soma faturas de dois cartões).
      let weeklySpendData: WeeklySpend[] = [];
      if (primary) {
        const readingsData = await getReadings(month.id, primary.id);
        setReadings(readingsData);
        weeklySpendData = weeklySpendFromReadings(
          readingsData,
          primary.closing_day ?? undefined,
        );
        setWeeklySpend(weeklySpendData);
      } else {
        setReadings([]);
        setWeeklySpend([]);
      }

      // Orçamento semanal decrescente: passou uma semana, divide pelas que
      // restam. Com leituras lançadas, usa o maior índice de semana já
      // registrado (mínimo 1 restante); sem leituras, cai no cálculo por data.
      let weeksForBudget = weeksInCycle;
      if (primary?.closing_day != null) {
        if (weeklySpendData.length > 0) {
          const maxWeekIndex = Math.max(
            ...weeklySpendData.map((w) => w.weekIndex),
          );
          weeksForBudget = Math.max(1, weeksInCycle - maxWeekIndex);
        } else {
          weeksForBudget = getWeeksRemainingInCycle(primary.closing_day);
        }
      }
      setWeeksRemaining(weeksForBudget);

      const result = calculateSummary(
        transactionsMapped,
        [],
        snapshotsData,
        installmentsDB,
        'total',
        weeksForBudget,
      );

      setSummary(result);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddReading = async () => {
    if (!primaryCard || !currentMonthId || !activeMonth) return;
    const amount = parseFloat(readingAmount.replace(',', '.'));
    if (isNaN(amount) || amount < 0) return;
    try {
      await addReading({ month_id: currentMonthId, card_id: primaryCard.id, amount });
      setReadingAmount('');
      // recarrega tudo: uma nova leitura muda as semanas restantes e,
      // portanto, o orçamento semanal vigente.
      await loadMonthData(activeMonth);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteReading = async (id: string) => {
    if (!primaryCard || !currentMonthId || !activeMonth) return;
    try {
      await deleteReading(id);
      await loadMonthData(activeMonth);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMonth, pathname, router, searchParams]);

  // recarrega tudo (transações, snapshots, leituras, parcelas, summary) ao trocar de mês
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

  const formatDateShort = (date: Date): string =>
    date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

  const totalInstallments = installments.reduce(
    (acc, i) => acc + Number(i.installment_amount),
    0,
  );

  // Semanas do ciclo, na mesma forma usada pelo gráfico e pela lista —
  // única fonte: leituras da fatura do cartão principal.
  const chartWeeks: Week[] = Array.from({ length: cycleWeeks }, (_, i) => {
    const index = i + 1;
    const entry = weeklySpend.find((w) => w.weekIndex === index);
    const spent = entry?.spent ?? 0;

    return {
      id: `week-${index}`,
      monthId: currentMonthId ?? '',
      index,
      budget: summary.weeklyBudget,
      spent,
      remaining: summary.weeklyBudget - spent,
    };
  });

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
          title="Entradas"
          value={formatCurrency(summary.totalIncome)}
          subtitle="Salário, extras e reembolsos — clique para ver cada lançamento"
          onClick={() => handleCardClick('income')}
          className="border border-green-800"
        />

        <Card
          title="Custos Fixos"
          value={formatCurrency(summary.fixedCosts)}
          onClick={() => handleCardClick('fixed')}
        />

        <Card
          title="Cartões"
          value={formatCurrency(summary.cardSpending)}
          subtitle="Soma das faturas do mês"
          onClick={() => handleCardClick('cards')}
        />

        <Card
          title="Parcelamentos"
          value={formatCurrency(totalInstallments)}
          subtitle="Parcelas ativas no mês"
          onClick={() => handleCardClick('installments')}
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
          title="Saldo do Mês"
          value={formatCurrency(summary.total)}
          subtitle="O que ainda dá pra gastar: entradas − fixos − faturas − parcelas − provisões − reserva"
          onClick={() => handleCardClick('balance')}
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
              ? `Saldo ÷ ${weeksRemaining} semanas restantes do ciclo (${primaryCard.name} fecha dia ${primaryCard.closing_day})`
              : 'Saldo ÷ semanas do mês (defina um cartão principal ★ para usar o ciclo da fatura)'
          }
          onClick={() => handleCardClick('weekly-budget')}
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

      <div className="mt-6 bg-zinc-900 p-5 rounded-xl">
        <h2 className="text-base font-semibold text-white mb-4">
          Acompanhamento Semanal{primaryCard ? ` — ${primaryCard.name}` : ''}
        </h2>

        {!primaryCard && (
          <p className="text-amber-400 text-sm">
            Marque um cartão como principal (★ na tela de Cartões) para
            ativar o acompanhamento semanal — ele é calculado só a partir das
            leituras da fatura do cartão principal.
          </p>
        )}

        {primaryCard && (
          <>
            <div className="grid gap-2 mb-4">
              {chartWeeks.map((week) => {
                const entry = weeklySpend.find(
                  (w) => w.weekIndex === week.index,
                );
                const diff = summary.weeklyBudget - week.spent;

                const { start, end } =
                  primaryCard.closing_day != null
                    ? weekDateRangeInCycle(week.index, primaryCard.closing_day)
                    : { start: null, end: null };

                return (
                  <div
                    key={week.index}
                    className="bg-zinc-800 rounded p-3 flex flex-wrap justify-between items-center gap-2"
                  >
                    <span className="text-white text-sm font-bold">
                      Semana {week.index}
                      {start && end && (
                        <span className="text-zinc-500 font-normal">
                          {' '}
                          ({formatDateShort(start)}–{formatDateShort(end)})
                        </span>
                      )}
                    </span>
                    <span className="text-zinc-400 text-sm">
                      Orçamento: {formatCurrency(summary.weeklyBudget)}
                    </span>
                    {entry?.isBaseline ? (
                      <span className="text-zinc-400 text-sm italic">
                        Leitura inicial (base)
                      </span>
                    ) : entry ? (
                      <>
                        <span className="text-white font-bold text-sm">
                          Gasto: {formatCurrency(week.spent)}
                        </span>
                        <span
                          className={`font-bold text-sm ${diff >= 0 ? 'text-green-400' : 'text-red-400'}`}
                        >
                          {diff >= 0 ? '+' : ''}
                          {formatCurrency(diff)}
                        </span>
                      </>
                    ) : (
                      <span className="text-zinc-500 text-sm italic">
                        sem leitura ainda
                      </span>
                    )}
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
          </>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="bg-zinc-900 p-5 rounded-xl">
          <h2 className="text-base font-semibold text-white mb-4">
            Orçamento × Gasto por Semana
          </h2>
          <WeeklyBarChart weeks={chartWeeks} formatCurrency={formatCurrency} />
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

      <Modal
        open={!!selectedCard}
        onClose={() => setSelectedCard(null)}
        title={selectedCard ? (MODAL_TITLES[selectedCard] ?? 'Detalhamento') : 'Detalhamento'}
      >
        {selectedCard === 'income' && (
          <div className="grid gap-2">
            {filteredTransactions.length === 0 && (
              <p className="text-zinc-400">Nenhum registro</p>
            )}
            {filteredTransactions.map((t) => (
              <div
                key={t.id}
                className="bg-zinc-800 rounded p-3 flex justify-between items-center gap-3"
              >
                <div className="min-w-0">
                  <p className="text-white font-bold truncate">
                    {t.description || t.category}
                  </p>
                  <p className="text-zinc-400 text-sm">{t.category}</p>
                </div>
                <p className="text-green-400 font-bold shrink-0">
                  {formatCurrency(t.amount)}
                </p>
              </div>
            ))}
          </div>
        )}

        {selectedCard === 'cards' && (
          <div className="grid gap-2">
            {cards.length === 0 && (
              <p className="text-zinc-400">Nenhum cartão cadastrado</p>
            )}
            {cards.map((card) => {
              const snapshot = snapshots.find((s) => s.card_id === card.id);
              const fatura = Number(snapshot?.amount ?? 0);

              const parcelas = installments
                .filter((i) => i.card_id === card.id)
                .reduce((acc, i) => acc + Number(i.installment_amount), 0);

              const limite = Number(card.limit_amount ?? 0);
              const disponivel = limite > 0 ? limite - fatura : null;

              return (
                <div key={card.id} className="bg-zinc-800 rounded p-3 grid gap-1">
                  <p className="text-white font-bold">💳 {card.name}</p>
                  <p className="text-zinc-400 text-sm">
                    Fatura atual: {formatCurrency(fatura)}
                  </p>
                  <p className="text-zinc-400 text-sm">
                    Parcelas no mês: {formatCurrency(parcelas)}
                  </p>
                  {limite > 0 && (
                    <p className="text-zinc-400 text-sm">
                      Limite: {formatCurrency(limite)} • Disponível:{' '}
                      {formatCurrency(disponivel ?? 0)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {selectedCard === 'installments' && (
          <div className="grid gap-2">
            {installments.length === 0 && (
              <p className="text-zinc-400">Nenhum parcelamento ativo neste mês</p>
            )}
            {installments.map((i) => {
              const start = installmentMonthLabel(i.startMonth);
              const end = installmentEndLabel(i.startMonth, i.total_installments);

              return (
                <div key={i.id} className="bg-zinc-800 rounded p-3 grid gap-1">
                  <p className="text-white font-bold">{i.description}</p>
                  <p className="text-orange-400 text-sm font-bold">
                    Parcela {i.currentInstallment}/{i.total_installments} —{' '}
                    {formatCurrency(Number(i.installment_amount))}/mês
                  </p>
                  <p className="text-zinc-400 text-sm">
                    {i.cards?.name ? `💳 ${i.cards.name}` : 'Sem cartão'}
                    {start ? ` • Início: ${start}` : ''}
                    {end ? ` • Última parcela: ${end}` : ''}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {selectedCard === 'balance' && (
          <div className="grid gap-2">
            {[
              { label: 'Entradas', value: summary.totalIncome },
              { label: 'Custos Fixos', value: -summary.fixedCosts },
              { label: 'Cartões (faturas)', value: -summary.cardSpending },
              { label: 'Parcelamentos', value: -summary.installmentSpending },
              { label: 'Provisões (envelopes)', value: -summary.envelopeSpending },
              { label: 'Reserva / Investimentos', value: -summary.reserveSpending },
            ].map((row) => (
              <div key={row.label} className="bg-zinc-800 rounded p-3 flex justify-between">
                <span className="text-white">{row.label}</span>
                <span className={row.value < 0 ? 'text-red-400' : 'text-green-400'}>
                  {formatCurrency(row.value)}
                </span>
              </div>
            ))}
            <div className="bg-zinc-800 rounded p-3 flex justify-between border border-zinc-700">
              <span className="text-white font-bold">Saldo do Mês</span>
              <span
                className={`font-bold ${summary.total < 0 ? 'text-red-400' : 'text-green-400'}`}
              >
                {formatCurrency(summary.total)}
              </span>
            </div>
          </div>
        )}

        {selectedCard === 'weekly-budget' && (
          <div className="grid gap-2">
            <div className="bg-zinc-800 rounded p-3 flex justify-between">
              <span className="text-white">Saldo do mês</span>
              <span className="text-white font-bold">{formatCurrency(summary.total)}</span>
            </div>
            <div className="bg-zinc-800 rounded p-3 flex justify-between">
              <span className="text-white">÷ semanas restantes do ciclo</span>
              <span className="text-white font-bold">{weeksRemaining}</span>
            </div>
            <div className="bg-zinc-800 rounded p-3 flex justify-between border border-zinc-700">
              <span className="text-white font-bold">Orçamento semanal</span>
              <span className="text-white font-bold">
                {formatCurrency(summary.weeklyBudget)}
              </span>
            </div>
          </div>
        )}

        {(selectedCard === 'fixed' ||
          selectedCard === 'subscriptions' ||
          selectedCard === 'reserve') && (
          <div className="grid gap-2">
            {filteredTransactions.length === 0 && (
              <p className="text-zinc-400">Nenhum registro</p>
            )}
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
        )}
      </Modal>
    </div>
  );
}
