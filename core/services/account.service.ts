import { supabase } from '@/lib/supabase';
import { getCurrentUser } from './auth.service';
import { DBAccount, DBAccountReading } from '@/core/types/database';

export async function getAccounts(): Promise<DBAccount[]> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at');

  if (error) throw error;

  return (data ?? []) as DBAccount[];
}

export async function createAccount(data: {
  name: string;
  kind: 'corrente' | 'guardado';
  color?: string | null;
}): Promise<DBAccount> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { data: created, error } = await supabase
    .from('accounts')
    .insert({
      ...data,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) throw error;

  return created as DBAccount;
}

export async function updateAccount(
  id: string,
  data: { name?: string; kind?: 'corrente' | 'guardado'; color?: string | null },
): Promise<DBAccount> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { data: updated, error } = await supabase
    .from('accounts')
    .update(data)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) throw error;

  return updated as DBAccount;
}

/**
 * Marca a conta `id` como conta de pagamento padrão (usada na projeção do
 * dashboard) e desmarca todas as demais do usuário — só uma por vez, igual
 * ao ★ de cartão principal.
 */
export async function setPaymentDefaultAccount(id: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Usuário não autenticado');

  await supabase
    .from('accounts')
    .update({ is_payment_default: false })
    .eq('user_id', user.id);

  const { error } = await supabase
    .from('accounts')
    .update({ is_payment_default: true })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw error;
}

export async function deleteAccount(id: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { error } = await supabase
    .from('accounts')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw error;
}

export async function getAccountReadings(
  accountId?: string,
): Promise<DBAccountReading[]> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Usuário não autenticado');

  let query = supabase
    .from('account_readings')
    .select('*')
    .eq('user_id', user.id)
    .order('read_at');

  if (accountId) {
    query = query.eq('account_id', accountId);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data ?? []) as DBAccountReading[];
}

export async function addAccountReading(
  accountId: string,
  amount: number,
  readAt?: string,
): Promise<DBAccountReading> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { data: created, error } = await supabase
    .from('account_readings')
    .insert({
      account_id: accountId,
      amount,
      user_id: user.id,
      read_at: readAt ?? new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;

  return created as DBAccountReading;
}

export async function deleteAccountReading(id: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { error } = await supabase
    .from('account_readings')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw error;
}
