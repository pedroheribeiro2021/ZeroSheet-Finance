import { getCurrentUser } from './auth.service';
import { supabase } from '@/lib/supabase';
import { copyRecurringTransactions } from './transaction.service';

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
    Busca último mês
    para copiar recorrências
  */

  const { data: existingMonths, error: existingMonthsError } = await supabase
    .from('months')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at');

  if (existingMonthsError) {
    throw existingMonthsError;
  }

  const lastMonth = existingMonths?.[existingMonths.length - 1];

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
