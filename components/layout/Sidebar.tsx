'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  {
    label: 'Dashboard',
    href: '/dashboard',
  },
  {
    label: 'Transações',
    href: '/transactions',
  },
  {
    label: 'Parcelamentos',
    href: '/installments',
  },
  {
    label: 'Cartões',
    href: '/cards',
  },
  {
    label: 'Planejamento',
    href: '/planning',
  },
  {
    label: 'Configurações',
    href: '/settings',
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-zinc-950 border-r border-zinc-800 p-4">
      <h1 className="text-xl font-bold mb-8">ZeroSheet</h1>

      <nav className="grid gap-2">
        {items.map((item) => {
          const active = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`p-3 rounded transition ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-zinc-900 text-zinc-300'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
