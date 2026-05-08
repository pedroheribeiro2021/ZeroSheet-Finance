'use client';

import { useEffect, useState } from 'react';

import Card from '@/components/ui/Card';

import { createCard, deleteCard, getCards } from '@/core/services/card.service';

export default function CardsPage() {
  const [cards, setCards] = useState<any[]>([]);
  const [name, setName] = useState('');

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

  const handleCreate = async () => {
    if (!name.trim()) return;

    try {
      await createCard({
        name,
        slug: name.toLowerCase().replace(/\s+/g, '-'),
      });

      setName('');

      await load();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCard(id);
      await load();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-6 grid gap-6">
      <div className="bg-zinc-900 rounded p-4 grid gap-4">
        <h1 className="text-2xl font-bold text-white">Meus Cartões</h1>

        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do cartão"
            className="flex-1 bg-zinc-800 rounded p-3 text-white outline-none"
          />

          <button
            onClick={handleCreate}
            className="bg-blue-600 px-4 rounded text-white hover:bg-blue-700"
          >
            Adicionar
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <div key={card.id} className="bg-zinc-900 rounded p-4 grid gap-4">
            <Card title={card.name} value="Cartão cadastrado" />

            <button
              onClick={() => handleDelete(card.id)}
              className="bg-red-600 rounded p-2 text-white hover:bg-red-700"
            >
              Remover
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
