import { supabase } from '@/lib/supabase';
import { DBTransaction } from '@/core/types/database';

export async function createTransaction(
  transaction: Omit<DBTransaction, 'id' | 'created_at'>,
) {
  const { data, error } = await supabase
    .from('transactions')
    .insert([transaction])
    .select()
    .single();

  if (error) throw error;

  return data as DBTransaction;
}

export async function getTransactions(monthId: string) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('month_id', monthId);

  if (error) throw error;

  return data as DBTransaction[];
}
