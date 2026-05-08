'use client';

import { useState } from 'react';

import { upsertCardSnapshot } from '@/core/services/cardSnapshot.service';
import { parseCurrencyInput } from '@/core/utils/number';

export default function CardSnapshotForm({
  monthId,
  cards,
  onUpdated,
}: {
  monthId: string;
  cards: any[];
  onUpdated: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});

  const handleChange = (cardName: string, value: string) => {
    setValues((prev) => ({
      ...prev,
      [cardName]: value,
    }));
  };

  const handleSave = async () => {
    try {
      for (const card of cards) {
        const value = values[card.name];

        if (!value) continue;

        await upsertCardSnapshot(monthId, card.name, parseCurrencyInput(value));
      }

      setValues({});

      onUpdated();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="bg-zinc-900 p-4 rounded mb-4">
      <h2 className="text-white font-bold mb-2">Atualizar Faturas</h2>

      <div className="grid gap-2">
        {cards.map((card) => (
          <input
            key={card.id}
            placeholder={card.name}
            value={values[card.name] || ''}
            onChange={(e) => handleChange(card.name, e.target.value)}
            className="p-2 rounded bg-zinc-800 text-white"
          />
        ))}
      </div>

      <button
        onClick={handleSave}
        className="mt-3 bg-blue-600 px-4 py-2 rounded text-white"
      >
        Salvar Faturas
      </button>
    </div>
  );
}
