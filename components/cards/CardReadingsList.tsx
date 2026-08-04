'use client';

import { useEffect, useState } from 'react';

import { getAllReadings, deleteReading } from '@/core/services/cardReading.service';
import { useToast } from '@/components/ui/ToastProvider';
import { DBCard, DBCardReading } from '@/core/types/database';

/**
 * Leituras não têm edição direta — a correção é apagar a errada e lançar de
 * novo com o valor certo em "Atualizar Faturas". Existe pra permitir limpar
 * leituras lançadas na competência errada (ex.: antes da virada de mês
 * explícita existir, tudo caía no único mês que havia).
 */
export default function CardReadingsList({
  monthId,
  cards,
}: {
  monthId: string;
  cards: DBCard[];
}) {
  const { showToast } = useToast();
  const [readings, setReadings] = useState<DBCardReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getAllReadings(monthId);
      setReadings(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthId]);

  const handleDelete = async (id: string) => {
    if (!confirm('Remover esta leitura?')) return;

    setPendingId(id);
    try {
      await deleteReading(id);
      showToast('Leitura removida');
      await load();
    } catch (err) {
      console.error(err);
      showToast('Erro ao remover leitura', 'error');
    } finally {
      setPendingId(null);
    }
  };

  if (loading) return null;
  if (readings.length === 0) return null;

  const cardName = (cardId: string | null) =>
    cards.find((c) => c.id === cardId)?.name ?? 'Cartão removido';

  const sorted = [...readings].sort(
    (a, b) => new Date(b.read_at).getTime() - new Date(a.read_at).getTime(),
  );

  return (
    <div className="surface p-4 sm:p-5">
      <h2 className="text-white font-bold mb-1">Leituras deste mês</h2>
      <p className="text-zinc-500 text-xs mb-4">
        Histórico usado no acompanhamento semanal. Lançou na competência
        errada? Apague aqui e relance em Atualizar Faturas.
      </p>

      <div className="grid gap-1.5">
        {sorted.map((reading) => (
          <div
            key={reading.id}
            className="surface-row flex items-center justify-between gap-3 p-3"
          >
            <div className="min-w-0">
              <p className="font-medium text-white">{cardName(reading.card_id)}</p>
              <p className="text-xs text-zinc-400">
                {new Date(reading.read_at).toLocaleString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <span className="font-bold text-white">
                {Number(reading.amount).toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </span>
              <button
                onClick={() => handleDelete(reading.id)}
                disabled={pendingId === reading.id}
                className="btn-ghost text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300"
              >
                Remover
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
