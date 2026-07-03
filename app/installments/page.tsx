'use client';

import { useEffect, useState } from 'react';

import InstallmentForm from '@/components/installments/InstallmentForm';
import InstallmentList from '@/components/installments/InstallmentList';
import { getInstallments } from '@/core/services/installment.service';
import type { ActiveInstallment } from '@/core/services/installment.service';
import { createMonth, getMonths } from '@/core/services/month.service';

export default function InstallmentsPage() {
  const [monthId, setMonthId] = useState<string | null>(null);
  const [monthLabel, setMonthLabel] = useState<string>('');
  const [installments, setInstallments] = useState<ActiveInstallment[]>([]);

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
      setMonthLabel(
        new Intl.DateTimeFormat('pt-BR', {
          month: 'long',
          year: 'numeric',
        }).format(new Date(latestMonth.year, latestMonth.month - 1)),
      );

      const installmentsData = await getInstallments(latestMonth.id);
      setInstallments(installmentsData);
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
      <h1 className="text-2xl font-bold text-white">Parcelamentos</h1>

      <InstallmentForm monthId={monthId} monthLabel={monthLabel} onCreated={load} />
      <InstallmentList installments={installments} onUpdated={load} />
    </div>
  );
}
