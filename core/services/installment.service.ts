/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '@/lib/supabase';

export async function getInstallments() {
  const { data, error } = await supabase.from('installments').select('*');

  if (error) throw error;

  return data;
}

export async function createInstallment(data: any) {
  const { error } = await supabase.from('installments').insert(data);

  if (error) throw error;
}
