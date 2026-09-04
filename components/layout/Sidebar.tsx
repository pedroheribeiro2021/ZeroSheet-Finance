'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Layers,
  CreditCard,
  Wallet,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X,
  type LucideIcon,
} from 'lucide-react';

import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/ToastProvider';

const items: { label: string; href: string; icon: LucideIcon }[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Transações', href: '/transactions', icon: ArrowLeftRight },
  { label: 'Parcelamentos', href: '/installments', icon: Layers },
  { label: 'Cartões', href: '/cards', icon: CreditCard },
  { label: 'Contas', href: '/accounts', icon: Wallet },
  { label: 'Configurações', href: '/settings', icon: Settings },
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
  const { showToast } = useToast();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    showToast('Sessão encerrada');
    router.push('/login');
    router.refresh();
  };

  const showLabels = !collapsed || mobileOpen;

  return (
    <aside
      className={`
    fixed inset-y-0 left-0 z-40
    flex flex-col
    border-r border-white/[0.06]
    bg-zinc-950
    p-3
    shadow-2xl shadow-black/50
    transition-transform duration-300 ease-out
    md:shadow-none md:transition-[width]

    ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}

    md:translate-x-0
    ${collapsed ? 'md:w-20' : 'md:w-64'}
    w-72 max-w-[80vw]
  `}
    >
      <div className="mb-6 flex items-center justify-between gap-2 px-1 pt-1">
        <div className="flex min-w-0 items-center gap-2.5">
          <Image
            src="/logo-mark.png"
            alt="ZeroSheet"
            width={36}
            height={36}
            className="h-9 w-9 shrink-0 rounded-xl shadow-lg shadow-black/40"
            priority
          />
          {showLabels && (
            <h1 className="truncate text-lg font-bold text-white">ZeroSheet</h1>
          )}
        </div>

        <button
          onClick={onToggleCollapse}
          className="btn-icon hidden h-9 w-9 md:flex"
          aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        <button
          onClick={onCloseMobile}
          className="btn-icon h-9 w-9 md:hidden"
          aria-label="Fechar menu"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="grid gap-1">
        {items.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onCloseMobile}
              className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? 'bg-blue-600/15 text-white'
                  : 'text-zinc-400 hover:bg-white/5 hover:text-white'
              } ${collapsed ? 'md:justify-center md:px-2' : ''}`}
              title={collapsed && !mobileOpen ? item.label : undefined}
            >
              <span
                className={`absolute top-1/2 left-0 h-5 w-1 -translate-y-1/2 rounded-r-full bg-blue-500 transition-opacity ${
                  active ? 'opacity-100' : 'opacity-0'
                }`}
              />
              <Icon
                size={19}
                strokeWidth={2}
                className={`shrink-0 ${active ? 'text-blue-400' : 'text-zinc-500 group-hover:text-zinc-300'}`}
              />
              {showLabels && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={handleLogout}
        className={`mt-auto flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-400 transition hover:bg-red-500/10 hover:text-red-300 ${
          collapsed ? 'md:justify-center md:px-2' : ''
        }`}
      >
        <LogOut size={19} strokeWidth={2} className="shrink-0" />
        {showLabels && <span>Sair</span>}
      </button>
    </aside>
  );
}
