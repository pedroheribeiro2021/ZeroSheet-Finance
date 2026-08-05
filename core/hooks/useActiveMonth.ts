'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

import { getMonths, createMonth } from '@/core/services/month.service';
import { competenceKey } from '@/core/engine/month';
import { DBMonth } from '@/core/types/database';

/**
 * Competência ativa da página. A escolha é ESTADO local; a URL (?month=YYYY-MM)
 * é lida uma única vez na montagem, só pra semear, e depois apenas espelhada
 * com `history.replaceState` — o link continua compartilhável e não há
 * navegação do router envolvida.
 *
 * A versão anterior derivava o mês de `useSearchParams()` a cada render e
 * trocava de mês com `router.push`, enquanto um efeito de canonização chamava
 * `router.replace` quando as duas coisas discordavam. Com duas navegações do
 * App Router disputando, o clique às vezes era engolido: "seleciono julho e
 * não vai, vai quando quer".
 */
export function useActiveMonth() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [months, setMonths] = useState<DBMonth[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const reloadMonths = async (): Promise<DBMonth[] | null> => {
    try {
      let monthsData = await getMonths();

      if (!monthsData.length) {
        const now = new Date();
        const newMonth = await createMonth(
          now.getMonth() + 1,
          now.getFullYear(),
        );
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

  // semeia a competência a partir da URL — uma vez só
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveKey((current) => current ?? searchParams.get('month'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeMonth = useMemo(() => {
    if (!months.length) return null;

    const found = activeKey
      ? months.find((m) => competenceKey(m) === activeKey)
      : undefined;

    return found ?? months[months.length - 1];
  }, [months, activeKey]);

  // URL como espelho do estado, sem acionar o router
  useEffect(() => {
    if (!activeMonth) return;

    const key = competenceKey(activeMonth);
    if (new URLSearchParams(window.location.search).get('month') !== key) {
      window.history.replaceState(null, '', `${pathname}?month=${key}`);
    }
  }, [activeMonth, pathname]);

  const goToMonth = (month: DBMonth) => {
    setActiveKey(competenceKey(month));
  };

  return { months, activeMonth, goToMonth, reloadMonths };
}
