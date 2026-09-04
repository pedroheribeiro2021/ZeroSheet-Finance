import { supabase } from '@/lib/supabase';
import { getCurrentUser } from './auth.service';
import { DEFAULT_PAYDAY, PaydayMode, PaydaySettings } from '@/core/engine/payday';
import { DBUserSettings } from '@/core/types/database';

/**
 * Configurações do usuário (tabela `user_settings`, uma linha por pessoa).
 * Hoje só carrega a regra de recebimento do salário; é o lugar natural para
 * as próximas preferências que hoje o app adivinha.
 *
 * Ausência de linha NÃO é erro: usuário que nunca abriu Configurações
 * simplesmente não tem uma, e quem chama decide o fallback.
 */
export async function getUserSettings(): Promise<DBUserSettings | null> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw error;

  return (data as DBUserSettings | null) ?? null;
}

export async function savePaydaySettings(
  settings: PaydaySettings,
): Promise<DBUserSettings> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { data, error } = await supabase
    .from('user_settings')
    .upsert(
      {
        user_id: user.id,
        payday_mode: settings.mode,
        payday_day: settings.day,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    .select()
    .single();

  if (error) throw error;

  return data as DBUserSettings;
}

/** Linha do banco → configuração de domínio, com defaults sãos. */
export function toPaydaySettings(
  row: DBUserSettings | null,
): PaydaySettings | null {
  if (!row) return null;

  const mode: PaydayMode =
    row.payday_mode === 'business-day' ? 'business-day' : 'fixed-day';

  const day = Number(row.payday_day);

  return {
    mode,
    day: Number.isFinite(day) && day > 0 ? day : DEFAULT_PAYDAY.day,
  };
}
