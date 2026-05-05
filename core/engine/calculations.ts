import { Transaction, Week } from '../types/finance';
import { toCurrency } from '../utils/number';

type Snapshot = {
  card: string;
  amount: number;
};

type Installment = {
  installment_amount: number;
};

export function calculateSummary(
  transactions: Transaction[],
  weeks: Week[],
  snapshots: Snapshot[] = [],
  installments: Installment[] = [],
) {
  let totalIncome = 0;
  let fixedCosts = 0;

  let provisionPlanned = 0;
  let provisionUsed = 0;

  let nubankSpending = 0;
  let c6Spending = 0;

  // ✅ PROCESSA TRANSAÇÕES
  for (const t of transactions) {
    if (t.type === 'income') {
      totalIncome += t.amount;
      continue;
    }

    // 🟣 PROVISÃO (planejado)
    if (t.isProvision) {
      provisionPlanned += t.amount;
      continue;
    }

    // 🔴 GASTO REAL
    if (!t.isFixed && !t.isProvision && t.type === 'expense') {
      provisionUsed += t.amount;
    }

    // ⚫ FIXOS
    if (t.isFixed) {
      fixedCosts += t.amount;
      continue;
    }

    // 🟡 CARTÕES (fallback se não houver snapshot)
    if (snapshots.length === 0) {
      if (t.card === 'nubank') {
        nubankSpending += t.amount;
      }

      if (t.card === 'c6') {
        c6Spending += t.amount;
      }
    }
  }

  // ✅ SNAPSHOT SOBRESCREVE CARTÕES
  if (snapshots.length > 0) {
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

  // ✅ PARCELAS
  const installmentSpending = installments.reduce(
    (acc, i) => acc + (i.installment_amount || 0),
    0,
  );

  // ✅ TOTAL FINAL (AGORA CORRETO)
  const total =
    totalIncome -
    fixedCosts -
    cardSpending -
    provisionPlanned -
    installmentSpending;

  const weeklyBudget = weeks.length > 0 ? total / weeks.length : total;

  return {
    totalIncome,
    fixedCosts,

    nubankSpending,
    c6Spending,
    cardSpending,

    provisionPlanned,
    provisionUsed,
    provisionDiff: provisionPlanned - provisionUsed,

    installmentSpending,

    total: toCurrency(total),
    weeklyBudget: toCurrency(weeklyBudget),
  };
}
