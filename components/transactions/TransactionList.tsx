'use client';

import { useState } from 'react';
import { deleteTransaction } from '@/core/services/transaction.service';
import EditTransactionModal from '../modals/EditTransactionModal';
import { useToast } from '@/components/ui/ToastProvider';

export default function TransactionList({ transactions, onUpdated }: any) {
  const { showToast } = useToast();
  const [selected, setSelected] = useState<any>(null);

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
      <h2 className="text-white font-bold">Transações</h2>

      {transactions.map((t: any) => (
        <div
          key={t.id}
          className="bg-zinc-800 p-3 rounded flex justify-between items-center"
        >
          <div className="text-white">
            <p className="font-bold">
              {t.category} - R$ {t.amount}
            </p>

            <div className="text-xs flex gap-2">
              {t.isFixed && <span>Fixo</span>}
              {t.isRecurring && <span>🔁</span>}
              {t.isProvision && <span>📊</span>}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setSelected(t)}
              className="bg-blue-600 px-2 py-1 rounded text-white text-xs"
            >
              Editar
            </button>

            <button
              onClick={() => handleDelete(t.id)}
              className="bg-red-600 px-2 py-1 rounded text-white text-xs"
            >
              Excluir
            </button>
          </div>
        </div>
      ))}

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
