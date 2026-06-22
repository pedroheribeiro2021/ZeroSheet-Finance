type MonthRef = { id: string };

type InstallmentRef = {
  start_month_id: string;
  total_installments: number;
};

export function filterActiveInstallments<T extends InstallmentRef>(
  installments: T[],
  months: MonthRef[],
  currentMonthId: string,
): T[] {
  const currentMonthIndex = months.findIndex((m) => m.id === currentMonthId);

  if (currentMonthIndex === -1) return [];

  return installments.filter((installment) => {
    const startIndex = months.findIndex(
      (m) => m.id === installment.start_month_id,
    );

    if (startIndex === -1) return false;

    const endIndex = startIndex + installment.total_installments - 1;

    return currentMonthIndex >= startIndex && currentMonthIndex <= endIndex;
  });
}
