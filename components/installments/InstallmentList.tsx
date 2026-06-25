'use client';

import { deleteInstallment } from '@/core/services/installment.service';
import { useToast } from '@/components/ui/ToastProvider';
import { DBInstallment } from '@/core/types/database';

type Props = {
  installments: (DBInstallment & { currentInstallment: number })[];
  onUpdated?: () => void;
};

export default function InstallmentList({ installments, onUpdated }: Props) {
  const { showToast } = useToast();

  const handleDelete = async (id: string) => {
    try {
      await deleteInstallment(id);
      showToast('Parcelamento excluído');
      onUpdated?.();
    } catch (err) {
      console.error(err);
      showToast('Erro ao excluir parcelamento', 'error');
    }
  };

  return (
    <div className="bg-zinc-900 p-4 rounded grid gap-2">
      <h2 className="font-bold text-white">Parcelas</h2>

      {installments.map((i) => {
        const progress = i.currentInstallment
          ? `${i.currentInstallment}/${i.total_installments}`
          : null;

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
