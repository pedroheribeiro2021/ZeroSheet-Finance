'use client';

import { useState } from 'react';
import { upsertCardSnapshot } from '@/core/services/cardSnapshot.service';

export default function CardSnapshotForm({
  monthId,
  onUpdated,
}: {
  monthId: string;
  onUpdated: () => void;
}) {
  const [nubank, setNubank] = useState('');
  const [c6, setC6] = useState('');

  const handleSave = async () => {
    try {
      if (nubank) {
        await upsertCardSnapshot(monthId, 'nubank', Number(nubank));
      }

      if (c6) {
        await upsertCardSnapshot(monthId, 'c6', Number(c6));
      }

      setNubank('');
      setC6('');

      onUpdated();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="bg-zinc-900 p-4 rounded mb-4">
      <h2 className="text-white font-bold mb-2">Atualizar Faturas</h2>

      <div className="grid grid-cols-2 gap-2">
        <input
          placeholder="Nubank"
          value={nubank}
          onChange={(e) => setNubank(e.target.value)}
          className="p-2 rounded bg-zinc-800 text-white"
        />

        <input
          placeholder="C6"
          value={c6}
          onChange={(e) => setC6(e.target.value)}
          className="p-2 rounded bg-zinc-800 text-white"
        />
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
