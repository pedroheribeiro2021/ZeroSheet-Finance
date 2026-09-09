'use client';

import { useState } from 'react';

import { upsertCardSnapshot } from '@/core/services/cardSnapshot.service';
import { recordSnapshotAsReading } from '@/core/services/cardReading.service';
import { parseCurrencyInput, sanitizeAmountInput } from '@/core/utils/number';
import { useToast } from '@/components/ui/ToastProvider';

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    value,
  );

export type PendingInvoice = {
  cardId: string;
  cardName: string;
  monthId: string;
  monthLabel: string;
  /** Fim do ciclo daquela competência — vira o `read_at` da leitura, pra ela
   * nunca ser confundida com a primeira leitura do ciclo seguinte. */
  cycleEnd: Date;
  lastKnownAmount: number | null;
};

export default function PendingInvoiceForm({
  invoices,
  onUpdated,
}: {
  invoices: PendingInvoice[];
  onUpdated: () => void;
}) {
  const { showToast } = useToast();
  const [values, setValues] = useState<Record<string, string>>({});

  if (invoices.length === 0) return null;

  const key = (invoice: PendingInvoice) => `${invoice.monthId}:${invoice.cardId}`;

  const handleChange = (invoice: PendingInvoice, value: string) => {
    setValues((prev) => ({
      ...prev,
      [key(invoice)]: value,
    }));
  };

  const handleSave = async () => {
    try {
      for (const invoice of invoices) {
        const value = values[key(invoice)];
        if (!value) continue;

        const amount = parseCurrencyInput(value);
        const readAt = new Date(
          invoice.cycleEnd.getFullYear(),
          invoice.cycleEnd.getMonth(),
          invoice.cycleEnd.getDate(),
          23,
          59,
          59,
        ).toISOString();

        await upsertCardSnapshot(invoice.monthId, invoice.cardId, amount);
        await recordSnapshotAsReading({
          month_id: invoice.monthId,
          card_id: invoice.cardId,
          amount,
          read_at: readAt,
        });
      }

      setValues({});
      showToast('Fatura(s) anterior(es) confirmada(s)');
      onUpdated();
    } catch (err) {
      console.error(err);
      showToast('Erro ao confirmar fatura anterior', 'error');
    }
  };

  return (
    <div className="surface p-4 sm:p-5 border-l-2 border-l-amber-500">
      <h2 className="text-white font-bold mb-1">Fatura(s) anterior(es) pendente(s)</h2>
      <p className="text-zinc-500 text-xs mb-4">
        Esses ciclos já fecharam e ainda não foram confirmados. Lance o valor
        final aqui — não no campo do mês atual — pra não misturar com o gasto
        da semana corrente.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {invoices.map((invoice) => (
          <label key={key(invoice)} className="field-label">
            {invoice.cardName} — {invoice.monthLabel}
            <input
              placeholder="Ex: 1200,50"
              value={values[key(invoice)] ?? ''}
              inputMode="decimal"
              onChange={(e) =>
                handleChange(invoice, sanitizeAmountInput(e.target.value))
              }
              className="field"
            />
            {invoice.lastKnownAmount != null && (
              <span className="text-xs text-zinc-500">
                Última leitura: {formatCurrency(invoice.lastKnownAmount)}
              </span>
            )}
          </label>
        ))}
      </div>

      <button onClick={handleSave} className="btn-primary mt-4 w-full sm:w-auto">
        Confirmar fatura(s) anterior(es)
      </button>
    </div>
  );
}
