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
 * Leituras de um cartão num intervalo de datas (`read_at`), ignorando
 * `month_id` — o ciclo de fatura quase sempre atravessa a virada de
 * competência (ex.: fecha dia 4, ciclo 04/07–03/08), então uma leitura de
 * julho pode pertencer ao mesmo ciclo que está sendo exibido em agosto.
 * Filtrar só por `month_id` (como `getReadings`) esconde essas leituras
 * antigas do acompanhamento semanal assim que a competência vira. Use isso
 * pra qualquer visão baseada no CICLO da fatura; `getReadings` continua
 * certo pra listagens por competência (ex.: limpeza de leituras do mês).
 *
 * `start`/`end` são tratados como dias inteiros (00:00–23:59:59.999): uma
 * leitura lançada à noite do último dia do ciclo não pode cair fora por
 * `end` ser meia-noite.
 */
export async function getReadingsInRange(
  cardId: string,
  start: Date,
  end: Date,
): Promise<DBCardReading[]> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Usuário não autenticado');

  const startOfDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endOfDay = new Date(
    end.getFullYear(),
    end.getMonth(),
    end.getDate(),
    23,
    59,
    59,
    999,
  );

  const { data, error } = await supabase
    .from('card_readings')
    .select('*')
    .eq('user_id', user.id)
    .eq('card_id', cardId)
    .gte('read_at', startOfDay.toISOString())
    .lte('read_at', endOfDay.toISOString())
    .order('read_at');

  if (error) {
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
 */
export async function recordSnapshotAsReading(data: {
  month_id: string;
  card_id: string;
  amount: number;
}): Promise<DBCardReading | null> {
  const existing = await getReadings(data.month_id, data.card_id);

  const today = new Date().toDateString();
  const isDuplicate = existing.some(
    (r) =>
      Number(r.amount) === data.amount &&
      new Date(r.read_at).toDateString() === today,
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
