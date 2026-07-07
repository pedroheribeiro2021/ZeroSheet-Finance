'use client';

import { useEffect, useState } from 'react';
import { createTransaction } from '@/core/services/transaction.service';
import { getCards } from '@/core/services/card.service';
import { DBCard } from '@/core/types/database';
import { parseCurrencyInput, sanitizeAmountInput } from '@/core/utils/number';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  RESERVE_CATEGORIES,
} from '@/core/constants/categories';
import { useToast } from '@/components/ui/ToastProvider';
import { resolveSplitAmount } from '@/core/engine/split';
import { recurringUntilFromMonths } from '@/core/engine/recurrence';

type Kind = 'income' | 'expense' | 'reserve';

type Props = {
  monthId: string;
  /** Competência ativa — usada para calcular o fim da recorrência. */
  month?: { month: number; year: number } | null;
  onCreated?: () => void;
};

const KIND_OPTIONS: { value: Kind; label: string; hint: string }[] = [
  { value: 'expense', label: '(−) Despesa', hint: 'Sai do orçamento' },
  { value: 'income', label: '(+) Entrada', hint: 'Soma ao orçamento' },
  {
    value: 'reserve',
    label: '(↗) Reserva',
    hint: 'Não é gasto: vai para poupança/investimento, mas abate das entradas',
  },
];

