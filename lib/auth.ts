import { supabase } from './supabase';
import { getCurrentUser } from '@/core/services/auth.service';

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;

  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();

  if (error) throw error;
}

// Ambos passam pelo resolvedor memoizado de `auth.service` — ver o comentário
// lá: `supabase.auth.getUser()` é uma ida à rede por chamada, e era a causa
// da demora para os números aparecerem no dashboard.
export async function getUser() {
  return getCurrentUser();
}

export async function getCurrentUserId() {
  const user = await getCurrentUser();

  if (!user?.id) {
    throw new Error('Usuário não autenticado');
  }

  return user.id;
}
