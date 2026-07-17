'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Transaction } from '@/core/types/finance';
import { normalizeCategory } from '@/core/utils/normalize';

type Props = {
  transactions: Transaction[];
  formatCurrency: (value: number) => string;
};

const TOOLTIP_STYLE = {
  backgroundColor: '#27272a',
  border: '1px solid #3f3f46',
  borderRadius: 8,
};

const BAR_COLORS = [
  '#818cf8', '#6366f1', '#a78bfa', '#7c3aed',
  '#c084fc', '#e879f9', '#f472b6', '#fb923c',
];

/**
 * Agrupa despesas por categoria SEM somar provisão com gasto efetivo.
 * Mesma regra do envelope: por categoria vale o MAIOR entre o planejado
 * (provisão) e o realizado — provisão é meta, não um gasto a mais.
 */
function groupExpensesByCategory(expenses: Transaction[]) {
  const byCat: Record<
    string,
    { category: string; planned: number; realized: number }
  > = {};

  for (const t of expenses) {
    const key = normalizeCategory(t.category) || 'sem categoria';
    if (!byCat[key]) {
      byCat[key] = { category: t.category.trim(), planned: 0, realized: 0 };
    }
    if (t.isProvision) byCat[key].planned += Number(t.amount);
    else byCat[key].realized += Number(t.amount);
  }

  return Object.values(byCat)
    .map((c) => ({
      category: c.category,
      total: Math.max(c.planned, c.realized),
    }))
    .sort((a, b) => b.total - a.total);
}

export default function CategoryBarChart({ transactions, formatCurrency }: Props) {
  const expenses = transactions.filter((t) => t.type === 'expense');
  const grouped = groupExpensesByCategory(expenses).slice(0, 8);

  if (grouped.length === 0) {
    return (
      <p className="text-zinc-500 text-sm text-center py-8">
        Nenhuma despesa registrada neste mês.
      </p>
    );
  }

  const data = grouped.map((item) => ({
    category: item.category.length > 14 ? item.category.slice(0, 14) + '…' : item.category,
    fullCategory: item.category,
    total: item.total,
  }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 44)}>
      <BarChart data={data} layout="vertical" barCategoryGap="25%">
        <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={(v) => `R$${(v / 1000).toFixed(1)}k`}
          tick={{ fill: '#a1a1aa', fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          dataKey="category"
          type="category"
          tick={{ fill: '#d4d4d8', fontSize: 13 }}
          axisLine={false}
          tickLine={false}
          width={110}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelStyle={{ color: '#f4f4f5', fontWeight: 600 }}
          itemStyle={{ color: '#a1a1aa' }}
          formatter={(value, _name, entry) => [
            typeof value === 'number' ? formatCurrency(value) : String(value ?? ''),
            (entry as { payload?: { fullCategory?: string } })?.payload?.fullCategory ?? '',
          ]}
        />
        <Bar dataKey="total" radius={[0, 4, 4, 0]}>
          {data.map((_entry, index) => (
            <Cell key={index} fill={BAR_COLORS[index % BAR_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
