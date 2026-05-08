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

  if (error) {
    throw error;
  }

  return data;
}

export async function createCard(input: {
  name: string;
  brand?: string;
  limit_amount: number;
  closing_day: number;
  due_day: number;
  color?: string;
}) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Usuário não autenticado');
  }

  const { data, error } = await supabase
    .from('cards')
    .insert({
      ...input,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}
