import { supabase } from '@/lib/supabase';
import { getCurrentUser } from './auth.service';
import { DBCardReading } from '@/core/types/database';

/**
 * Retorna as leituras de fatura de um cartão num mês, ordenadas por read_at.
 * Retorna array vazio se a tabela ainda não existir (antes da migration).
 */
export async function getReadings(
  monthId: string,
  cardId: string,
): Promise<DBCardReading[]> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { data, error } = await supabase
    .from('card_readings')
    .select('*')
    .eq('user_id', user.id)
    .eq('month_id', monthId)
    .eq('card_id', cardId)
    .order('read_at');

  if (error) {
    // tabela ainda não existe — trata como ausência neutra
    if (error.code === '42P01') return [];
    throw error;
  }

  return (data ?? []) as DBCardReading[];
}

export async function addReading(data: {
  month_id: string;
  card_id: string;
  amount: number;
  read_at?: string;
}): Promise<DBCardReading> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { data: created, error } = await supabase
    .from('card_readings')
    .insert({
      ...data,
      user_id: user.id,
      read_at: data.read_at ?? new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;

  return created as DBCardReading;
}

export async function deleteReading(id: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { error } = await supabase
    .from('card_readings')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw error;
}
