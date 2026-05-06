'use client';

import { deleteInstallment } from '@/core/services/installment.service';

export default function InstallmentList({ installments, onUpdated }: any) {
  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(v);

  return (
    <div className="bg-zinc-900 p-4 rounded grid gap-3">
      <h2 className="font-bold text-white">Parcelamentos</h2>

      {installments.map((i: any) => (
        <div
          key={i.id}
          className="bg-zinc-800 p-3 rounded flex justify-between items-center"
        >
          <div>
            <p className="text-white font-bold">{i.name}</p>

            <p className="text-sm text-zinc-400">
              {formatCurrency(i.installment_amount)} • {i.current_installment}/
              {i.total_installments}
            </p>

            <p className="text-xs text-zinc-500">
              {i.card.toUpperCase()} {i.is_recurring && '🔁'}
            </p>
          </div>

          <button
            onClick={async () => {
              await deleteInstallment(i.id);
              onUpdated?.();
            }}
            className="text-red-400"
          >
            Excluir
          </button>
        </div>
      ))}
    </div>
  );
}
