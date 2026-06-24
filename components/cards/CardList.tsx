'use client';

import { useState } from 'react';

import { deleteCard } from '@/core/services/card.service';
import EditCardModal from '../modals/EditCardModal';
import { useToast } from '@/components/ui/ToastProvider';

type Props = {
  cards: any[];
  snapshots?: any[];
  onUpdated: () => void;
};

export default function CardList({ cards, snapshots = [], onUpdated }: Props) {
  const { showToast } = useToast();
  const [selected, setSelected] = useState<any>(null);

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
    <div className="bg-zinc-900 rounded p-4 grid gap-3">
      <h2 className="text-white font-bold text-lg">Cartões cadastrados</h2>

      {cards.length === 0 && (
        <p className="text-zinc-400">Nenhum cartão cadastrado.</p>
      )}

      {cards.map((card) => {
        const snapshot = snapshots.find((s) => s.card_id === card.id);

        return (
          <div
            key={card.id}
            className="bg-zinc-800 rounded p-3 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: card.color ?? '#52525b' }}
              />

              <div>
                <p className="text-white font-medium">{card.name}</p>

                <p className="text-zinc-400 text-sm">
                  Fecha dia {card.closing_day} • vence dia{' '}
                  {card.due_day ?? '-'}
                  {card.limit_amount != null &&
                    ` • limite ${new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    }).format(Number(card.limit_amount))}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-zinc-500 text-xs">Fatura atual</p>

                <p className="text-white font-bold">
                  {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  }).format(Number(snapshot?.amount ?? 0))}
                </p>
              </div>

              <button
                onClick={() => setSelected(card)}
                className="bg-blue-600 px-2 py-1 rounded text-white text-xs"
              >
                Editar
              </button>

              <button
                onClick={() => handleDelete(card.id)}
                className="text-red-500 hover:text-red-700 text-sm"
              >
                Remover
              </button>
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
