'use client';

import { useState } from 'react';

import { upsertCardSnapshot } from '@/core/services/cardSnapshot.service';
import { parseCurrencyInput } from '@/core/utils/number';
import { useToast } from '@/components/ui/ToastProvider';
import { DBCard } from '@/core/types/database';

export default function CardSnapshotForm({
  monthId,
  cards,
  onUpdated,
}: {
  monthId: string;
  cards: DBCard[];
  onUpdated: () => void;
}) {
  const { showToast } = useToast();
  const [values, setValues] = useState<Record<string, string>>({});

  const handleChange = (cardId: string, value: string) => {
    setValues((prev) => ({
      ...prev,
      [cardId]: value,
    }));
  };

  const handleSave = async () => {
    try {
      for (const card of cards) {
        const value = values[card.id];

        if (!value) continue;

        await upsertCardSnapshot(monthId, card.id, parseCurrencyInput(value));
      }

      setValues({});

      showToast('Fatura(s) atualizada(s) com sucesso');
      onUpdated();
    } catch (err) {
      console.error(err);
      showToast('Erro ao salvar fatura', 'error');
    }
  };

  return (
    <div className="bg-zinc-900 p-4 rounded">
      <h2 className="text-white font-bold mb-4">Atualizar Faturas</h2>

      <div className="grid gap-3">
        {cards.map((card) => (
          <input
            key={card.id}
            placeholder={card.name}
            value={values[card.id] ?? ''}
            onChange={(e) => handleChange(card.id, e.target.value)}
            className="p-2 rounded bg-zinc-800 text-white"
          />
        ))}
      </div>

      <button
        onClick={handleSave}
        className="mt-4 bg-blue-600 px-4 py-2 rounded text-white hover:bg-blue-700"
      >
        Salvar Faturas
      </button>
    </div>
  );
}
