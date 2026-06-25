'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Week } from '@/core/types/finance';

type Props = {
  weeks: Week[];
  formatCurrency: (value: number) => string;
};

const TOOLTIP_STYLE = {
  backgroundColor: '#27272a',
  border: '1px solid #3f3f46',
  borderRadius: 8,
};

export default function WeeklyBarChart({ weeks, formatCurrency }: Props) {
  const data = weeks.map((w) => ({
    name: `Sem. ${w.index}`,
    Orçamento: w.budget,
    Gasto: w.spent,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" vertical={false} />
        <XAxis dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 13 }} axisLine={false} tickLine={false} />
        <YAxis
          tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
          tick={{ fill: '#a1a1aa', fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelStyle={{ color: '#f4f4f5', fontWeight: 600 }}
          itemStyle={{ color: '#a1a1aa' }}
          formatter={(value) => (typeof value === 'number' ? formatCurrency(value) : String(value ?? ''))}
        />
        <Legend
          wrapperStyle={{ color: '#a1a1aa', fontSize: 13, paddingTop: 8 }}
        />
        <Bar dataKey="Orçamento" fill="#52525b" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Gasto" fill="#22d3ee" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
