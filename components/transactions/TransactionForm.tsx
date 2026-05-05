'use client';

import { useState } from 'react';
import { createTransaction } from '@/core/services/transaction.service';
import { parseCurrencyInput } from '@/core/utils/number';

export default function TransactionForm({ onCreated, monthId }: any) {
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [category, setCategory] = useState('');

  const [isFixed, setIsFixed] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [isProvision, setIsProvision] = useState(false);

  const handleSubmit = async () => {
    try {
      if (!monthId) {
        alert('Erro: mês não carregado');
        return;
      }

      const parsedAmount = parseCurrencyInput(amount);

      await createTransaction({
        month_id: monthId, // ✅ CORREÇÃO PRINCIPAL
        amount: parsedAmount,
        type,
        category,
        is_fixed: isFixed,
        is_recurring: isRecurring,
        is_provision: isProvision,
        card: null,
      });

      // reset
      setAmount('');
      setCategory('');
      setIsFixed(false);
      setIsRecurring(false);
      setIsProvision(false);

      onCreated?.();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="bg-zinc-900 p-4 rounded grid gap-3 text-white">
      <h2 className="font-bold">Nova Transação</h2>

      <input
        type="text"
        placeholder="Valor (ex: 1000,50)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="bg-zinc-800 p-2 rounded"
      />

      <input
        type="text"
        placeholder="Categoria (ex: Mercado, Água...)"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="bg-zinc-800 p-2 rounded"
      />

      <select
        value={type}
        onChange={(e) => setType(e.target.value as any)}
        className="bg-zinc-800 p-2 rounded"
      >
        <option value="income">Entrada</option>
        <option value="expense">Despesa</option>
      </select>

      {/* FLAGS */}
      <div className="grid gap-2 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isFixed}
            onChange={(e) => setIsFixed(e.target.checked)}
          />
          Despesa fixa
        </label>

        {isFixed && (
          <label className="flex items-center gap-2 ml-4">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
            />
            Recorrente mensal
          </label>
        )}

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isProvision}
            onChange={(e) => setIsProvision(e.target.checked)}
          />
          Provisão (planejamento)
        </label>
      </div>

      <button
        onClick={handleSubmit}
        className="bg-green-600 p-2 rounded hover:bg-green-700"
      >
        Salvar
      </button>
    </div>
  );
}
