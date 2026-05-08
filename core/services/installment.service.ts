import { getCurrentUser } from './auth.service';
import { supabase } from '@/lib/supabase';

export async function getInstallments(monthId: string) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Usuário não autenticado');
  }

  const { data: months, error: monthsError } = await supabase
    .from('months')
    .select('*')
    .eq('user_id', user.id)
    .order('year', { ascending: true })
    .order('month', { ascending: true });

  if (monthsError) throw monthsError;

  const currentMonthIndex = months.findIndex((m) => m.id === monthId);
  if (currentMonthIndex === -1) return [];

  const { data: installments, error } = await supabase
    .from('installments')
    .select(
      `
    *,
    cards (
      id,
      name
    )
  `,
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const activeInstallments = installments.filter((i) => {
    const startIndex = months.findIndex((m) => m.id === i.start_month_id);

    if (startIndex === -1) return false;

    const endIndex = startIndex + i.total_installments - 1;

    return currentMonthIndex >= startIndex && currentMonthIndex <= endIndex;
  });

  return activeInstallments;
}

export async function createInstallment(data: {
  description: string;
  card_id: string;
  total_amount: number;
  installment_amount: number;
  total_installments: number;
  start_month_id: string;
}) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Usuário não autenticado');
  }

  const { error } = await supabase.from('installments').insert([
    {
      description: data.description,
      card_id: data.card_id,
      total_amount: data.total_amount,
      installment_amount: data.installment_amount,
      total_installments: data.total_installments,
      current_installment: 1,
      start_month_id: data.start_month_id,
      user_id: user.id,
    },
  ]);

  if (error) throw error;
}

export async function deleteInstallment(id: string) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Usuário não autenticado');
  }

  const { error } = await supabase
    .from('installments')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw error;
}
