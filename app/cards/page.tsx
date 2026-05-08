'use client';

import { useEffect, useState } from 'react';

import CardList from '@/components/cards/CardList';

import { getCards } from '@/core/services/card.service';
import CardForm from '@/components/cards/CardForm';

export default function CardsPage() {
  const [cards, setCards] = useState<any[]>([]);

  const load = async () => {
    try {
      const data = await getCards();
      setCards(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="p-6 grid gap-4">
      <h1 className="text-2xl font-bold text-white">Cartões</h1>

      <CardForm onCreated={load} />

      <CardList cards={cards} onUpdated={load} />
    </div>
  );
}
