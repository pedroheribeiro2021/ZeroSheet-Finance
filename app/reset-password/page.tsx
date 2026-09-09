'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const MIN_LENGTH = 6;

export default function ResetPasswordPage() {
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // O link do email só estabelece sessão depois que o Supabase processa o
  // fragmento da URL — por isso o formulário fica escondido até o evento
  // PASSWORD_RECOVERY (ou uma sessão já existente, se o listener perder o
  // primeiro disparo).
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const handleSave = async () => {
    if (password.length < MIN_LENGTH) {
      setError(`A senha precisa ter pelo menos ${MIN_LENGTH} caracteres`);
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setError(error.message);
        return;
      }

      // scope: 'local' — só encerra ESTA sessão de recuperação. O padrão do
      // supabase-js é 'global', que revoga o refresh token de TODAS as
      // sessões do usuário (qualquer outra aba/dispositivo logado); usado
      // aqui isso derrubava sessões que não tinham nada a ver com a troca de
      // senha, quebrando o app nelas assim que tentassem renovar o token.
      await supabase.auth.signOut({ scope: 'local' });
      router.push('/login');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível salvar a senha',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="surface w-full max-w-sm grid gap-5 p-6 sm:p-8">
        <div className="grid gap-1.5 text-center">
          <Image
            src="/logo-mark.png"
            alt="ZeroSheet"
            width={48}
            height={48}
            className="mx-auto h-12 w-12 rounded-2xl shadow-lg shadow-black/40"
            priority
          />
          <h1 className="mt-2 text-2xl font-bold text-white">Nova senha</h1>
          <p className="text-sm text-zinc-500">Escolha uma nova senha de acesso</p>
        </div>

        {!ready ? (
          <p className="text-center text-sm text-zinc-500">
            Confirmando o link do email...
          </p>
        ) : (
          <>
            <div className="grid gap-3">
              <input
                type="password"
                placeholder="Nova senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field"
              />

              <input
                type="password"
                placeholder="Confirmar nova senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                className="field"
              />
            </div>

            {error && (
              <p className="rounded-lg border border-red-500/20 bg-red-500/10 p-2.5 text-sm text-red-400">
                {error}
              </p>
            )}

            <button onClick={handleSave} disabled={loading} className="btn-primary">
              {loading ? 'Salvando...' : 'Salvar nova senha'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
