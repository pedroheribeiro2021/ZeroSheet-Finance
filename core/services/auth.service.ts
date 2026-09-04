import type { User } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

/**
 * Usuário logado, resolvido LOCALMENTE e memoizado.
 *
 * Por que não `supabase.auth.getUser()`: aquele método bate em
 * `/auth/v1/user` no servidor a CADA chamada. Como todo service do app começa
 * com `const user = await getCurrentUser()`, abrir o dashboard disparava mais
 * de uma dezena dessas idas — e em série, porque cada uma acontece ANTES da
 * query que ela habilita, então o `Promise.all` dos dados não ajudava em nada.
 * Medido em produção: ~13 chamadas a `/auth/v1/user`, 250–1100ms cada,
 * empilhando ~5s antes de o primeiro número aparecer na tela. Era isso, e não
 * o banco, que fazia o dashboard demorar.
 *
 * `getSession()` lê a sessão já persistida no storage do navegador (e só vai à
 * rede quando o token está para expirar). Fora do primeiro acesso, o cache
 * abaixo nem isso precisa.
 *
 * É seguro: o `user.id` daqui serve só para montar o filtro `eq('user_id', …)`
 * das queries. Quem garante a propriedade dos dados é o RLS do Postgres, que
 * valida o JWT no servidor a cada request. Um token adulterado no storage não
 * "libera" nada — só produz queries que o RLS recusa.
 */
let cachedUser: User | null = null;
let inFlight: Promise<User | null> | null = null;

// Login, logout, refresh de token e o INITIAL_SESSION do boot passam por aqui —
// é o único ponto que invalida o cache, então ele nunca fica velho.
supabase.auth.onAuthStateChange((_event, session) => {
  cachedUser = session?.user ?? null;
  inFlight = null;
});

export async function getCurrentUser(): Promise<User | null> {
  if (cachedUser) return cachedUser;

  // Chamadas concorrentes (o dashboard dispara várias no mesmo tick)
  // compartilham a mesma promessa em vez de cada uma resolver a sua.
  if (!inFlight) {
    inFlight = supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) throw error;

        cachedUser = data.session?.user ?? null;
        return cachedUser;
      })
      .finally(() => {
        inFlight = null;
      });
  }

  return inFlight;
}

/**
 * Revalida o usuário contra o servidor de auth. Use só onde a identidade
 * precisa ser confirmada de verdade (não em leitura de dados, que o RLS já
 * protege).
 */
export async function fetchCurrentUserFromServer(): Promise<User | null> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw error;

  cachedUser = user;
  return user;
}
