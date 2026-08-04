'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { getMonths, createMonth } from '@/core/services/month.service';
import { competenceKey } from '@/core/engine/month';
import { DBMonth } from '@/core/types/database';

/**
 * Competência ativa da página, sincronizada pela URL (?month=YYYY-MM) — a
 * mesma convenção do dashboard. Sem parâmetro (ou sem match), usa a mais
 * recente cadastrada. Páginas que não usam isso ficam presas no mês mais
 * novo pra sempre, ignorando qual competência o usuário está navegando.
 */
export function useActiveMonth() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [months, setMonths] = useState<DBMonth[]>([]);

  const reloadMonths = async (): Promise<DBMonth[] | null> => {
    try {
      let monthsData = await getMonths();

      if (!monthsData.length) {
        const now = new Date();
        const newMonth = await createMonth(now.getMonth() + 1, now.getFullYear());
        monthsData = [newMonth];
      }

      setMonths(monthsData);
      return monthsData;
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reloadMonths();
  }, []);

  const activeMonth = useMemo(() => {
    if (!months.length) return null;

    const param = searchParams.get('month');
    if (param) {
      const found = months.find((m) => competenceKey(m) === param);
      if (found) return found;
    }

    return months[months.length - 1];
  }, [months, searchParams]);

  // mantém a URL sincronizada com o mês ativo (ex.: sem ?month, canoniza pro mais recente)
  useEffect(() => {
    if (!activeMonth) return;

    const key = competenceKey(activeMonth);
    if (searchParams.get('month') !== key) {
      router.replace(`${pathname}?month=${key}`);
    }
  }, [activeMonth, pathname, router, searchParams]);

  const goToMonth = (month: DBMonth) => {
    router.push(`${pathname}?month=${competenceKey(month)}`);
  };

  return { months, activeMonth, goToMonth, reloadMonths };
}
