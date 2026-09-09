'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

import Card from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import PageLoading from '@/components/ui/PageLoading';

import { getMonths, createMonth } from '@/core/services/month.service';
import { getTransactions } from '@/core/services/transaction.service';

import { mapTransaction } from '@/core/models/mappers';
import Link from 'next/link';
import { calculateSummary } from '@/core/engine/calculations';
import {
  Insight,
  InsightEnvelope,
  buildInsights,
} from '@/core/engine/insights';
import InsightsPanel from '@/components/dashboard/InsightsPanel';
import {
  PaydaySettings,
  describePayday,
  resolveNextPaydayDate,
} from '@/core/engine/payday';
import {
  getUserSettings,
  toPaydaySettings,
} from '@/core/services/settings.service';
import {
  cycleLengthInWeeks,
  getCycleRange,
  getWeeksInMonth,
  getWeeksRemainingInCycle,
  weekDateRangeInCycle,
  weekIndexInCycle,
} from '@/core/engine/weekly';
import { getWeekBudgets, freezeWeekBudget } from '@/core/services/week.service';
import {
  calculateCycleSpend,
  CycleCharge,
  CycleSpend,
} from '@/core/engine/cycleSpend';
import { normalizeCategory } from '@/core/utils/normalize';
import {
  getCardSnapshots,
  getAllCardSnapshots,
} from '@/core/services/cardSnapshot.service';
import { findPreviousMonth, nextMonthToOpen } from '@/core/engine/month';
import {
  buildInvoices,
  estimateMissingInvoices,
  invoiceDueDate,
  invoicesDueInCompetence,
  openInvoicesUpTo,
  overdueInvoices,
  Invoice,
} from '@/core/engine/invoices';
import { groupTransactionsByCategory } from '@/core/utils/groupTransactions';

import { getInstallments } from '@/core/services/installment.service';
import type { ActiveInstallment } from '@/core/services/installment.service';
import { getCards } from '@/core/services/card.service';
import {
  getReadings,
  getAllReadings,
  deleteReading,
} from '@/core/services/cardReading.service';
import {
  getAccounts,
  getAccountReadings,
} from '@/core/services/account.service';
import { getTransfers } from '@/core/services/transfer.service';
import {
  DBCard,
  DBCardSnapshot,
  DBCardReading,
  DBMonth,
  DBAccount,
  DBAccountReading,
  DBTransaction,
} from '@/core/types/database';
import { Transaction, Week } from '@/core/types/finance';
import { getDueItems, CardInvoiceCharge } from '@/core/engine/dueDates';
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
  coverageInvoicesFromOpen,
  resolvePaydayDay,
  suggestCoverageSource,
  Coverage,
} from '@/core/engine/coverage';
import {
  mapAccount,
  mapAccountReading,
  mapTransfer,
} from '@/core/models/mappers';
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
  cash: 'Caixa — até o salário e até o fim do mês',
};

