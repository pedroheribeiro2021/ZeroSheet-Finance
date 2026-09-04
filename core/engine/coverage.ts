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
 * ⚠️ A janela quase sempre atravessa a virada do mês (ex.: em 30/07 ela vai
 * até 15/08), então NÃO basta resolver os vencimentos na competência
 * exibida — ver `resolveOccurrence`.
 *
 * É função pura (sem I/O) e NÃO altera `calculateSummary` — assim como as
 * transferências, isto é uma visão de caixa, não de orçamento do mês.
 */

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Ocorrência do `day` na competência de `today` deslocada de `monthOffset`. */
function occurrenceInMonth(
  day: number,
  today: Date,
  monthOffset: number,
): Date {
  const ref = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);

  return resolveDueDate(day, ref.getFullYear(), ref.getMonth() + 1);
}

/**
 * Data em que a obrigação de fato sai do bolso, dado o estado dela hoje:
 *
 * - **em aberto** → a ocorrência da competência corrente, mesmo que já tenha
 *   passado (é atraso: o dinheiro continua tendo que sair);
 * - **já paga** → a próxima ocorrência, na competência seguinte. É o caso da
 *   fatura paga dia 16/07 que volta a vencer em 10/08, dentro da janela.
 *
 * Sem isso, tudo que já foi pago no mês some da janela e a cobertura dá zero.
 */
export function resolveOccurrence(
  day: number,
  today: Date,
  paid: boolean,
): Date {
  return occurrenceInMonth(day, today, paid ? 1 : 0);
}

/**
 * FALLBACK. Dia do mês em que o salário cai, deduzido das RECEITAS do mês: a
 * maior entrada com `dueDay` preenchido. Usado só quando o usuário ainda não
 * configurou o recebimento em Configurações — a configuração explícita
 * (`user_settings.payday_*`, ver `engine/payday`) sempre tem precedência,
 * porque ela sabe representar "5º dia útil", coisa que um dia do mês não sabe.
 *
 * Reembolso não conta (não é dinheiro novo) e pausada no mês também não.
 *
 * ⚠️ `dueDay` numa receita é dia de RECEBIMENTO, não de vencimento —
 * `getDueItems` já ignora tudo que não é `expense`, então uma entrada nunca
 * vira item de "conta a pagar".
 */
export function resolvePaydayDay(transactions: Transaction[]): number | null {
  const incomes = transactions.filter(
    (t) =>
      t.type === 'income' &&
      !t.skipped &&
      !t.isReimbursement &&
      t.dueDay != null,
  );

  if (incomes.length === 0) return null;

  const main = incomes.reduce((biggest, t) =>
    t.amount > biggest.amount ? t : biggest,
  );

  return main.dueDay ?? null;
}

/**
 * Próxima ocorrência do dia do salário a partir de `today` (inclusive): se o
 * dia ainda não passou neste mês é este mês, senão o mês que vem.
 */
export function resolveNextPayday(paydayDay: number, today: Date): Date {
  const thisMonth = occurrenceInMonth(paydayDay, today, 0);

  if (startOfDay(thisMonth).getTime() >= startOfDay(today).getTime()) {
    return thisMonth;
  }

  return occurrenceInMonth(paydayDay, today, 1);
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
  /**
   * Valor ainda não é definitivo: fatura de ciclo aberto (vinda da última
   * leitura) ou conta cujo valor foi repetido da competência anterior.
   */
  partial: boolean;
  /** Dia de fechamento do cartão — só em fatura parcial, para o aviso. */
  closingDay?: number | null;
};

export type CoverageSource = {
  accountId: string;
  accountName: string;
  /** Última leitura de saldo da conta guardada. */
  available: number;
  /** A leitura não cobre o `shortfall` sozinha. */
  insufficient: boolean;
};

export type CoverageBill = {
  id: string;
  label: string;
  amount: number;
  dueDay: number;
  paid: boolean;
  /** Só despesa recorrente/fixa reaparece na competência seguinte. */
  recurring: boolean;
};

export type CoverageInvoice = {
  id: string;
  label: string;
  amount: number;
  dueDate: Date;
  partial: boolean;
  closingDay?: number | null;
};

export type CoverageInput = {
  today: Date;
  /**
   * Data do próximo salário; null = sem configuração, não dá pra calcular a
   * janela. É uma DATA e não um dia do mês de propósito: quem recebe no
   * "5º dia útil" não tem dia fixo — quem resolve a regra é
   * `engine/payday.resolveNextPaydayDate`.
   */
  payday: Date | null;
  /** Última leitura da conta de pagamento padrão; null = sem leitura. */
  balance: number | null;
  /** Despesas do mês sem cartão (o que tem cartão vem na fatura). */
  bills: CoverageBill[];
  /** Faturas já resolvidas por `coverageInvoices`. */
  invoices: CoverageInvoice[];
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
  /** Algum item tem valor ainda não fechado — o total é um piso. */
  hasPartial: boolean;
  source: CoverageSource | null;
  /** Sem dia de salário cadastrado não há janela — a UI mostra o aviso. */
  hasPayday: boolean;
};

