'use client';

import { useEffect, useState } from 'react';

import { updateInstallment } from '@/core/services/installment.service';
import type { ActiveInstallment } from '@/core/services/installment.service';
import {
  parseCurrencyInput,
  sanitizeAmountInput,
  formatBRL,
} from '@/core/utils/number';
import { getCards } from '@/core/services/card.service';
import { useToast } from '@/components/ui/ToastProvider';
import Modal from '@/components/ui/Modal';
import { DBCard } from '@/core/types/database';

type Props = {
  installment: ActiveInstallment;
  onClose: () => void;
  onUpdated?: () => void;
};

export default function EditInstallmentModal({
  installment,
  onClose,
  onUpdated,
}: Props) {
  const { showToast } = useToast();

  const [description, setDescription] = useState(installment.description);
  const [amount, setAmount] = useState(String(installment.installment_amount));
  const [totalInstallments, setTotalInstallments] = useState(
    installment.total_installments,
  );
  const [cards, setCards] = useState<DBCard[]>([]);
  const [cardId, setCardId] = useState(installment.card_id ?? '');
  const [billingDay, setBillingDay] = useState(
    installment.billing_day != null ? String(installment.billing_day) : '',
  );

  useEffect(() => {
    getCards()
      .then(setCards)
      .catch(() => setCards([]));
  }, []);

  const parsed = parseCurrencyInput(amount);
  const total = parsed * totalInstallments;

  const handleSave = async () => {
    try {
      if (!description) {
        showToast('Informe uma descrição', 'error');
        return;
      }

      if (!parsed) {
        showToast('Informe o valor da parcela', 'error');
        return;
      }

      await updateInstallment(installment.id, {
        description,
        card_id: cardId,
        total_amount: total,
        installment_amount: parsed,
        total_installments: totalInstallments,
        billing_day: billingDay ? Number(billingDay) : null,
      });

      showToast('Parcelamento atualizado com sucesso');
      onUpdated?.();
      onClose();
    } catch (err) {
      console.error(err);
      showToast('Erro ao atualizar parcelamento', 'error');
    }
  };

  return (
    <Modal open onClose={onClose} title="Editar Parcelamento">
      <div className="grid gap-3">
        <label className="field-label">
          Descrição
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="field"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="field-label">
            Valor de cada parcela
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(sanitizeAmountInput(e.target.value))}
              className="field"
            />
          </label>

          <label className="field-label">
            Número de parcelas
            <input
              type="number"
              min={1}
              max={72}
              value={totalInstallments}
              onChange={(e) =>
                setTotalInstallments(Math.max(1, Number(e.target.value)))
              }
              className="field"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="field-label">
            Cartão onde foi parcelado
            <select
              value={cardId}
              onChange={(e) => setCardId(e.target.value)}
              className="field"
            >
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field-label">
            Dia em que cai na fatura (opcional)
            <input
              type="number"
              min={1}
              max={31}
              placeholder="Ex: 10"
              value={billingDay}
              onChange={(e) => setBillingDay(e.target.value)}
              className="field"
            />
          </label>
        </div>

        <p className="text-xs text-zinc-500">
          O mês de início não muda ao editar (só descrição, valor, quantidade
          de parcelas, cartão e dia de lançamento).
          {parsed > 0 &&
            ` Total da compra: ${formatBRL(total)} (${totalInstallments}× de ${formatBRL(parsed)}).`}
        </p>

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
