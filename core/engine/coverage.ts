import { Account, AccountReading, Transaction } from '../types/finance';
import { resolveDueDate } from './dueDates';
import { toCurrency } from '../utils/number';

/**
 * Cobertura até o salário
 * ------------------------
 * Existe um gap entre o dia em que o salário cai e o vencimento das contas
 * maiores (faturas, sobretudo), que vencem ANTES disso. Nesse intervalo o
 * dinheiro sai da conta guardada (um `complemento`, ver `engine/accounts`),
 * paga o que vence, e é devolvido quando o salário entra.
 *
 * Este módulo responde a pergunta prática: **quanto falta pra atravessar até
 * o salário?** = tudo que vence de hoje até a véspera do salário, menos o que
 * já está na conta de pagamento.
 *
 * É função pura (sem I/O) e NÃO altera `calculateSummary` — assim como as
 * transferências, isto é uma visão de caixa, não de orçamento do mês.
 */

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Dia do mês em que o salário cai, deduzido das RECEITAS do mês: a maior
 * entrada com `dueDay` preenchido. Reembolso não conta (não é dinheiro novo)
 * e pausada no mês também não.
 *
 * ⚠️ `dueDay` numa receita é dia de RECEBIMENTO, não de vencimento —
 * `getDueItems` já ignora tudo que não é `expense`, então uma entrada nunca
 * vira item de "conta a pagar".
 */
export function resolvePaydayDay(transactions: Transaction[]): number | null {
  const incomes = transactions.filter(
    (t) =>
      t.type === 'income' && !t.skipped && !t.isReimbursement && t.dueDay != null,
  );

  if (incomes.length === 0) return null;

  const main = incomes.reduce((biggest, t) => (t.amount > biggest.amount ? t : biggest));

  return main.dueDay ?? null;
}

/**
 * Próxima ocorrência do dia do salário a partir de `today` (inclusive): se o
 * dia ainda não passou neste mês é este mês, senão o mês que vem. Usa
 * `resolveDueDate` para clampar dia 31 em mês curto.
 */
export function resolveNextPayday(paydayDay: number, today: Date): Date {
  const thisMonth = resolveDueDate(
    paydayDay,
    today.getFullYear(),
    today.getMonth() + 1,
  );

  if (startOfDay(thisMonth).getTime() >= startOfDay(today).getTime()) {
    return thisMonth;
  }

  const next = new Date(today.getFullYear(), today.getMonth() + 1, 1);

  return resolveDueDate(paydayDay, next.getFullYear(), next.getMonth() + 1);
}

export type CoverageKind = 'bill' | 'invoice';

export type CoverageItem = {
  id: string;
  label: string;
  amount: number;
  dueDate: Date;
  kind: CoverageKind;
  /** Vencimento já passou e segue em aberto. */
  overdue: boolean;
};

export type CoverageSource = {
  accountId: string;
  accountName: string;
  /** Última leitura de saldo da conta guardada. */
  available: number;
  /** A leitura não cobre o `shortfall` sozinha. */
  insufficient: boolean;
};

export type CoverageInput = {
  today: Date;
  /** Dia do salário (1–31); null = não dá pra calcular a janela. */
  paydayDay: number | null;
  /** Última leitura da conta de pagamento padrão; null = sem leitura. */
  balance: number | null;
  /** Despesas em aberto do mês (sem cartão — o que tem cartão vem na fatura). */
  bills: { id: string; label: string; amount: number; dueDay: number }[];
  /** Faturas de cartão do mês ainda não pagas. */
  invoices: { id: string; label: string; amount: number; dueDay: number }[];
  /** Complementos ainda não devolvidos (contexto: o saldo já pode incluí-los). */
  borrowed?: number;
  /** Conta guardada sugerida como fonte do complemento. */
  source?: { accountId: string; accountName: string; available: number } | null;
};

export type Coverage = {
  payday: Date | null;
  daysUntilPayday: number;
  /** O que vence de hoje (ou atrasado) até a véspera do salário. */
  items: CoverageItem[];
  dueBeforePayday: number;
  balance: number;
  /** Quanto falta tirar da conta guardada; 0 = a conta se paga sozinha. */
  shortfall: number;
  /** Quanto sobra depois de pagar tudo que vence antes do salário. */
  leftover: number;
  /** Complementos em aberto já embutidos no saldo lido. */
  borrowed: number;
  source: CoverageSource | null;
  /** Sem dia de salário cadastrado não há janela — a UI mostra o aviso. */
  hasPayday: boolean;
};

/**
 * Monta a janela `[hoje, salário)` e confronta o que vence nela com o saldo
 * disponível. Conta atrasada e ainda em aberto entra na janela mesmo com
 * `dueDate` no passado — ela continua sendo dinheiro que precisa sair.
 */
