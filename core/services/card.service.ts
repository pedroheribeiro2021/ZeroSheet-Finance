import { supabase } from '@/lib/supabase';
import { getCurrentUser } from './auth.service';
import { DBCard } from '@/core/types/database';

export async function getCards(): Promise<DBCard[]> {
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

  return (data ?? []) as DBCard[];
}

export async function createCard(data: {
  name: string;
  slug: string;
  color?: string;
  limit_amount?: number;
  closing_day?: number;
  due_day?: number;
}): Promise<DBCard> {
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

  return created as DBCard;
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
): Promise<DBCard> {
  const { data: updated, error } = await supabase
    .from('cards')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  return updated as DBCard;
}

/**
 * Marca o cartão `id` como principal e desmarca todos os demais do mesmo
 * usuário — garante que só exista um principal por vez.
 * Trata ausência da coluna is_primary (antes da migration) como neutro.
 */
export async function setPrimaryCard(id: string): Promise<void> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Usuário não autenticado');
  }

  // Desmarca todos do usuário primeiro
  await supabase
    .from('cards')
    .update({ is_primary: false })
    .eq('user_id', user.id);

  // Marca o escolhido
  const { error } = await supabase
    .from('cards')
    .update({ is_primary: true })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw error;
}

export async function deleteCard(id: string) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Usuário não autenticado');
  }

  const { error } = await supabase
    .from('cards')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw error;
}
