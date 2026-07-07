'use client';

import { useEffect, useState } from 'react';

import InstallmentForm from '@/components/installments/InstallmentForm';
import InstallmentList from '@/components/installments/InstallmentList';
import PageLoading from '@/components/ui/PageLoading';
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
    return <PageLoading />;
  }

  return (
    <div className="grid gap-4 p-4 sm:gap-5 sm:p-6">
      <h1 className="text-xl font-bold text-white sm:text-2xl">Parcelamentos</h1>

      <InstallmentForm monthId={monthId} monthLabel={monthLabel} onCreated={load} />
      <InstallmentList installments={installments} onUpdated={load} />
    </div>
  );
}
