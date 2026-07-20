/* eslint-disable @typescript-eslint/no-explicit-any */
import { getCurrentUser } from './auth.service';
import { supabase } from '@/lib/supabase';
import { isRecurrenceActive } from '@/core/engine/recurrence';

export async function getTransactions(monthId: string) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Usuário não autenticado');
  }

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
    .eq('month_id', monthId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data;
}

export async function createTransaction(data: any) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Usuário não autenticado');
  }

  const { data: created, error } = await supabase
    .from('transactions')
    .insert([
      {
        ...data,
        user_id: user.id,
      },
    ])
    .select()
    .single();

  if (error) throw error;

  return created;
}

export async function updateTransaction(id: string, data: any) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Usuário não autenticado');
  }

  const { error } = await supabase
    .from('transactions')
    .update(data)
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw error;
}

export async function markTransactionPaid(
  id: string,
  paidAt: string = new Date().toISOString(),
) {
  await updateTransaction(id, { paid_at: paidAt });
}

export async function unmarkTransactionPaid(id: string) {
  await updateTransaction(id, { paid_at: null });
}

/**
 * "Pausar este mês": o lançamento fica na lista, mas fora de todos os
 * cálculos. Só vale para o mês corrente — copyRecurringTransactions não
 * propaga a coluna, então o mês seguinte nasce com o lançamento ativo.
 */
export async function setTransactionSkipped(id: string, skipped: boolean) {
  await updateTransaction(id, { skipped });
}

export async function deleteTransaction(id: string) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Usuário não autenticado');
  }

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw error;
}

export async function copyRecurringTransactions(
  fromMonthId: string,
  toMonthId: string,
  /** Competência do mês destino — usada para respeitar recurring_until. */
  target?: { month: number; year: number },
) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Usuário não autenticado');
  }

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('month_id', fromMonthId)
    .eq('user_id', user.id)
    .eq('is_recurring', true);

  if (error) throw error;

  if (!data || data.length === 0) return;

  // respeita a duração da recorrência (recurring_until)
  const active = target
    ? data.filter((t) =>
        isRecurrenceActive(t.recurring_until, target.year, target.month),
      )
    : data;

  if (active.length === 0) return;

  // `skipped` fica deliberadamente FORA do payload: pausa vale só para o
  // mês em que foi feita — o mês novo nasce com o lançamento ativo.
  const payload = active.map((t) => ({
    month_id: toMonthId,
    user_id: user.id,
    type: t.type,
    category: t.category,
    description: t.description ?? null,
    amount: t.amount,
    is_fixed: t.is_fixed,
    is_recurring: t.is_recurring,
    is_provision: t.is_provision,
    is_reimbursement: t.is_reimbursement ?? false,
    is_reserve: t.is_reserve ?? false,
    due_day: t.due_day ?? null,
    recurring_until: t.recurring_until ?? null,
    card: t.card ?? null,
  }));

  const { error: insertError } = await supabase
    .from('transactions')
    .insert(payload);

  if (insertError) throw insertError;
}
