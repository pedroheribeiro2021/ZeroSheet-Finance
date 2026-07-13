'use client';

import { useEffect, useMemo, useState } from 'react';
import { getDueItems, resolveDueDate, DueItem, DueStatus } from '@/core/engine/dueDates';
import { markTransactionPaid, unmarkTransactionPaid } from '@/core/services/transaction.service';
import {
  getPushSubscriptionState,
  subscribeToPush,
  unsubscribeFromPush,
} from '@/core/services/push.service';
import { useToast } from '@/components/ui/ToastProvider';
import { Transaction } from '@/core/types/finance';
import { DBCard } from '@/core/types/database';

type DueDatesPanelProps = {
  transactions: Transaction[];
  cards: DBCard[];
  month: number;
  year: number;
  onChanged: () => void;
};

const GROUP_ORDER: { status: DueStatus; label: string }[] = [
  { status: 'today', label: 'Vence hoje' },
  { status: 'upcoming', label: 'Próximos 7 dias' },
  { status: 'overdue', label: 'Vencido' },
  { status: 'paid', label: 'Pago' },
  { status: 'automatic', label: 'Cobranças automáticas (cartão)' },
];

const STATUS_DOT: Record<DueStatus, string> = {
  overdue: 'bg-red-500',
  today: 'bg-amber-500',
  upcoming: 'bg-sky-500',
  paid: 'bg-green-500',
  automatic: 'bg-indigo-500',
};

const WEEKDAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export default function DueDatesPanel({
  transactions,
  cards,
  month,
  year,
  onChanged,
}: DueDatesPanelProps) {
  const { showToast } = useToast();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pushState, setPushState] = useState<
    'unsupported' | 'denied' | 'subscribed' | 'not-subscribed' | 'loading'
  >('loading');

  useEffect(() => {
    getPushSubscriptionState()
      .then(setPushState)
      .catch(() => setPushState('unsupported'));
  }, []);

  const handleTogglePush = async () => {
    setPushState('loading');
    try {
      if (pushState === 'subscribed') {
        await unsubscribeFromPush();
        showToast('Notificações desativadas');
      } else {
        await subscribeToPush();
        showToast('Notificações ativadas');
      }
    } catch (err) {
      console.error(err);
      showToast(
        err instanceof Error ? err.message : 'Não foi possível atualizar as notificações',
        'error',
      );
    } finally {
      const state = await getPushSubscriptionState().catch(() => 'unsupported' as const);
      setPushState(state);
    }
  };

  const today = useMemo(() => new Date(), []);

  const dueItems = useMemo(
    () => getDueItems(transactions, today, { horizonDays: 7 }),
    [transactions, today],
  );

  const dueByDay = useMemo(() => {
    const map = new Map<number, DueItem[]>();

    for (const t of transactions) {
      if (t.type !== 'expense') continue;
      if (!t.dueDay) continue;
      if (!t.isFixed && !t.isRecurring) continue;

      const dueDate = resolveDueDate(t.dueDay, year, month);
      const day = dueDate.getDate();
      const status: DueStatus = t.card
        ? 'automatic'
        : t.paidAt
          ? 'paid'
          : dueDate.getTime() < startOfDay(today).getTime()
            ? 'overdue'
            : dueDate.getTime() === startOfDay(today).getTime()
              ? 'today'
              : 'upcoming';

      const list = map.get(day) ?? [];
      list.push({ transaction: t, dueDate, status, daysUntil: 0 });
      map.set(day, list);
    }

    return map;
  }, [transactions, month, year, today]);

  const groups = GROUP_ORDER.map(({ status, label }) => ({
    status,
    label,
    items: dueItems.filter((i) => i.status === status),
  })).filter((g) => g.items.length > 0);

  const handleTogglePaid = async (item: DueItem) => {
    setPendingId(item.transaction.id);
    try {
      if (item.status === 'paid') {
        await unmarkTransactionPaid(item.transaction.id);
        showToast('Vencimento desmarcado como pago');
      } else {
        await markTransactionPaid(item.transaction.id);
        showToast('Vencimento marcado como pago');
      }
      onChanged();
    } catch (err) {
      console.error(err);
      showToast('Não foi possível atualizar o vencimento', 'error');
    } finally {
      setPendingId(null);
    }
  };

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const todayNum = startOfDay(today).getTime();

  const calendarCells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="surface p-4 sm:p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-white">Vencimentos do mês</h2>

        {pushState !== 'unsupported' && (
          <button
            onClick={handleTogglePush}
            disabled={pushState === 'loading' || pushState === 'denied'}
            className="btn-ghost text-xs"
            title={
              pushState === 'denied'
                ? 'Notificações bloqueadas nas configurações do navegador'
                : undefined
            }
          >
            {pushState === 'subscribed'
              ? '🔕 Desativar notificações'
              : pushState === 'denied'
                ? '🔕 Notificações bloqueadas'
                : '🔔 Ativar notificações'}
          </button>
        )}
      </div>
      <p className="mb-4 text-xs text-zinc-500">
        Despesas fixas/recorrentes com dia de vencimento cadastrado. As
        vinculadas a um cartão são cobradas automaticamente na fatura — só
        aparecem informativamente, sem exigir marcar como pago.
      </p>

      <div className="mb-5 grid grid-cols-7 gap-1 text-center">
        {WEEKDAY_LABELS.map((w, i) => (
          <div key={i} className="text-xs font-medium text-zinc-500">
            {w}
          </div>
        ))}

        {calendarCells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} className="h-9 sm:h-11" />;

          const cellDate = new Date(year, month - 1, day).getTime();
          const isToday = cellDate === todayNum;
          const items = dueByDay.get(day) ?? [];
          const worstStatus = items.find((i) => i.status === 'overdue')
            ? 'overdue'
            : items.find((i) => i.status === 'today')
              ? 'today'
              : items.find((i) => i.status === 'upcoming')
                ? 'upcoming'
                : items.find((i) => i.status === 'paid')
                  ? 'paid'
                  : items.find((i) => i.status === 'automatic')
                    ? 'automatic'
                    : undefined;

          return (
            <div
              key={day}
              className={`flex h-9 flex-col items-center justify-center rounded-lg text-xs sm:h-11 ${
                isToday
                  ? 'border border-white/20 bg-zinc-800 font-bold text-white'
                  : 'text-zinc-400'
              }`}
              title={items.map((i) => i.transaction.description || i.transaction.category).join(', ')}
            >
              <span>{day}</span>
              {items.length > 0 && worstStatus && (
                <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${STATUS_DOT[worstStatus]}`} />
              )}
            </div>
          );
        })}
      </div>

      {groups.length === 0 && (
        <p className="text-sm text-zinc-500">Nenhum vencimento nos próximos dias.</p>
      )}

      <div className="grid gap-4">
        {groups.map((group) => (
          <div key={group.status} className="grid gap-1.5">
            <p className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
              <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[group.status]}`} />
              {group.label}
            </p>

            {group.items.map((item) => {
              const cardName = cards.find(
                (c) => c.id === item.transaction.card,
              )?.name;

              return (
                <div
                  key={item.transaction.id}
                  className="surface-row flex items-center justify-between gap-3 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-bold text-white">
                      {item.transaction.description || item.transaction.category}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-400">
                      <span className="badge bg-zinc-700/50 text-zinc-300">
                        {item.transaction.category}
                      </span>
                      <span>
                        {item.dueDate.toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                        })}
                      </span>
                      {item.status === 'automatic' && (
                        <span className="badge bg-indigo-500/15 text-indigo-400">
                          💳 cobrança automática{cardName ? ` — ${cardName}` : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <span className="font-bold text-white">
                      {item.transaction.amount.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </span>
                    {item.status !== 'automatic' && (
                      <button
                        onClick={() => handleTogglePaid(item)}
                        disabled={pendingId === item.transaction.id}
                        className={item.status === 'paid' ? 'btn-ghost text-xs' : 'btn-primary text-xs'}
                      >
                        {item.status === 'paid' ? 'Desmarcar' : 'Marcar como pago'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
