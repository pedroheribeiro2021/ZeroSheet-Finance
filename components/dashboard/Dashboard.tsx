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
  adjustWeeklySpendForKnownCharges,
  getCycleRange,
  getWeeksInCurrentCycle,
  getWeeksInMonth,
  getWeeksRemainingInCycle,
  knownChargesByWeek,
  KnownCharge,
  weekDateRangeInCycle,
  weeklySpendFromReadings,
  WeeklySpend,
} from '@/core/engine/weekly';
import { normalizeCategory } from '@/core/utils/normalize';
import {
  getCardSnapshots,
  getOpenCardSnapshots,
} from '@/core/services/cardSnapshot.service';
import {
  carriedOverInvoices,
  nextMonthToOpen,
  CarriedInvoice,
} from '@/core/engine/month';
import { groupTransactionsByCategory } from '@/core/utils/groupTransactions';

import { getInstallments } from '@/core/services/installment.service';
import type { ActiveInstallment } from '@/core/services/installment.service';
import { getCards } from '@/core/services/card.service';
import {
  getReadings,
  getReadingsInRange,
  getAllReadings,
  deleteReading,
} from '@/core/services/cardReading.service';
import { getAccounts, getAccountReadings } from '@/core/services/account.service';
import { getTransfers } from '@/core/services/transfer.service';
import {
  DBCard,
  DBCardSnapshot,
  DBCardReading,
  DBMonth,
  DBAccount,
  DBAccountReading,
} from '@/core/types/database';
import { Transaction, Week } from '@/core/types/finance';
import { getDueItems } from '@/core/engine/dueDates';
import {
  latestReadingByAccount,
  openBillsFromTransactions,
  pendingReturns,
  projectBalance,
  PendingReturn,
  ProjectionLine,
} from '@/core/engine/accounts';
import {
  calculateCoverage,
  coverageBillsFromTransactions,
  coverageInvoices,
  resolvePaydayDay,
  suggestCoverageSource,
  Coverage,
} from '@/core/engine/coverage';
import { mapAccount, mapAccountReading, mapTransfer } from '@/core/models/mappers';
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
  accounts: 'Contas',
  coverage: 'Cobertura até o salário',
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
  const [monthReadings, setMonthReadings] = useState<DBCardReading[]>([]);
  const [weeklySpend, setWeeklySpend] = useState<WeeklySpend[]>([]);
  const [weeklyKnownCharges, setWeeklyKnownCharges] = useState<
    Map<number, number>
  >(new Map());
  const [cycleWeeks, setCycleWeeks] = useState(0);
  const [weeksRemaining, setWeeksRemaining] = useState(0);
  const [cycleRange, setCycleRange] = useState<{ start: Date; end: Date } | null>(null);
  const [currentMonthId, setCurrentMonthId] = useState<string | null>(null);
  const [primaryCard, setPrimaryCardState] = useState<DBCard | null>(null);
  const [readingsOpen, setReadingsOpen] = useState(false);
  const [installments, setInstallments] = useState<ActiveInstallment[]>([]);
  const [accounts, setAccounts] = useState<DBAccount[]>([]);
  const [accountReadings, setAccountReadings] = useState<DBAccountReading[]>([]);
  const [openComplements, setOpenComplements] = useState<PendingReturn[]>([]);
  const [defaultAccountProjection, setDefaultAccountProjection] = useState<{
    lines: ProjectionLine[];
    projected: number;
  } | null>(null);
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [carriedInvoices, setCarriedInvoices] = useState<CarriedInvoice[]>([]);
  const [openingMonth, setOpeningMonth] = useState(false);

  const handleCardClick = (type: string) => {
    let filtered: Transaction[] = [];

    // Pausados neste mês não compõem nenhum card — ficam só na lista de
    // Transações, com o badge de pausado.
    const active = transactions.filter((t) => !t.skipped);

    switch (type) {
      case 'income':
        filtered = active.filter((t) => t.type === 'income');
        break;

      case 'subscriptions':
        filtered = active.filter(
          (t) =>
            t.type === 'expense' &&
            normalizeCategory(t.category) === 'assinaturas',
        );
        break;

      case 'fixed':
        filtered = active.filter((t) => t.isFixed);
        break;

      case 'reserve':
        filtered = active.filter((t) => t.isReserve);
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
      return monthsData;
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  /**
   * Abre a competência seguinte à mais recente. Explícito de propósito: é o
   * clique que fecha o mês corrente e dispara a cópia das recorrentes. Se
   * houver mais de um mês em atraso, abre um por vez — a cadeia de
   * recorrências precisa passar por cada competência.
   */
  const handleOpenNextMonth = async () => {
    const target = nextMonthToOpen(months);
    if (!target || openingMonth) return;

    setOpeningMonth(true);

    try {
      const created = await createMonth(target.month, target.year);
      await loadMonthsList();
      router.push(`${pathname}?month=${monthKey(created)}`);
    } catch (err) {
      console.error(err);
    } finally {
      setOpeningMonth(false);
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

      // Contas & Complementos: saldo projetado da conta de pagamento default
      // (leitura − contas a pagar em aberto − faturas em aberto − devoluções
      // pendentes). Transferências nunca entram em calculateSummary — só
      // afetam esta visão.
      const [accountsData, accountReadingsData, transfersData, openSnapshots] =
        await Promise.all([
          getAccounts(),
          getAccountReadings(),
          getTransfers(),
          getOpenCardSnapshots(),
        ]);

      // Faturas de meses anteriores que continuam em aberto. Não viram
      // transação neste mês (dupla contagem em calculateSummary) — entram só
      // aqui e na projeção de saldo, que é onde a obrigação de caixa pesa.
      const carried = carriedOverInvoices({
        months,
        snapshots: openSnapshots,
        cards: cardsDB,
        current: { month: month.month, year: month.year },
      });
      setCarriedInvoices(carried);

      setAccounts(accountsData);
      setAccountReadings(accountReadingsData);

      const accountReadingsMapped = accountReadingsData.map(mapAccountReading);
      const transfersMapped = transfersData.map(mapTransfer);
      const pending = pendingReturns(transfersMapped);
      setOpenComplements(pending);

      const latestByAccount = latestReadingByAccount(accountReadingsMapped);

      const defaultAccount = accountsData.find((a) => a.is_payment_default) ?? null;
      if (defaultAccount) {
        const latest = latestByAccount.get(defaultAccount.id) ?? null;
        const nameById = new Map(accountsData.map((a) => [a.id, a.name]));

        const returnsForDefault = pending
          .filter((p) => p.holdingAccountId === defaultAccount.id)
          .map((p) => ({
            label: `Devolver p/ ${nameById.get(p.toAccountId) ?? '?'}`,
            amount: p.amount,
          }));

        // A fatura da PRÓPRIA competência exibida ainda não é uma obrigação
        // de pagamento: ela só "vence" de fato quando o mês vira e ela some
        // pra trás sem ser paga — aí sim vira `carried`. Contar o snapshot
        // do mês corrente aqui faria a projeção cobrar a mesma fatura duas
        // vezes: uma como "fatura deste mês", outra como carried assim que
        // o próximo mês for aberto.
        setDefaultAccountProjection(
          projectBalance({
            reading: latest ? { label: defaultAccount.name, amount: latest.amount } : null,
            openBills: openBillsFromTransactions(transactionsMapped),
            openInvoices: carried.map((c) => ({
              label: `Fatura ${c.cardName} (${formatMonthLabel(c.competence.month, c.competence.year)})`,
              amount: c.amount,
            })),
            pendingReturns: returnsForDefault,
          }),
        );
      } else {
        setDefaultAccountProjection(null);
      }

      // Cobertura até o salário: o gap entre hoje e o dia em que a entrada
      // cai. Só faz sentido no mês corrente — em mês passado/futuro o "hoje"
      // não pertence à competência exibida.
      const now = new Date();
      const isCurrentMonth =
        month.month === now.getMonth() + 1 && month.year === now.getFullYear();

      if (isCurrentMonth) {
        const paymentReading = defaultAccount
          ? (latestByAccount.get(defaultAccount.id)?.amount ?? null)
          : null;

        // Leituras de todos os cartões: a fatura que vence depois da virada
        // do mês ainda não tem snapshot, e é a leitura do ciclo que dá o valor.
        const allCardReadings = await getAllReadings(month.id);

        setCoverage(
          calculateCoverage({
            today: now,
            paydayDay: resolvePaydayDay(transactionsMapped),
            balance: paymentReading,
            bills: coverageBillsFromTransactions(transactionsMapped),
            invoices: coverageInvoices(cardsDB, snapshotsData, allCardReadings, now),
            borrowed: pending
              .filter((p) => !defaultAccount || p.holdingAccountId === defaultAccount.id)
              .reduce((acc, p) => acc + p.amount, 0),
            source: suggestCoverageSource(
              accountsData.map(mapAccount),
              latestByAccount,
            ),
          }),
        );
      } else {
        setCoverage(null);
      }

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
      const cycleRangeForPrimary =
        primary?.closing_day != null ? getCycleRange(primary.closing_day) : null;
      setCycleRange(cycleRangeForPrimary);

      // leituras do cartão principal DENTRO DO CICLO da fatura — não da
      // competência exibida. O ciclo quase sempre atravessa a virada do mês
      // (fecha dia 4 → 04/07–03/08), então leituras de julho continuam
      // valendo pro acompanhamento semanal mostrado em agosto; filtrar só
      // por month_id (getReadings) as esconderia assim que o mês virasse.
      let weeklySpendData: WeeklySpend[] = [];
      if (primary) {
        const readingsData = cycleRangeForPrimary
          ? await getReadingsInRange(
              primary.id,
              cycleRangeForPrimary.start,
              cycleRangeForPrimary.end,
            )
          : await getReadings(month.id, primary.id);

        // Histórico exibido na UI: só as leituras DESTA competência — o
        // usuário espera ver aqui só o que lançou no mês que está vendo, não
        // o ciclo inteiro da fatura (que usa `readingsData`, acima, só para o
        // cálculo de gasto semana a semana).
        setMonthReadings(await getReadings(month.id, primary.id));

        weeklySpendData = weeklySpendFromReadings(
          readingsData,
          primary.closing_day ?? undefined,
        );

        // Assinaturas e parcelas com dia de lançamento conhecido, lançadas no
        // cartão principal: já são compromisso fixo (descontado do saldo do
        // mês em calculateSummary) — não devem contar de novo como "gasto
        // livre" só porque a fatura subiu naquela semana.
        let knownCharges = new Map<number, number>();
        if (primary.closing_day != null) {
          const subscriptionCharges: KnownCharge[] = transactionsMapped
            .filter(
              (t) =>
                !t.skipped &&
                t.type === 'expense' &&
                t.card === primary.id &&
                (t.isFixed || t.isRecurring),
            )
            .map((t) => ({ amount: t.amount, day: t.dueDay }));

          const installmentCharges: KnownCharge[] = installmentsDB
            .filter((i) => i.card_id === primary.id)
            .map((i) => ({
              amount: Number(i.installment_amount),
              day: i.billing_day,
            }));

          // Só desconta cobrança cujo dia já chegou pela leitura mais
          // recente da fatura — sem isso, uma assinatura/parcela que só cai
          // dali a alguns dias já zera gasto que já aconteceu de verdade
          // (a leitura mais recente ainda nem inclui essa cobrança futura).
          const latestReadingDate = readingsData.length
            ? new Date(
                Math.max(...readingsData.map((r) => new Date(r.read_at).getTime())),
              )
            : undefined;

          // E só desconta cobrança que caiu DEPOIS da leitura inicial (base):
          // o que já estava dentro da base nunca aparece nos deltas, então
          // descontar de novo apagaria gasto livre real da semana.
          const baselineReadingDate = readingsData.length
            ? new Date(
                Math.min(...readingsData.map((r) => new Date(r.read_at).getTime())),
              )
            : undefined;

          knownCharges = knownChargesByWeek(
            [...subscriptionCharges, ...installmentCharges],
            month.year,
            month.month,
            primary.closing_day,
            latestReadingDate,
            baselineReadingDate,
          );

          weeklySpendData = adjustWeeklySpendForKnownCharges(
            weeklySpendData,
            knownCharges,
          );
        }
        setWeeklyKnownCharges(knownCharges);
        setWeeklySpend(weeklySpendData);
      } else {
        setMonthReadings([]);
        setWeeklySpend([]);
        setWeeklyKnownCharges(new Map());
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

  // carrega a lista de meses uma vez, ao montar — sem sistema externo pra
  // sincronizar, é o fetch inicial da tela.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadMonthsList();
  }, []);

  // mês ativo: vem da URL (?month=YYYY-MM); sem parâmetro, usa o mais recente
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
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

  // recarrega tudo (transações, snapshots, leituras, parcelas, summary) ao trocar de mês
  useEffect(() => {
    if (!activeMonth) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadMonthData(activeMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMonth?.id]);

  const goToMonth = (month: DBMonth) => {
    router.push(`${pathname}?month=${monthKey(month)}`);
  };

  // competência seguinte à mais recente cadastrada — alvo do botão de virada
  const monthToOpen = useMemo(() => nextMonthToOpen(months), [months]);

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

  // Composição do card de Assinaturas — mesmos lançamentos do modal.
  const subscriptionTransactions = transactions.filter(
    (t) =>
      !t.skipped &&
      t.type === 'expense' &&
      normalizeCategory(t.category) === 'assinaturas',
  );
  const subscriptionTotal = subscriptionTransactions.reduce(
    (acc, t) => acc + Number(t.amount),
    0,
  );
  const subscriptionNames = subscriptionTransactions
    .map((t) => t.description || t.category)
    .slice(0, 3)
    .join(', ');
  const subscriptionExtra = subscriptionTransactions.length - 3;

  // Card "Contas": composição resumida das últimas leituras + pendências,
  // truncada para caber no subtítulo do card.
  const defaultAccount = accounts.find((a) => a.is_payment_default) ?? null;
  const latestAccountReadings = latestReadingByAccount(
    accountReadings.map(mapAccountReading),
  );
  const accountSummaryParts = accounts
    .map((a) => {
      const latest = latestAccountReadings.get(a.id);
      return latest ? `${a.name} ${formatCurrency(latest.amount)}` : null;
    })
    .filter((s): s is string => !!s);
  const totalPendingReturns = openComplements.reduce((acc, p) => acc + p.amount, 0);
  const accountsSubtitle =
    accountSummaryParts.length === 0
      ? 'Cadastre uma conta e lance a leitura de saldo'
      : [
          ...accountSummaryParts.slice(0, 2),
          totalPendingReturns > 0 ? `devolver ${formatCurrency(totalPendingReturns)}` : null,
        ]
          .filter((s): s is string => !!s)
          .join(' · ');

  // Card "Cobertura até o salário": quanto falta pra atravessar o gap entre
  // hoje e o dia em que a entrada cai (as faturas vencem antes).
  const coverageSourceName = coverage?.source?.accountName;
  const coverageValue = !coverage
    ? '—'
    : !coverage.hasPayday
      ? '—'
      : coverage.shortfall > 0
        ? formatCurrency(coverage.shortfall)
        : 'Coberto';

  const coverageSubtitle = !coverage
    ? 'Só calculado no mês corrente'
    : !coverage.hasPayday
      ? 'Marque o dia do recebimento na sua entrada recorrente para calcular'
      : coverage.items.length === 0
        ? `Nada vence antes de ${coverage.payday ? formatDateShort(coverage.payday) : ''}`
        : coverage.shortfall > 0
          ? `${coverage.items.length} conta(s) de ${formatCurrency(coverage.dueBeforePayday)}${coverage.hasPartial ? '+' : ''} até ${coverage.payday ? formatDateShort(coverage.payday) : ''} · saldo ${formatCurrency(coverage.balance)}${coverageSourceName ? ` · tirar de ${coverageSourceName}` : ''}`
          : `${formatCurrency(coverage.dueBeforePayday)}${coverage.hasPartial ? '+' : ''} até ${coverage.payday ? formatDateShort(coverage.payday) : ''} · sobra ${formatCurrency(coverage.leftover)}`;

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

            {/* Virada de mês: o mês seguinte só nasce por clique explícito —
                é ele que dispara a cópia das recorrentes. */}
            {!nextMonth && monthToOpen && (
              <button
                onClick={handleOpenNextMonth}
                disabled={openingMonth}
                className="btn-secondary min-h-[44px] whitespace-nowrap px-3 text-sm"
              >
                {openingMonth
                  ? 'Abrindo…'
                  : `+ Abrir ${formatMonthLabel(monthToOpen.month, monthToOpen.year)}`}
              </button>
            )}
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

      {/* Faturas que ficaram para trás: aparecem no mês novo para não sumirem
          junto com a competência, mas não entram em calculateSummary — só na
          projeção de saldo da conta de pagamento. */}
      {carriedInvoices.length > 0 && (
        <div className="rounded-xl border border-orange-500/20 bg-orange-500/10 p-3 text-sm text-orange-300">
          <p className="font-semibold">Faturas de meses anteriores em aberto</p>
          <ul className="mt-1 grid gap-0.5">
            {carriedInvoices.map((invoice) => (
              <li key={invoice.snapshotId} className="flex justify-between gap-3">
                <span>
                  {invoice.cardName} ·{' '}
                  {formatMonthLabel(
                    invoice.competence.month,
                    invoice.competence.year,
                  )}
                </span>
                <span className="font-semibold">
                  {formatCurrency(invoice.amount)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-xs text-orange-300/70">
            Já descontadas da projeção de saldo. Marque como paga na competência
            de origem para sair daqui.
          </p>
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
          subtitle={
            summary.installmentsInCardBills > 0
              ? `Parcelas ativas no mês — ${formatCurrency(summary.installmentsInCardBills)} já dentro das faturas`
              : 'Parcelas ativas no mês'
          }
          onClick={() => handleCardClick('installments')}
        />

        <Card
          title="Assinaturas"
          value={formatCurrency(subscriptionTotal)}
          subtitle={
            subscriptionTransactions.length > 0
              ? `${subscriptionNames}${subscriptionExtra > 0 ? ` +${subscriptionExtra}` : ''} — compõem a fatura`
              : 'Nenhuma assinatura lançada neste mês'
          }
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

        <Card
          title="Contas"
          value={
            defaultAccount && defaultAccountProjection
              ? formatCurrency(defaultAccountProjection.projected)
              : 'Sem conta de pagamento'
          }
          subtitle={accountsSubtitle}
          onClick={() => setSelectedCard('accounts')}
          className="max-sm:col-span-2"
        />

        <Card
          title="Cobertura até o salário"
          value={coverageValue}
          subtitle={coverageSubtitle}
          onClick={() => setSelectedCard('coverage')}
          className={`max-sm:col-span-2 ${
            coverage?.hasPayday && coverage.shortfall > 0
              ? 'border-l-2 border-l-amber-500'
              : 'border-l-2 border-l-green-500'
          }`}
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
                          {(weeklyKnownCharges.get(week.index) ?? 0) > 0 && (
                            <span className="text-zinc-500 text-xs italic">
                              (não conta{' '}
                              {formatCurrency(
                                weeklyKnownCharges.get(week.index) ?? 0,
                              )}{' '}
                              de assinaturas/parcelas lançadas na fatura)
                            </span>
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

            {monthReadings.length > 0 && (
              <div className="grid gap-1.5">
                <button
                  type="button"
                  onClick={() => setReadingsOpen((v) => !v)}
                  className="flex items-center justify-between gap-2 rounded-lg px-1 py-1 text-left transition hover:bg-white/5"
                >
                  <span className="text-zinc-400 text-xs">
                    Leituras deste mês ({monthReadings.length}) · última:{' '}
                    {formatCurrency(
                      Number(monthReadings[monthReadings.length - 1].amount),
                    )}
                  </span>
                  <span
                    className={`text-zinc-500 text-xs shrink-0 transition-transform ${readingsOpen ? 'rotate-180' : ''}`}
                  >
                    ▾
                  </span>
                </button>

                {readingsOpen &&
                  monthReadings.map((r) => (
                    <div
                      key={r.id}
                      className="surface-row flex flex-col gap-1.5 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="text-zinc-400 text-xs shrink-0">
                        {new Date(r.read_at).toLocaleDateString('pt-BR')}
                      </span>
                      <div className="flex items-center justify-between gap-2 sm:justify-end">
                        <span className="text-white text-sm font-bold">
                          {formatCurrency(Number(r.amount))}
                        </span>
                        <button
                          onClick={() => handleDeleteReading(r.id)}
                          className="btn-ghost text-red-400 hover:text-red-300 shrink-0"
                        >
                          Remover
                        </button>
                      </div>
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
          installments={installments}
          cards={cards}
          snapshots={snapshots}
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
              {
                label: 'Parcelamentos (fora das faturas)',
                value: -summary.installmentSpending,
                note:
                  summary.installmentsInCardBills > 0
                    ? `${formatCurrency(summary.installmentsInCardBills)} em parcelas já estão dentro das faturas acima — não abatem duas vezes`
                    : undefined,
              },
              { label: 'Provisões (envelopes)', value: -summary.envelopeSpending },
              { label: 'Reserva / Investimentos', value: -summary.reserveSpending },
            ].map((row) => (
              <div key={row.label} className="surface-row p-3 grid gap-1">
                <div className="flex justify-between">
                  <span className="text-white">{row.label}</span>
                  <span className={row.value < 0 ? 'text-red-400' : 'text-green-400'}>
                    {formatCurrency(row.value)}
                  </span>
                </div>
                {'note' in row && row.note && (
                  <p className="text-zinc-500 text-xs">{row.note}</p>
                )}
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

        {selectedCard === 'accounts' && (
          <div className="grid gap-4">
            <div className="grid gap-2">
              {accounts.length === 0 && (
                <p className="text-zinc-400">Nenhuma conta cadastrada</p>
              )}
              {accounts.map((account) => {
                const latest = latestAccountReadings.get(account.id);
                return (
                  <div
                    key={account.id}
                    className="surface-row p-3 flex items-center justify-between gap-3"
                  >
                    <p className="text-white font-medium flex items-center gap-1.5">
                      {account.name}
                      {account.is_payment_default && (
                        <span className="badge bg-yellow-500/15 text-yellow-400">
                          ★ Pagamento
                        </span>
                      )}
                    </p>
                    <p className="text-zinc-400 text-sm">
                      {latest
                        ? `${formatCurrency(latest.amount)} · lida em ${new Date(latest.readAt).toLocaleDateString('pt-BR')}`
                        : 'Sem leitura'}
                    </p>
                  </div>
                );
              })}
            </div>

            {defaultAccount && defaultAccountProjection && (
              <div className="grid gap-1">
                <h3 className="text-white font-bold text-sm mb-1">
                  Projeção — {defaultAccount.name}
                </h3>
                {defaultAccountProjection.lines.map((line, i) => (
                  <div key={i} className="surface-row p-3 flex justify-between">
                    <span className="text-white">{line.label}</span>
                    <span className={line.amount < 0 ? 'text-red-400' : 'text-green-400'}>
                      {formatCurrency(line.amount)}
                    </span>
                  </div>
                ))}
                <div className="surface-row p-3 flex justify-between border-white/10">
                  <span className="text-white font-bold">Sobra projetada</span>
                  <span
                    className={`font-bold ${defaultAccountProjection.projected < 0 ? 'text-red-400' : 'text-green-400'}`}
                  >
                    {formatCurrency(defaultAccountProjection.projected)}
                  </span>
                </div>
              </div>
            )}

            {openComplements.length > 0 && (
              <div className="grid gap-1">
                <h3 className="text-white font-bold text-sm mb-1">Complementos em aberto</h3>
                {openComplements.map((p) => (
                  <div
                    key={p.complementId}
                    className="surface-row p-3 flex justify-between"
                  >
                    <span className="text-white">
                      Devolver p/{' '}
                      {accounts.find((a) => a.id === p.toAccountId)?.name ?? '?'}
                    </span>
                    <span className="text-amber-400 font-bold">
                      {formatCurrency(p.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedCard === 'coverage' && (
          <div className="grid gap-4">
            {!coverage && (
              <p className="text-zinc-400">
                A cobertura só é calculada no mês corrente — troque a competência
                para o mês atual.
              </p>
            )}

            {coverage && !coverage.hasPayday && (
              <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-400">
                Nenhuma entrada com dia de recebimento cadastrado. Edite seu
                salário em Transações e preencha o dia — é ele que define até
                quando a cobertura precisa durar.
              </p>
            )}

            {coverage?.hasPayday && (
              <>
                <div className="surface-row p-3">
                  <p className="text-white font-bold">
                    {coverage.shortfall > 0
                      ? `Faltam ${formatCurrency(coverage.shortfall)} para chegar no salário`
                      : 'O saldo cobre tudo até o salário'}
                  </p>
                  <p className="text-zinc-400 text-sm mt-1">
                    Salário em{' '}
                    {coverage.payday ? formatDateShort(coverage.payday) : ''}
                    {coverage.daysUntilPayday > 0
                      ? ` (${coverage.daysUntilPayday} dia(s))`
                      : ' (hoje)'}
                    {coverage.source
                      ? ` · sugestão: tirar de ${coverage.source.accountName} (${formatCurrency(coverage.source.available)} disponível)`
                      : ''}
                  </p>
                  {coverage.source?.insufficient && (
                    <p className="text-amber-400 text-sm mt-1">
                      ⚠️ {coverage.source.accountName} não cobre esse valor sozinho.
                    </p>
                  )}
                </div>

                <div className="grid gap-1">
                  <h3 className="text-white font-bold text-sm mb-1">
                    Vence antes do salário
                  </h3>

                  {coverage.items.length === 0 && (
                    <p className="text-zinc-400">
                      Nada em aberto vence antes do salário.
                    </p>
                  )}

                  {coverage.items.map((item) => (
                    <div
                      key={item.id}
                      className="surface-row p-3 flex justify-between items-center gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-white font-medium truncate">
                          {item.label}
                        </p>
                        <p className="text-zinc-400 text-sm">
                          {item.kind === 'invoice' ? '💳 fatura' : 'conta'} · vence{' '}
                          {formatDateShort(item.dueDate)}
                          {item.overdue ? ' · atrasada' : ''}
                          {item.partial
                            ? item.kind === 'invoice'
                              ? ` · parcial${item.closingDay ? `, fecha dia ${item.closingDay}` : ''}`
                              : ' · valor do mês anterior'
                            : ''}
                        </p>
                      </div>
                      <span
                        className={`font-bold shrink-0 ${item.overdue ? 'text-red-400' : 'text-white'}`}
                      >
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="grid gap-1">
                  <div className="surface-row p-3 flex justify-between">
                    <span className="text-white">
                      Total a pagar até o salário
                      {coverage.hasPartial ? ' (piso)' : ''}
                    </span>
                    <span className="text-red-400">
                      {formatCurrency(coverage.dueBeforePayday)}
                      {coverage.hasPartial ? '+' : ''}
                    </span>
                  </div>
                  <div className="surface-row p-3 flex justify-between">
                    <span className="text-white">
                      Saldo na conta de pagamento
                      {defaultAccount ? ` (${defaultAccount.name})` : ''}
                    </span>
                    <span className="text-green-400">
                      {formatCurrency(coverage.balance)}
                    </span>
                  </div>
                  {coverage.borrowed > 0 && (
                    <div className="surface-row p-3 flex justify-between">
                      <span className="text-zinc-400">
                        Do saldo, já é complemento a devolver
                      </span>
                      <span className="text-amber-400">
                        {formatCurrency(coverage.borrowed)}
                      </span>
                    </div>
                  )}
                  <div className="surface-row p-3 flex justify-between border-white/10">
                    <span className="text-white font-bold">
                      {coverage.shortfall > 0 ? 'Falta cobrir' : 'Sobra até o salário'}
                    </span>
                    <span
                      className={`font-bold ${coverage.shortfall > 0 ? 'text-amber-400' : 'text-green-400'}`}
                    >
                      {formatCurrency(
                        coverage.shortfall > 0 ? coverage.shortfall : coverage.leftover,
                      )}
                    </span>
                  </div>
                </div>

                {coverage.hasPartial && (
                  <p className="text-zinc-500 text-xs leading-relaxed">
                    Itens marcados como parciais são de ciclo ainda aberto — o
                    valor é o acumulado até a última leitura e ainda pode subir
                    até o fechamento. Trate o total como piso.
                  </p>
                )}

                <p className="text-zinc-500 text-xs leading-relaxed">
                  Depois de puxar o valor, registre em Contas como{' '}
                  <strong className="text-zinc-400">complemento</strong> — assim a
                  devolução fica pendente e some quando o salário cair.
                </p>
              </>
            )}
          </div>
        )}

        {selectedCard === 'subscriptions' && (
          <div className="grid gap-2">
            {filteredTransactions.length === 0 && (
              <p className="text-zinc-400">Nenhum registro</p>
            )}
            {filteredTransactions.map((t) => {
              const card = cards.find((c) => c.id === t.card);
              const percent =
                subscriptionTotal > 0
                  ? ((Number(t.amount) / subscriptionTotal) * 100).toFixed(1)
                  : '0';

              return (
                <div
                  key={t.id}
                  className="surface-row p-3 flex justify-between items-center gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-white font-bold truncate">
                      {t.description || t.category}
                    </p>
                    <p className="text-zinc-400 text-sm">
                      {card ? `💳 ${card.name} — na fatura` : 'Sem cartão'}
                      {t.dueDay ? ` • lança dia ${t.dueDay}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-white font-bold">
                      {formatCurrency(Number(t.amount))}
                    </p>
                    <p className="text-zinc-400 text-sm">{percent}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {(selectedCard === 'fixed' || selectedCard === 'reserve') && (
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
