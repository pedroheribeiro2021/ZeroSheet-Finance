'use client';

import { deleteInstallment } from '@/core/services/installment.service';
import type { ActiveInstallment } from '@/core/services/installment.service';
import { useToast } from '@/components/ui/ToastProvider';
import { formatBRL } from '@/core/utils/number';

type Props = {
  installments: ActiveInstallment[];
  onUpdated?: () => void;
};

function monthLabel(m: { month: number; year: number } | null): string | null {
  if (!m) return null;
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'short',
    year: 'numeric',
  }).format(new Date(m.year, m.month - 1, 1));
}

function endLabel(
  start: { month: number; year: number } | null,
  totalInstallments: number,
): string | null {
  if (!start) return null;
  const d = new Date(start.year, start.month - 1 + totalInstallments - 1, 1);
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export default function InstallmentList({ installments, onUpdated }: Props) {
  const { showToast } = useToast();

  const handleDelete = async (id: string) => {
    const confirmDelete = confirm('Deseja excluir esse parcelamento?');
    if (!confirmDelete) return;

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
      <h2 className="font-bold text-white">Parcelamentos ativos no mês</h2>

      {installments.length === 0 && (
        <p className="text-zinc-500 text-sm">
          Nenhum parcelamento ativo neste mês.
        </p>
      )}

      {installments.map((i) => {
        const start = monthLabel(i.startMonth);
        const end = endLabel(i.startMonth, i.total_installments);

        return (
          <div
            key={i.id}
            className="flex justify-between items-center bg-zinc-800 p-3 rounded border-l-4 border-orange-500 gap-3"
          >
            <div className="min-w-0">
              <p className="text-white font-medium truncate">
                {i.description}{' '}
                <span className="text-orange-400 font-bold">
                  − {formatBRL(Number(i.installment_amount))}/mês
                </span>
              </p>

              <div className="text-xs flex gap-1.5 flex-wrap mt-1">
                <span className="bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded font-medium">
                  Parcela vigente: {i.currentInstallment}/
                  {i.total_installments}
                </span>
                {start && (
                  <span className="bg-zinc-600/40 text-zinc-300 px-1.5 py-0.5 rounded">
                    Início: {start}
                  </span>
                )}
                {end && (
                  <span className="bg-zinc-600/40 text-zinc-300 px-1.5 py-0.5 rounded">
                    Última parcela: {end}
                  </span>
                )}
                {i.cards?.name && (
                  <span className="bg-zinc-600/40 text-zinc-300 px-1.5 py-0.5 rounded">
                    💳 {i.cards.name}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={() => handleDelete(i.id)}
              className="bg-red-600 px-2 py-1 rounded text-white text-xs hover:bg-red-700 shrink-0"
            >
              Excluir
            </button>
          </div>
        );
      })}
    </div>
  );
}