export default function Dashboard() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [months, setMonths] = useState<DBMonth[]>([]);
  /**
   * Competência escolhida ('YYYY-MM'). É ESTADO, não a URL: antes o mês ativo
   * era derivado de `useSearchParams()` e trocado com `router.push`, com um
   * efeito de canonização chamando `router.replace` em paralelo. As duas
   * navegações do App Router disputavam entre si e uma engolia a outra — daí
   * o "clico em julho e às vezes vai, às vezes não". Agora o clique muda o
   * estado na hora (render síncrono, sem transição) e a URL é só um espelho,
   * atualizada com `history.replaceState` para continuar compartilhável sem
   * disparar navegação nenhuma.
   */
  const [activeKey, setActiveKey] = useState<string | null>(null);
  /** Descarta resposta de um mês que não é mais o exibido (clique rápido). */
  const loadToken = useRef(0);
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
  /** Gasto livre por semana do ciclo, já com parcelas/assinaturas descontadas. */
  const [cycleSpend, setCycleSpend] = useState<CycleSpend | null>(null);
  const [cycleWeeks, setCycleWeeks] = useState(0);
  const [weeksRemaining, setWeeksRemaining] = useState(0);
  /**
   * Orçamento semanal CONGELADO no momento em que cada semana virou a atual —
   * ao contrário de `summary.weeklyBudget`, que é recalculado a cada leitura
   * de fatura nova e por isso muda o número mostrado até pras semanas já
   * passadas. Índice do ciclo → valor congelado.
   */
  const [frozenWeekBudgets, setFrozenWeekBudgets] = useState<Map<number, number>>(
    new Map(),
  );
  const [cycleRange, setCycleRange] = useState<{
    start: Date;
    end: Date;
  } | null>(null);
  const [currentMonthId, setCurrentMonthId] = useState<string | null>(null);
  const [primaryCard, setPrimaryCardState] = useState<DBCard | null>(null);
  const [readingsOpen, setReadingsOpen] = useState(false);
  const [installments, setInstallments] = useState<ActiveInstallment[]>([]);
  const [accounts, setAccounts] = useState<DBAccount[]>([]);
  const [accountReadings, setAccountReadings] = useState<DBAccountReading[]>(
    [],
  );
  const [openComplements, setOpenComplements] = useState<PendingReturn[]>([]);
  const [defaultAccountProjection, setDefaultAccountProjection] = useState<{
    lines: ProjectionLine[];
    projected: number;
  } | null>(null);
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  /** Regra de recebimento em vigor (configurada ou deduzida das entradas). */
  const [paydayRule, setPaydayRule] = useState<PaydaySettings | null>(null);
  const [previousEnvelopes, setPreviousEnvelopes] = useState<InsightEnvelope[]>(
    [],
  );
  /** false = está só deduzindo do `dueDay`, o usuário nunca configurou. */
  const [paydayIsConfigured, setPaydayIsConfigured] = useState(false);
  /** Faturas em aberto cujo vencimento JÁ passou — só essas são atraso. */
  const [lateInvoices, setLateInvoices] = useState<Invoice[]>([]);
  /** Faturas que vencem neste mês, para o calendário de vencimentos. */
  const [invoiceCharges, setInvoiceCharges] = useState<CardInvoiceCharge[]>([]);
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
      setActiveKey(monthKey(created));
    } catch (err) {
      console.error(err);
    } finally {
      setOpeningMonth(false);
    }
  };

  const loadMonthData = async (month: DBMonth, monthsList: DBMonth[]) => {
    const token = ++loadToken.current;
    const isStale = () => token !== loadToken.current;

    try {
      const competence = { month: month.month, year: month.year };

      // A competência anterior sai da lista de meses que já temos em mãos —
      // não precisa de ida ao banco — então as leituras dela cabem na MESMA
      // rodada. Antes elas eram um `await` solto no meio do fluxo, uma terceira
      // viagem em série depois das outras duas.
      const previousMonth = findPreviousMonth(monthsList, competence);

      // Tudo que não depende de nada vem junto: eram 8 idas ao banco em série,
      // e nesse intervalo a tela seguia mostrando os números do mês anterior —
      // parte da sensação de "cliquei e não mudou".
      const [
        snapshotsData,
        cardsDB,
        transactionsDB,
        installmentsDB,
        accountsData,
        accountReadingsData,
        transfersData,
        allSnapshots,
        previousReadings,
        settingsRow,
        previousTransactionsDB,
      ] = await Promise.all([
        getCardSnapshots(month.id),
        getCards(),
        getTransactions(month.id),
        getInstallments(month.id),
        getAccounts(),
        getAccountReadings(),
        getTransfers(),
        getAllCardSnapshots(),
        previousMonth
          ? getAllReadings(previousMonth.id)
          : Promise.resolve([] as DBCardReading[]),
        getUserSettings(),
        // Envelopes da competência anterior alimentam a comparação dos
        // insights ("mercado está acima do mês passado em X"). Vai na mesma
        // rodada porque `previousMonth` já é conhecido aqui.
        previousMonth
          ? getTransactions(previousMonth.id)
          : Promise.resolve([] as DBTransaction[]),
      ]);

      if (isStale()) return;

      const transactionsMapped = transactionsDB.map(mapTransaction);

      setSnapshots(snapshotsData);
      setCards(cardsDB);
      setInstallments(installmentsDB);
      setTransactions(transactionsMapped);

      const primary = cardsDB.find((c) => c.is_primary === true) ?? null;
      setPrimaryCardState(primary);
      setCurrentMonthId(month.id);

      // Ciclo de fatura, regra única (engine/invoices): a fatura lançada numa
      // competência vence no mês SEGUINTE. Logo, a fatura que vence no mês
      // exibido é a da competência anterior — por isso não dá pra olhar só os
      // snapshots deste mês.
      let allInvoices = buildInvoices({
        months: monthsList,
        snapshots: allSnapshots,
        cards: cardsDB,
      });

      // Fatura da competência anterior ainda não lançada em Cartões: usa a
      // última leitura daquele mês como piso, senão a obrigação que vence
      // agora simplesmente sumiria da tela.
      //
      // `previousReadings` também diz se o cartão já era acompanhado antes da
      // virada — é o que permite afirmar que o ciclo atual nasceu zerado
      // (ver `startsAtZero` mais abaixo).
      if (previousMonth) {
        allInvoices = [
          ...allInvoices,
          ...estimateMissingInvoices({
            invoices: allInvoices,
            cards: cardsDB,
            month: previousMonth,
            readings: previousReadings,
          }),
        ];
      }

      // Em aberto e já vencendo até o fim do mês exibido. A fatura da PRÓPRIA
      // competência exibida fica de fora: ela só vence mês que vem, então não
      // é obrigação de caixa daqui — é isso que evita contá-la duas vezes.
      const open = openInvoicesUpTo(allInvoices, competence);
      setLateInvoices(overdueInvoices(open, new Date()));

      setInvoiceCharges(
        invoicesDueInCompetence(allInvoices, competence).map((invoice) => ({
          cardId: invoice.cardId,
          cardName: invoice.cardName,
          dueDay: invoice.dueDay,
          dueDate: invoice.dueDate,
          snapshotId: invoice.snapshotId,
          amount: invoice.amount,
          paidAt: invoice.paidAt,
          competenceLabel: formatMonthLabel(
            invoice.competence.month,
            invoice.competence.year,
          ),
          estimated: invoice.estimated,
        })),
      );

      setAccounts(accountsData);
      setAccountReadings(accountReadingsData);

      const accountReadingsMapped = accountReadingsData.map(mapAccountReading);
      const transfersMapped = transfersData.map(mapTransfer);
      const pending = pendingReturns(transfersMapped);
      setOpenComplements(pending);

      const latestByAccount = latestReadingByAccount(accountReadingsMapped);

      const defaultAccount =
        accountsData.find((a) => a.is_payment_default) ?? null;
      if (defaultAccount) {
        const latest = latestByAccount.get(defaultAccount.id) ?? null;
        const nameById = new Map(accountsData.map((a) => [a.id, a.name]));

        const returnsForDefault = pending
          .filter((p) => p.holdingAccountId === defaultAccount.id)
          .map((p) => ({
            label: `Devolver p/ ${nameById.get(p.toAccountId) ?? '?'}`,
            amount: p.amount,
          }));

        // A fatura da PRÓPRIA competência exibida não entra: ela só vence no
        // mês seguinte, então não é obrigação de caixa deste mês. `open` já
        // contém exatamente o que vence até o fim do mês exibido.
        setDefaultAccountProjection(
          projectBalance({
            reading: latest
              ? { label: defaultAccount.name, amount: latest.amount }
              : null,
            openBills: openBillsFromTransactions(transactionsMapped),
            openInvoices: open.map((invoice) => ({
              label: `Fatura ${invoice.cardName} (${formatMonthLabel(invoice.competence.month, invoice.competence.year)} · vence ${invoice.dueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })})`,
              amount: invoice.amount,
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

      // Regra de recebimento: o que o usuário configurou em Configurações
      // manda. Sem configuração, cai no comportamento antigo — deduzir o dia
      // do `dueDay` da maior entrada — para quem já usava o app não perder a
      // janela de cobertura da noite para o dia.
      const configured = toPaydaySettings(settingsRow);
      const legacyDay = resolvePaydayDay(transactionsMapped);

      const paydayRule: PaydaySettings | null =
        configured ??
        (legacyDay != null ? { mode: 'fixed-day', day: legacyDay } : null);

      setPaydayRule(paydayRule);
      setPaydayIsConfigured(!!configured);

      if (isCurrentMonth) {
        const paymentReading = defaultAccount
          ? (latestByAccount.get(defaultAccount.id)?.amount ?? null)
          : null;

        const nextPayday = paydayRule
          ? resolveNextPaydayDate(paydayRule, now)
          : null;

        // As faturas da janela são as MESMAS `open` da projeção — nada de
        // recalcular ciclo aqui. Marcar uma como paga só a remove da lista;
        // a do ciclo seguinte não toma o lugar dela, porque vence depois.
        setCoverage(
          calculateCoverage({
            today: now,
            payday: nextPayday,
            balance: paymentReading,
            bills: coverageBillsFromTransactions(transactionsMapped),
            invoices: coverageInvoicesFromOpen(open),
            borrowed: pending
              .filter(
                (p) =>
                  !defaultAccount || p.holdingAccountId === defaultAccount.id,
              )
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

      // Data de referência pra resolver QUAL ciclo da fatura estamos vendo:
      // "hoje" só corresponde ao ciclo certo quando a competência exibida é
      // o mês corrente de verdade. Navegando pra um mês passado/futuro, usar
      // "hoje" sempre resolveria pro ciclo vigente DE HOJE — por isso julho
      // aparecia com o ciclo/leituras de agosto. Uma data dentro da própria
      // competência exibida resolve pro ciclo daquele mês.
      const cycleReferenceDate = isCurrentMonth
        ? now
        : new Date(month.year, month.month, 0); // último dia da competência exibida

      // Intervalo real do ciclo (não os blocos de 7 dias, que podem
      // ultrapassar o fechamento real) — exibido no card de Orçamento
      // Semanal pra deixar claro qual ciclo está sendo usado no cálculo.
      const cycleRangeForPrimary =
        primary?.closing_day != null
          ? getCycleRange(primary.closing_day, cycleReferenceDate)
          : null;
      setCycleRange(cycleRangeForPrimary);

      // Semanas do ciclo: derivadas do MESMO intervalo acima (não de uma
      // função à parte com outra noção de "ciclo atual"), pra nunca divergir
      // do "Ciclo vigente: dd/mm–dd/mm" mostrado na tela.
      const weeksInCycle = cycleRangeForPrimary
        ? cycleLengthInWeeks(cycleRangeForPrimary)
        : getWeeksInMonth(month.month, month.year);
      setCycleWeeks(weeksInCycle);

      // leituras do cartão principal da competência EXIBIDA — regra única,
      // sem exceção por data: o mês que você escolhe ao lançar a leitura em
      // Cartões é o que vale, sempre. Antes havia uma janela de exceção pra
      // uma leitura da competência anterior lançada na véspera da virada
      // (bom pra não perder um lançamento adiantado, mas era mais uma regra
      // implícita pra usuário e IA terem que lembrar). E antes disso ainda,
      // uma busca por intervalo de datas (sem olhar month_id nenhum) inflava
      // a semana 1 com o valor cheio de uma fatura já fechada, só porque a
      // confirmação do fechamento tinha sido lançada no mesmo dia em que o
      // ciclo novo começa — daí a regra ficar só nisto: `month_id`, ponto.
      if (primary && cycleRangeForPrimary) {
        const cycleReadings = await getReadings(month.id, primary.id);

        if (isStale()) return;

        // Histórico exibido na UI: são as mesmas leituras usadas no cálculo
        // do ciclo — aqui o usuário espera ver o que lançou no mês que está
        // vendo.
        setMonthReadings(cycleReadings);

        // O ciclo nasce zerado quando já havia acompanhamento antes da virada:
        // aí a primeira leitura é gasto, não linha de base.
        const startsAtZero = previousReadings.some(
          (r) => r.card_id === primary.id,
        );

        // Parcela entra na virada do ciclo (não tem dia próprio — nasce com a
        // fatura); assinatura entra no dia da renovação.
        const charges: CycleCharge[] = [
          ...transactionsMapped
            .filter(
              (t) =>
                !t.skipped &&
                t.type === 'expense' &&
                t.card === primary.id &&
                (t.isFixed || t.isRecurring),
            )
            .map((t) => ({
              label: t.description || t.category,
              amount: t.amount,
              kind: 'subscription' as const,
              day: t.dueDay,
            })),
          ...installmentsDB
            .filter((i) => i.card_id === primary.id)
            .map((i) => ({
              label: i.description,
              amount: Number(i.installment_amount),
              kind: 'installment' as const,
            })),
        ];

        setCycleSpend(
          calculateCycleSpend({
            cycle: cycleRangeForPrimary,
            totalWeeks: weeksInCycle,
            readings: cycleReadings,
            charges,
            startsAtZero,
          }),
        );
      } else {
        setMonthReadings([]);
        setCycleSpend(null);
      }

      // Orçamento semanal decrescente: passou uma semana, divide pelas que
      // restam. Quantas restam depende SÓ da data — leitura de fatura diz
      // quanto já foi gasto, não em que ponto do ciclo estamos. Antes havia um
      // segundo caminho que deduzia a semana atual do maior índice já lido
      // (`weeksInCycle - maxWeekIndex`), e ele descontava a semana em curso
      // como se ela tivesse acabado: lançar uma leitura na semana 1 derrubava
      // o divisor de 5 pra 4 na hora, inflando o orçamento em 25%.
      //
      // Fora do ciclo vigente (mês passado ou futuro) "quanto falta a partir
      // de hoje" não quer dizer nada — aí o divisor é o ciclo inteiro, que é o
      // mesmo número de barras desenhado no gráfico.
      const todayInCycle =
        !!cycleRangeForPrimary &&
        now.getTime() >= cycleRangeForPrimary.start.getTime() &&
        now.getTime() <=
          new Date(
            cycleRangeForPrimary.end.getFullYear(),
            cycleRangeForPrimary.end.getMonth(),
            cycleRangeForPrimary.end.getDate(),
            23,
            59,
            59,
            999,
          ).getTime();

      const weeksForBudget =
        primary?.closing_day != null && todayInCycle
          ? getWeeksRemainingInCycle(primary.closing_day, now)
          : weeksInCycle;

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

      // Congela o orçamento da semana ATUAL na primeira vez que ela aparece
      // (freezeWeekBudget é no-op se já existir) e carrega os valores já
      // congelados de todas as semanas da competência exibida — é o que
      // permite mostrar "orçamento inicial" ao lado do recalculado sem essa
      // semana passada mudar de número a cada fatura nova.
      try {
        const weekBudgetsData = await getWeekBudgets(month.id);
        const frozen = new Map(
          weekBudgetsData
            .filter((w) => w.budget != null)
            .map((w) => [w.index, Number(w.budget)]),
        );

        if (todayInCycle && primary?.closing_day != null) {
          const currentWeekIndex = weekIndexInCycle(now, primary.closing_day);
          if (!frozen.has(currentWeekIndex)) {
            await freezeWeekBudget(month.id, currentWeekIndex, result.weeklyBudget);
            frozen.set(currentWeekIndex, result.weeklyBudget);
          }
        }

        if (isStale()) return;
        setFrozenWeekBudgets(frozen);
      } catch (err) {
        console.error(err);
      }

      // Só os envelopes interessam da competência anterior — parcelas e
      // orçamento semanal de lá não entram em nenhum insight.
      setPreviousEnvelopes(
        previousMonth
          ? calculateSummary(
              previousTransactionsDB.map(mapTransaction),
              [],
              allSnapshots.filter((s) => s.month_id === previousMonth.id),
            ).envelopes
          : [],
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteReading = async (id: string) => {
    if (!primaryCard || !currentMonthId || !activeMonth) return;
    try {
      await deleteReading(id);
      await loadMonthData(activeMonth, months);
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

  // Semente do estado: a URL só é lida uma vez, na montagem. Depois disso quem
  // manda é `activeKey` — ler `searchParams` a cada render era o que deixava a
  // navegação à mercê do timing do router.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveKey((current) => current ?? searchParams.get('month'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mês ativo: a competência escolhida, ou a mais recente quando a chave não
  // existe (URL apontando pra um mês ainda não aberto, por exemplo).
  const activeMonth = months.length
    ? ((activeKey
        ? months.find((m) => monthKey(m) === activeKey)
        : undefined) ?? months[months.length - 1])
    : null;

  // recarrega tudo (transações, snapshots, leituras, parcelas, summary) ao trocar de mês
  useEffect(() => {
    if (!activeMonth) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadMonthData(activeMonth, months);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMonth?.id, months]);

  // A URL vira espelho do estado: `history.replaceState` mantém o link
  // compartilhável sem acionar o router (sem transição, sem corrida, sem
  // re-render em cascata).
  useEffect(() => {
    if (!activeMonth) return;

    const key = monthKey(activeMonth);
    if (new URLSearchParams(window.location.search).get('month') !== key) {
      window.history.replaceState(null, '', `${pathname}?month=${key}`);
    }
  }, [activeMonth, pathname]);

  const goToMonth = (month: DBMonth) => {
    setActiveKey(monthKey(month));
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

  // Card "Caixa": Contas e Cobertura eram dois cards contando quase a mesma
  // história com números diferentes. Agora é um só, com dois horizontes
  // explícitos — até o salário (a pergunta urgente) e até o fim do mês
  // (a projeção) — detalhados lado a lado no modal.
  const defaultAccount = accounts.find((a) => a.is_payment_default) ?? null;
  const latestAccountReadings = latestReadingByAccount(
    accountReadings.map(mapAccountReading),
  );
  const totalPendingReturns = openComplements.reduce(
    (acc, p) => acc + p.amount,
    0,
  );
  const projected = defaultAccountProjection?.projected ?? null;
  const paydayLabel = coverage?.payday ? formatDateShort(coverage.payday) : '';

  const cashValue = !defaultAccount
    ? 'Sem conta de pagamento'
    : coverage?.hasPayday
      ? coverage.shortfall > 0
        ? `Tirar ${formatCurrency(coverage.shortfall)}`
        : `Sobra ${formatCurrency(coverage.leftover)}`
      : projected != null
        ? formatCurrency(projected)
        : '—';

  const pendingReturnsFragment =
    totalPendingReturns > 0
      ? `devolver ${formatCurrency(totalPendingReturns)}`
      : null;

  const cashSubtitle = !defaultAccount
    ? 'Marque uma conta como ★ de pagamento em Contas'
    : !coverage
      ? [
          `Saldo ${formatCurrency(latestAccountReadings.get(defaultAccount.id)?.amount ?? 0)}`,
          `projeção até o fim do mês${projected != null ? ` ${formatCurrency(projected)}` : ''} — a janela até o salário só é calculada no mês corrente`,
          pendingReturnsFragment,
        ]
          .filter((s): s is string => !!s)
          .join(' · ')
      : !coverage.hasPayday
        ? 'Preencha o dia de recebimento na sua entrada recorrente para calcular a janela até o salário'
        : [
            `Saldo ${formatCurrency(coverage.balance)}`,
            coverage.items.length === 0
              ? `nada vence até ${paydayLabel}`
              : `${formatCurrency(coverage.dueBeforePayday)}${coverage.hasPartial ? '+' : ''} vence até ${paydayLabel}`,
            coverage.shortfall > 0 && coverage.source
              ? `tirar de ${coverage.source.accountName}`
              : null,
            projected != null
              ? `fim do mês ${formatCurrency(projected)}`
              : null,
            pendingReturnsFragment,
          ]
            .filter((s): s is string => !!s)
            .join(' · ');

  // Semanas do ciclo, na mesma forma usada pelo gráfico e pela lista —
  // única fonte: leituras da fatura do cartão principal.
  const chartWeeks: Week[] = Array.from({ length: cycleWeeks }, (_, i) => {
    const index = i + 1;
    const entry = cycleSpend?.weeks.find((w) => w.weekIndex === index);
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

  // Leitura do mês: os mesmos números já calculados, transformados em
  // veredito. Ver `core/engine/insights.ts` — a pergunta muda conforme a
  // competência esteja em curso (ritmo) ou fechada (sobrou/estourou).
  const insights: Insight[] = activeMonth
    ? buildInsights({
        today: now,
        isCurrentMonth,
        cycle: cycleRange,
        competence: { month: activeMonth.month, year: activeMonth.year },
        envelopes: summary.envelopes,
        totalIncome: summary.totalIncome,
        fixedCosts: summary.fixedCosts,
        cardSpending: summary.cardSpending,
        installmentSpending: summary.installmentSpending,
        reserveSpending: summary.reserveSpending,
        total: summary.total,
        previousEnvelopes,
      })
    : [];

  /**
   * Bloco "até o salário" do modal de Caixa. Era um modal separado (card
   * Cobertura); virou seção porque as duas telas respondiam à mesma pergunta
   * com números diferentes e horizontes diferentes, sem dizer qual era qual.
   */
  const renderCoverageSection = () => {
    if (!coverage) {
      return (
        <p className="text-zinc-400">
          A janela até o salário só é calculada no mês corrente — troque a
          competência para o mês atual.
        </p>
      );
    }

    return (
      <div className="grid gap-4">
        {coverage && !coverage.hasPayday && (
          <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-400">
            Falta dizer quando você recebe.{' '}
            <Link href="/settings" className="underline">
              Configure em Configurações
            </Link>{' '}
            — dia fixo do mês ou N-ésimo dia útil. É essa data que define até
            quando a cobertura precisa durar.
          </p>
        )}

        {coverage?.hasPayday && paydayRule && !paydayIsConfigured && (
          <p className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-xs text-zinc-400">
            Recebimento deduzido do dia cadastrado na sua entrada recorrente
            ({describePayday(paydayRule)}).{' '}
            <Link href="/settings" className="underline">
              Confirme em Configurações
            </Link>{' '}
            — quem recebe por dia útil não tem dia fixo.
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
                  {coverage.shortfall > 0
                    ? 'Falta cobrir'
                    : 'Sobra até o salário'}
                </span>
                <span
                  className={`font-bold ${coverage.shortfall > 0 ? 'text-amber-400' : 'text-green-400'}`}
                >
                  {formatCurrency(
                    coverage.shortfall > 0
                      ? coverage.shortfall
                      : coverage.leftover,
                  )}
                </span>
              </div>
            </div>

            {coverage.hasPartial && (
              <p className="text-zinc-500 text-xs leading-relaxed">
                Itens marcados como parciais são de ciclo ainda aberto — o valor
                é o acumulado até a última leitura e ainda pode subir até o
                fechamento. Trate o total como piso.
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
    );
  };

  return (
    <div className="grid gap-4 p-4 sm:gap-5 sm:p-6">
      {activeMonth && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* flex-wrap + min-w-0: sem isso o botão "+ Abrir <mês>" é
              `whitespace-nowrap` e força o min-content da linha inteira para
              perto de 400px, o que alargava a coluna da página toda em
              telas pequenas (ver comentário em globals.css). */}
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
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

      {/* Só ATRASO aparece aqui. A fatura de julho que vence dia 10/08 não é
          atraso no dia 4 — ela é uma conta normal do mês, e aparece no
          calendário de vencimentos e no card de Caixa como qualquer outra. */}
      {lateInvoices.length > 0 && (
        <div className="rounded-xl border border-orange-500/20 bg-orange-500/10 p-3 text-sm text-orange-300">
          <p className="font-semibold">Faturas vencidas e ainda em aberto</p>
          <ul className="mt-1 grid gap-0.5">
            {lateInvoices.map((invoice) => (
              <li
                key={`${invoice.snapshotId}-${invoice.cardId}`}
                className="flex justify-between gap-3"
              >
                <span>
                  {invoice.cardName} ·{' '}
                  {formatMonthLabel(
                    invoice.competence.month,
                    invoice.competence.year,
                  )}{' '}
                  · venceu {formatDateShort(invoice.dueDate)}
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
          subtitle={
            summary.pendingCardSpending > 0
              ? `Faturas desta competência + ${formatCurrency(summary.pendingCardSpending)} lançados em cartão sem fatura registrada ainda`
              : 'Faturas fechando nesta competência — pagas no mês que vem'
          }
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
          title="Caixa"
          value={cashValue}
          subtitle={cashSubtitle}
          onClick={() => setSelectedCard('cash')}
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
            Marque um cartão como principal (★ na tela de Cartões) para ativar o
            acompanhamento semanal — ele é calculado só a partir das leituras da
            fatura do cartão principal.
          </p>
        )}

        {primaryCard && (
          <>
            <div className="grid gap-2 mb-4">
              {chartWeeks.map((week) => {
                const entry = cycleSpend?.weeks.find(
                  (w) => w.weekIndex === week.index,
                );

                // Orçamento CONGELADO no início da semana, quando existir —
                // é contra ele que a diferença faz sentido (senão o "sobrou/
                // faltou" de uma semana já passada muda toda vez que uma
                // fatura nova é lançada). Sem congelamento ainda (semana que
                // nunca foi "a atual"), cai no recalculado como estimativa.
                const frozenBudget = frozenWeekBudgets.get(week.index) ?? null;
                const initialBudget = frozenBudget ?? summary.weeklyBudget;
                const diff = initialBudget - week.spent;

                // `cycleRange.start` (já resolvido pra competência exibida,
                // não "hoje") garante que as datas de cada semana batem com
                // o ciclo mostrado, mesmo navegando por um mês passado.
                const { start, end } =
                  primaryCard.closing_day != null && cycleRange
                    ? weekDateRangeInCycle(
                        week.index,
                        primaryCard.closing_day,
                        cycleRange.start,
                      )
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
                        Orçamento inicial: {formatCurrency(initialBudget)}
                      </span>
                      {frozenBudget != null &&
                        Math.abs(frozenBudget - summary.weeklyBudget) > 0.004 && (
                          <span className="text-zinc-500 text-xs italic">
                            (recalculado hoje: {formatCurrency(summary.weeklyBudget)})
                          </span>
                        )}
                      {entry?.hasReading ? (
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
                          {entry.appliedCharges > 0 && (
                            <span className="text-zinc-500 text-xs italic">
                              (a fatura subiu{' '}
                              {formatCurrency(entry.invoiceDelta)}, sendo{' '}
                              {formatCurrency(entry.appliedCharges)} de
                              assinaturas/parcelas já lançadas)
                            </span>
                          )}
                          {entry.unappliedCharges > 0 && (
                            <span className="text-amber-400 text-xs">
                              ⚠️ {formatCurrency(entry.unappliedCharges)} de
                              cobranças conhecidas não couberam no que a fatura
                              subiu — confira o dia cadastrado
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

      <InsightsPanel insights={insights} />

      {isCurrentMonth && activeMonth && (
        <DueDatesPanel
          transactions={transactions}
          installments={installments}
          cards={cards}
          invoiceCharges={invoiceCharges}
          month={activeMonth.month}
          year={activeMonth.year}
          onChanged={() => loadMonthData(activeMonth, months)}
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
        title={
          selectedCard
            ? (MODAL_TITLES[selectedCard] ?? 'Detalhamento')
            : 'Detalhamento'
        }
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
                    Fatura desta competência: {formatCurrency(fatura)}
                    {activeMonth && card.due_day != null
                      ? ` · vence ${formatDateShort(
                          invoiceDueDate(
                            {
                              month: activeMonth.month,
                              year: activeMonth.year,
                            },
                            card.due_day,
                          ),
                        )}`
                      : ''}
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
              <p className="text-zinc-400">
                Nenhum parcelamento ativo neste mês
              </p>
            )}
            {installments.map((i) => {
              const start = installmentMonthLabel(i.startMonth);
              const end = installmentEndLabel(
                i.startMonth,
                i.total_installments,
              );

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
              {
                label: 'Provisões (envelopes)',
                value: -summary.envelopeSpending,
              },
              {
                label: 'Reserva / Investimentos',
                value: -summary.reserveSpending,
              },
            ].map((row) => (
              <div key={row.label} className="surface-row p-3 grid gap-1">
                <div className="flex justify-between">
                  <span className="text-white">{row.label}</span>
                  <span
                    className={
                      row.value < 0 ? 'text-red-400' : 'text-green-400'
                    }
                  >
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
                  {formatDateShort(cycleRange.start)}–
                  {formatDateShort(cycleRange.end)}
                </span>
              </div>
            )}
            <div className="surface-row p-3 flex justify-between">
              <span className="text-white">Saldo do mês</span>
              <span className="text-white font-bold">
                {formatCurrency(summary.total)}
              </span>
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

        {selectedCard === 'cash' && (
          <div className="grid gap-6">
            {/* ------- Horizonte 1: até o salário ------- */}
            <div className="grid gap-4">
              <div>
                <h3 className="text-white font-bold text-sm">
                  Até o salário
                  {coverage?.payday
                    ? ` — ${formatDateShort(coverage.payday)}`
                    : ''}
                </h3>
                <p className="text-zinc-500 text-xs mt-0.5">
                  O que sai da conta de pagamento antes da próxima entrada cair.
                </p>
              </div>
              {renderCoverageSection()}
            </div>

            {/* ------- Horizonte 2: até o fim do mês ------- */}
            <div className="grid gap-4">
              <div>
                <h3 className="text-white font-bold text-sm">
                  Até o fim do mês
                </h3>
                <p className="text-zinc-500 text-xs mt-0.5">
                  Saldo de cada conta e a projeção do mês inteiro — inclui o que
                  vence depois do salário.
                </p>
              </div>

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
                    <div
                      key={i}
                      className="surface-row p-3 flex justify-between"
                    >
                      <span className="text-white">{line.label}</span>
                      <span
                        className={
                          line.amount < 0 ? 'text-red-400' : 'text-green-400'
                        }
                      >
                        {formatCurrency(line.amount)}
                      </span>
                    </div>
                  ))}
                  <div className="surface-row p-3 flex justify-between border-white/10">
                    <span className="text-white font-bold">
                      {defaultAccountProjection.projected < 0
                        ? 'Falta projetada'
                        : 'Sobra projetada'}
                    </span>
                    <span
                      className={`font-bold ${defaultAccountProjection.projected < 0 ? 'text-red-400' : 'text-green-400'}`}
                    >
                      {formatCurrency(Math.abs(defaultAccountProjection.projected))}
                    </span>
                  </div>
                </div>
              )}

              {openComplements.length > 0 && (
                <div className="grid gap-1">
                  <h3 className="text-white font-bold text-sm mb-1">
                    Complementos em aberto
                  </h3>
                  {openComplements.map((p) => (
                    <div
                      key={p.complementId}
                      className="surface-row p-3 flex justify-between"
                    >
                      <span className="text-white">
                        Devolver p/{' '}
                        {accounts.find((a) => a.id === p.toAccountId)?.name ??
                          '?'}
                      </span>
                      <span className="text-amber-400 font-bold">
                        {formatCurrency(p.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
