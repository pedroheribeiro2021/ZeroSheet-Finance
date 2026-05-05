import { supabase } from '@/lib/supabase';
import { DBTransaction } from '@/core/types/database';

export async function getTransactions(monthId: string) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('month_id', monthId)
    .order('created_at');

  if (error) throw error;

  return data;
}

export async function createTransaction(
  data: Omit<DBTransaction, 'id' | 'created_at'>,
) {
  const { error } = await supabase.from('transactions').insert(data);

  if (error) throw error;
}

// 🚀 NOVO: copiar recorrentes
export async function copyRecurringTransactions(
  fromMonthId: string,
  toMonthId: string,
) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('month_id', fromMonthId)
    .eq('is_recurring', true);

  if (error) throw error;

  if (!data || data.length === 0) return;

  const payload = data.map((t) => ({
    month_id: toMonthId,
    type: t.type,
    category: t.category,
    amount: t.amount,
    is_fixed: t.is_fixed,
    is_provision: t.is_provision,
    is_recurring: t.is_recurring,
    card: t.card ?? null,
  }));

  const { error: insertError } = await supabase
    .from('transactions')
    .insert(payload);

  if (insertError) throw insertError;
}
