import { Suspense } from 'react';

import TransactionsView from '@/components/transactions/TransactionsView';
import PageLoading from '@/components/ui/PageLoading';

export default function TransactionsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <TransactionsView />
    </Suspense>
  );
}
