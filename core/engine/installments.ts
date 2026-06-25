type MonthRef = { id: string };

type InstallmentRef = {
  start_month_id: string | null;
  total_installments: number;
};

export function filterActiveInstallments<T extends InstallmentRef>(
  installments: T[],
  months: MonthRef[],
  currentMonthId: string,
): (T & { currentInstallment: number })[] {
  const currentMonthIndex = months.findIndex((m) => m.id === currentMonthId);

  if (currentMonthIndex === -1) return [];

  const active: (T & { currentInstallment: number })[] = [];

  for (const installment of installments) {
    const startIndex = months.findIndex(
      (m) => m.id === installment.start_month_id,
    );

    if (startIndex === -1) continue;

    const endIndex = startIndex + installment.total_installments - 1;

    if (currentMonthIndex < startIndex || currentMonthIndex > endIndex) {
      continue;
    }

    active.push({
      ...installment,
      currentInstallment: currentMonthIndex - startIndex + 1,
    });
  }

  return active;
}
