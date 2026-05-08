'use client';

import { useEffect, useState } from 'react';

import CardForm from '@/components/cards/CardForm';
import CardSnapshotForm from '@/components/cards/CardSnapshotForm';

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

      <div className="grid gap-3">
        {cards.map((card) => {
          const snapshot = snapshots.find((s) => s.card_id === card.id);

          return (
            <div
              key={card.id}
              className="bg-zinc-900 rounded p-4 border border-zinc-800"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-white font-bold text-lg">{card.name}</h2>

                  <p className="text-zinc-400 text-sm">
                    Fecha dia {card.closing_day}
                  </p>

                  <p className="text-zinc-400 text-sm">
                    Vence dia {card.due_day ?? '-'}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-zinc-500 text-sm">Fatura Atual</p>

                  <p className="text-white text-xl font-bold">
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    }).format(Number(snapshot?.amount ?? 0))}
                  </p>
                </div>
              </div>
            </div>
          );
        })}

        {cards.length === 0 && (
          <div className="bg-zinc-900 rounded p-4 text-zinc-400">
            Nenhum cartão cadastrado
          </div>
        )}
      </div>
    </div>
  );
}
