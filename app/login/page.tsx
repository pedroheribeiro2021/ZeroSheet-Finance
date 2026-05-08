'use client';

import { useState } from 'react';
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
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="bg-zinc-900 p-6 rounded w-full max-w-sm grid gap-4">
        <h1 className="text-white text-2xl font-bold">Login</h1>

        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-zinc-800 p-3 rounded text-white"
        />

        <input
          type="password"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="bg-zinc-800 p-3 rounded text-white"
        />

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="bg-blue-600 p-3 rounded text-white"
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>

        <button
          onClick={() => router.push('/register')}
          className="text-zinc-400 text-sm"
        >
          Criar conta
        </button>
      </div>
    </div>
  );
}
