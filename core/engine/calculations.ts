/* eslint-disable @typescript-eslint/no-explicit-any */
import { Transaction, Week } from '../types/finance';
import { toCurrency } from '../utils/number';
import { normalizeCategory } from '../utils/normalize';

export function calculateSummary(
  transactions: Transaction[],
  weeks: Week[],
  snapshots?: { amount: number; card_id?: string | null }[],
  installments: any[] = [],
  weeklyBudgetVariant: 'total' | 'incomeMinusFixed' = 'total',
  /** Nº de semanas para dividir o orçamento (ciclo da fatura). Default: weeks.length. */
  weeksForBudget?: number,
) {
  let totalIncome = 0;
  let salaryIncome = 0;
  let fixedCosts = 0;
  let cardSpending = 0;
  let reimbursementIncome = 0;
  let reserveSpending = 0;

  const provisionPlanned: Record<string, number> = {};
  const realizedSpend: Record<string, number> = {};
  /** Gastos reais que JÁ estão dentro de uma fatura de cartão (snapshot). */
  const realizedOnCard: Record<string, number> = {};
  const categoryLabel: Record<string, string> = {};

  const hasSnapshots = !!snapshots && snapshots.length > 0;

  // card_ids que têm fatura fechada (snapshot) neste mês.
  // Transações vinculadas a esses cartões não entram em nenhum outro bucket
  // (já estão contadas dentro da fatura do cartão).
  const snapshotCardIds = new Set<string>(
    (snapshots ?? [])
      .map((s) => s.card_id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0),
  );

  // Se o campo card de Transaction for o id do cartão, usa direto;
  // se for slug/nome legado, não haverá match com snapshotCardIds — e isso
  // é o comportamento seguro (não exclui o que não consegue identificar).
  const cardCoveredBySnapshot = (card: string | null | undefined): boolean => {
    if (!card) return false;
    return snapshotCardIds.has(card);
  };

  for (const t of transactions) {
    const cat = normalizeCategory(t.category);
    if (!categoryLabel[cat]) categoryLabel[cat] = t.category.trim();

    if (t.type === 'income') {
      if (t.isReimbursement) {
        reimbursementIncome += t.amount;
      } else {
        totalIncome += t.amount;
        if (cat === 'salario') salaryIncome += t.amount;
      }
      continue;
    }

    // Transação vinculada a cartão com snapshot — já está na fatura, não
    // conta de novo no total; mas o gasto real ABATE o envelope da categoria
    // (ex.: gasolina paga no cartão consome a provisão de gasolina).
    if (cardCoveredBySnapshot(t.card)) {
      if (!t.isProvision && !t.isReserve) {
        realizedOnCard[cat] = (realizedOnCard[cat] ?? 0) + t.amount;
      }
      continue;
    }

    if (t.isProvision) {
      provisionPlanned[cat] = (provisionPlanned[cat] ?? 0) + t.amount;
      continue;
    }

    if (t.isReserve) {
      reserveSpending += t.amount;
      continue;
    }

    if (t.isFixed) {
      fixedCosts += t.amount;
      continue;
    }

    if (!hasSnapshots && t.card) {
      cardSpending += t.amount;
      continue;
    }

    if (hasSnapshots && t.card) {
      continue;
    }

    realizedSpend[cat] = (realizedSpend[cat] ?? 0) + t.amount;
  }

  if (hasSnapshots) {
    cardSpending = snapshots!.reduce((acc, s) => acc + Number(s.amount), 0);
  }

  // ENVELOPE: por categoria, vale o MAIOR entre planejado e realizado
  let envelopeSpending = 0;
  const provisionMap: Record<string, number> = {};
  let plannedTotal = 0;
  let usedTotal = 0;

  const categories = new Set([
    ...Object.keys(provisionPlanned),
    ...Object.keys(realizedSpend),
    ...Object.keys(realizedOnCard),
  ]);

  const envelopes: {
    category: string;
    planned: number;
    used: number;
    remaining: number;
  }[] = [];

  for (const cat of categories) {
    const planned = provisionPlanned[cat] ?? 0;
    const realizedOff = realizedSpend[cat] ?? 0;
    const onCard = realizedOnCard[cat] ?? 0;
    const realized = realizedOff + onCard;

    // Compromisso da categoria = maior entre planejado e realizado.
    // A parte já dentro da fatura (onCard) não é subtraída de novo aqui,
    // pois já está contada em cardSpending (snapshot da fatura).
    const committed = Math.max(planned, realized);
    envelopeSpending += Math.max(0, committed - onCard);

    provisionMap[cat] = planned - realized;
    plannedTotal += planned;
    usedTotal += realizedOff + (planned > 0 ? onCard : 0);

    // envelope de verdade = categoria que tem provisão planejada
    if (planned > 0) {
      envelopes.push({
        category: categoryLabel[cat] ?? cat,
        planned: toCurrency(planned),
        used: toCurrency(realized),
        remaining: toCurrency(planned - realized),
      });
    }
  }

  envelopes.sort((a, b) => b.planned - a.planned);

  // Parcela cujo cartão tem fatura fechada (snapshot) no mês NÃO soma de
  // novo: ela já está dentro do valor da fatura. Evita dupla contagem.
  // O valor coberto vai para installmentsInCardBills, para a UI conseguir
  // mostrar "parcelas já dentro das faturas" em vez de um 0 sem explicação.
  let installmentSpending = 0;
  let installmentsInCardBills = 0;
  for (const i of installments) {
    if (i.card_id && snapshotCardIds.has(i.card_id)) {
      installmentsInCardBills += Number(i.installment_amount);
    } else {
      installmentSpending += Number(i.installment_amount);
    }
  }

  const total = toCurrency(
    totalIncome -
      fixedCosts -
      cardSpending -
      envelopeSpending -
      installmentSpending -
      reserveSpending,
  );

  const weeklyBudgetBase =
    weeklyBudgetVariant === 'incomeMinusFixed'
      ? totalIncome - fixedCosts
      : total;

  const budgetWeeks = weeksForBudget ?? weeks.length;

  const weeklyBudget =
    budgetWeeks > 0
      ? toCurrency(weeklyBudgetBase / budgetWeeks)
      : toCurrency(weeklyBudgetBase);

  return {
    totalIncome,
    salaryIncome: toCurrency(salaryIncome),
    otherIncome: toCurrency(totalIncome - salaryIncome),
    fixedCosts,

    cardSpending,
    reimbursementIncome,
    reserveSpending,

    provisionPlanned: plannedTotal,
    provisionUsed: usedTotal,
    provisionDiff: plannedTotal - usedTotal,
    envelopeSpending,

    installmentSpending: toCurrency(installmentSpending),
    /** Parcelas que já estão dentro de faturas (snapshots) — não abatem de novo. */
    installmentsInCardBills: toCurrency(installmentsInCardBills),

    total,
    weeklyBudget,

    provisionMap,
    envelopes,
  };
}
