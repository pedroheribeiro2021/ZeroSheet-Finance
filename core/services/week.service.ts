import { supabase } from '@/lib/supabase';
import { getCurrentUser } from './auth.service';
import { DBWeek } from '@/core/types/database';

/**
 * Orçamentos semanais já congelados de uma competência — usados só pra
 * exibir "orçamento inicial da semana" ao lado do orçamento recalculado
 * (`summary.weeklyBudget`), que muda a cada leitura de fatura nova.
 */
export async function getWeekBudgets(monthId: string): Promise<DBWeek[]> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { data, error } = await supabase
    .from('weeks')
    .select('*')
    .eq('user_id', user.id)
    .eq('month_id', monthId);

  if (error) {
    // tabela ainda não existe (ambiente sem essa migration) — trata como ausência
    if (error.code === '42P01') return [];
    throw error;
  }

  return (data ?? []) as DBWeek[];
}

/**
 * Congela o orçamento semanal vigente na PRIMEIRA vez que essa semana é
 * observada. `ignoreDuplicates` faz o insert virar no-op se a semana já foi
 * congelada antes — nunca sobrescreve, é isso que torna o valor um "retrato
 * do início da semana" em vez de mais um número que recalcula.
 */
export async function freezeWeekBudget(
  monthId: string,
  index: number,
  budget: number,
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { error } = await supabase.from('weeks').upsert(
    { month_id: monthId, index, budget, user_id: user.id },
    { onConflict: 'month_id,index', ignoreDuplicates: true },
  );

  if (error && error.code !== '42P01') throw error;
}
