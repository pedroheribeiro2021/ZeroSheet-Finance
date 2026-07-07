'use client';

import { useEffect, useState } from 'react';

import { createInstallment } from '@/core/services/installment.service';
import {
  parseCurrencyInput,
  sanitizeAmountInput,
  formatBRL,
} from '@/core/utils/number';
import { getCards } from '@/core/services/card.service';
import { useToast } from '@/components/ui/ToastProvider';
import { DBCard } from '@/core/types/database';

type Props = {
  monthId: string;
  /** Rótulo do mês ativo (ex.: "Julho de 2026") para deixar claro quando a 1ª parcela conta. */
  monthLabel?: string;
  onCreated?: () => void;
};

export default function InstallmentForm({
  monthId,
  monthLabel,
  onCreated,
}: Props) {
  const { showToast } = useToast();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [totalInstallments, setTotalInstallments] = useState(1);

  const [cards, setCards] = useState<DBCard[]>([]);
  const [cardId, setCardId] = useState('');

  useEffect(() => {
    async function loadCards() {
      const data = await getCards();

      setCards(data);

      if (data.length > 0) {
        setCardId(data[0].id);
      }
    }

    loadCards();
  }, []);

  const parsed = parseCurrencyInput(amount);
  const total = parsed * totalInstallments;

  const handleSubmit = async () => {
    try {
      if (!description) {
        showToast('Informe uma descrição', 'error');
        return;
      }

      if (!parsed) {
        showToast('Informe o valor da parcela', 'error');
        return;
      }

      await createInstallment({
        description,
        card_id: cardId,
        total_amount: total,
        installment_amount: parsed,
        total_installments: totalInstallments,
        start_month_id: monthId,
      });

      setDescription('');
      setAmount('');
      setTotalInstallments(1);

      showToast('Parcelamento salvo com sucesso');
      onCreated?.();
    } catch (err) {
      console.error(err);
      showToast('Erro ao salvar parcelamento', 'error');
    }
  };

  return (
    <div className="surface grid gap-3 p-4 sm:p-5">
      <h2 className="font-bold text-white">Novo Parcelamento</h2>

      <label className="field-label">
        Descrição
        <input
          placeholder="Ex: Celular Samsung"
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
            placeholder="Ex: 703,20"
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

      <p className="text-xs text-zinc-500">
        A 1ª parcela conta {monthLabel ? `em ${monthLabel}` : 'neste mês'}.
        {parsed > 0 &&
          ` Total da compra: ${formatBRL(total)} (${totalInstallments}× de ${formatBRL(parsed)}).`}{' '}
        A parcela compromete a fatura do cartão selecionado todo mês até
        terminar.
      </p>

      <button onClick={handleSubmit} className="btn-primary">
        Salvar
      </button>
    </div>
  );
}
