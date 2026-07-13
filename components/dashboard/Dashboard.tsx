'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import Card from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import PageLoading from '@/components/ui/PageLoading';

import { getMonths, createMonth } from '@/core/services/month.service';
import { getTransactions } from '@/core/services/transaction.service';

import { mapTransaction } from '@/core/models/mappers';
import { calculateSummary } from '@/core/engine/calculations';
import {
  getCycleRange,
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
import { getReadings, deleteReading } from '@/core/services/cardReading.service';
import { DBCard, DBCardSnapshot, DBCardReading, DBMonth } from '@/core/types/database';
import { Transaction, Week } from '@/core/types/finance';
import { getDueItems } from '@/core/engine/dueDates';
import WeeklyBarChart from './WeeklyBarChart';
import CategoryBarChart from './CategoryBarChart';
import DueDatesPanel from './DueDatesPanel';

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
  const [cycleRange, setCycleRange] = useState<{ start: Date; end: Date } | null>(null);
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

      // Intervalo real do ciclo vigente (não os blocos de 7 dias, que podem
      // ultrapassar o fechamento real) — exibido no card de Orçamento
      // Semanal pra deixar claro qual ciclo está sendo usado no cálculo.
      setCycleRange(
        primary?.closing_day != null ? getCycleRange(primary.closing_day) : null,
      );

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
    return <PageLoading />;
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

  const now = new Date();
  const isCurrentMonth =
    !!activeMonth &&
    activeMonth.month === now.getMonth() + 1 &&
    activeMonth.year === now.getFullYear();

  const dueTodayItems = isCurrentMonth
    ? getDueItems(transactions, now).filter((i) => i.status === 'today')
    : [];

  return (
    <div className="grid gap-4 p-4 sm:gap-5 sm:p-6">
      {activeMonth && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => prevMonth && goToMonth(prevMonth)}
              disabled={!prevMonth}
              className="btn-icon h-10 w-10"
              aria-label="Mês anterior"
            >
              ‹
            </button>

            <h1 className="text-xl font-bold text-white sm:text-2xl">
              {formatMonthLabel(activeMonth.month, activeMonth.year)}
            </h1>

            <button
              onClick={() => nextMonth && goToMonth(nextMonth)}
              disabled={!nextMonth}
              className="btn-icon h-10 w-10"
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
            className="field w-auto min-h-[44px] !py-2"
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

      {dueTodayItems.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-400">
          🔔 Vence hoje:{' '}
          {dueTodayItems
            .map(
              (i) =>
                `${i.transaction.description || i.transaction.category} (${formatCurrency(i.transaction.amount)})`,
            )
            .join(', ')}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <Card
          title="Entradas"
          value={formatCurrency(summary.totalIncome)}
          subtitle="Salário, extras e reembolsos — clique para ver cada lançamento"
          onClick={() => handleCardClick('income')}
          className="border-l-2 border-l-green-500 max-sm:col-span-2"
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
          className="border-l-2 border-l-sky-500"
        />

        <Card
          title="Saldo do Mês"
          value={formatCurrency(summary.total)}
          subtitle="O que ainda dá pra gastar: entradas − fixos − faturas − parcelas − provisões − reserva"
          onClick={() => handleCardClick('balance')}
          className={`max-sm:col-span-2 ${
            summary.total < 0
              ? 'border-l-2 border-l-red-500'
              : 'border-l-2 border-l-green-500'
          }`}
        />

        <Card
          title="Orçamento Semanal"
          value={formatCurrency(summary.weeklyBudget)}
          subtitle={
            primaryCard?.closing_day != null && cycleRange
              ? `Ciclo vigente: ${formatDateShort(cycleRange.start)}–${formatDateShort(cycleRange.end)} · Saldo ÷ ${weeksRemaining} semanas restantes (${primaryCard.name} fecha dia ${primaryCard.closing_day})`
              : 'Saldo ÷ semanas do mês (defina um cartão principal ★ para usar o ciclo da fatura)'
          }
          onClick={() => handleCardClick('weekly-budget')}
          className="max-sm:col-span-2"
        />
      </div>

      <div className="surface p-4 sm:p-5">
        <h2 className="text-base font-semibold text-white mb-4">
          Acompanhamento Semanal{primaryCard ? ` — ${primaryCard.name}` : ''}
        </h2>

        {!primaryCard && (
          <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-400">
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
                    className="surface-row flex flex-col gap-2 p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
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

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="text-zinc-400 text-sm">
                        Orçamento: {formatCurrency(summary.weeklyBudget)}
                      </span>
                      {entry ? (
                        <>
                          {entry.isBaseline && (
                            <span className="badge bg-zinc-700/50 text-zinc-300">
                              Leitura inicial (base)
                            </span>
                          )}
                          {(!entry.isBaseline || week.spent > 0) && (
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
                          )}
                        </>
                      ) : (
                        <span className="text-zinc-500 text-sm italic">
                          sem leitura ainda
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {readings.length > 0 && (
              <div className="grid gap-1.5">
                <p className="text-zinc-500 text-xs mb-1">Histórico de leituras</p>
                {readings.map((r) => (
                  <div key={r.id} className="surface-row flex justify-between items-center px-3 py-2 gap-2">
                    <span className="text-zinc-400 text-xs shrink-0">
                      {new Date(r.read_at).toLocaleDateString('pt-BR')}
                    </span>
                    <span className="text-white text-sm font-bold flex-1 text-right sm:text-left">{formatCurrency(Number(r.amount))}</span>
                    <button
                      onClick={() => handleDeleteReading(r.id)}
                      className="btn-ghost text-red-400 hover:text-red-300 shrink-0"
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

      {summary.envelopes.length > 0 && (
        <div className="surface p-4 sm:p-5">
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
                  <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
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

      {isCurrentMonth && activeMonth && (
        <DueDatesPanel
          transactions={transactions}
          month={activeMonth.month}
          year={activeMonth.year}
          onChanged={() => loadMonthData(activeMonth)}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-2 sm:gap-5">
        <div className="surface p-4 sm:p-5">
          <h2 className="text-base font-semibold text-white mb-4">
            Orçamento × Gasto por Semana
          </h2>
          <WeeklyBarChart weeks={chartWeeks} formatCurrency={formatCurrency} />
        </div>

        <div className="surface p-4 sm:p-5">
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
                className="surface-row p-3 flex justify-between items-center gap-3"
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
                <div key={card.id} className="surface-row p-3 grid gap-1">
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
                <div key={i.id} className="surface-row p-3 grid gap-1">
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
              <div key={row.label} className="surface-row p-3 flex justify-between">
                <span className="text-white">{row.label}</span>
                <span className={row.value < 0 ? 'text-red-400' : 'text-green-400'}>
                  {formatCurrency(row.value)}
                </span>
              </div>
            ))}
            <div className="surface-row p-3 flex justify-between border-white/10">
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
            {cycleRange && (
              <div className="surface-row p-3 flex justify-between">
                <span className="text-white">Ciclo vigente</span>
                <span className="text-white font-bold">
                  {formatDateShort(cycleRange.start)}–{formatDateShort(cycleRange.end)}
                </span>
              </div>
            )}
            <div className="surface-row p-3 flex justify-between">
              <span className="text-white">Saldo do mês</span>
              <span className="text-white font-bold">{formatCurrency(summary.total)}</span>
            </div>
            <div className="surface-row p-3 flex justify-between">
              <span className="text-white">÷ semanas restantes do ciclo</span>
              <span className="text-white font-bold">{weeksRemaining}</span>
            </div>
            <div className="surface-row p-3 flex justify-between border-white/10">
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
                <div key={item.category} className="surface-row p-3">
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
