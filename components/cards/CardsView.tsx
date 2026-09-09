'use client';

import { useEffect, useState } from 'react';

import CardForm from '@/components/cards/CardForm';
import CardSnapshotForm from '@/components/cards/CardSnapshotForm';
import PendingInvoiceForm, {
  PendingInvoice,
} from '@/components/cards/PendingInvoiceForm';
import CardList from '@/components/cards/CardList';
import CardReadingsList from '@/components/cards/CardReadingsList';
import MonthSelect, { formatMonthLabel } from '@/components/ui/MonthSelect';
import PageLoading from '@/components/ui/PageLoading';

import { getCards } from '@/core/services/card.service';
import { getCardSnapshots } from '@/core/services/cardSnapshot.service';
import { getAllReadings } from '@/core/services/cardReading.service';
import { useActiveMonth } from '@/core/hooks/useActiveMonth';
import { findPreviousMonth } from '@/core/engine/month';
import { getCycleRange } from '@/core/engine/weekly';
import { DBCard, DBCardSnapshot } from '@/core/types/database';

export default function CardsView() {
  const { months, activeMonth, goToMonth, reloadMonths } = useActiveMonth();

  const [cards, setCards] = useState<DBCard[]>([]);
  const [snapshots, setSnapshots] = useState<DBCardSnapshot[]>([]);
  const [pendingInvoices, setPendingInvoices] = useState<PendingInvoice[]>([]);
  const [refreshToken, setRefreshToken] = useState(0);

  const loadCardsAndSnapshots = async (monthId: string) => {
    try {
      const [cardsData, snapshotsData] = await Promise.all([
        getCards(),
        getCardSnapshots(monthId),
      ]);

      setCards(cardsData);
      setSnapshots(snapshotsData);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!activeMonth) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCardsAndSnapshots(activeMonth.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMonth?.id]);

  // Faturas de competências anteriores cujo ciclo já fechou, mas que ainda
  // não têm snapshot lançado — mostradas num campo à parte pra nunca virarem
  // "primeira leitura" do ciclo atual (o que inflava o gasto da semana 1 com
  // o total inteiro da fatura anterior).
  useEffect(() => {
    if (!activeMonth || cards.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPendingInvoices([]);
      return;
    }

    const previousMonth = findPreviousMonth(months, activeMonth);
    if (!previousMonth) {
      setPendingInvoices([]);
      return;
    }

    (async () => {
      try {
        const [previousSnapshots, previousReadings] = await Promise.all([
          getCardSnapshots(previousMonth.id),
          getAllReadings(previousMonth.id),
        ]);

        const launchedCardIds = new Set(
          previousSnapshots
            .filter((s) => Number(s.amount) > 0)
            .map((s) => s.card_id),
        );

        const today = new Date();
        const lastDayOfPreviousMonth = new Date(
          previousMonth.year,
          previousMonth.month,
          0,
        );

        const pending: PendingInvoice[] = [];

        for (const card of cards) {
          if (launchedCardIds.has(card.id)) continue;
          if (card.closing_day == null) continue;

          const cycleEnd = getCycleRange(
            card.closing_day,
            lastDayOfPreviousMonth,
          ).end;
          if (cycleEnd.getTime() >= today.getTime()) continue;

          const cardReadings = previousReadings
            .filter((r) => r.card_id === card.id)
            .sort(
              (a, b) =>
                new Date(b.read_at).getTime() - new Date(a.read_at).getTime(),
            );

          pending.push({
            cardId: card.id,
            cardName: card.name,
            monthId: previousMonth.id,
            monthLabel: formatMonthLabel(previousMonth.month, previousMonth.year),
            cycleEnd,
            lastKnownAmount: cardReadings.length
              ? Number(cardReadings[0].amount)
              : null,
          });
        }

        setPendingInvoices(pending);
      } catch (err) {
        console.error(err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMonth?.id, cards, months]);

  const handleReload = () => {
    if (activeMonth) loadCardsAndSnapshots(activeMonth.id);
    setRefreshToken((t) => t + 1);
  };

  if (!activeMonth) {
    return <PageLoading />;
  }

  return (
    <div className="grid gap-4 p-4 sm:gap-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-white sm:text-2xl">Cartões</h1>
        <MonthSelect
          months={months}
          activeMonth={activeMonth}
          onChange={goToMonth}
        />
      </div>

      <CardForm
        onCreated={() => {
          reloadMonths();
          handleReload();
        }}
      />

      <PendingInvoiceForm invoices={pendingInvoices} onUpdated={handleReload} />

      <CardSnapshotForm
        monthId={activeMonth.id}
        cards={cards}
        onUpdated={handleReload}
      />

      <CardReadingsList
        key={`${activeMonth.id}-${refreshToken}`}
        monthId={activeMonth.id}
        cards={cards}
      />

      <CardList
        cards={cards}
        snapshots={snapshots}
        competence={{ month: activeMonth.month, year: activeMonth.year }}
        onUpdated={handleReload}
      />
    </div>
  );
}
