'use client';

import { useEffect, useState } from 'react';

import CardForm from '@/components/cards/CardForm';
import CardSnapshotForm from '@/components/cards/CardSnapshotForm';
import CardList from '@/components/cards/CardList';
import PageLoading from '@/components/ui/PageLoading';

import { getCards } from '@/core/services/card.service';
import { getCardSnapshots } from '@/core/services/cardSnapshot.service';

import { getMonths, createMonth } from '@/core/services/month.service';
import { DBCard, DBCardSnapshot } from '@/core/types/database';

export default function CardsPage() {
  const [cards, setCards] = useState<DBCard[]>([]);
  const [snapshots, setSnapshots] = useState<DBCardSnapshot[]>([]);
  const [monthId, setMonthId] = useState<string | null>(null);

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

      setMonthId(latestMonth.id);

      const cardsData = await getCards();
      const snapshotsData = await getCardSnapshots(latestMonth.id);

      setCards(cardsData);
      setSnapshots(snapshotsData);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (!monthId) {
    return <PageLoading />;
  }

  return (
    <div className="grid gap-4 p-4 sm:gap-5 sm:p-6">
      <h1 className="text-xl font-bold text-white sm:text-2xl">Cartões</h1>

      <CardForm onCreated={load} />

      <CardSnapshotForm monthId={monthId} cards={cards} onUpdated={load} />

      <CardList cards={cards} snapshots={snapshots} onUpdated={load} />
    </div>
  );
}
