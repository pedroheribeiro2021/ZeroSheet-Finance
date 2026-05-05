/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '@/lib/supabase';

export async function getTransactions(monthId: string) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('month_id', monthId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data;
}

export async function createTransaction(data: any) {
  const { error } = await supabase.from('transactions').insert(data);

  if (error) throw error;
}

export async function updateTransaction(id: string, data: any) {
  const { error } = await supabase
    .from('transactions')
    .update(data)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteTransaction(id: string) {
  const { error } = await supabase.from('transactions').delete().eq('id', id);

  if (error) throw error;
}

//
// 🔥 FUNÇÃO RESTAURADA + MELHORADA
//
export async function copyRecurringTransactions(
  fromMonthId: string,
  toMonthId: string,
) {
  // busca transações recorrentes do mês anterior
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('month_id', fromMonthId)
    .eq('is_recurring', true);

  if (error) throw error;

  if (!data || data.length === 0) return;

  // remove campos que não podem ser copiados
  const payload = data.map((t) => ({
    month_id: toMonthId,
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
    .insert(payload);

  if (insertError) throw insertError;
}
