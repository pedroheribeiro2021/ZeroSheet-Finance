import { getCurrentUser } from './auth.service';
import { supabase } from '@/lib/supabase';
import { copyRecurringTransactions } from './transaction.service';
import { findPreviousMonth } from '@/core/engine/month';

export async function getMonths() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Usuário não autenticado');
  }

  const { data, error } = await supabase
    .from('months')
    .select('*')
    .eq('user_id', user.id)
    .order('year')
    .order('month');

  if (error) throw error;

  return data;
}

export async function createMonth(month: number, year: number) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Usuário não autenticado');
  }

  /*
    PRIMEIRO:
    verifica se o mês já existe
  */

  const { data: existingMonth, error: existingMonthError } = await supabase
    .from('months')
    .select('*')
    .eq('user_id', user.id)
    .eq('month', month)
    .eq('year', year)
    .maybeSingle();

  if (existingMonthError) {
    throw existingMonthError;
  }

  /*
    Se já existir:
    retorna o existente
  */

  if (existingMonth) {
    return existingMonth;
  }

  /*
    Busca o mês anterior POR COMPETÊNCIA (não por created_at) para copiar as
    recorrências: abrir um mês retroativo depois de um mais novo não pode
    fazer a cópia puxar do mês errado.
  */

  const { data: existingMonths, error: existingMonthsError } = await supabase
    .from('months')
    .select('*')
    .eq('user_id', user.id)
    .order('year')
    .order('month');

  if (existingMonthsError) {
    throw existingMonthsError;
  }

  const lastMonth = findPreviousMonth(existingMonths ?? [], { month, year });

  /*
    Cria novo mês
  */

  const { data, error } = await supabase
    .from('months')
    .insert({
      month,
      year,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  /*
    Copia recorrências
  */

  if (lastMonth) {
    await copyRecurringTransactions(lastMonth.id, data.id, { month, year });
  }

  return data;
}
