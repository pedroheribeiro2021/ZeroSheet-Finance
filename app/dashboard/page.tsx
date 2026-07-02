import { Suspense } from 'react';

import Dashboard from '@/components/dashboard/Dashboard';

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="p-6 text-white">Carregando...</div>}>
      <Dashboard />
    </Suspense>
  );
}
