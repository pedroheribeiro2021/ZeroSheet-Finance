'use client';

import { useState } from 'react';

import { createCard } from '@/core/services/card.service';

export default function CardForm({ onCreated }: { onCreated?: () => void }) {
  const [name, setName] = useState('');
  const [closingDay, setClosingDay] = useState(1);

  const handleSubmit = async () => {
    try {
      if (!name) return;

      await createCard({
        name,
        slug: name.toLowerCase().trim().replace(/\s+/g, '-'),

        closing_day: closingDay,
      });

      setName('');
      setClosingDay(1);

      onCreated?.();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="bg-zinc-900 p-4 rounded grid gap-3">
      <h2 className="text-white font-bold">Novo Cartão</h2>

      <input
        placeholder="Nome do cartão"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="bg-zinc-800 p-2 rounded text-white"
      />

      <input
        type="number"
        min={1}
        max={31}
        value={closingDay}
        onChange={(e) => setClosingDay(Number(e.target.value))}
        className="bg-zinc-800 p-2 rounded text-white"
      />

      <button
        onClick={handleSubmit}
        className="bg-blue-600 p-2 rounded text-white"
      >
        Salvar Cartão
      </button>
    </div>
  );
}
