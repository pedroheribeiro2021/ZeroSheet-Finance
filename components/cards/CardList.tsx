'use client';

import { useState } from 'react';

import { deleteCard, setPrimaryCard } from '@/core/services/card.service';
import EditCardModal from '../modals/EditCardModal';
import { useToast } from '@/components/ui/ToastProvider';
import { DBCard, DBCardSnapshot } from '@/core/types/database';
import { invoiceDueDate } from '@/core/engine/invoices';
import { Competence } from '@/core/engine/month';

type Props = {
  cards: DBCard[];
  snapshots?: DBCardSnapshot[];
  /** Competência exibida — usada só pra mostrar quando essa fatura vence. */
  competence?: Competence | null;
  onUpdated: () => void;
};

export default function CardList({
  cards,
  snapshots = [],
  competence = null,
  onUpdated,
}: Props) {
  const { showToast } = useToast();
  const [selected, setSelected] = useState<DBCard | null>(null);

  const handleSetPrimary = async (id: string) => {
    try {
      await setPrimaryCard(id);
      showToast('Cartão principal atualizado');
      onUpdated();
    } catch (err) {
      console.error(err);
      showToast('Erro ao definir cartão principal', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    const confirmDelete = confirm('Deseja remover esse cartão?');

    if (!confirmDelete) return;

    try {
      await deleteCard(id);
      showToast('Cartão removido');
      onUpdated();
    } catch (err) {
      console.error(err);
      showToast('Erro ao remover cartão', 'error');
    }
  };

  return (
    <div className="surface grid gap-3 p-4 sm:p-5">
      <h2 className="text-white font-bold text-lg">Cartões cadastrados</h2>

      {cards.length === 0 && (
        <p className="text-zinc-400">Nenhum cartão cadastrado.</p>
      )}

      {cards.map((card) => {
        const snapshot = snapshots.find((s) => s.card_id === card.id);

        return (
          <div
            key={card.id}
            className="surface-row flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-3">
              <span
                className="h-3 w-3 shrink-0 rounded-full ring-2 ring-black/40"
                style={{ backgroundColor: card.color ?? '#52525b' }}
              />

              <div className="min-w-0">
                <p className="text-white font-medium flex items-center gap-1.5">
                  {card.name}
                  {card.is_primary && (
                    <span className="badge bg-yellow-500/15 text-yellow-400">
                      ★ Principal
                    </span>
                  )}
                </p>

                <p className="text-zinc-400 text-sm">
                  Fecha dia {card.closing_day} • vence dia {card.due_day ?? '-'}
                  {card.limit_amount != null &&
                    ` • limite ${new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    }).format(Number(card.limit_amount))}`}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <div className="sm:text-right">
                <p className="text-zinc-500 text-xs">
                  Fatura desta competência
                  {competence && card.due_day != null
                    ? ` · vence ${invoiceDueDate(
                        competence,
                        card.due_day,
                      ).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                      })}`
                    : ''}
                </p>

                <p className="text-white font-bold">
                  {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  }).format(Number(snapshot?.amount ?? 0))}
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleSetPrimary(card.id)}
                  title={
                    card.is_primary
                      ? 'Cartão principal'
                      : 'Definir como principal'
                  }
                  className={`btn-icon h-10 w-10 text-lg leading-none ${card.is_primary ? 'text-yellow-400' : 'text-zinc-500 hover:text-yellow-400'}`}
                >
                  ★
                </button>

                <button
                  onClick={() => setSelected(card)}
                  className="btn-ghost bg-white/5 text-zinc-200 hover:text-white"
                >
                  Editar
                </button>

                <button
                  onClick={() => handleDelete(card.id)}
                  className="btn-ghost text-red-400 hover:bg-red-500/10 hover:text-red-300"
                >
                  Remover
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {selected && (
        <EditCardModal
          card={selected}
          onClose={() => setSelected(null)}
          onUpdated={onUpdated}
        />
      )}
    </div>
  );
}
