import { Suspense } from 'react';

import Dashboard from '@/components/dashboard/Dashboard';
import PageLoading from '@/components/ui/PageLoading';

export default function DashboardPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Dashboard />
    </Suspense>
  );
}
