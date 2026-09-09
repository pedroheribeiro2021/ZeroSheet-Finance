'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/ToastProvider';

export default function RegisterPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleRegister = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      showToast('Preencha nome e sobrenome', 'error');
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          full_name: `${firstName.trim()} ${lastName.trim()}`,
        },
      },
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
          <Image
            src="/logo-mark.png"
            alt="ZeroSheet"
            width={48}
            height={48}
            className="mx-auto h-12 w-12 rounded-2xl shadow-lg shadow-black/40"
            priority
          />
          <h1 className="mt-2 text-2xl font-bold text-white">Criar Conta</h1>
          <p className="text-sm text-zinc-500">Comece a organizar suas finanças</p>
        </div>

        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Nome"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
              className="field"
            />

            <input
              placeholder="Sobrenome"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
              className="field"
            />
          </div>

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
