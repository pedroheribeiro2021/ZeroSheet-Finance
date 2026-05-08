'use client';

import { useEffect, useState } from 'react';

import { createInstallment } from '@/core/services/installment.service';
import { parseCurrencyInput } from '@/core/utils/number';
import { getCards } from '@/core/services/card.service';

export default function InstallmentForm({ monthId, onCreated }: any) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [totalInstallments, setTotalInstallments] = useState(1);

  const [cards, setCards] = useState<any[]>([]);
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

  const handleSubmit = async () => {
    try {
      const parsed = parseCurrencyInput(amount);

      await createInstallment({
        description,
        card_id: cardId,
        total_amount: parsed * totalInstallments,
        installment_amount: parsed,
        total_installments: totalInstallments,
        start_month_id: monthId,
      });

      setDescription('');
      setAmount('');
      setTotalInstallments(1);

      onCreated?.();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="bg-zinc-900 p-4 rounded grid gap-3">
      <h2 className="font-bold text-white">Nova Parcela</h2>

      <input
        placeholder="Nome"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="bg-zinc-800 p-2 rounded text-white"
      />

      <input
        placeholder="Valor"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="bg-zinc-800 p-2 rounded text-white"
      />

      <input
        type="number"
        value={totalInstallments}
        onChange={(e) => setTotalInstallments(Number(e.target.value))}
        className="bg-zinc-800 p-2 rounded text-white"
      />

      <select
        value={cardId}
        onChange={(e) => setCardId(e.target.value)}
        className="bg-zinc-800 p-2 rounded text-white"
      >
        {cards.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <button onClick={handleSubmit} className="bg-blue-600 p-2 rounded">
        Salvar
      </button>
    </div>
  );
}
