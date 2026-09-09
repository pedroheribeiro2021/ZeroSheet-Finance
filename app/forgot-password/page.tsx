'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    try {
      setLoading(true);
      setError('');

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        setError(error.message);
        return;
      }

      setSent(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível enviar o email',
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
          <h1 className="mt-2 text-2xl font-bold text-white">
            Esqueceu a senha?
          </h1>
          <p className="text-sm text-zinc-500">
            Enviamos um link de redefinição para o seu email.
          </p>
        </div>

        {sent ? (
          <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-400">
            Se esse email tiver uma conta, você vai receber um link para
            criar uma nova senha.
          </p>
        ) : (
          <>
            <input
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              className="field"
            />

            {error && (
              <p className="rounded-lg border border-red-500/20 bg-red-500/10 p-2.5 text-sm text-red-400">
                {error}
              </p>
            )}

            <button
              onClick={handleSend}
              disabled={loading || !email}
              className="btn-primary"
            >
              {loading ? 'Enviando...' : 'Enviar link'}
            </button>
          </>
        )}

        <Link
          href="/login"
          className="text-center text-zinc-400 text-sm hover:text-white transition"
        >
          Voltar para o login
        </Link>
      </div>
    </div>
  );
}
