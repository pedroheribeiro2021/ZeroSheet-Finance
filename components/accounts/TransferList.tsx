'use client';

import { deleteTransfer } from '@/core/services/transfer.service';
import { formatBRL } from '@/core/utils/number';
import { useToast } from '@/components/ui/ToastProvider';
import { DBAccount, DBTransfer } from '@/core/types/database';
import { PendingReturn } from '@/core/engine/accounts';

type Props = {
  transfers: DBTransfer[];
  accounts: DBAccount[];
  openComplements: PendingReturn[];
  onUpdated: () => void;
};

const KIND_BADGE: Record<DBTransfer['kind'], string> = {
  complemento: 'bg-indigo-500/15 text-indigo-400',
  devolucao: 'bg-green-500/15 text-green-400',
  movimentacao: 'bg-zinc-700/50 text-zinc-300',
};

const KIND_LABEL: Record<DBTransfer['kind'], string> = {
  complemento: 'Complemento',
  devolucao: 'Devolução',
  movimentacao: 'Movimentação',
};

export default function TransferList({ transfers, accounts, openComplements, onUpdated }: Props) {
  const { showToast } = useToast();

  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? '?';

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja remover essa transferência?')) return;

    try {
      await deleteTransfer(id);
      showToast('Transferência removida');
      onUpdated();
    } catch (err) {
      console.error(err);
      showToast('Erro ao remover transferência', 'error');
    }
  };

  return (
    <div className="surface grid gap-3 p-4 sm:p-5">
      <h2 className="text-white font-bold text-lg">Transferências do mês</h2>

      {transfers.length === 0 && (
        <p className="text-zinc-400">Nenhuma transferência lançada neste mês.</p>
      )}

      {transfers.map((t) => {
        const pending =
          t.kind === 'complemento'
            ? openComplements.find((c) => c.complementId === t.id)
            : undefined;

        return (
          <div
            key={t.id}
            className="surface-row flex flex-col gap-1.5 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="text-white font-medium flex flex-wrap items-center gap-1.5">
                {accountName(t.from_account_id)} → {accountName(t.to_account_id)}
                <span className={`badge ${KIND_BADGE[t.kind]}`}>{KIND_LABEL[t.kind]}</span>
                {pending && (
                  <span className="badge bg-amber-500/15 text-amber-400">
                    falta devolver {formatBRL(pending.amount)}
                  </span>
                )}
              </p>
              <p className="text-zinc-400 text-sm">
                {new Date(t.transferred_at).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                {t.note ? ` • ${t.note}` : ''}
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <span className="text-white font-bold shrink-0">{formatBRL(Number(t.amount))}</span>
              <button
                onClick={() => handleDelete(t.id)}
                className="btn-ghost text-red-400 hover:text-red-300 shrink-0"
              >
                Remover
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
