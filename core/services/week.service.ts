import { supabase } from '@/lib/supabase';
import { DBWeek } from '../models/mappers';

export async function getWeeks(monthId: string) {
  const { data, error } = await supabase
    .from('weeks')
    .select('*')
    .eq('month_id', monthId);

  if (error) throw error;

  return data as DBWeek[];
}
