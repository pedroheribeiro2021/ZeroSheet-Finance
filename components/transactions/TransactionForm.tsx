'use client';

import { useState } from 'react';
import { createTransaction } from '@/core/services/transaction.service';
import { parseCurrencyInput } from '@/core/utils/number';
import { DEFAULT_CATEGORIES } from '@/core/constants/categories';
import { useToast } from '@/components/ui/ToastProvider';

export default function TransactionForm({ onCreated, monthId }: any) {
  const { showToast } = useToast();

  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');

  const [selectedCategory, setSelectedCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');

  const [isFixed, setIsFixed] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [isProvision, setIsProvision] = useState(false);

  const isCustom = selectedCategory === '__custom__';

  const handleSubmit = async () => {
    try {
      if (!monthId) {
        showToast('Erro: mês não carregado', 'error');
        return;
      }

      const parsedAmount = parseCurrencyInput(amount);

      const finalCategory = isCustom ? customCategory : selectedCategory;

      if (!finalCategory) {
        showToast('Informe uma categoria', 'error');
        return;
      }

      await createTransaction({
        month_id: monthId,
        amount: parsedAmount,
        type,
        category: finalCategory,
        is_fixed: isFixed,
        is_recurring: isRecurring,
        is_provision: isProvision,
        card: null,
      });

      // reset
      setAmount('');
      setSelectedCategory('');
      setCustomCategory('');
      setIsFixed(false);
      setIsRecurring(false);
      setIsProvision(false);

      showToast('Transação salva com sucesso');
      onCreated?.();
    } catch (err) {
      console.error(err);
      showToast('Erro ao salvar transação', 'error');
    }
  };

  return (
    <div className="bg-zinc-900 p-4 rounded grid gap-3">
      <h2 className="font-bold text-white">Nova Transação</h2>

      <input
        type="text"
        placeholder="Valor (ex: 1000,50)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="bg-zinc-800 p-2 rounded text-white"
      />

      {/* ✅ SELECT DE CATEGORIA */}
      <select
        value={selectedCategory}
        onChange={(e) => setSelectedCategory(e.target.value)}
        className="bg-zinc-800 p-2 rounded text-white"
      >
        <option value="">Selecione uma categoria</option>

        {DEFAULT_CATEGORIES.map((cat) => (
          <option key={cat} value={cat}>
            {cat}
          </option>
        ))}

        <option value="__custom__">Outra...</option>
      </select>

      {/* ✅ INPUT CUSTOM */}
      {isCustom && (
        <input
          type="text"
          placeholder="Digite a categoria"
          value={customCategory}
          onChange={(e) => setCustomCategory(e.target.value)}
          className="bg-zinc-800 p-2 rounded text-white"
        />
      )}

      <select
        value={type}
        onChange={(e) => setType(e.target.value as any)}
        className="bg-zinc-800 p-2 rounded text-white"
      >
        <option value="income">Entrada</option>
        <option value="expense">Despesa</option>
      </select>

      {/* FLAGS */}
      <div className="grid gap-2 text-sm text-white">
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
