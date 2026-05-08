'use client';

import { useEffect, useState } from 'react';

import CardSnapshotForm from '@/components/cards/CardSnapshotForm';
import { createMonth, getMonths } from '@/core/services/month.service';

export default function CardsPage() {
  const [monthId, setMonthId] = useState<string | null>(null);

  const load = async () => {
    try {
      let monthsData = await getMonths();

      if (!monthsData.length) {
        const now = new Date();
        const newMonth = await createMonth(
          now.getMonth() + 1,
          now.getFullYear(),
        );

        monthsData = [newMonth];
      }

      const latestMonth = monthsData[monthsData.length - 1];
      setMonthId(latestMonth.id);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (!monthId) {
    return <div className="p-6 text-white">Carregando...</div>;
  }

  return (
    <div className="p-6 grid gap-4">
      <h1 className="text-2xl font-bold text-white">Cartões</h1>

      <CardSnapshotForm monthId={monthId} onUpdated={load} />
    </div>
  );
}
