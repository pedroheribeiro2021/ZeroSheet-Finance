'use client';

import { useMemo, useState } from 'react';
import { deleteTransaction } from '@/core/services/transaction.service';
import EditTransactionModal from '../modals/EditTransactionModal';
import { useToast } from '@/components/ui/ToastProvider';
import { formatBRL } from '@/core/utils/number';
import { normalizeCategory } from '@/core/utils/normalize';
import { Transaction } from '@/core/types/finance';

type SortMode = 'entradas-primeiro' | 'recentes' | 'maior-valor' | 'categoria';

const SORT_LABELS: Record<SortMode, string> = {
  'entradas-primeiro': 'Entradas primeiro',
  recentes: 'Mais recentes',
  'maior-valor': 'Maior valor',
  categoria: 'Categoria (A→Z)',
};

type TypeFilter = 'todas' | 'entradas' | 'despesas' | 'reservas';

const TYPE_FILTER_LABELS: Record<TypeFilter, string> = {
  todas: 'Todas',
  entradas: 'Entradas',
  despesas: 'Despesas',
  reservas: 'Reservas',
};

const CARD_FILTER_ALL = 'todas';
const CARD_FILTER_NONE = 'sem-cartao';

type PaidFilter = 'todas' | 'pagas' | 'nao-pagas';

const PAID_FILTER_LABELS: Record<PaidFilter, string> = {
  todas: 'Pagamento: todas',
  pagas: 'Contas pagas',
  'nao-pagas': 'Contas a pagar',
};

type FlagFilters = {
  provision: boolean;
  fixed: boolean;
  recurring: boolean;
  subscription: boolean;
};

const EMPTY_FLAGS: FlagFilters = {
  provision: false,
  fixed: false,
  recurring: false,
  subscription: false,
};

/** entrada = 0, reserva = 1, despesa = 2 — define o agrupamento padrão */
function kindRank(t: Transaction): number {
  if (t.type === 'income') return 0;
  if (t.isReserve) return 1;
  return 2;
}

function matchesTypeFilter(t: Transaction, filter: TypeFilter): boolean {
  switch (filter) {
    case 'entradas':
      return t.type === 'income';
    case 'reservas':
      return !!t.isReserve;
    case 'despesas':
      return t.type === 'expense' && !t.isReserve;
    case 'todas':
    default:
      return true;
  }
}

function matchesCardFilter(t: Transaction, filter: string): boolean {
  if (filter === CARD_FILTER_ALL) return true;
  if (filter === CARD_FILTER_NONE) return !t.card;
  return t.card === filter;
}

/** "Conta" = despesa com dia de vencimento cadastrado (mesmo critério do calendário de vencimentos). */
function isDueTrackedExpense(t: Transaction): boolean {
  return t.type === 'expense' && !!t.dueDay;
}

function matchesPaidFilter(t: Transaction, filter: PaidFilter): boolean {
  if (filter === 'todas') return true;
  if (!isDueTrackedExpense(t)) return false;
  return filter === 'pagas' ? !!t.paidAt : !t.paidAt;
}

function matchesFlags(t: Transaction, flags: FlagFilters): boolean {
  if (flags.provision && !t.isProvision) return false;
  if (flags.fixed && !t.isFixed) return false;
  if (flags.recurring && !t.isRecurring) return false;
  if (flags.subscription && normalizeCategory(t.category) !== 'assinaturas')
    return false;
  return true;
}

function matchesSearch(t: Transaction, search: string): boolean {
  if (!search) return true;
  const haystack = normalizeCategory(`${t.description ?? ''} ${t.category}`);
  return haystack.includes(search);
}

