'use client';

import { useState } from 'react';
import { updateTransaction } from '@/core/services/transaction.service';
import { parseCurrencyInput } from '@/core/utils/number';
import { useToast } from '@/components/ui/ToastProvider';

export default function EditTransactionModal({
  transaction,
  onClose,
  onUpdated,
}: any) {
  const { showToast } = useToast();
  const [amount, setAmount] = useState(String(transaction.amount));
  const [category, setCategory] = useState(transaction.category);
  const [type, setType] = useState(transaction.type);

  const [isFixed, setIsFixed] = useState(transaction.isFixed);
  const [isRecurring, setIsRecurring] = useState(transaction.isRecurring);
  const [isProvision, setIsProvision] = useState(transaction.isProvision);
  const [dueDay, setDueDay] = useState(
    transaction.dueDay != null ? String(transaction.dueDay) : '',
  );

  const handleSave = async () => {
    try {
      const parsedAmount = parseCurrencyInput(amount);

      await updateTransaction(transaction.id, {
        amount: parsedAmount,
        category,
        type,
        is_fixed: isFixed,
        is_recurring: isRecurring,
        is_provision: isProvision,
        due_day: isRecurring && dueDay ? Number(dueDay) : null,
      });

      showToast('Transação atualizada com sucesso');
      onUpdated?.();
      onClose();
    } catch (err) {
      console.error(err);
      showToast('Erro ao atualizar transação', 'error');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center">
      <div className="bg-zinc-900 p-6 rounded w-full max-w-md grid gap-3">
        <h2 className="text-white font-bold">Editar Transação</h2>

        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="bg-zinc-800 p-2 rounded text-white"
        />

        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="bg-zinc-800 p-2 rounded text-white"
        />

        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="bg-zinc-800 p-2 rounded text-white"
        >
          <option value="income">Entrada</option>
          <option value="expense">Despesa</option>
        </select>

        <div className="text-sm text-white grid gap-2">
          <label>
            <input
              type="checkbox"
              checked={isFixed}
              onChange={(e) => setIsFixed(e.target.checked)}
            />{' '}
            Fixo
          </label>

          {isFixed && (
            <label>
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
              />{' '}
              Recorrente
            </label>
          )}

          {isFixed && isRecurring && (
            <label className="grid gap-1">
              Dia de vencimento (opcional)
              <input
                type="number"
                min={1}
                max={31}
                placeholder="Ex: 10"
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
                className="bg-zinc-800 p-2 rounded text-white w-24"
              />
            </label>
          )}

          <label>
            <input
              type="checkbox"
              checked={isProvision}
              onChange={(e) => setIsProvision(e.target.checked)}
            />{' '}
            Provisão
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
