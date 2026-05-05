'use client';

import { useState } from 'react';
import { createInstallment } from '@/core/services/installment.service';
import { parseCurrencyInput } from '@/core/utils/number';

export default function InstallmentForm({ onCreated }: any) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [installments, setInstallments] = useState(1);
  const [card, setCard] = useState<'nubank' | 'c6'>('c6');

  const handleSubmit = async () => {
    try {
      const total = parseCurrencyInput(amount);
      const installmentAmount = total / installments;

      await createInstallment({
        description,
        total_amount: total,
        installment_amount: installmentAmount,
        total_installments: installments,
        card,
      });

      setDescription('');
      setAmount('');
      setInstallments(1);

      onCreated?.();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="bg-zinc-900 p-4 rounded grid gap-3">
      <h2 className="text-white font-bold">Parcelamento</h2>

      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Descrição"
        className="bg-zinc-800 p-2 rounded text-white"
      />

      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Valor total"
        className="bg-zinc-800 p-2 rounded text-white"
      />

      <input
        type="number"
        value={installments}
        onChange={(e) => setInstallments(Number(e.target.value))}
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

      <button onClick={handleSubmit} className="bg-purple-600 p-2 rounded">
        Criar Parcelamento
      </button>
    </div>
  );
}
