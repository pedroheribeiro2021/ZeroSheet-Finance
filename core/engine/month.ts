/**
 * Regras puras de competência (virada de mês).
 *
 * "Competência" é o par (year, month) — mês 1–12. O app nunca deve confiar em
 * `created_at` para saber qual mês vem antes de qual: um mês retroativo criado
 * depois quebraria a ordem. Tudo aqui ordena e compara por competência.
 */

export type Competence = { month: number; year: number };

/** Chave ordenável e comparável: year * 12 + (month - 1). */
export function competenceIndex(c: Competence): number {
  return c.year * 12 + (c.month - 1);
}

/** 'YYYY-MM' — mesma chave usada na URL (?month=). */
export function competenceKey(c: Competence): string {
  return `${c.year}-${String(c.month).padStart(2, '0')}`;
}

/** Competência seguinte, virando o ano em dezembro. */
export function nextCompetence(c: Competence): Competence {
  return c.month === 12
    ? { month: 1, year: c.year + 1 }
    : { month: c.month + 1, year: c.year };
}

/** Cópia ordenada por competência crescente (não muta a entrada). */
export function sortByCompetence<T extends Competence>(months: T[]): T[] {
  return [...months].sort((a, b) => competenceIndex(a) - competenceIndex(b));
}

/** Competência mais recente da lista, ou null se vazia. */
export function latestCompetence<T extends Competence>(months: T[]): T | null {
  if (!months.length) return null;
  return sortByCompetence(months)[months.length - 1];
}

/**
 * Mês imediatamente anterior a `target` por competência — a fonte correta das
 * recorrências ao abrir um mês novo. Ignora `created_at` de propósito.
 */
export function findPreviousMonth<T extends Competence>(
  months: T[],
  target: Competence,
): T | null {
  const targetIndex = competenceIndex(target);

  const earlier = months.filter((m) => competenceIndex(m) < targetIndex);
  if (!earlier.length) return null;

  return sortByCompetence(earlier)[earlier.length - 1];
}

/**
 * Próxima competência que ainda não existe, a partir da mais recente
 * cadastrada. Null quando não há mês nenhum (aí o caso é o de primeiro
 * acesso, tratado por `createMonth` com o mês corrente).
 */
export function nextMonthToOpen<T extends Competence>(months: T[]): Competence | null {
  const latest = latestCompetence(months);
  if (!latest) return null;

  return nextCompetence(latest);
}

export type CarriedInvoice = {
  snapshotId: string;
  cardId: string | null;
  /** Nome do cartão, ou fallback quando o cartão foi apagado. */
  cardName: string;
  amount: number;
  /** Competência de origem da fatura — a que ficou para trás. */
  competence: Competence;
};

type SnapshotLike = {
  id: string;
  month_id: string | null;
  card_id: string | null;
  amount: number | string;
  paid_at?: string | null;
};

/**
 * Faturas de cartão ainda em aberto vindas de competências ANTERIORES à
 * exibida. Elas não viram transação no mês novo de propósito: uma linha em
 * `transactions` entraria em `calculateSummary` e contaria a fatura duas
 * vezes. Aqui é só visibilidade + dedução na projeção de saldo, que é onde a
 * obrigação de caixa realmente pesa.
 */
export function carriedOverInvoices(input: {
  months: (Competence & { id: string })[];
  snapshots: SnapshotLike[];
  cards: { id: string; name: string }[];
  current: Competence;
}): CarriedInvoice[] {
  const currentIndex = competenceIndex(input.current);
  const monthById = new Map(input.months.map((m) => [m.id, m]));
  const cardById = new Map(input.cards.map((c) => [c.id, c]));

  const result: CarriedInvoice[] = [];

  for (const snapshot of input.snapshots) {
    if (snapshot.paid_at) continue;

    const amount = Number(snapshot.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;

    const month = snapshot.month_id ? monthById.get(snapshot.month_id) : undefined;
    if (!month) continue;
    if (competenceIndex(month) >= currentIndex) continue;

    const card = snapshot.card_id ? cardById.get(snapshot.card_id) : undefined;

    result.push({
      snapshotId: snapshot.id,
      cardId: snapshot.card_id,
      cardName: card?.name ?? 'Cartão',
      amount,
      competence: { month: month.month, year: month.year },
    });
  }

  // mais antigo primeiro: a fatura mais atrasada é a mais urgente
  return result.sort(
    (a, b) => competenceIndex(a.competence) - competenceIndex(b.competence),
  );
}
