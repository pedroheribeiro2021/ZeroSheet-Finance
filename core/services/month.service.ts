import { getCurrentUserId } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { copyRecurringTransactions } from './transaction.service';

export async function getMonths() {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from('months')
    .select('*')
    .eq('user_id', userId)
    .order('year')
    .order('month');

  if (error) throw error;

  return data;
}

export async function createMonth(month: number, year: number) {
  const userId = await getCurrentUserId();

  const { data: existingMonths, error: existingMonthsError } = await supabase
    .from('months')
    .select('*')
    .eq('user_id', userId)
    .order('created_at');

  if (existingMonthsError) throw existingMonthsError;

  const lastMonth = existingMonths?.[existingMonths.length - 1];

  const { data, error } = await supabase
    .from('months')
    .insert({ month, year, user_id: userId })
    .select()
    .single();

  if (error) throw error;

  if (lastMonth) {
    await copyRecurringTransactions(lastMonth.id, data.id);
  }

  return data;
}
