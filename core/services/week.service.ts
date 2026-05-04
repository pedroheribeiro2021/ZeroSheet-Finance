/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '@/lib/supabase';

export async function getWeeks(monthId: string) {
  const { data, error } = await supabase
    .from('weeks')
    .select('*')
    .eq('month_id', monthId)
    .order('index');

  if (error) throw error;

  return data;
}

export async function createWeeks(monthId: string, weeks: any[]) {
  const payload = weeks.map((w) => ({
    month_id: monthId,
    index: w.index,
    budget: w.budget,
    spent: w.spent,
    remaining: w.remaining,
  }));

  const { error } = await supabase.from('weeks').insert(payload);

  if (error) throw error;
}

export async function updateWeek(id: string, data: any) {
  const { error } = await supabase.from('weeks').update(data).eq('id', id);

  if (error) throw error;
}
