/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '@/lib/supabase';

export type WeekDB = {
  id: string;
  month_id: string;
  index: number;
  budget: number;
  spent: number;
  remaining: number;
  created_at: string; // ✅ ADICIONADO
};

// 🔍 GET
export async function getWeeks(monthId: string): Promise<WeekDB[]> {
  const { data, error } = await supabase
    .from('weeks')
    .select('*')
    .eq('month_id', monthId)
    .order('index', { ascending: true });

  if (error) throw error;

  return data ?? [];
}

// 🧱 CREATE
export async function createWeeks(monthId: string, weeks: any[]) {
  const payload = weeks.map((w) => ({
    month_id: monthId,
    index: w.index,
    budget: Number(w.budget ?? 0),
    spent: Number(w.spent ?? 0),
    remaining: Number(w.remaining ?? 0),
  }));

  const { data, error } = await supabase.from('weeks').insert(payload).select();

  if (error) throw error;

  return data;
}

// ✏️ UPDATE
export async function updateWeek(
  id: string,
  data: {
    budget?: number;
    spent?: number;
    remaining?: number;
  },
) {
  const payload: any = {};

  if (data.budget !== undefined) payload.budget = data.budget;
  if (data.spent !== undefined) payload.spent = data.spent;
  if (data.remaining !== undefined) payload.remaining = data.remaining;

  const { data: updated, error } = await supabase
    .from('weeks')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  return updated;
}
