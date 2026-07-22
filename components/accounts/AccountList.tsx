'use client';

import { useState } from 'react';

import {
  addAccountReading,
  deleteAccount,
  deleteAccountReading,
  setPaymentDefaultAccount,
} from '@/core/services/account.service';
import { reconcile } from '@/core/engine/accounts';
import { parseCurrencyInput, sanitizeAmountInput, formatBRL } from '@/core/utils/number';
import { useToast } from '@/components/ui/ToastProvider';
import EditAccountModal from '../modals/EditAccountModal';
import { DBAccount, DBAccountReading } from '@/core/types/database';

type Props = {
  accounts: DBAccount[];
  readings: DBAccountReading[];
  /** Projeção atual de cada conta (a partir da última leitura) — usada para o aviso de conciliação. */
  projectedByAccount: Map<string, number>;
  onUpdated: () => void;
};

export default function AccountList({
  accounts,
  readings,
  projectedByAccount,
  onUpdated,
}: Props) {
  const { showToast } = useToast();
  const [selected, setSelected] = useState<DBAccount | null>(null);
  const [openHistory, setOpenHistory] = useState<Record<string, boolean>>({});
  const [readingValue, setReadingValue] = useState<Record<string, string>>({});
  const [readingDate, setReadingDate] = useState<Record<string, string>>({});

  const readingsByAccount = (accountId: string) =>
    readings
      .filter((r) => r.account_id === accountId)
      .sort((a, b) => new Date(a.read_at).getTime() - new Date(b.read_at).getTime());

  const handleSetDefault = async (id: string) => {
    try {
      await setPaymentDefaultAccount(id);
      showToast('Conta de pagamento padrão atualizada');
      onUpdated();
    } catch (err) {
      console.error(err);
      showToast('Erro ao definir conta de pagamento', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja remover essa conta?')) return;

    try {
      await deleteAccount(id);
      showToast('Conta removida');
      onUpdated();
    } catch (err) {
      console.error(err);
      showToast('Erro ao remover conta', 'error');
    }
  };

  const handleDeleteReading = async (id: string) => {
    try {
      await deleteAccountReading(id);
      showToast('Leitura removida');
      onUpdated();
    } catch (err) {
      console.error(err);
      showToast('Erro ao remover leitura', 'error');
    }
  };

  const handleAddReading = async (accountId: string) => {
    const raw = readingValue[accountId];
    if (!raw) return;

    try {
      const amount = parseCurrencyInput(raw);
      const readAt = readingDate[accountId]
        ? new Date(readingDate[accountId]).toISOString()
        : undefined;

      await addAccountReading(accountId, amount, readAt);

      setReadingValue((prev) => ({ ...prev, [accountId]: '' }));
      setReadingDate((prev) => ({ ...prev, [accountId]: '' }));

      showToast('Leitura lançada com sucesso');
      onUpdated();
    } catch (err) {
      console.error(err);
      showToast('Erro ao lançar leitura', 'error');
    }
  };

  return (
    <div className="surface grid gap-3 p-4 sm:p-5">
      <h2 className="text-white font-bold text-lg">Contas cadastradas</h2>

      {accounts.length === 0 && <p className="text-zinc-400">Nenhuma conta cadastrada.</p>}

      {accounts.map((account) => {
        const history = readingsByAccount(account.id);
        const latest = history[history.length - 1] ?? null;
        const historyOpen = openHistory[account.id] ?? false;

        const rawValue = readingValue[account.id] ?? '';
        const previewAmount = rawValue ? parseCurrencyInput(rawValue) : null;
        const previousProjected = projectedByAccount.get(account.id);
        const preview =
          previewAmount != null && previousProjected != null
            ? reconcile(previousProjected, previewAmount)
            : null;

        return (
          <div key={account.id} className="surface-row flex flex-col gap-3 p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span
                  className="h-3 w-3 shrink-0 rounded-full ring-2 ring-black/40"
                  style={{ backgroundColor: account.color ?? '#52525b' }}
                />

                <div className="min-w-0">
                  <p className="text-white font-medium flex items-center gap-1.5">
                    {account.name}
                    <span className="badge bg-zinc-700/50 text-zinc-300">
                      {account.kind === 'corrente' ? 'Corrente' : 'Guardado'}
                    </span>
                    {account.is_payment_default && (
                      <span className="badge bg-yellow-500/15 text-yellow-400">
                        ★ Pagamento
                      </span>
                    )}
                  </p>

                  <p className="text-zinc-400 text-sm">
                    {latest
                      ? `${formatBRL(Number(latest.amount))} · lida em ${new Date(latest.read_at).toLocaleDateString('pt-BR')}`
                      : 'Sem leitura ainda'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleSetDefault(account.id)}
                  title={
                    account.is_payment_default
                      ? 'Conta de pagamento padrão'
                      : 'Definir como conta de pagamento'
                  }
                  className={`btn-icon h-10 w-10 text-lg leading-none ${
                    account.is_payment_default
                      ? 'text-yellow-400'
                      : 'text-zinc-500 hover:text-yellow-400'
                  }`}
                >
                  ★
                </button>

                <button
                  onClick={() => setSelected(account)}
                  className="btn-ghost bg-white/5 text-zinc-200 hover:text-white"
                >
                  Editar
                </button>

                <button
                  onClick={() => handleDelete(account.id)}
                  className="btn-ghost text-red-400 hover:bg-red-500/10 hover:text-red-300"
                >
                  Remover
                </button>
              </div>
            </div>

            <div className="grid gap-2 rounded-xl border border-white/[0.06] bg-black/20 p-3 sm:grid-cols-[1fr_auto_auto]">
              <input
                placeholder="Ex: 3412,00"
                inputMode="decimal"
                value={rawValue}
                onChange={(e) =>
                  setReadingValue((prev) => ({
                    ...prev,
                    [account.id]: sanitizeAmountInput(e.target.value),
                  }))
                }
                className="field"
              />
              <input
                type="datetime-local"
                value={readingDate[account.id] ?? ''}
                onChange={(e) =>
                  setReadingDate((prev) => ({ ...prev, [account.id]: e.target.value }))
                }
                className="field"
              />
              <button
                onClick={() => handleAddReading(account.id)}
                className="btn-primary whitespace-nowrap"
              >
                Lançar leitura
              </button>
            </div>

            {preview != null && (
              <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
                {preview === 0
                  ? 'Bate certinho com a projeção anterior.'
                  : `${formatBRL(Math.abs(preview))} ${preview > 0 ? 'a mais' : 'a menos'} do que a projeção anterior previa — fora do radar desde a última leitura.`}
              </p>
            )}

            {history.length > 0 && (
              <div className="grid gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setOpenHistory((prev) => ({ ...prev, [account.id]: !historyOpen }))
                  }
                  className="flex items-center justify-between gap-2 rounded-lg px-1 py-1 text-left transition hover:bg-white/5"
                >
                  <span className="text-zinc-400 text-xs">
                    Histórico de leituras ({history.length})
                  </span>
                  <span
                    className={`text-zinc-500 text-xs shrink-0 transition-transform ${historyOpen ? 'rotate-180' : ''}`}
                  >
                    ▾
                  </span>
                </button>

                {historyOpen &&
                  history.map((r) => (
                    <div
                      key={r.id}
                      className="surface-row flex flex-col gap-1.5 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="text-zinc-400 text-xs shrink-0">
                        {new Date(r.read_at).toLocaleDateString('pt-BR')}
                      </span>
                      <div className="flex items-center justify-between gap-2 sm:justify-end">
                        <span className="text-white text-sm font-bold">
                          {formatBRL(Number(r.amount))}
                        </span>
                        <button
                          onClick={() => handleDeleteReading(r.id)}
                          className="btn-ghost text-red-400 hover:text-red-300 shrink-0"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        );
      })}

      {selected && (
        <EditAccountModal
          account={selected}
          onClose={() => setSelected(null)}
          onUpdated={onUpdated}
        />
      )}
    </div>
  );
}
