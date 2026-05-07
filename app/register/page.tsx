'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function RegisterPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleRegister = async () => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert('Conta criada com sucesso!');

    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="bg-zinc-900 p-8 rounded w-full max-w-md grid gap-4">
        <h1 className="text-2xl font-bold text-white">Criar Conta</h1>

        <input
          type="email"
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

        <button
          onClick={handleRegister}
          className="bg-green-600 hover:bg-green-700 p-3 rounded text-white"
        >
          Criar conta
        </button>
      </div>
    </div>
  );
}
