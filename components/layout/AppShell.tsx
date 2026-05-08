'use client';

import Sidebar from './Sidebar';

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-black text-white flex">
      <Sidebar />

      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}
