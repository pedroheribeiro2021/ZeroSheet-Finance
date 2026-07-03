'use client';

import { useMemo, useState } from 'react';
import { deleteTransaction } from '@/core/services/transaction.service';
import EditTransactionModal from '../modals/EditTransactionModal';
import { useToast } from '@/components/ui/ToastProvider';
import { formatBRL } from '@/core/utils/number';
import { Transaction } from '@/core/types/finance';

type SortMode = 'entradas-primeiro' | 'recentes' | 'maior-valor' | 'categoria';

const SORT_LABELS: Record<SortMode, string> = {
  'entradas-primeiro': 'Entradas primeiro',
  recentes: 'Mais recentes',
  'maior-valor': 'Maior valor',
  categoria: 'Categoria (A→Z)',
};

/** entrada = 0, reserva = 1, despesa = 2 — define o agrupamento padrão */
function kindRank(t: Transaction): number {
  if (t.type === 'income') return 0;
  if (t.isReserve) return 1;
  return 2;
}

function formatUntil(recurringUntil?: string | null): string {
  if (!recurringUntil) return 'sempre';
  const [y, m] = recurringUntil.split('-').map(Number);
  const label = new Intl.DateTimeFormat('pt-BR', {
    month: 'short',
    year: 'numeric',
  }).format(new Date(y, (m ?? 1) - 1, 1));
  return `até ${label}`;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function TransactionList({ transactions, onUpdated }: any) {
  const { showToast } = useToast();
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('entradas-primeiro');

  const sorted = useMemo(() => {
    const list = [...(transactions as Transaction[])];

    switch (sortMode) {
      case 'entradas-primeiro':
        return list.sort(
          (a, b) =>
            kindRank(a) - kindRank(b) ||
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
      case 'maior-valor':
        return list.sort((a, b) => b.amount - a.amount);
      case 'categoria':
        return list.sort((a, b) =>
          a.category.localeCompare(b.category, 'pt-BR'),
        );
      case 'recentes':
      default:
        return list.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
    }
  }, [transactions, sortMode]);

  const handleDelete = async (id: string) => {
    const confirmDelete = confirm('Deseja excluir essa transação?');

    if (!confirmDelete) return;

    try {
      await deleteTransaction(id);
      showToast('Transação excluída');
      onUpdated?.();
    } catch (err) {
      console.error(err);
      showToast('Erro ao excluir transação', 'error');
    }
  };

  return (
    <div className="bg-zinc-900 p-4 rounded grid gap-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-white font-bold">Transações</h2>

        <label className="flex items-center gap-2 text-xs text-zinc-400">
          Ordenar por
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="bg-zinc-800 p-1.5 rounded text-white text-xs"
          >
            {Object.entries(SORT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {sorted.length === 0 && (
        <p className="text-zinc-500 text-sm">Nenhuma transação neste mês.</p>
      )}

      {sorted.map((t) => {
        const isIncome = t.type === 'income';
        const isReserve = !!t.isReserve;

        const borderColor = isIncome
          ? 'border-green-500'
          : isReserve
            ? 'border-sky-500'
            : 'border-red-500';

        const amountColor = isIncome
          ? 'text-green-400'
          : isReserve
            ? 'text-sky-400'
            : 'text-red-400';

        const sign = isIncome ? '+' : '−';

        return (
          <div
            key={t.id}
            className={`bg-zinc-800 p-3 rounded flex justify-between items-center gap-3 border-l-4 ${borderColor}`}
          >
            <div className="min-w-0">
              <p className="text-white font-bold truncate">
                {t.category}{' '}
                <span className={`${amountColor} font-bold`}>
                  {sign} {formatBRL(t.amount)}
                </span>
              </p>

              <div className="text-xs flex gap-1.5 flex-wrap mt-1">
                {t.isProvision && (
                  <span className="bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-medium">
                    Provisão
                  </span>
                )}
                {isReserve && (
                  <span className="bg-sky-500/20 text-sky-400 px-1.5 py-0.5 rounded font-medium">
                    Reserva
                  </span>
                )}
                {t.isReimbursement && (
                  <span className="bg-zinc-600/40 text-zinc-300 px-1.5 py-0.5 rounded font-medium">
                    Reembolso
                  </span>
                )}
                {t.isFixed && (
                  <span className="bg-zinc-600/40 text-zinc-300 px-1.5 py-0.5 rounded font-medium">
                    Fixo
                  </span>
                )}
                {t.isRecurring && (
                  <span className="bg-violet-500/20 text-violet-400 px-1.5 py-0.5 rounded font-medium">
                    🔁 {formatUntil(t.recurringUntil)}
                    {t.dueDay ? ` • vence dia ${t.dueDay}` : ''}
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => setSelected(t)}
                className="bg-blue-600 px-2 py-1 rounded text-white text-xs hover:bg-blue-700"
              >
                Editar
              </button>

              <button
                onClick={() => handleDelete(t.id)}
                className="bg-red-600 px-2 py-1 rounded text-white text-xs hover:bg-red-700"
              >
                Excluir
              </button>
            </div>
          </div>
        );
      })}

      {selected && (
        <EditTransactionModal
          transaction={selected}
          onClose={() => setSelected(null)}
          onUpdated={onUpdated}
        />
      )}
    </div>
  );
}
