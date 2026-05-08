'use client';

import { deleteInstallment } from '@/core/services/installment.service';

export default function InstallmentList({
  installments,
  months,
  currentMonthId,
  onUpdated,
}: any) {
  const handleDelete = async (id: string) => {
    try {
      await deleteInstallment(id);
      onUpdated?.();
    } catch (err) {
      console.error(err);
    }
  };

  const getInstallmentProgress = (installment: any) => {
    const currentIndex = months.findIndex((m: any) => m.id === currentMonthId);

    const startIndex = months.findIndex(
      (m: any) => m.id === installment.start_month_id,
    );

    if (currentIndex === -1 || startIndex === -1) return null;

    const currentInstallment = currentIndex - startIndex + 1;

    return `${currentInstallment}/${installment.total_installments}`;
  };

  return (
    <div className="bg-zinc-900 p-4 rounded grid gap-2">
      <h2 className="font-bold text-white">Parcelas</h2>

      {installments.map((i: any) => {
        const progress = getInstallmentProgress(i);

        return (
          <div
            key={i.id}
            className="flex justify-between items-center bg-zinc-800 p-2 rounded"
          >
            <div>
              <p className="text-white font-medium">
                {i.description}{' '}
                {progress && (
                  <span className="text-zinc-400 text-sm">({progress})</span>
                )}
              </p>

              <p className="text-zinc-400 text-sm">
                R$ {Number(i.installment_amount).toFixed(2)} • {i.cards?.name}
              </p>
            </div>

            <button
              onClick={() => handleDelete(i.id)}
              className="text-red-500 hover:text-red-700 text-sm"
            >
              Remover
            </button>
          </div>
        );
      })}
    </div>
  );
}
