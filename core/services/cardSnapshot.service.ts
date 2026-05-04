import { supabase } from '@/lib/supabase';

export async function upsertCardSnapshot(
  monthId: string,
  card: 'nubank' | 'c6',
  amount: number,
) {
  const { data, error } = await supabase
    .from('card_snapshots')
    .upsert(
      {
        month_id: monthId,
        card,
        amount,
      },
      {
        onConflict: 'month_id,card',
      },
    )
    .select();

  if (error) throw error;

  return data;
}

export async function getCardSnapshots(monthId: string) {
  const { data, error } = await supabase
    .from('card_snapshots')
    .select('*')
    .eq('month_id', monthId);

  if (error) throw error;

  return data;
}
