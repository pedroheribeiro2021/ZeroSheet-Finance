'use client';

import { useState } from 'react';

import { updateCard } from '@/core/services/card.service';
import { parseCurrencyInput } from '@/core/utils/number';
import { useToast } from '@/components/ui/ToastProvider';

export default function EditCardModal({ card, onClose, onUpdated }: any) {
  const { showToast } = useToast();

  const [name, setName] = useState(card.name);
  const [closingDay, setClosingDay] = useState(card.closing_day ?? 1);
  const [dueDay, setDueDay] = useState(card.due_day ?? 10);
  const [color, setColor] = useState(card.color ?? '#2563eb');
  const [limitAmount, setLimitAmount] = useState(
    card.limit_amount != null ? String(card.limit_amount) : '',
  );

  const handleSave = async () => {
    try {
      await updateCard(card.id, {
        name,
        slug: name.toLowerCase().trim().replace(/\s+/g, '-'),
        closing_day: closingDay,
        due_day: dueDay,
        color,
        limit_amount: limitAmount
          ? parseCurrencyInput(limitAmount)
          : undefined,
      });

      showToast('Cartão atualizado com sucesso');
      onUpdated?.();
      onClose();
    } catch (err) {
      console.error(err);
      showToast('Erro ao atualizar cartão', 'error');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-zinc-900 p-6 rounded w-full max-w-md grid gap-3">
        <h2 className="text-white font-bold">Editar Cartão</h2>

        <label className="grid gap-1 text-sm text-zinc-400">
          Nome do cartão
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-zinc-800 p-2 rounded text-white"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1 text-sm text-zinc-400">
            Dia de fechamento
            <input
              type="number"
              min={1}
              max={31}
              value={closingDay}
              onChange={(e) => setClosingDay(Number(e.target.value))}
              className="bg-zinc-800 p-2 rounded text-white"
            />
          </label>

          <label className="grid gap-1 text-sm text-zinc-400">
            Dia de vencimento
            <input
              type="number"
              min={1}
              max={31}
              value={dueDay}
              onChange={(e) => setDueDay(Number(e.target.value))}
              className="bg-zinc-800 p-2 rounded text-white"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1 text-sm text-zinc-400">
            Limite do cartão
            <input
              value={limitAmount}
              onChange={(e) => setLimitAmount(e.target.value)}
              className="bg-zinc-800 p-2 rounded text-white"
            />
          </label>

          <label className="grid gap-1 text-sm text-zinc-400">
            Cor
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="bg-zinc-800 h-10 rounded"
            />
          </label>
        </div>

        <div className="flex gap-2 mt-2">
          <button
            onClick={handleSave}
            className="bg-green-600 px-3 py-1 rounded"
          >
            Salvar
          </button>

          <button onClick={onClose} className="bg-zinc-700 px-3 py-1 rounded">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
