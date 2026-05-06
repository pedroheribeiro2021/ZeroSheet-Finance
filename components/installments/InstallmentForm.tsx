'use client';

import { useState } from 'react';
import { createInstallment } from '@/core/services/installment.service';
import { parseCurrencyInput } from '@/core/utils/number';

export default function InstallmentForm({ monthId, onCreated }: any) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [totalInstallments, setTotalInstallments] = useState(1);
  const [card, setCard] = useState<'nubank' | 'c6'>('c6');

  const handleSubmit = async () => {
    try {
      const parsed = parseCurrencyInput(amount);

      await createInstallment({
        description,
        card,
        total_amount: parsed * totalInstallments,
        installment_amount: parsed,
        total_installments: totalInstallments,
        start_month_id: monthId, // ✅ CORRETO
      });

      // reset
      setDescription('');
      setAmount('');
      setTotalInstallments(1);

      onCreated?.();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="bg-zinc-900 p-4 rounded grid gap-3">
      <h2 className="font-bold text-white">Nova Parcela</h2>

      <input
        placeholder="Nome (ex: Sauipe Pass)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="bg-zinc-800 p-2 rounded text-white"
      />

      <input
        placeholder="Valor (ex: 277,92)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="bg-zinc-800 p-2 rounded text-white"
      />

      <input
        type="number"
        value={totalInstallments}
        onChange={(e) => setTotalInstallments(Number(e.target.value))}
        className="bg-zinc-800 p-2 rounded text-white"
      />

      <select
        value={card}
        onChange={(e) => setCard(e.target.value as any)}
        className="bg-zinc-800 p-2 rounded text-white"
      >
        <option value="c6">C6</option>
        <option value="nubank">Nubank</option>
      </select>

      <button
        onClick={handleSubmit}
        className="bg-blue-600 p-2 rounded hover:bg-blue-700"
      >
        Salvar
      </button>
    </div>
  );
}
