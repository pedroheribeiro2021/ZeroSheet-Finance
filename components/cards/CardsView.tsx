'use client';

import { useEffect, useState } from 'react';

import CardForm from '@/components/cards/CardForm';
import CardSnapshotForm from '@/components/cards/CardSnapshotForm';
import CardList from '@/components/cards/CardList';
import CardReadingsList from '@/components/cards/CardReadingsList';
import MonthSelect from '@/components/ui/MonthSelect';
import PageLoading from '@/components/ui/PageLoading';

import { getCards } from '@/core/services/card.service';
import { getCardSnapshots } from '@/core/services/cardSnapshot.service';
import { useActiveMonth } from '@/core/hooks/useActiveMonth';
import { DBCard, DBCardSnapshot } from '@/core/types/database';

export default function CardsView() {
  const { months, activeMonth, goToMonth, reloadMonths } = useActiveMonth();

  const [cards, setCards] = useState<DBCard[]>([]);
  const [snapshots, setSnapshots] = useState<DBCardSnapshot[]>([]);
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
        <MonthSelect months={months} activeMonth={activeMonth} onChange={goToMonth} />
      </div>

      <CardForm
        onCreated={() => {
          reloadMonths();
          handleReload();
        }}
      />

      <CardSnapshotForm monthId={activeMonth.id} cards={cards} onUpdated={handleReload} />

      <CardReadingsList
        key={`${activeMonth.id}-${refreshToken}`}
        monthId={activeMonth.id}
        cards={cards}
      />

      <CardList cards={cards} snapshots={snapshots} onUpdated={handleReload} />
    </div>
  );
}
