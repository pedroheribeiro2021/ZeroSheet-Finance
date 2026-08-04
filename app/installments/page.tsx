import { Suspense } from 'react';

import InstallmentsView from '@/components/installments/InstallmentsView';
import PageLoading from '@/components/ui/PageLoading';

export default function InstallmentsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <InstallmentsView />
    </Suspense>
  );
}
