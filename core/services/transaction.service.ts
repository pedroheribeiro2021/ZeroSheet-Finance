/* eslint-disable @typescript-eslint/no-explicit-any */
import { getCurrentUserId } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export async function getTransactions(monthId: string) {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('month_id', monthId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data;
}

export async function createTransaction(data: any) {
  const userId = await getCurrentUserId();

  const { error } = await supabase.from('transactions').insert([
    {
      ...data,
      user_id: userId,
    },
  ]);

  if (error) throw error;
}

export async function updateTransaction(id: string, data: any) {
  const userId = await getCurrentUserId();

  const { error } = await supabase
    .from('transactions')
    .update(data)
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function deleteTransaction(id: string) {
  const userId = await getCurrentUserId();

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function copyRecurringTransactions(
  fromMonthId: string,
  toMonthId: string,
) {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('month_id', fromMonthId)
    .eq('user_id', userId)
    .eq('is_recurring', true);

  if (error) throw error;

  if (!data || data.length === 0) return;

  const payload = data.map((t) => ({
    month_id: toMonthId,
    user_id: userId,
    type: t.type,
    category: t.category,
    amount: t.amount,
    is_fixed: t.is_fixed,
    is_recurring: t.is_recurring,
    is_provision: t.is_provision,
    card: t.card ?? null,
  }));

  const { error: insertError } = await supabase
    .from('transactions')
    .upsert(payload, {
      onConflict: 'month_id,category,user_id',
    });

  if (insertError) throw insertError;
}