function formatUntil(recurringUntil?: string | null): string {
  if (!recurringUntil) return 'sempre';
  const [y, m] = recurringUntil.split('-').map(Number);
  const label = new Intl.DateTimeFormat('pt-BR', {
    month: 'short',
    year: 'numeric',
  }).format(new Date(y, (m ?? 1) - 1, 1));
  return `até ${label}`;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function TransactionList({
  transactions,
  cardNames = {},
  onUpdated,
}: any) {
  const { showToast } = useToast();
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('entradas-primeiro');

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('todas');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [cardFilter, setCardFilter] = useState(CARD_FILTER_ALL);
  const [paidFilter, setPaidFilter] = useState<PaidFilter>('todas');
  const [flags, setFlags] = useState<FlagFilters>(EMPTY_FLAGS);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const categoryOptions = useMemo(() => {
    const set = new Set<string>(
      (transactions as Transaction[]).map((t) => t.category),
    );
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [transactions]);

  const filtered = useMemo(() => {
    const normalizedSearch = normalizeCategory(search);

    return (transactions as Transaction[]).filter(
      (t) =>
        matchesTypeFilter(t, typeFilter) &&
        (!categoryFilter || t.category === categoryFilter) &&
        matchesCardFilter(t, cardFilter) &&
        matchesPaidFilter(t, paidFilter) &&
        matchesFlags(t, flags) &&
        matchesSearch(t, normalizedSearch),
    );
  }, [transactions, typeFilter, categoryFilter, cardFilter, paidFilter, flags, search]);

  const filteredSum = filtered.reduce(
    (acc, t) => acc + (t.type === 'income' ? t.amount : -t.amount),
    0,
  );

  const sorted = useMemo(() => {
    const list = [...filtered];

    switch (sortMode) {
      case 'entradas-primeiro':
        return list.sort(
          (a, b) =>
            kindRank(a) - kindRank(b) ||
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
      case 'maior-valor':
        return list.sort((a, b) => b.amount - a.amount);
      case 'categoria':
        return list.sort((a, b) =>
          a.category.localeCompare(b.category, 'pt-BR'),
        );
      case 'recentes':
      default:
        return list.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
    }
  }, [filtered, sortMode]);

  const toggleFlag = (key: keyof FlagFilters) => {
    setFlags((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedSum = sorted
    .filter((t) => selectedIds.has(t.id))
    .reduce((acc, t) => acc + (t.type === 'income' ? t.amount : -t.amount), 0);

  const handleDelete = async (id: string) => {
    const confirmDelete = confirm('Deseja excluir essa transação?');

    if (!confirmDelete) return;

    try {
      await deleteTransaction(id);
      showToast('Transação excluída');
      onUpdated?.();
    } catch (err) {
      console.error(err);
      showToast('Erro ao excluir transação', 'error');
    }
  };

  return (
    <div className="surface grid gap-3 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-white font-bold">Transações</h2>

        <label className="flex items-center gap-2 text-xs text-zinc-400">
          Ordenar por
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="field-sm"
          >
            {Object.entries(SORT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-2.5 rounded-xl border border-white/[0.04] bg-black/20 p-3">
        <div className="flex gap-2 flex-wrap">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
            className="field-sm"
            aria-label="Filtrar por tipo"
          >
            {Object.entries(TYPE_FILTER_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="field-sm"
            aria-label="Filtrar por categoria"
          >
            <option value="">Todas as categorias</option>
            {categoryOptions.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            value={cardFilter}
            onChange={(e) => setCardFilter(e.target.value)}
            className="field-sm"
            aria-label="Filtrar por cartão"
          >
            <option value={CARD_FILTER_ALL}>Todos os cartões</option>
            <option value={CARD_FILTER_NONE}>Sem cartão</option>
            {Object.entries(cardNames as Record<string, string>).map(
              ([id, name]) => (
                <option key={id} value={id}>
                  💳 {name}
                </option>
              ),
            )}
          </select>

          <select
            value={paidFilter}
            onChange={(e) => setPaidFilter(e.target.value as PaidFilter)}
            className="field-sm"
            aria-label="Filtrar por status de pagamento"
          >
            {Object.entries(PAID_FILTER_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Buscar por descrição ou categoria..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="field-sm flex-1 min-w-[180px] basis-full sm:basis-auto"
          />
        </div>

        <div className="flex gap-3 flex-wrap text-xs text-zinc-300">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={flags.provision}
              onChange={() => toggleFlag('provision')}
            />
            Provisão
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={flags.fixed}
              onChange={() => toggleFlag('fixed')}
            />
            Fixo
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={flags.recurring}
              onChange={() => toggleFlag('recurring')}
            />
            Recorrente
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={flags.subscription}
              onChange={() => toggleFlag('subscription')}
            />
            Assinatura
          </label>
        </div>

        <p className="text-zinc-400 text-xs">
          {filtered.length} lançamento{filtered.length === 1 ? '' : 's'} •{' '}
          {formatBRL(filteredSum)}
        </p>
      </div>

      {sorted.length === 0 && (
        <p className="text-zinc-500 text-sm">
          {(transactions as Transaction[]).length === 0
            ? 'Nenhuma transação neste mês.'
            : 'Nenhuma transação encontrada com esses filtros.'}
        </p>
      )}

      {sorted.map((t) => {
        const isIncome = t.type === 'income';
        const isReserve = !!t.isReserve;

        const borderColor = isIncome
          ? 'border-green-500'
          : isReserve
            ? 'border-sky-500'
            : 'border-red-500';

        const amountColor = isIncome
          ? 'text-green-400'
          : isReserve
            ? 'text-sky-400'
            : 'text-red-400';

        const sign = isIncome ? '+' : '−';

        const isPaidBill = isDueTrackedExpense(t) && !!t.paidAt;

        return (
          <div
            key={t.id}
            className={`surface-row p-3 flex flex-col gap-2.5 border-l-2 sm:flex-row sm:items-center sm:justify-between ${borderColor}`}
          >
            <div className="flex min-w-0 items-start gap-2.5">
              <input
                type="checkbox"
                checked={selectedIds.has(t.id)}
                onChange={() => toggleSelected(t.id)}
                aria-label="Selecionar lançamento"
                className="mt-1 shrink-0"
              />

              <div className="min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate font-bold text-white">
                    {t.description || t.category}
                  </p>
                  <span className={`${amountColor} shrink-0 font-bold`}>
                    {sign} {formatBRL(t.amount)}
                  </span>
                </div>

                <div className="text-xs flex gap-1.5 flex-wrap mt-1.5">
                  {t.description && (
                    <span className="badge bg-zinc-700/50 text-zinc-300">
                      {t.category}
                    </span>
                  )}
                  {isPaidBill && (
                    <span className="badge bg-green-500/15 text-green-400">
                      ✅ Pago
                    </span>
                  )}
                  {t.card && (
                    <span className="badge bg-indigo-500/15 text-indigo-400">
                      💳 {cardNames[t.card] ?? 'Cartão'} — na fatura
                    </span>
                  )}
                  {t.isProvision && (
                    <span className="badge bg-amber-500/15 text-amber-400">
                      Provisão
                    </span>
                  )}
                  {isReserve && (
                    <span className="badge bg-sky-500/15 text-sky-400">
                      Reserva
                    </span>
                  )}
                  {t.isReimbursement && (
                    <span className="badge bg-zinc-600/30 text-zinc-300">
                      Reembolso
                    </span>
                  )}
                  {t.isFixed && (
                    <span className="badge bg-zinc-600/30 text-zinc-300">
                      Fixo
                    </span>
                  )}
                  {t.isRecurring && (
                    <span className="badge bg-violet-500/15 text-violet-400">
                      🔁 {formatUntil(t.recurringUntil)}
                      {t.dueDay ? ` • vence dia ${t.dueDay}` : ''}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => setSelected(t)}
                className="btn-ghost flex-1 bg-white/5 text-zinc-200 hover:text-white sm:flex-initial"
              >
                Editar
              </button>

              <button
                onClick={() => handleDelete(t.id)}
                className="btn-ghost flex-1 text-red-400 hover:bg-red-500/10 hover:text-red-300 sm:flex-initial"
              >
                Excluir
              </button>
            </div>
          </div>
        );
      })}

      {selectedIds.size > 0 && (
        <div className="safe-bottom sticky bottom-2 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-500/30 bg-zinc-900/95 p-3 shadow-lg shadow-black/40 backdrop-blur-sm">
          <span className="text-sm text-white">
            <span className="font-bold">{selectedIds.size}</span>{' '}
            selecionado{selectedIds.size === 1 ? '' : 's'} •{' '}
            <span className="font-bold">{formatBRL(selectedSum)}</span>
          </span>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="btn-ghost text-xs"
          >
            Limpar seleção
          </button>
        </div>
      )}

      {selected && (
        <EditTransactionModal
          transaction={selected}
          onClose={() => setSelected(null)}
          onUpdated={onUpdated}
        />
      )}
    </div>
  );
}
