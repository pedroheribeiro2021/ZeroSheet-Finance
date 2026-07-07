'use client';

import { useState } from 'react';

import { updateCard } from '@/core/services/card.service';
import { parseCurrencyInput } from '@/core/utils/number';
import { useToast } from '@/components/ui/ToastProvider';
import Modal from '@/components/ui/Modal';
import { DBCard } from '@/core/types/database';

type Props = {
  card: DBCard;
  onClose: () => void;
  onUpdated?: () => void;
};

export default function EditCardModal({ card, onClose, onUpdated }: Props) {
  const { showToast } = useToast();

  const [name, setName] = useState(card.name);
  const [closingDay, setClosingDay] = useState(card.closing_day ?? 1);
  const [dueDay, setDueDay] = useState(card.due_day ?? 10);
  const [color, setColor] = useState(card.color ?? '#2563eb');
  const [limitAmount, setLimitAmount] = useState(
    card.limit_amount != null ? String(card.limit_amount) : '',
  );

  const handleSave = async () => {
    try {
      await updateCard(card.id, {
        name,
        slug: name.toLowerCase().trim().replace(/\s+/g, '-'),
        closing_day: closingDay,
        due_day: dueDay,
        color,
        limit_amount: limitAmount
          ? parseCurrencyInput(limitAmount)
          : undefined,
      });

      showToast('Cartão atualizado com sucesso');
      onUpdated?.();
      onClose();
    } catch (err) {
      console.error(err);
      showToast('Erro ao atualizar cartão', 'error');
    }
  };

  return (
    <Modal open onClose={onClose} title="Editar Cartão">
      <div className="grid gap-3">
        <label className="field-label">
          Nome do cartão
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="field"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="field-label">
            Dia de fechamento
            <input
              type="number"
              min={1}
              max={31}
              value={closingDay}
              onChange={(e) => setClosingDay(Number(e.target.value))}
              className="field"
            />
          </label>

          <label className="field-label">
            Dia de vencimento
            <input
              type="number"
              min={1}
              max={31}
              value={dueDay}
              onChange={(e) => setDueDay(Number(e.target.value))}
              className="field"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="field-label">
            Limite do cartão
            <input
              value={limitAmount}
              onChange={(e) => setLimitAmount(e.target.value)}
              className="field"
            />
          </label>

          <label className="field-label">
            Cor
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-11 w-full rounded-xl border border-zinc-700/80 bg-zinc-800/80 p-1"
            />
          </label>
        </div>

        <div className="flex gap-2 mt-2">
          <button onClick={handleSave} className="btn-success flex-1">
            Salvar
          </button>

          <button onClick={onClose} className="btn-secondary flex-1">
            Cancelar
          </button>
        </div>
      </div>
    </Modal>
  );
}
