import { Suspense } from 'react';

import CardsView from '@/components/cards/CardsView';
import PageLoading from '@/components/ui/PageLoading';

export default function CardsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <CardsView />
    </Suspense>
  );
}
