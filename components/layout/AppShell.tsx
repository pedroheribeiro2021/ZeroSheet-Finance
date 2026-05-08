'use client';

import Sidebar from './Sidebar';

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-black text-white flex">
      <Sidebar collapsed={false} mobileOpen={false} onToggleCollapse={function (): void {
              throw new Error('Function not implemented.');
          } } onCloseMobile={function (): void {
              throw new Error('Function not implemented.');
          } } />

      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}
