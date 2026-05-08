'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { supabase } from '@/lib/supabase';

const items = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    shortLabel: 'DB',
  },
  {
    label: 'Transações',
    href: '/transactions',
    shortLabel: 'TR',
  },
  {
    label: 'Parcelamentos',
    href: '/installments',
    shortLabel: 'PA',
  },
  {
    label: 'Cartões',
    href: '/cards',
    shortLabel: 'CT',
  },
];

type SidebarProps = {
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
};

export default function Sidebar({
  collapsed,
  mobileOpen,
  onToggleCollapse,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-72 -translate-x-full flex-col border-r border-zinc-800 bg-zinc-950 p-4 transition-transform duration-300 md:w-auto md:translate-x-0 ${
        mobileOpen ? 'translate-x-0' : ''
      } ${collapsed ? 'md:w-20' : 'md:w-64'}`}
    >
      <div className="mb-8 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-white">
            {collapsed && !mobileOpen ? 'ZS' : 'ZeroSheet'}
          </h1>
        </div>

        <button
          onClick={onToggleCollapse}
          className="hidden rounded bg-zinc-900 px-3 py-2 text-white transition hover:bg-zinc-800 md:block"
          aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
        >
          {collapsed ? '->' : '<-'}
        </button>

        <button
          onClick={onCloseMobile}
          className="rounded bg-zinc-900 px-3 py-2 text-white transition hover:bg-zinc-800 md:hidden"
          aria-label="Fechar menu"
        >
          X
        </button>
      </div>

      <nav className="grid gap-2">
        {items.map((item) => {
          const active = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onCloseMobile}
              className={`flex items-center gap-3 rounded p-3 transition ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-zinc-300 hover:bg-zinc-900'
              } ${collapsed ? 'justify-center md:px-2' : ''}`}
              title={collapsed && !mobileOpen ? item.label : undefined}
            >
              <span className="text-xs font-bold tracking-wide text-zinc-200">
                {item.shortLabel}
              </span>
              {(!collapsed || mobileOpen) && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={handleLogout}
        className={`mt-auto rounded bg-red-600 p-3 text-white transition hover:bg-red-700 ${
          collapsed ? 'md:px-2' : ''
        }`}
      >
        {collapsed && !mobileOpen ? 'Out' : 'Logout'}
      </button>
    </aside>
  );
}
