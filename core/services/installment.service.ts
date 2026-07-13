import { getCurrentUser } from './auth.service';
import { supabase } from '@/lib/supabase';
import { filterActiveInstallments } from '@/core/engine/installments';
import { DBInstallment, DBMonth } from '@/core/types/database';

export type ActiveInstallment = DBInstallment & {
  currentInstallment: number;
  /** Mês da 1ª parcela (para exibir "Início: jul/2026"). */
  startMonth: DBMonth | null;
};

export async function getInstallments(
  monthId: string,
): Promise<ActiveInstallment[]> {
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

  const active = filterActiveInstallments(
    installments as DBInstallment[],
    months as DBMonth[],
    monthId,
  );

  const monthById = new Map((months as DBMonth[]).map((m) => [m.id, m]));

  return active.map((i) => ({
    ...i,
    startMonth: i.start_month_id
      ? (monthById.get(i.start_month_id) ?? null)
      : null,
  }));
}

export async function createInstallment(data: {
  description: string;
  card_id: string;
  total_amount: number;
  installment_amount: number;
  total_installments: number;
  start_month_id: string;
  billing_day?: number | null;
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
      billing_day: data.billing_day ?? null,
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
