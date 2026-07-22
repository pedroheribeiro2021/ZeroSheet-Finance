'use client';

import { useState } from 'react';

import { createTransfer } from '@/core/services/transfer.service';
import { parseCurrencyInput, sanitizeAmountInput, formatBRL } from '@/core/utils/number';
import { useToast } from '@/components/ui/ToastProvider';
import { DBAccount } from '@/core/types/database';
import { TransferKind } from '@/core/types/finance';
import { PendingReturn } from '@/core/engine/accounts';

type Props = {
  accounts: DBAccount[];
  openComplements: PendingReturn[];
  onCreated?: () => void;
};

const KIND_LABEL: Record<TransferKind, string> = {
  complemento: 'Complemento (empréstimo entre contas)',
  devolucao: 'Devolução',
  movimentacao: 'Movimentação comum',
};

export default function TransferForm({ accounts, openComplements, onCreated }: Props) {
  const { showToast } = useToast();

  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [kind, setKind] = useState<TransferKind>('movimentacao');
  const [linkedComplementId, setLinkedComplementId] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');

  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? '?';

  const handleSelectComplement = (complementId: string) => {
    setLinkedComplementId(complementId);

    const pending = openComplements.find((c) => c.complementId === complementId);
    if (!pending) return;

    setFromAccountId(pending.holdingAccountId);
    setToAccountId(pending.toAccountId);
    setAmount(String(pending.amount).replace('.', ','));
  };

  const handleSubmit = async () => {
    try {
      if (!fromAccountId || !toAccountId || !amount) return;
      if (fromAccountId === toAccountId) {
        showToast('Origem e destino precisam ser contas diferentes', 'error');
        return;
      }

      await createTransfer({
        fromAccountId,
        toAccountId,
        amount: parseCurrencyInput(amount),
        kind,
        linkedTransferId: kind === 'devolucao' ? linkedComplementId || null : null,
        note: note || null,
        transferredAt: date || undefined,
      });

      setFromAccountId('');
      setToAccountId('');
      setAmount('');
      setKind('movimentacao');
      setLinkedComplementId('');
      setNote('');
      setDate('');

      showToast('Transferência lançada com sucesso');
      onCreated?.();
    } catch (err) {
      console.error(err);
      showToast('Erro ao lançar transferência', 'error');
    }
  };

  return (
    <div className="surface grid gap-3 p-4 sm:p-5">
      <h2 className="text-white font-bold">Nova Transferência</h2>

      <label className="field-label">
        Tipo
        <select
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as TransferKind);
            setLinkedComplementId('');
          }}
          className="field"
        >
          {(Object.keys(KIND_LABEL) as TransferKind[]).map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
      </label>

      {kind === 'devolucao' && (
        <label className="field-label">
          Vincular a um complemento em aberto
          {openComplements.length === 0 ? (
            <p className="text-zinc-500 text-xs">Nenhum complemento em aberto no momento.</p>
          ) : (
            <select
              value={linkedComplementId}
              onChange={(e) => handleSelectComplement(e.target.value)}
              className="field"
            >
              <option value="">Selecione…</option>
              {openComplements.map((c) => (
                <option key={c.complementId} value={c.complementId}>
                  {accountName(c.holdingAccountId)} → {accountName(c.toAccountId)} · falta{' '}
                  {formatBRL(c.amount)}
                </option>
              ))}
            </select>
          )}
        </label>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="field-label">
          Origem
          <select
            value={fromAccountId}
            onChange={(e) => setFromAccountId(e.target.value)}
            className="field"
          >
            <option value="">Selecione…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field-label">
          Destino
          <select
            value={toAccountId}
            onChange={(e) => setToAccountId(e.target.value)}
            className="field"
          >
            <option value="">Selecione…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="field-label">
          Valor
          <input
            placeholder="Ex: 1055,48"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(sanitizeAmountInput(e.target.value))}
            className="field"
          />
        </label>

        <label className="field-label">
          Data
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="field"
          />
        </label>
      </div>

      <label className="field-label">
        Observação
        <input
          placeholder="Ex: pagar fatura antes do salário"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="field"
        />
      </label>

      <button onClick={handleSubmit} className="btn-primary">
        Salvar Transferência
      </button>
    </div>
  );
}
