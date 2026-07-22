import { supabase } from '@/lib/supabase';
import { getCurrentUser } from './auth.service';
import { DBTransfer } from '@/core/types/database';

export async function getTransfers(): Promise<DBTransfer[]> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { data, error } = await supabase
    .from('transfers')
    .select('*')
    .eq('user_id', user.id)
    .order('transferred_at', { ascending: false });

  if (error) throw error;

  return (data ?? []) as DBTransfer[];
}

export async function createTransfer(data: {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  kind: 'complemento' | 'devolucao' | 'movimentacao';
  linkedTransferId?: string | null;
  note?: string | null;
  transferredAt?: string;
}): Promise<DBTransfer> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { data: created, error } = await supabase
    .from('transfers')
    .insert({
      from_account_id: data.fromAccountId,
      to_account_id: data.toAccountId,
      amount: data.amount,
      kind: data.kind,
      linked_transfer_id: data.linkedTransferId ?? null,
      note: data.note ?? null,
      transferred_at: data.transferredAt ?? new Date().toISOString().slice(0, 10),
      user_id: user.id,
    })
    .select()
    .single();

  if (error) throw error;

  return created as DBTransfer;
}

export async function deleteTransfer(id: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { error } = await supabase
    .from('transfers')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw error;
}
