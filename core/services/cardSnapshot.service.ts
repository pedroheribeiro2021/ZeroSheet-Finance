import { getCurrentUserId } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export async function upsertCardSnapshot(
  monthId: string,
  card: 'nubank' | 'c6',
  amount: number,
) {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from('card_snapshots')
    .upsert(
      {
        month_id: monthId,
        user_id: userId,
        card,
        amount,
      },
      {
        onConflict: 'month_id,card,user_id',
      },
    )
    .select();

  if (error) throw error;

  return data;
}

export async function getCardSnapshots(monthId: string) {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from('card_snapshots')
    .select('*')
    .eq('month_id', monthId)
    .eq('user_id', userId);

  if (error) throw error;

  return data;
}
