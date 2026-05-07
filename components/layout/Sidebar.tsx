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
    label: 'Parcelas',
    href: '/installments',
  },
  {
    label: 'Cartões',
    href: '/cards',
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  if (pathname === '/login') {
    return null;
  }

  return (
    <div className="w-64 bg-zinc-950 border-r border-zinc-800 min-h-screen p-4">
      <h1 className="text-white text-xl font-bold mb-8">
        ZeroSheet
      </h1>

      <div className="grid gap-2">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`p-3 rounded text-sm transition ${
              pathname === item.href
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:bg-zinc-900'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
