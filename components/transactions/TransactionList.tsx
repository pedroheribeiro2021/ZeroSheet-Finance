'use client';

import { Transaction } from '@/core/types/finance';

export default function TransactionList({
  transactions,
}: {
  transactions: Transaction[];
}) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (!transactions.length) {
    return (
      <div className="text-zinc-400 text-sm">Nenhuma transação cadastrada</div>
    );
  }

  return (
    <div className="bg-zinc-900 p-4 rounded grid gap-2">
      <h2 className="font-bold mb-2">Transações</h2>

      {transactions.map((t) => (
        <div
          key={t.id}
          className="flex justify-between items-center bg-zinc-800 p-2 rounded"
        >
          <div className="flex flex-col">
            <span className="font-medium">{t.category}</span>

            {/* ✅ FLAGS AQUI */}
            <div className="flex gap-2 text-xs text-zinc-400">
              {t.isFixed && <span>📌 Fixo</span>}
              {t.isRecurring && <span>🔁 Recorrente</span>}
              {t.isProvision && <span>📊 Provisão</span>}
            </div>
          </div>

          <span
            className={t.type === 'income' ? 'text-green-500' : 'text-red-500'}
          >
            {t.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}
          </span>
        </div>
      ))}
    </div>
  );
}
