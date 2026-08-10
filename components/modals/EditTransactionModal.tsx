'use client';

import { useEffect, useState } from 'react';
import { updateTransaction } from '@/core/services/transaction.service';
import { getCards } from '@/core/services/card.service';
import { DBCard } from '@/core/types/database';
import { parseCurrencyInput, sanitizeAmountInput } from '@/core/utils/number';
import { useToast } from '@/components/ui/ToastProvider';
import Modal from '@/components/ui/Modal';
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
  const [description, setDescription] = useState(transaction.description ?? '');
  const [amount, setAmount] = useState(String(transaction.amount));
  const [category, setCategory] = useState(transaction.category);
  const [cards, setCards] = useState<DBCard[]>([]);
  const [cardId, setCardId] = useState(transaction.card ?? '');

  useEffect(() => {
    getCards()
      .then(setCards)
      .catch(() => setCards([]));
  }, []);

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
        description: description || null,
        card: kind === 'expense' && cardId ? cardId : null,
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
    <Modal open onClose={onClose} title="Editar Transação">
      <div className="grid gap-3">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as Kind)}
          className="field"
        >
          <option value="income">(+) Entrada</option>
          <option value="expense">(−) Despesa</option>
          <option value="reserve">(↗) Reserva</option>
        </select>

        <input
          placeholder="Descrição (opcional — ex: Claude, Netflix)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="field"
        />

        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(sanitizeAmountInput(e.target.value))}
          placeholder="Valor"
          className="field"
        />

        <select
          value={allCategories.includes(category) ? category : '__custom__'}
          onChange={(e) => {
            if (e.target.value !== '__custom__') setCategory(e.target.value);
          }}
          className="field"
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
          className="field"
        />

        {kind === 'expense' && cards.length > 0 && (
          <label className="field-label">
            Pago no cartão de crédito? (compõe a fatura)
            <select
              value={cardId}
              onChange={(e) => setCardId(e.target.value)}
              className="field"
            >
              <option value="">Não (boleto/débito/pix)</option>
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  💳 {c.name}
                </option>
              ))}
            </select>
          </label>
        )}

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
              Reembolso (soma nas entradas — só não é usado para descobrir o dia
              do salário)
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
            <div className="ml-1 grid gap-2.5 rounded-xl border border-white/[0.04] bg-black/20 p-3 sm:ml-6">
              <label className="grid gap-1">
                Repetir até (vazio = sempre)
                <input
                  type="month"
                  value={recurringUntil}
                  onChange={(e) => setRecurringUntil(e.target.value)}
                  className="field-sm"
                />
              </label>

              <label className="grid gap-1">
                {kind === 'income'
                  ? 'Dia do recebimento (opcional)'
                  : 'Dia de vencimento (opcional)'}
                <input
                  type="number"
                  min={1}
                  max={31}
                  placeholder={kind === 'income' ? 'Ex: 15' : 'Ex: 10'}
                  value={dueDay}
                  onChange={(e) => setDueDay(e.target.value)}
                  className="field-sm w-24"
                />
                {kind === 'income' && (
                  <span className="text-zinc-500 text-xs">
                    Dia em que a entrada cai — define o card “Cobertura até o
                    salário”. Não vira conta a pagar.
                  </span>
                )}
              </label>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-2">
          <button onClick={handleSave} className="btn-success flex-1">
            Salvar
          </button>

          <button onClick={onClose} className="btn-secondary flex-1">
            Cancelar
          </button>
        </div>
      </div>
    </Modal>
  );
}
