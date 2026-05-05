/* eslint-disable @typescript-eslint/no-explicit-any */
export function getInstallmentsForMonth(
  installments: any[],
  monthIndex: number, // posição do mês na timeline
) {
  return installments.filter((inst) => {
    const start = 0; // simplificado por enquanto
    const end = inst.total_installments;

    return monthIndex >= start && monthIndex < end;
  });
}