export function calculateCoverage(input: CoverageInput): Coverage {
  const today = startOfDay(input.today);
  const borrowed = toCurrency(input.borrowed ?? 0);
  const balance = toCurrency(input.balance ?? 0);

  if (input.paydayDay == null) {
    return {
      payday: null,
      daysUntilPayday: 0,
      items: [],
      dueBeforePayday: 0,
      balance,
      shortfall: 0,
      leftover: balance,
      borrowed,
      source: null,
      hasPayday: false,
    };
  }

  const payday = resolveNextPayday(input.paydayDay, input.today);
  const daysUntilPayday = Math.round(
    (startOfDay(payday).getTime() - today.getTime()) / 86_400_000,
  );

  const year = input.today.getFullYear();
  const month = input.today.getMonth() + 1;

  const toItem =
    (kind: CoverageKind) =>
    (entry: { id: string; label: string; amount: number; dueDay: number }): CoverageItem => {
      const dueDate = resolveDueDate(entry.dueDay, year, month);

      return {
        id: entry.id,
        label: entry.label,
        amount: toCurrency(entry.amount),
        dueDate,
        kind,
        overdue: startOfDay(dueDate).getTime() < today.getTime(),
      };
    };

  const items = [
    ...input.bills.map(toItem('bill')),
    ...input.invoices.map(toItem('invoice')),
  ]
    // Vence antes do salário — o que cai no dia do salário ou depois já é
    // pago com o dinheiro que entrou, não precisa de cobertura.
    .filter((item) => startOfDay(item.dueDate).getTime() < startOfDay(payday).getTime())
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  const dueBeforePayday = toCurrency(items.reduce((acc, i) => acc + i.amount, 0));
  const shortfall = toCurrency(Math.max(0, dueBeforePayday - balance));
  const leftover = toCurrency(Math.max(0, balance - dueBeforePayday));

  const source: CoverageSource | null = input.source
    ? {
        accountId: input.source.accountId,
        accountName: input.source.accountName,
        available: toCurrency(input.source.available),
        insufficient: shortfall > toCurrency(input.source.available),
      }
    : null;

  return {
    payday,
    daysUntilPayday,
    items,
    dueBeforePayday,
    balance,
    shortfall,
    leftover,
    borrowed,
    source,
    hasPayday: true,
  };
}

/**
 * Conta `guardado` com a maior leitura de saldo — a fonte natural do
 * complemento (na prática, onde está a maior parte do dinheiro parado).
 * Conta sem leitura não é candidata: sem saldo conhecido não dá pra sugerir.
 */
export function suggestCoverageSource(
  accounts: Account[],
  latestByAccount: Map<string, AccountReading>,
): { accountId: string; accountName: string; available: number } | null {
  const candidates = accounts
    .filter((a) => a.kind === 'guardado')
    .map((a) => ({ account: a, reading: latestByAccount.get(a.id) }))
    .filter((c): c is { account: Account; reading: AccountReading } => !!c.reading);

  if (candidates.length === 0) return null;

  const best = candidates.reduce((biggest, c) =>
    c.reading.amount > biggest.reading.amount ? c : biggest,
  );

  return {
    accountId: best.account.id,
    accountName: best.account.name,
    available: toCurrency(best.reading.amount),
  };
}

/**
 * Despesas em aberto elegíveis à cobertura: mesma regra de
 * `openBillsFromTransactions` (não paga, não pausada, sem cartão) e com
 * `dueDay` — sem dia não dá pra saber se cai antes ou depois do salário.
 */
export function coverageBillsFromTransactions(
  transactions: Transaction[],
): { id: string; label: string; amount: number; dueDay: number }[] {
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
      id: t.id,
      label: t.description || t.category,
      amount: Number(t.amount),
      dueDay: t.dueDay as number,
    }));
}

/**
 * Faturas em aberto elegíveis: snapshot do mês com valor > 0, ainda não pago
 * e cujo cartão tem `due_day` cadastrado.
 */
export function coverageInvoicesFromSnapshots(
  cards: { id: string; name: string; due_day?: number | null }[],
  snapshots: { id: string; card_id: string | null; amount: number; paid_at?: string | null }[],
): { id: string; label: string; amount: number; dueDay: number }[] {
  return snapshots
    .filter((s) => !s.paid_at && Number(s.amount) > 0)
    .map((s) => {
      const card = cards.find((c) => c.id === s.card_id);

      if (!card?.due_day) return null;

      return {
        id: s.id,
        label: `Fatura ${card.name}`,
        amount: Number(s.amount),
        dueDay: card.due_day,
      };
    })
    .filter((i): i is { id: string; label: string; amount: number; dueDay: number } => !!i);
}
