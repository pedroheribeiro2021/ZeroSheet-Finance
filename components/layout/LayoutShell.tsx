'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { getCurrentUser } from '@/core/services/auth.service';

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
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  const isAuthPage =
    pathname.startsWith('/login') || pathname.startsWith('/register');

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    setCollapsed(saved === 'true');
  }, []);

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await getCurrentUser();
        setUserEmail(user?.email ?? '');
      } catch (err) {
        console.error(err);
      }
    };

    loadUser();
  }, []);

  if (isAuthPage) {
    return <main className="min-h-screen">{children}</main>;
  }

  const pageTitle = pageTitles[pathname] ?? 'ZeroSheet';

  return (
    <div className="flex min-h-screen bg-black text-white">
      {mobileOpen && (
        <button
          aria-label="Fechar menu"
          className="fixed inset-0 z-30 bg-black/70 md:hidden"
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
        className={`hidden shrink-0 md:block ${
          collapsed ? 'w-20' : 'w-64'
        }`}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          pageTitle={pageTitle}
          userEmail={userEmail}
          onMenuClick={() => setMobileOpen(true)}
        />

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
