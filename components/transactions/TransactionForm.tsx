'use client';

import { useState } from 'react';
import { createTransaction } from '@/core/services/transaction.service';
import { getMonths } from '@/core/services/month.service';

export default function TransactionForm({
  onCreated,
}: {
  onCreated: () => void;
}) {
  const [type, setType] = useState<'income' | 'expense'>('income');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const months = await getMonths();
    const latestMonth = months[months.length - 1];

    if (!latestMonth) {
      alert('Crie um mês primeiro');
      return;
    }

    await createTransaction({
      month_id: latestMonth.id,
      type,
      category,
      amount: Number(amount),
      is_fixed: false,
    });

    setCategory('');
    setAmount('');

    onCreated();
  };

  return (
    <form onSubmit={handleSubmit} className="bg-zinc-900 p-4 rounded-2xl mb-4">
      <h2 className="text-white font-bold mb-2">Nova Transação</h2>

      <select
        className="w-full mb-2 p-2 bg-zinc-800 text-white rounded"
        value={type}
        onChange={(e) => setType(e.target.value as any)}
      >
        <option value="income">Receita</option>
        <option value="expense">Despesa</option>
      </select>

      <input
        className="w-full mb-2 p-2 bg-zinc-800 text-white rounded"
        placeholder="Categoria"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
      />

      <input
        className="w-full mb-2 p-2 bg-zinc-800 text-white rounded"
        placeholder="Valor"
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />

      <button className="w-full bg-blue-600 text-white p-2 rounded">
        Salvar
      </button>
    </form>
  );
}
