'use client';

import { useEffect, useState } from 'react';

import InstallmentForm from '@/components/installments/InstallmentForm';
import InstallmentList from '@/components/installments/InstallmentList';
import MonthSelect, { formatMonthLabel } from '@/components/ui/MonthSelect';
import PageLoading from '@/components/ui/PageLoading';
import { getInstallments } from '@/core/services/installment.service';
import type { ActiveInstallment } from '@/core/services/installment.service';
import { useActiveMonth } from '@/core/hooks/useActiveMonth';

export default function InstallmentsView() {
  const { months, activeMonth, goToMonth } = useActiveMonth();

  const [installments, setInstallments] = useState<ActiveInstallment[]>([]);

  const load = async (monthId: string) => {
    try {
      const installmentsData = await getInstallments(monthId);
      setInstallments(installmentsData);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!activeMonth) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(activeMonth.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMonth?.id]);

  if (!activeMonth) {
    return <PageLoading />;
  }

  const handleReload = () => load(activeMonth.id);

  return (
    <div className="grid gap-4 p-4 sm:gap-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-white sm:text-2xl">Parcelamentos</h1>
        <MonthSelect months={months} activeMonth={activeMonth} onChange={goToMonth} />
      </div>

      <InstallmentForm
        monthId={activeMonth.id}
        monthLabel={formatMonthLabel(activeMonth.month, activeMonth.year)}
        onCreated={handleReload}
      />
      <InstallmentList installments={installments} onUpdated={handleReload} />
    </div>
  );
}
