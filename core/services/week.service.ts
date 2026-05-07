/* eslint-disable @typescript-eslint/no-explicit-any */
import { getCurrentUser } from './auth.service';
import { supabase } from '@/lib/supabase';

export type WeekDB = {
  id: string;
  month_id: string;
  index: number;
  budget: number;
  spent: number;
  remaining: number;
  created_at: string;
};

export async function getWeeks(monthId: string): Promise<WeekDB[]> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Usuário não autenticado');
  }

  const { data, error } = await supabase
    .from('weeks')
    .select('*')
    .eq('month_id', monthId)
    .eq('user_id', user.id)
    .order('index', { ascending: true });

  if (error) throw error;

  return data ?? [];
}

export async function createWeeks(monthId: string, weeks: any[]) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Usuário não autenticado');
  }

  const payload = weeks.map((w) => ({
    month_id: monthId,
    user_id: user.id,
    index: w.index,
    budget: Number(w.budget ?? 0),
    spent: Number(w.spent ?? 0),
    remaining: Number(w.remaining ?? 0),
  }));

  const { data, error } = await supabase.from('weeks').insert(payload).select();

  if (error) throw error;

  return data;
}

export async function updateWeek(
  id: string,
  data: {
    budget?: number;
    spent?: number;
    remaining?: number;
  },
) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Usuário não autenticado');
  }

  const payload: any = {};

  if (data.budget !== undefined) payload.budget = data.budget;
  if (data.spent !== undefined) payload.spent = data.spent;
  if (data.remaining !== undefined) payload.remaining = data.remaining;

  const { data: updated, error } = await supabase
    .from('weeks')
    .update(payload)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) throw error;

  return updated;
}
