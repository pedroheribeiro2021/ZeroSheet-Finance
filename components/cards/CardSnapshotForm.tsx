'use client';

import { useState } from 'react';

import { upsertCardSnapshot } from '@/core/services/cardSnapshot.service';
import { recordSnapshotAsReading } from '@/core/services/cardReading.service';
import { parseCurrencyInput, sanitizeAmountInput } from '@/core/utils/number';
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

        const amount = parseCurrencyInput(value);
        await upsertCardSnapshot(monthId, card.id, amount);

        // atualização da fatura vira leitura automaticamente — histórico
        // semanal se constrói sozinho, sem lançamento duplicado.
        await recordSnapshotAsReading({
          month_id: monthId,
          card_id: card.id,
          amount,
        });
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
    <div className="surface p-4 sm:p-5">
      <h2 className="text-white font-bold mb-1">Atualizar Faturas</h2>
      <p className="text-zinc-500 text-xs mb-4">
        Lança automaticamente uma leitura para o acompanhamento semanal.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((card) => (
          <label key={card.id} className="field-label">
            {card.name}
            <input
              placeholder="Ex: 1200,50"
              value={values[card.id] ?? ''}
              inputMode="decimal"
              onChange={(e) =>
                handleChange(card.id, sanitizeAmountInput(e.target.value))
              }
              className="field"
            />
          </label>
        ))}
      </div>

      <button onClick={handleSave} className="btn-primary mt-4 w-full sm:w-auto">
        Salvar Faturas
      </button>
    </div>
  );
}
