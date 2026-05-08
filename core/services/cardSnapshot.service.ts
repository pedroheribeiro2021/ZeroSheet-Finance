import { getCurrentUser } from './auth.service';
import { supabase } from '@/lib/supabase';

export async function upsertCardSnapshot(
  monthId: string,
  cardId: string,
  amount: number,
) {
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
        onConflict: 'month_id,card,user_id',
      },
    )
    .select();

  if (error) throw error;

  return data;
}

export async function getCardSnapshots(monthId: string) {
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

  return data;
}
