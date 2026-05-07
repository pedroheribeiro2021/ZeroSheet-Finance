'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Sidebar() {
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();

    router.push('/login');
    router.refresh();
  };

  return (
    <aside className="w-64 bg-zinc-950 border-r border-zinc-800 min-h-screen p-4 flex flex-col">
      <h1 className="text-2xl font-bold text-white mb-8">ZeroSheet</h1>

      <nav className="flex flex-col gap-2">
        <Link href="/" className="text-zinc-300 hover:text-white transition">
          Dashboard
        </Link>

        <Link
          href="/transactions"
          className="text-zinc-300 hover:text-white transition"
        >
          Transações
        </Link>

        <Link
          href="/installments"
          className="text-zinc-300 hover:text-white transition"
        >
          Parcelamentos
        </Link>

        <Link
          href="/cards"
          className="text-zinc-300 hover:text-white transition"
        >
          Cartões
        </Link>

        <Link
          href="/settings"
          className="text-zinc-300 hover:text-white transition"
        >
          Configurações
        </Link>
      </nav>

      <button
        onClick={handleLogout}
        className="mt-auto bg-red-600 hover:bg-red-700 text-white rounded p-2"
      >
        Logout
      </button>
    </aside>
  );
}
