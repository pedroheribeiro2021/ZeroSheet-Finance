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

/**
 * Leituras de fatura de TODOS os cartões no mês — usado pela cobertura até o
 * salário, que precisa do valor do ciclo em aberto de cada cartão, não só do
 * principal. Mesma tolerância à tabela inexistente de `getReadings`.
 */
export async function getAllReadings(monthId: string): Promise<DBCardReading[]> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { data, error } = await supabase
    .from('card_readings')
    .select('*')
    .eq('user_id', user.id)
    .eq('month_id', monthId)
    .order('read_at');

  if (error) {
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

/**
 * Registra uma leitura a partir da atualização da fatura no módulo Cartões
 * (`CardSnapshotForm`), sem duplicar: se já existe uma leitura com o mesmo
 * valor no mesmo dia para esse cartão/mês, não lança de novo.
 *
 * `read_at`, quando informado, é usado no lugar de "agora" — necessário ao
 * confirmar a fatura de uma competência cujo ciclo já fechou (ver
 * `PendingInvoiceForm`): sem isso, a leitura ficaria datada de hoje e
 * vazaria pro ciclo da competência seguinte só por coincidência de data
 * (`getReadingsInRange` filtra por `read_at`, não por `month_id`).
 */
export async function recordSnapshotAsReading(data: {
  month_id: string;
  card_id: string;
  amount: number;
  read_at?: string;
}): Promise<DBCardReading | null> {
  const existing = await getReadings(data.month_id, data.card_id);

  const targetDay = new Date(data.read_at ?? new Date()).toDateString();
  const isDuplicate = existing.some(
    (r) =>
      Number(r.amount) === data.amount &&
      new Date(r.read_at).toDateString() === targetDay,
  );

  if (isDuplicate) return null;

  return addReading(data);
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
