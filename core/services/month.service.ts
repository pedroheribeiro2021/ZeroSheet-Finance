import { supabase } from '@/lib/supabase';
import { DBMonth } from '@/core/types/database';

export async function createMonth(month: number, year: number) {
  const { data, error } = await supabase
    .from('months')
    .insert([{ month, year }])
    .select()
    .single();

  if (error) throw error;

  return data as DBMonth;
}

export async function getMonths() {
  const { data, error } = await supabase.from('months').select('*');

  if (error) throw error;

  return data as DBMonth[];
}
