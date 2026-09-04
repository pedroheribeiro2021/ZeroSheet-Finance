'use client';

import { useMemo, useState } from 'react';

import { useToast } from '@/components/ui/ToastProvider';
import {
  DEFAULT_PAYDAY,
  PaydayMode,
  PaydaySettings,
  paydayInMonth,
} from '@/core/engine/payday';
import { savePaydaySettings } from '@/core/services/settings.service';

type Props = {
  initial: PaydaySettings | null;
  /** true = veio do banco; false = deduzido das entradas (ainda não salvo). */
  configured: boolean;
  onSaved: (settings: PaydaySettings) => void;
};

const MODE_LABELS: Record<PaydayMode, string> = {
  'fixed-day': 'Todo dia X do mês',
  'business-day': 'N-ésimo dia útil do mês',
};

/**
 * A pergunta que o app fazia por conta própria: quando o salário cai.
 *
 * Dois modos porque as duas convenções são comuns no Brasil e nenhuma
 * representa a outra: "todo dia 15" é uma data; "quinto dia útil" é uma regra
 * que muda de data todo mês (05/01, 04/02, 05/03…). Guardar só um número de
 * dia obrigaria o usuário a corrigir isso na mão mês a mês.
 */
export default function PaydayForm({ initial, configured, onSaved }: Props) {
  const [mode, setMode] = useState<PaydayMode>(initial?.mode ?? DEFAULT_PAYDAY.mode);
  const [day, setDay] = useState<number>(initial?.day ?? DEFAULT_PAYDAY.day);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const maxDay = mode === 'business-day' ? 23 : 31;
  const safeDay = Math.min(Math.max(day || 1, 1), maxDay);

  // Prévia das próximas competências: é o que deixa claro, sem explicação,
  // que "5º dia útil" não é "dia 5".
  const preview = useMemo(() => {
    const settings: PaydaySettings = { mode, day: safeDay };
    const today = new Date();

    return Array.from({ length: 4 }, (_, i) => {
      const ref = new Date(today.getFullYear(), today.getMonth() + i, 1);
      return paydayInMonth(settings, ref.getFullYear(), ref.getMonth() + 1);
    });
  }, [mode, safeDay]);

  const handleSave = async () => {
    setSaving(true);

    try {
      const settings: PaydaySettings = { mode, day: safeDay };
      await savePaydaySettings(settings);
      onSaved(settings);
      showToast('Recebimento salvo');
    } catch (err) {
      console.error(err);
      showToast('Erro ao salvar', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="surface grid gap-4 p-4 sm:p-5">
      <div>
        <h2 className="font-bold text-white">Quando você recebe</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Define a janela de cobertura do dashboard: o que vence entre hoje e o
          próximo recebimento, e quanto falta para atravessar até lá.
        </p>
      </div>

      {!configured && (
        <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-400">
          Ainda não configurado — o app está deduzindo do dia cadastrado na sua
          entrada recorrente. Salve aqui para fixar a regra.
        </p>
      )}

      <label className="field-label">
        Regra
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as PaydayMode)}
          className="field"
        >
          {Object.entries(MODE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label className="field-label">
        {mode === 'business-day' ? 'Qual dia útil' : 'Dia do mês'}
        <input
          type="number"
          min={1}
          max={maxDay}
          value={day}
          onChange={(e) => setDay(Number(e.target.value))}
          className="field"
        />
        <span className="text-xs text-zinc-500">
          {mode === 'business-day'
            ? 'Conta só dias úteis, pulando fins de semana e feriados bancários nacionais (Carnaval, Sexta-feira Santa e Corpus Christi incluídos).'
            : 'Em meses mais curtos, cai no último dia do mês.'}
        </span>
      </label>

      <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
        <p className="mb-2 text-xs font-medium text-zinc-400">
          Próximos recebimentos
        </p>
        <div className="flex flex-wrap gap-2">
          {preview.map((date) => (
            <span
              key={date.toISOString()}
              className="badge bg-zinc-700/50 text-zinc-200"
            >
              {date.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'short',
              })}
            </span>
          ))}
        </div>
      </div>

      <button onClick={handleSave} disabled={saving} className="btn-primary">
        {saving ? 'Salvando…' : 'Salvar'}
      </button>
    </div>
  );
}
