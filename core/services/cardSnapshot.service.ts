import { getCurrentUser } from './auth.service';
import { supabase } from '@/lib/supabase';
import { DBCardSnapshot } from '@/core/types/database';

export async function upsertCardSnapshot(
  monthId: string,
  cardId: string,
  amount: number,
): Promise<DBCardSnapshot[]> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Usuário não autenticado');
  }

  const { data, error } = await supabase
    .from('card_snapshots')
    .upsert(
      {
        month_id: monthId,
        user_id: user.id,
        card_id: cardId,
        amount,
      },
      {
        onConflict: 'month_id,card_id,user_id',
      },
    )
    .select();

  if (error) throw error;

  return (data ?? []) as DBCardSnapshot[];
}

export async function getCardSnapshots(
  monthId: string,
): Promise<DBCardSnapshot[]> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Usuário não autenticado');
  }

  const { data, error } = await supabase
    .from('card_snapshots')
    .select('*')
    .eq('month_id', monthId)
    .eq('user_id', user.id);

  if (error) throw error;

  return (data ?? []) as DBCardSnapshot[];
}

export async function markCardSnapshotPaid(
  id: string,
  paidAt: string = new Date().toISOString(),
) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Usuário não autenticado');
  }

  const { error } = await supabase
    .from('card_snapshots')
    .update({ paid_at: paidAt })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw error;
}

export async function unmarkCardSnapshotPaid(id: string) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Usuário não autenticado');
  }

  const { error } = await supabase
    .from('card_snapshots')
    .update({ paid_at: null })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw error;
}
