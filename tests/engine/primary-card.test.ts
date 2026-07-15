import { describe, it, expect } from 'vitest';
import { DBCard } from '@/core/types/database';

/** Extrai o cartão principal de uma lista, se houver. */
function getPrimaryCard(cards: DBCard[]): DBCard | undefined {
  return cards.find((c) => c.is_primary === true);
}

/**
 * Simula a operação de setPrimaryCard sobre uma lista em memória:
 * desmarca todos, marca o alvo.
 */
function applySetPrimary(cards: DBCard[], targetId: string): DBCard[] {
  return cards.map((c) => ({ ...c, is_primary: c.id === targetId }));
}

const base: DBCard[] = [
  {
    id: 'c1',
    user_id: 'u1',
    name: 'Nubank',
    slug: 'nubank',
    color: '#8A05BE',
    limit_amount: 5000,
    closing_day: 3,
    due_day: 10,
    is_primary: false,
    created_at: null,
  },
  {
    id: 'c2',
    user_id: 'u1',
    name: 'C6',
    slug: 'c6',
    color: '#000000',
    limit_amount: 3000,
    closing_day: 28,
    due_day: 5,
    is_primary: false,
    created_at: null,
  },
];

describe('is_primary — lógica de cartão principal', () => {
  it('getPrimaryCard retorna undefined quando nenhum é principal', () => {
    expect(getPrimaryCard(base)).toBeUndefined();
  });

  it('marcar um cartão como principal desmarca o anterior', () => {
    const withFirst = applySetPrimary(base, 'c1');
    expect(getPrimaryCard(withFirst)?.id).toBe('c1');

    const withSecond = applySetPrimary(withFirst, 'c2');
    expect(getPrimaryCard(withSecond)?.id).toBe('c2');

    // o primeiro não deve mais ser principal
    expect(withSecond.find((c) => c.id === 'c1')?.is_primary).toBe(false);
  });

  it('nunca há mais de um principal ao mesmo tempo', () => {
    const result = applySetPrimary(base, 'c1');
    const primaries = result.filter((c) => c.is_primary);
    expect(primaries).toHaveLength(1);
  });

  it('lista sem is_primary retorna undefined (coluna ainda não existe)', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const legacy: DBCard[] = base.map(({ is_primary: _, ...rest }) => rest as DBCard);
    expect(getPrimaryCard(legacy)).toBeUndefined();
  });
});
