'use client';

import { deleteCard } from '@/core/services/card.service';

type Props = {
  cards: any[];
  onUpdated: () => void;
};

export default function CardList({ cards, onUpdated }: Props) {
  const handleDelete = async (id: string) => {
    try {
      await deleteCard(id);
      onUpdated();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="bg-zinc-900 rounded p-4 grid gap-3">
      <h2 className="text-white font-bold text-lg">Cartões cadastrados</h2>

      {cards.length === 0 && (
        <p className="text-zinc-400">Nenhum cartão cadastrado.</p>
      )}

      {cards.map((card) => (
        <div
          key={card.id}
          className="bg-zinc-800 rounded p-3 flex items-center justify-between"
        >
          <div>
            <p className="text-white font-medium">{card.name}</p>

            <p className="text-zinc-400 text-sm">
              Fecha dia {card.closing_day} • vence dia {card.due_day}
            </p>
          </div>

          <button
            onClick={() => handleDelete(card.id)}
            className="text-red-500 hover:text-red-700 text-sm"
          >
            Remover
          </button>
        </div>
      ))}
    </div>
  );
}
