'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/ToastProvider';

export default function RegisterPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleRegister = async () => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      showToast(error.message, 'error');
      return;
    }

    showToast('Conta criada com sucesso!');

    router.push('/login');
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="surface w-full max-w-sm grid gap-5 p-6 sm:p-8">
        <div className="grid gap-1.5 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-lg font-bold text-white shadow-lg shadow-blue-950/40">
            Z
          </div>
          <h1 className="mt-2 text-2xl font-bold text-white">Criar Conta</h1>
          <p className="text-sm text-zinc-500">Comece a organizar suas finanças</p>
        </div>

        <div className="grid gap-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
            className="field"
          />

          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
            className="field"
          />
        </div>

        <button onClick={handleRegister} className="btn-success">
          Criar conta
        </button>

        <button
          onClick={() => router.push('/login')}
          className="text-zinc-400 text-sm hover:text-white transition"
        >
          Já tem conta? <span className="text-blue-400">Voltar para o login</span>
        </button>
      </div>
    </div>
  );
}
