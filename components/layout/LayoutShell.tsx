'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { supabase } from '@/lib/supabase';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/transactions': 'Transações',
  '/installments': 'Parcelamentos',
  '/cards': 'Cartões',
  '/settings': 'Configurações',
  '/planning': 'Planejamento',
};

export default function LayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');

  const isAuthPage =
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password');

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(saved === 'true');
  }, []);

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false);
  }, [pathname]);

  // Sem isso, uma sessão que morre (refresh token revogado/expirado — em
  // qualquer aba, não só a que fez a ação) deixava a página logada
  // renderizando quebrada, com os serviços rejeitando com "Usuário não
  // autenticado" em vez de mandar pra tela de login.
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUserEmail(session?.user?.email ?? '');
        setUserName(session?.user?.user_metadata?.full_name ?? '');

        if (event === 'SIGNED_OUT' && !isAuthPage) {
          router.push('/login');
        }
      },
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [isAuthPage, router]);

  if (isAuthPage) {
    return <main className="min-h-screen">{children}</main>;
  }

  const pageTitle = pageTitles[pathname] ?? 'ZeroSheet';

  return (
    <div className="flex min-h-screen text-white">
      {mobileOpen && (
        <button
          aria-label="Fechar menu"
          style={{ animation: 'fade-in 150ms ease-out' }}
          className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div
        className={`
      flex min-w-0 flex-1 flex-col transition-all duration-300
      md:ml-20
      ${collapsed ? 'md:ml-20' : 'md:ml-64'}
    `}
      >
        <Topbar
          pageTitle={pageTitle}
          userEmail={userEmail}
          userName={userName}
          onMenuClick={() => setMobileOpen(true)}
        />

        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
