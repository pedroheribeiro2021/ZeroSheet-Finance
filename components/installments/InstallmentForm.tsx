'use client';

import { useEffect, useState } from 'react';

import { createInstallment } from '@/core/services/installment.service';
import { getCards } from '@/core/services/card.service';
import { parseCurrencyInput } from '@/core/utils/number';

export default function InstallmentForm({ monthId, onCreated }: any) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [totalInstallments, setTotalInstallments] = useState(1);

  const [cards, setCards] = useState<any[]>([]);
  const [selectedCardId, setSelectedCardId] = useState('');

  useEffect(() => {
    const loadCards = async () => {
      try {
        const cardsData = await getCards();

        setCards(cardsData);

        if (cardsData.length > 0) {
          setSelectedCardId(cardsData[0].id);
        }
      } catch (err) {
        console.error(err);
      }
    };

    loadCards();
  }, []);

  const handleSubmit = async () => {
    try {
      const parsed = parseCurrencyInput(amount);

      await createInstallment({
        description,
        card_id: selectedCardId,
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
        placeholder="Nome (ex: Notebook)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="bg-zinc-800 p-2 rounded text-white"
      />

      <input
        placeholder="Valor (ex: 277,92)"
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
        value={selectedCardId}
        onChange={(e) => setSelectedCardId(e.target.value)}
        className="bg-zinc-800 p-2 rounded text-white"
      >
        {cards.map((card) => (
          <option key={card.id} value={card.id}>
            {card.name}
          </option>
        ))}
      </select>

      <button
        onClick={handleSubmit}
        className="bg-blue-600 p-2 rounded hover:bg-blue-700"
      >
        Salvar
      </button>
    </div>
  );
}
