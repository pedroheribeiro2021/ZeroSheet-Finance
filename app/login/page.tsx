'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { signIn } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    try {
      await signIn(email, password);

      router.push('/dashboard');
    } catch (err) {
      console.error(err);
      alert('Erro ao autenticar');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="bg-zinc-900 p-6 rounded w-full max-w-md grid gap-4">
        <h1 className="text-2xl font-bold text-white">
          ZeroSheet Finance
        </h1>

        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-zinc-800 p-2 rounded text-white"
        />

        <input
          type="password"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="bg-zinc-800 p-2 rounded text-white"
        />

        <button
          onClick={handleLogin}
          className="bg-green-600 p-2 rounded text-white"
        >
          Entrar
        </button>
      </div>
    </div>
  );
}
