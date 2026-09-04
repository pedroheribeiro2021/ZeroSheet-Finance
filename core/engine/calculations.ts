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
  /**
   * Gasto lançado num cartão que ainda NÃO tem fatura registrada nesta
   * competência. Não está dentro de nenhum snapshot, então precisa ser somado
   * ao `cardSpending` por fora — senão o dinheiro simplesmente sumia do mês.
   */
  let pendingCardSpending = 0;

  const provisionPlanned: Record<string, number> = {};
  const realizedSpend: Record<string, number> = {};
  /**
   * Gastos reais feitos em CARTÃO — com fatura lançada ou não. Abatem o
   * envelope da categoria, mas não podem ser somados de novo ao total: já
   * estão contados dentro de `cardSpending` (via snapshot ou via
   * `pendingCardSpending`).
   */
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

  /**
   * Só dá para afirmar que um cartão NÃO tem fatura no mês quando todo
   * snapshot recebido diz a que cartão pertence. Snapshot em formato legado
   * (sem `card_id`) torna a pergunta indecidível — aí o seguro é assumir que
   * a despesa de cartão já está dentro de alguma fatura, senão ela seria
   * contada duas vezes.
   */
  const canTellCardCoverage =
    hasSnapshots &&
    snapshots!.every(
      (s) => typeof s.card_id === 'string' && s.card_id.length > 0,
    );

  // Se o campo card de Transaction for o id do cartão, usa direto;
  // se for slug/nome legado, não haverá match com snapshotCardIds — e isso
  // é o comportamento seguro (não exclui o que não consegue identificar).
  const cardCoveredBySnapshot = (card: string | null | undefined): boolean => {
    if (!card) return false;
    if (hasSnapshots && !canTellCardCoverage) return true;
    return snapshotCardIds.has(card);
  };

  for (const t of transactions) {
    // "Pausado neste mês": existe na lista, mas não conta em nenhum bucket.
    if (t.skipped) continue;

    const cat = normalizeCategory(t.category);
    if (!categoryLabel[cat]) categoryLabel[cat] = t.category.trim();

    if (t.type === 'income') {
      // Reembolso SOMA no total, como qualquer entrada. Ele existe justamente
      // para compensar uma despesa que já foi contada — a passagem comprada no
      // cartão entra em `cardSpending`, e o dinheiro tirado da reserva para
      // cobri-la precisa entrar do outro lado. Sem isso a mesma despesa pesa
      // duas vezes: some do saldo e nunca volta.
      //
      // Antes o valor ia para um balde à parte e nunca era somado em `total`
      // (ver PARIDADE-PLANILHA.md item 2). A planilha de referência, na
      // verdade, sempre contou esses valores dentro do "Rendimento total" — a
      // linha "Extras/Reembolsos" que não somava era outra coisa, receita que
      // não é do usuário para gastar, e nunca chegou a ser usada.
      //
      // `reimbursementIncome` continua existindo como recorte informativo:
      // quanto do que entrou é reembolso.
      totalIncome += t.amount;
      if (t.isReimbursement) reimbursementIncome += t.amount;
      if (cat === 'salario') salaryIncome += t.amount;

      continue;
    }

    // Despesa lançada em cartão. O gasto real SEMPRE abate o envelope da
    // categoria — comprar mercado no cartão consome a provisão de mercado no
    // instante do lançamento, com ou sem fatura registrada. O que muda é só de
    // onde o valor sai no total do mês:
    //
    //  - cartão JÁ com fatura (snapshot) nesta competência → o valor está
    //    dentro do snapshot, não pode somar de novo;
    //  - cartão ainda SEM fatura → nada o contém ainda, então vira
    //    `pendingCardSpending` e entra no `cardSpending` por fora.
    //
    // Antes: sem snapshot nenhum no mês, a despesa ia para `cardSpending` mas
    // não tocava o envelope (a compra de mercado de 01/09 não abatia a
    // provisão); e — pior — com snapshot de OUTRO cartão, ela caía num
    // `continue` mudo e desaparecia de todos os baldes.
    if (t.card) {
      if (!cardCoveredBySnapshot(t.card)) {
        pendingCardSpending += t.amount;
      }

      // Provisão/reserva lançada em cartão é meta, não gasto realizado.
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

    realizedSpend[cat] = (realizedSpend[cat] ?? 0) + t.amount;
  }

  if (hasSnapshots) {
    cardSpending = snapshots!.reduce((acc, s) => acc + Number(s.amount), 0);
  }

  // Faturas lançadas + o que já foi gasto em cartão sem fatura ainda. Os dois
  // nunca se sobrepõem: `pendingCardSpending` só acumula cartão FORA de
  // `snapshotCardIds`.
  cardSpending = toCurrency(cardSpending + pendingCardSpending);

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
    /** Parte de `cardSpending` que ainda não tem fatura lançada no mês. */
    pendingCardSpending: toCurrency(pendingCardSpending),
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
