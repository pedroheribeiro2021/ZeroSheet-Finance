'use client';

import { useEffect, useState } from 'react';

import CardForm from '@/components/cards/CardForm';
import CardSnapshotForm from '@/components/cards/CardSnapshotForm';
import CardList from '@/components/cards/CardList';

import { getCards } from '@/core/services/card.service';
import { getCardSnapshots } from '@/core/services/cardSnapshot.service';

import { getMonths, createMonth } from '@/core/services/month.service';

export default function CardsPage() {
  const [cards, setCards] = useState<any[]>([]);
  const [snapshots, setSnapshots] = useState<any[]>([]);
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
    return <div className="p-6 text-white">Carregando...</div>;
  }

  return (
    <div className="p-6 grid gap-6">
      <h1 className="text-2xl font-bold text-white">Cartões</h1>

      <CardForm onCreated={load} />

      <CardSnapshotForm monthId={monthId} cards={cards} onUpdated={load} />

      <CardList cards={cards} snapshots={snapshots} onUpdated={load} />
    </div>
  );
}
