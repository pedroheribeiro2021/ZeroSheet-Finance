import { supabase } from '@/lib/supabase';
import { copyRecurringTransactions } from './transaction.service';
// import { copyRecurringTransactions } from './transaction.service';

export async function getMonths() {
  const { data, error } = await supabase
    .from('months')
    .select('*')
    .order('year')
    .order('month');

  if (error) throw error;

  return data;
}

export async function createMonth(month: number, year: number) {
  // 🔍 pega último mês
  const { data: existingMonths } = await supabase
    .from('months')
    .select('*')
    .order('created_at');

  const lastMonth = existingMonths?.[existingMonths.length - 1];

  // 🆕 cria novo mês
  const { data, error } = await supabase
    .from('months')
    .insert({ month, year })
    .select()
    .single();

  if (error) throw error;

  // 🔁 copia recorrentes do mês anterior
  if (lastMonth) {
    await copyRecurringTransactions(lastMonth.id, data.id);
  }

  return data;
}
