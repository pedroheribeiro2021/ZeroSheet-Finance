import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  RESERVE_CATEGORIES,
} from '../constants/categories';
import { normalizeCategory } from '../utils/normalize';

/**
 * Categorias do usuário
 * ---------------------
 * As categorias padrão são só um ponto de partida: cada usuário descreve a
 * própria vida do seu jeito ("Mercado / Alimentação" em vez de "Mercado"). A
 * categoria criada em "Outra..." não é guardada numa tabela à parte — ela já
 * fica registrada no próprio lançamento, então o histórico de transações do
 * usuário É a lista das categorias dele. Isso mantém tudo por usuário (RLS de
 * `transactions`), sem migration e sem nada para sincronizar: usou uma vez,
 * ela aparece no seletor dali em diante, em qualquer mês.
 */

export type CategoryKind = 'income' | 'expense' | 'reserve';

export type UsedCategory = {
  category: string;
  type: 'income' | 'expense';
  is_reserve?: boolean | null;
};

export function defaultCategoriesFor(kind: CategoryKind): string[] {
  if (kind === 'income') return INCOME_CATEGORIES;
  if (kind === 'reserve') return RESERVE_CATEGORIES;
  return EXPENSE_CATEGORIES;
}

/** Reserva é gravada como `expense` + `is_reserve`; aqui ela volta a ser um tipo próprio. */
export function categoryKindOf(t: UsedCategory): CategoryKind {
  if (t.is_reserve) return 'reserve';
  return t.type;
}

/**
 * Opções do seletor de categoria para um tipo de lançamento: as padrão, na
 * ordem de sempre, e as próprias do usuário em ordem alfabética.
 *
 * `used` deve vir do mais recente para o mais antigo — quando a mesma
 * categoria aparece com grafias diferentes ("mercado / alimentação" e
 * "Mercado / Alimentação"), vale a mais recente. Grafia que só difere da
 * padrão em acento/maiúscula/espaço é a própria padrão, não uma nova.
 *
 * `current`, se informado e ausente das duas listas, entra nas do usuário —
 * o seletor nunca pode deixar de mostrar o valor que o lançamento já tem.
 */
export function categoryOptions(
  kind: CategoryKind,
  used: UsedCategory[],
  current?: string | null,
): { defaults: string[]; custom: string[] } {
  const defaults = defaultCategoriesFor(kind);
  const seen = new Set(defaults.map(normalizeCategory));

  const custom: string[] = [];

  const add = (raw: string) => {
    const name = raw.trim();
    if (!name) return;

    const key = normalizeCategory(name);
    if (seen.has(key)) return;

    seen.add(key);
    custom.push(name);
  };

  for (const t of used) {
    if (categoryKindOf(t) === kind) add(t.category);
  }

  if (current) add(current);

  custom.sort((a, b) => a.localeCompare(b, 'pt-BR'));

  return { defaults, custom };
}
