'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    try {
      setLoading(true);
      setError('');

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        return;
      }

      // 🔥 MUITO IMPORTANTE
      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
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
          <h1 className="mt-2 text-2xl font-bold text-white">Bem-vindo de volta</h1>
          <p className="text-sm text-zinc-500">Entre na sua conta ZeroSheet</p>
        </div>

        <div className="grid gap-3">
          <input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            className="field"
          />

          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            className="field"
          />
        </div>

        {error && (
          <p className="rounded-lg border border-red-500/20 bg-red-500/10 p-2.5 text-sm text-red-400">
            {error}
          </p>
        )}

        <button onClick={handleLogin} disabled={loading} className="btn-primary">
          {loading ? 'Entrando...' : 'Entrar'}
        </button>

        <button
          onClick={() => router.push('/register')}
          className="text-zinc-400 text-sm hover:text-white transition"
        >
          Não tem conta? <span className="text-blue-400">Criar conta</span>
        </button>
      </div>
    </div>
  );
}