export default function TransactionForm({ monthId, month, onCreated }: Props) {
  const { showToast } = useToast();

  const [kind, setKind] = useState<Kind>('expense');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [cards, setCards] = useState<DBCard[]>([]);
  const [cardId, setCardId] = useState('');
  const [isSplit, setIsSplit] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');

  const [isFixed, setIsFixed] = useState(false);
  const [isProvision, setIsProvision] = useState(false);
  const [isReimbursement, setIsReimbursement] = useState(false);

  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceMode, setRecurrenceMode] = useState<
    'forever' | 'months' | 'until'
  >('forever');
  const [recurrenceMonths, setRecurrenceMonths] = useState('12');
  const [recurrenceUntil, setRecurrenceUntil] = useState('');
  const [dueDay, setDueDay] = useState('');

  const isCustom = selectedCategory === '__custom__';

  useEffect(() => {
    getCards()
      .then(setCards)
      .catch(() => setCards([]));
  }, []);

  const categories =
    kind === 'income'
      ? INCOME_CATEGORIES
      : kind === 'reserve'
        ? RESERVE_CATEGORIES
        : EXPENSE_CATEGORIES;

  const changeKind = (k: Kind) => {
    setKind(k);
    setSelectedCategory(k === 'reserve' ? RESERVE_CATEGORIES[0] : '');
    setIsFixed(false);
    setIsProvision(false);
    setIsReimbursement(false);
    setIsSplit(false);
  };

  const computeRecurringUntil = (): string | null => {
    if (!isRecurring) return null;

    if (recurrenceMode === 'months') {
      const n = Number(recurrenceMonths);
      if (!n || n < 1) return null;
      const base = month ?? {
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
      };
      return recurringUntilFromMonths(base.year, base.month, n);
    }

    if (recurrenceMode === 'until' && recurrenceUntil) {
      return `${recurrenceUntil}-01`;
    }

    return null; // para sempre
  };

  const handleSubmit = async () => {
    try {
      if (!monthId) {
        showToast('Erro: mês não carregado', 'error');
        return;
      }

      const parsedAmount = parseCurrencyInput(amount);

      if (!parsedAmount) {
        showToast('Informe um valor válido', 'error');
        return;
      }

      const finalCategory = isCustom ? customCategory : selectedCategory;

      if (!finalCategory) {
        showToast('Informe uma categoria', 'error');
        return;
      }

      // Split: o sinal do valor decide o tipo (só p/ entrada/despesa).
      const resolved =
        isSplit && kind !== 'reserve'
          ? resolveSplitAmount(parsedAmount)
          : {
              type: kind === 'reserve' ? ('expense' as const) : kind,
              amount: Math.abs(parsedAmount),
            };

      await createTransaction({
        month_id: monthId,
        amount: resolved.amount,
        type: resolved.type,
        category: finalCategory,
        is_fixed: kind === 'expense' && isFixed,
        is_recurring: isRecurring,
        is_provision: kind === 'expense' && isProvision,
        is_reserve: kind === 'reserve',
        is_reimbursement: kind === 'income' && isReimbursement,
        recurring_until: computeRecurringUntil(),
        due_day: isRecurring && dueDay ? Number(dueDay) : null,
        description: description || null,
        card: kind === 'expense' && cardId ? cardId : null,
      });

      // reset
      setDescription('');
      setCardId('');
      setAmount('');
      setSelectedCategory(kind === 'reserve' ? RESERVE_CATEGORIES[0] : '');
      setCustomCategory('');
      setIsFixed(false);
      setIsProvision(false);
      setIsReimbursement(false);
      setIsRecurring(false);
      setRecurrenceMode('forever');
      setRecurrenceUntil('');
      setDueDay('');
      setIsSplit(false);

      showToast('Transação salva com sucesso');
      onCreated?.();
    } catch (err) {
      console.error(err);
      showToast('Erro ao salvar transação', 'error');
    }
  };

  return (
    <div className="surface grid gap-3 p-4 sm:p-5">
      <h2 className="font-bold text-white">Nova Transação</h2>

      {/* TIPO */}
      <div className="grid grid-cols-3 gap-2">
        {KIND_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => changeKind(opt.value)}
            title={opt.hint}
            className={`min-h-[44px] rounded-xl p-2 text-sm font-semibold transition active:scale-[0.97] ${
              kind === opt.value
                ? opt.value === 'income'
                  ? 'bg-green-600 text-white shadow-md shadow-green-950/40'
                  : opt.value === 'reserve'
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-950/40'
                    : 'bg-red-600 text-white shadow-md shadow-red-950/40'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-zinc-500">
        {KIND_OPTIONS.find((o) => o.value === kind)?.hint}
      </p>

      <input
        type="text"
        placeholder="Descrição (opcional — ex: Claude, Netflix, Conta de luz)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="field"
      />

      <input
        type="text"
        inputMode="decimal"
        placeholder={
          isSplit ? 'Valor (+/-, ex: -63,56 ou +51,00)' : 'Valor (ex: 1000,50)'
        }
        value={amount}
        onChange={(e) =>
          setAmount(sanitizeAmountInput(e.target.value, isSplit))
        }
        className="field"
      />

      {kind !== 'reserve' && (
        <label className="flex items-center gap-2 text-sm text-white">
          <input
            type="checkbox"
            checked={isSplit}
            onChange={(e) => setIsSplit(e.target.checked)}
          />
          Split (+/-): o sinal do valor decide se soma ou subtrai
        </label>
      )}

      {/* CATEGORIA */}
      <select
        value={selectedCategory}
        onChange={(e) => setSelectedCategory(e.target.value)}
        className="field"
      >
        <option value="">Selecione uma categoria</option>

        {categories.map((cat) => (
          <option key={cat} value={cat}>
            {cat}
          </option>
        ))}

        <option value="__custom__">Outra...</option>
      </select>

      {kind === 'expense' && cards.length > 0 && (
        <label className="grid gap-1 text-sm text-zinc-400">
          Pago no cartão de crédito? (compõe a fatura — não conta duas vezes)
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

      {isCustom && (
        <input
          type="text"
          placeholder="Digite a categoria"
          value={customCategory}
          onChange={(e) => setCustomCategory(e.target.value)}
          className="field"
        />
      )}

      {/* FLAGS */}
      <div className="grid gap-2 text-sm text-white">
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
            Provisão (planejamento — os gastos reais da mesma categoria abatem
            deste valor)
          </label>
        )}

        {kind === 'income' && (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isReimbursement}
              onChange={(e) => setIsReimbursement(e.target.checked)}
            />
            Reembolso (aparece no resumo, mas não soma nas entradas)
          </label>
        )}

        {/* RECORRÊNCIA — disponível para entrada, despesa e reserva */}
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isRecurring}
            onChange={(e) => setIsRecurring(e.target.checked)}
          />
          Recorrente mensal (copiada automaticamente para os próximos meses)
        </label>

        {isRecurring && (
          <div className="ml-1 grid gap-2.5 rounded-xl border border-white/[0.04] bg-black/20 p-3 sm:ml-6">
            <p className="text-zinc-400 text-xs">Repetir por quanto tempo?</p>

            <label className="flex flex-wrap items-center gap-2">
              <input
                type="radio"
                name="recurrence-mode"
                checked={recurrenceMode === 'forever'}
                onChange={() => setRecurrenceMode('forever')}
              />
              Sempre (até eu remover)
            </label>

            <label className="flex flex-wrap items-center gap-2">
              <input
                type="radio"
                name="recurrence-mode"
                checked={recurrenceMode === 'months'}
                onChange={() => setRecurrenceMode('months')}
              />
              Por
              <input
                type="number"
                min={1}
                max={120}
                value={recurrenceMonths}
                onChange={(e) => setRecurrenceMonths(e.target.value)}
                onFocus={() => setRecurrenceMode('months')}
                className="field-sm w-16 text-center"
              />
              meses (contando este)
            </label>

            <label className="flex flex-wrap items-center gap-2">
              <input
                type="radio"
                name="recurrence-mode"
                checked={recurrenceMode === 'until'}
                onChange={() => setRecurrenceMode('until')}
              />
              Até
              <input
                type="month"
                value={recurrenceUntil}
                onChange={(e) => setRecurrenceUntil(e.target.value)}
                onFocus={() => setRecurrenceMode('until')}
                className="field-sm"
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
                className="field-sm w-24"
              />
            </label>
          </div>
        )}
      </div>

      <button onClick={handleSubmit} className="btn-success">
        Salvar
      </button>
    </div>
  );
}
