'use client';

import { useState } from 'react';

import { createCard } from '@/core/services/card.service';
import { parseCurrencyInput } from '@/core/utils/number';
import { useToast } from '@/components/ui/ToastProvider';

export default function CardForm({ onCreated }: { onCreated?: () => void }) {
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [closingDay, setClosingDay] = useState(1);
  const [dueDay, setDueDay] = useState(10);
  const [color, setColor] = useState('#2563eb');
  const [limitAmount, setLimitAmount] = useState('');

  const handleSubmit = async () => {
    try {
      if (!name) return;

      await createCard({
        name,
        slug: name.toLowerCase().trim().replace(/\s+/g, '-'),
        closing_day: closingDay,
        due_day: dueDay,
        color,
        limit_amount: limitAmount
          ? parseCurrencyInput(limitAmount)
          : undefined,
      });

      setName('');
      setClosingDay(1);
      setDueDay(10);
      setColor('#2563eb');
      setLimitAmount('');

      showToast('Cartão criado com sucesso');
      onCreated?.();
    } catch (err) {
      console.error(err);
      showToast('Erro ao criar cartão', 'error');
    }
  };

  return (
    <div className="bg-zinc-900 p-4 rounded grid gap-3">
      <h2 className="text-white font-bold">Novo Cartão</h2>

      <label className="grid gap-1 text-sm text-zinc-400">
        Nome do cartão
        <input
          placeholder="Ex: Nubank"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="bg-zinc-800 p-2 rounded text-white"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1 text-sm text-zinc-400">
          Dia de fechamento da fatura
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
            placeholder="Ex: 5000,00"
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

      <button
        onClick={handleSubmit}
        className="bg-blue-600 p-2 rounded text-white"
      >
        Salvar Cartão
      </button>
    </div>
  );
}
