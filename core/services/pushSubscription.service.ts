import { supabase } from '@/lib/supabase';
import { getCurrentUser } from './auth.service';
import { DBPushSubscription } from '@/core/types/database';

export async function savePushSubscription(subscription: {
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<void> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Usuário não autenticado');
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
    { onConflict: 'user_id,endpoint' },
  );

  if (error) throw error;
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Usuário não autenticado');
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', endpoint);

  if (error) throw error;
}

export async function getPushSubscriptions(): Promise<DBPushSubscription[]> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Usuário não autenticado');
  }

  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', user.id);

  if (error) throw error;

  return (data ?? []) as DBPushSubscription[];
}