/**
 * Monta a janela `[hoje, salário)` e confronta o que vence nela com o saldo
 * disponível.
 */
export function calculateCoverage(input: CoverageInput): Coverage {
  const today = startOfDay(input.today);
  const borrowed = toCurrency(input.borrowed ?? 0);
  const balance = toCurrency(input.balance ?? 0);

  if (input.payday == null) {
    return {
      payday: null,
      daysUntilPayday: 0,
      items: [],
      dueBeforePayday: 0,
      balance,
      shortfall: 0,
      leftover: balance,
      borrowed,
      hasPartial: false,
      source: null,
      hasPayday: false,
    };
  }

  const payday = input.payday;
  const daysUntilPayday = Math.round(
    (startOfDay(payday).getTime() - today.getTime()) / 86_400_000,
  );

  const billItems: CoverageItem[] = input.bills
    // Despesa avulsa já paga não volta na competência seguinte.
    .filter((bill) => !bill.paid || bill.recurring)
    .map((bill) => {
      const dueDate = resolveOccurrence(bill.dueDay, input.today, bill.paid);

      return {
        id: bill.id,
        label: bill.label,
        amount: toCurrency(bill.amount),
        dueDate,
        kind: 'bill' as const,
        overdue: startOfDay(dueDate).getTime() < today.getTime(),
        // Repetida da competência anterior: o valor pode mudar (conta de luz etc.).
        partial: bill.paid,
      };
    });

  const invoiceItems: CoverageItem[] = input.invoices.map((invoice) => ({
    id: invoice.id,
    label: invoice.label,
    amount: toCurrency(invoice.amount),
    dueDate: invoice.dueDate,
    kind: 'invoice' as const,
    overdue: startOfDay(invoice.dueDate).getTime() < today.getTime(),
    partial: invoice.partial,
    closingDay: invoice.closingDay ?? null,
  }));

  const items = [...billItems, ...invoiceItems]
    // Vence antes do salário — o que cai no dia do salário ou depois já é
    // pago com o dinheiro que entrou, não precisa de cobertura.
    .filter(
      (item) =>
        startOfDay(item.dueDate).getTime() < startOfDay(payday).getTime(),
    )
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  const dueBeforePayday = toCurrency(
    items.reduce((acc, i) => acc + i.amount, 0),
  );
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
    hasPartial: items.some((i) => i.partial),
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
    .filter(
      (c): c is { account: Account; reading: AccountReading } => !!c.reading,
    );

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
 * Despesas elegíveis à cobertura: sem cartão (o que tem cartão já é coberto
 * pela fatura), não pausada e com `dueDay` — sem dia não dá pra saber se cai
 * antes ou depois do salário. Diferente de `openBillsFromTransactions`, a
 * já paga NÃO é descartada: ela reaparece na competência seguinte, que
 * costuma ser justamente onde a janela cai.
 */
export function coverageBillsFromTransactions(
  transactions: Transaction[],
): CoverageBill[] {
  return transactions
    .filter(
      (t) => t.type === 'expense' && t.dueDay != null && !t.skipped && !t.card,
    )
    .map((t) => ({
      id: t.id,
      label: t.description || t.category,
      amount: Number(t.amount),
      dueDay: t.dueDay as number,
      paid: !!t.paidAt,
      recurring: !!t.isRecurring || !!t.isFixed,
    }));
}

/**
 * Faturas em aberto viram itens de cobertura direto: o vencimento já veio
 * resolvido por `engine/invoices` (competência M → vence no dia do cartão em
 * M+1), então aqui não há nenhuma regra de ciclo — só tradução de formato.
 *
 * Antes esta função reinventava o ciclo a partir do `due_day` e do estado de
 * "paga", e por isso mostrava em agosto, como se vencesse 10/08, a fatura de
 * agosto que só vence 10/09. Marcar a fatura como paga também fazia a do ciclo
 * SEGUINTE tomar o lugar dela na lista, em vez de simplesmente sair.
 */
export function coverageInvoicesFromOpen(
  invoices: {
    snapshotId: string;
    cardId: string | null;
    cardName: string;
    amount: number;
    dueDate: Date;
    paid: boolean;
    estimated?: boolean;
    closingDay?: number | null;
  }[],
): CoverageInvoice[] {
  return invoices
    .filter((invoice) => !invoice.paid && invoice.amount > 0)
    .map((invoice) => ({
      id: invoice.snapshotId || `card-${invoice.cardId}`,
      label: `Fatura ${invoice.cardName}`,
      amount: invoice.amount,
      dueDate: invoice.dueDate,
      partial: !!invoice.estimated,
      closingDay: invoice.closingDay ?? null,
    }));
}
