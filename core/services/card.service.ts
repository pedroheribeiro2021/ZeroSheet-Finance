import { supabase } from '@/lib/supabase';
import { getCurrentUser } from './auth.service';

export async function getCards() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Usuário não autenticado');
  }

  const { data, error } = await supabase
    .from('cards')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at');

  if (error) throw error;

  return data;
}

export async function createCard(data: {
  name: string;
  slug: string;
  color?: string;
  limit_amount?: number;
  closing_day?: number;
  due_day?: number;
}) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Usuário não autenticado');
  }

  const { data: created, error } = await supabase
    .from('cards')
    .insert({
      ...data,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) throw error;

  return created;
}

export async function updateCard(
  id: string,
  data: {
    name?: string;
    slug?: string;
    color?: string;
    limit_amount?: number;
    closing_day?: number;
    due_day?: number;
  },
) {
  const { data: updated, error } = await supabase
    .from('cards')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  return updated;
}

export async function deleteCard(id: string) {
  const { error } = await supabase.from('cards').delete().eq('id', id);

  if (error) throw error;
}
