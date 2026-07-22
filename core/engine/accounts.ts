import { AccountReading, Transaction, Transfer } from '../types/finance';
import { toCurrency } from '../utils/number';

/**
 * Leitura mais recente (por `readAt`) de cada conta — igual à ideia de
 * "última leitura" já usada no acompanhamento semanal de fatura.
 */
export function latestReadingByAccount(
  readings: AccountReading[],
): Map<string, AccountReading> {
  const map = new Map<string, AccountReading>();

  for (const reading of readings) {
    const current = map.get(reading.accountId);

    if (!current || new Date(reading.readAt) > new Date(current.readAt)) {
      map.set(reading.accountId, reading);
    }
  }

  return map;
}

export type PendingReturn = {
  /** Complemento (transfers.kind = 'complemento') que originou a pendência. */
  complementId: string;
  /** Conta que deve receber a devolução de volta — from_account_id do complemento. */
  toAccountId: string;
  /**
   * Conta que está com o valor emprestado (to_account_id do complemento) —
   * é dela que a projeção de saldo desconta a pendência.
   */
  holdingAccountId: string;
  /** Quanto ainda falta devolver (nunca negativo). */
  amount: number;
};

/**
 * Para cada `complemento`, soma as `devolucao` vinculadas (`linkedTransferId`)
 * e retorna o que falta devolver. Quitação parcial reduz o valor; quitação
 * total (ou além) faz o complemento sumir da lista.
 */
export function pendingReturns(transfers: Transfer[]): PendingReturn[] {
  const complementos = transfers.filter((t) => t.kind === 'complemento');
  const devolucoes = transfers.filter((t) => t.kind === 'devolucao');

  const result: PendingReturn[] = [];

  for (const complemento of complementos) {
    const returned = devolucoes
      .filter((d) => d.linkedTransferId === complemento.id)
      .reduce((acc, d) => acc + d.amount, 0);

    const amount = toCurrency(Math.max(0, complemento.amount - returned));

    if (amount <= 0) continue;

    result.push({
      complementId: complemento.id,
      toAccountId: complemento.fromAccountId,
      holdingAccountId: complemento.toAccountId,
      amount,
    });
  }

  return result;
}

export type ProjectionLine = {
  label: string;
  /** Contribuição com sinal: positiva para a leitura, negativa para deduções. */
  amount: number;
};

export type ProjectBalanceInput = {
  /** Leitura mais recente da conta de pagamento (null = sem leitura ainda). */
  reading: { label: string; amount: number } | null;
  /** Contas a pagar em aberto (transações expense com due_day, paid_at null, !skipped, sem card). */
  openBills: { label: string; amount: number; dueDay?: number | null }[];
  /** Faturas de cartão em aberto (card_snapshots com paid_at null). */
  openInvoices: { label: string; amount: number }[];
  /** Devoluções pendentes que descontam desta conta (pendingReturns filtrado por holdingAccountId). */
  pendingReturns: { label: string; amount: number }[];
};

/**
 * Composição projetada: leitura − contas a pagar − faturas − devoluções
 * pendentes = sobra livre. Retorna as linhas na ordem exibida na UI.
 */
export function projectBalance(input: ProjectBalanceInput): {
  lines: ProjectionLine[];
  projected: number;
} {
  const lines: ProjectionLine[] = [
    {
      label: input.reading?.label ?? 'Saldo informado',
      amount: input.reading?.amount ?? 0,
    },
    ...input.openBills.map((bill) => ({ label: bill.label, amount: -bill.amount })),
    ...input.openInvoices.map((invoice) => ({
      label: invoice.label,
      amount: -invoice.amount,
    })),
    ...input.pendingReturns.map((ret) => ({ label: ret.label, amount: -ret.amount })),
  ];

  const projected = toCurrency(lines.reduce((acc, line) => acc + line.amount, 0));

  return { lines, projected };
}

/** Diferença entre a nova leitura e a projeção anterior — "R$ X fora do radar". */
export function reconcile(projected: number, newReading: number): number {
  return toCurrency(newReading - projected);
}

/**
 * Contas a pagar em aberto para a composição da projeção: despesa com
 * vencimento cadastrado, ainda não paga, não pausada neste mês e sem
 * cartão (o que tem cartão já é coberto pela fatura, não é pago à parte).
 */
export function openBillsFromTransactions(
  transactions: Transaction[],
): { label: string; amount: number; dueDay?: number | null }[] {
  return transactions
    .filter(
      (t) =>
        t.type === 'expense' &&
        t.dueDay != null &&
        !t.paidAt &&
        !t.skipped &&
        !t.card,
    )
    .map((t) => ({
      label: t.description || t.category,
      amount: t.amount,
      dueDay: t.dueDay,
    }));
}

/** Faturas de cartão em aberto (card_snapshots ainda não pagas) para a projeção. */
export function openInvoicesFromSnapshots(
  cards: { id: string; name: string }[],
  snapshots: { card_id: string | null; amount: number; paid_at?: string | null }[],
): { label: string; amount: number }[] {
  return snapshots
    .filter((s) => !s.paid_at && Number(s.amount) > 0)
    .map((s) => {
      const card = cards.find((c) => c.id === s.card_id);
      return {
        label: card ? `Fatura ${card.name}` : 'Fatura do cartão',
        amount: Number(s.amount),
      };
    });
}
