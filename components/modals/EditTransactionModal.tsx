'use client';

import { useState } from 'react';
import { updateTransaction } from '@/core/services/transaction.service';
import { parseCurrencyInput, sanitizeAmountInput } from '@/core/utils/number';
import { useToast } from '@/components/ui/ToastProvider';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  RESERVE_CATEGORIES,
} from '@/core/constants/categories';

type Kind = 'income' | 'expense' | 'reserve';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function EditTransactionModal({
  transaction,
  onClose,
  onUpdated,
}: any) {
  const { showToast } = useToast();

  const initialKind: Kind = transaction.isReserve
    ? 'reserve'
    : transaction.type;

  const [kind, setKind] = useState<Kind>(initialKind);
  const [amount, setAmount] = useState(String(transaction.amount));
  const [category, setCategory] = useState(transaction.category);

  const [isFixed, setIsFixed] = useState(!!transaction.isFixed);
  const [isProvision, setIsProvision] = useState(!!transaction.isProvision);
  const [isReimbursement, setIsReimbursement] = useState(
    !!transaction.isReimbursement,
  );
  const [isRecurring, setIsRecurring] = useState(!!transaction.isRecurring);
  const [recurringUntil, setRecurringUntil] = useState(
    transaction.recurringUntil ? transaction.recurringUntil.slice(0, 7) : '',
  );
  const [dueDay, setDueDay] = useState(
    transaction.dueDay != null ? String(transaction.dueDay) : '',
  );

  const allCategories = Array.from(
    new Set([
      ...(kind === 'income'
        ? INCOME_CATEGORIES
        : kind === 'reserve'
          ? RESERVE_CATEGORIES
          : EXPENSE_CATEGORIES),
      category,
    ]),
  ).filter(Boolean);

  const handleSave = async () => {
    try {
      const parsedAmount = parseCurrencyInput(amount);

      if (!parsedAmount) {
        showToast('Informe um valor válido', 'error');
        return;
      }

      await updateTransaction(transaction.id, {
        amount: Math.abs(parsedAmount),
        category,
        type: kind === 'reserve' ? 'expense' : kind,
        is_fixed: kind === 'expense' && isFixed,
        is_recurring: isRecurring,
        is_provision: kind === 'expense' && isProvision,
        is_reserve: kind === 'reserve',
        is_reimbursement: kind === 'income' && isReimbursement,
        recurring_until:
          isRecurring && recurringUntil ? `${recurringUntil}-01` : null,
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-zinc-900 p-6 rounded w-full max-w-md grid gap-3 max-h-[90vh] overflow-y-auto">
        <h2 className="text-white font-bold">Editar Transação</h2>

        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as Kind)}
          className="bg-zinc-800 p-2 rounded text-white"
        >
          <option value="income">(+) Entrada</option>
          <option value="expense">(−) Despesa</option>
          <option value="reserve">(↗) Reserva</option>
        </select>

        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(sanitizeAmountInput(e.target.value))}
          placeholder="Valor"
          className="bg-zinc-800 p-2 rounded text-white"
        />

        <select
          value={allCategories.includes(category) ? category : '__custom__'}
          onChange={(e) => {
            if (e.target.value !== '__custom__') setCategory(e.target.value);
          }}
          className="bg-zinc-800 p-2 rounded text-white"
        >
          {allCategories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
          <option value="__custom__">Outra...</option>
        </select>

        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Categoria"
          className="bg-zinc-800 p-2 rounded text-white"
        />

        <div className="text-sm text-white grid gap-2">
          {kind === 'expense' && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isFixed}
                onChange={(e) => setIsFixed(e.target.checked)}
              />
              Despesa fixa
            </label>
          )}

          {kind === 'expense' && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isProvision}
                onChange={(e) => setIsProvision(e.target.checked)}
              />
              Provisão (planejamento)
            </label>
          )}

          {kind === 'income' && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isReimbursement}
                onChange={(e) => setIsReimbursement(e.target.checked)}
              />
              Reembolso (não soma nas entradas)
            </label>
          )}

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
            />
            Recorrente mensal
          </label>

          {isRecurring && (
            <div className="ml-6 grid gap-2 rounded bg-zinc-800/60 p-3">
              <label className="grid gap-1">
                Repetir até (vazio = sempre)
                <input
                  type="month"
                  value={recurringUntil}
                  onChange={(e) => setRecurringUntil(e.target.value)}
                  className="bg-zinc-900 p-2 rounded text-white"
                />
              </label>

              <label className="grid gap-1">
                Dia de vencimento (opcional)
                <input
                  type="number"
                  min={1}
                  max={31}
                  placeholder="Ex: 10"
                  value={dueDay}
                  onChange={(e) => setDueDay(e.target.value)}
                  className="bg-zinc-900 p-2 rounded text-white w-24"
                />
              </label>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-2">
          <button
            onClick={handleSave}
            className="bg-green-600 px-3 py-1 rounded text-white"
          >
            Salvar
          </button>

          <button
            onClick={onClose}
            className="bg-zinc-700 px-3 py-1 rounded text-white"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
