import { Transaction, Week } from '../types/finance';

export function calculateSummary(
  transactions: Transaction[],
  weeks: Week[],
  snapshots?: { card: string; amount: number }[],
) {
  let totalIncome = 0;

  let fixedCosts = 0;

  let provisionPlanned = 0;
  let provisionUsed = 0;

  // 🚫 NÃO somamos cartões aqui
  let nubankSpending = 0;
  let c6Spending = 0;

  for (const t of transactions) {
    if (t.type === 'income') {
      totalIncome += t.amount;
      continue;
    }

    // 🔵 PROVISÃO (planejado)
    if (t.isProvision) {
      provisionPlanned += t.amount;
      continue;
    }

    // 🔴 GASTO REAL (mercado/gasolina etc)
    if (!t.isFixed && !t.isProvision && t.type === 'expense') {
      provisionUsed += t.amount;
    }

    // 🟣 CARTÕES (SÓ SE NÃO TIVER SNAPSHOT)
    if (!snapshots || snapshots.length === 0) {
      if (t.card === 'nubank') {
        nubankSpending += t.amount;
        continue;
      }

      if (t.card === 'c6') {
        c6Spending += t.amount;
        continue;
      }
    }

    // ⚫ FIXOS
    if (t.isFixed) {
      fixedCosts += t.amount;
      continue;
    }
  }

  // 🟡 SNAPSHOT SOBRESCREVE
  if (snapshots && snapshots.length > 0) {
    const nubankSnapshot = snapshots.find((s) => s.card === 'nubank');
    const c6Snapshot = snapshots.find((s) => s.card === 'c6');

    if (nubankSnapshot) {
      nubankSpending = nubankSnapshot.amount;
    }

    if (c6Snapshot) {
      c6Spending = c6Snapshot.amount;
    }
  }

  const cardSpending = nubankSpending + c6Spending;

  const provisionDiff = provisionPlanned - provisionUsed;

  const total = totalIncome - fixedCosts - cardSpending - provisionPlanned;

  const weeklyBudget = weeks.length > 0 ? total / weeks.length : total;

  return {
    totalIncome,
    fixedCosts,

    nubankSpending,
    c6Spending,
    cardSpending,

    provisionPlanned,
    provisionUsed,
    provisionDiff,

    total,
    weeklyBudget,
  };
}
