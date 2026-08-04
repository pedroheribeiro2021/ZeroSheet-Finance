'use client';

import { competenceKey } from '@/core/engine/month';
import { DBMonth } from '@/core/types/database';

export function formatMonthLabel(month: number, year: number): string {
  const raw = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1));

  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export default function MonthSelect({
  months,
  activeMonth,
  onChange,
}: {
  months: DBMonth[];
  activeMonth: DBMonth;
  onChange: (month: DBMonth) => void;
}) {
  return (
    <select
      value={competenceKey(activeMonth)}
      onChange={(e) => {
        const found = months.find((m) => competenceKey(m) === e.target.value);
        if (found) onChange(found);
      }}
      className="field w-auto min-h-[44px] !py-2"
      aria-label="Selecionar mês"
    >
      {months.map((m) => (
        <option key={m.id} value={competenceKey(m)}>
          {formatMonthLabel(m.month, m.year)}
        </option>
      ))}
    </select>
  );
}
