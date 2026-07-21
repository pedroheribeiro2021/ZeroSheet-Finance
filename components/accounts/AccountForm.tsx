'use client';

import { useState } from 'react';

import { createAccount } from '@/core/services/account.service';
import { useToast } from '@/components/ui/ToastProvider';
import { AccountKind } from '@/core/types/finance';

export default function AccountForm({ onCreated }: { onCreated?: () => void }) {
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [kind, setKind] = useState<AccountKind>('corrente');
  const [color, setColor] = useState('#2563eb');

  const handleSubmit = async () => {
    try {
      if (!name) return;

      await createAccount({ name, kind, color });

      setName('');
      setKind('corrente');
      setColor('#2563eb');

      showToast('Conta criada com sucesso');
      onCreated?.();
    } catch (err) {
      console.error(err);
      showToast('Erro ao criar conta', 'error');
    }
  };

  return (
    <div className="surface grid gap-3 p-4 sm:p-5">
      <h2 className="text-white font-bold">Nova Conta</h2>

      <label className="field-label">
        Nome da conta
        <input
          placeholder="Ex: C6 Corrente"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="field"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="field-label">
          Tipo
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as AccountKind)}
            className="field"
          >
            <option value="corrente">Corrente</option>
            <option value="guardado">Guardado</option>
          </select>
        </label>

        <label className="field-label">
          Cor
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-11 w-full rounded-xl border border-zinc-700/80 bg-zinc-800/80 p-1"
          />
        </label>
      </div>

      <button onClick={handleSubmit} className="btn-primary">
        Salvar Conta
      </button>
    </div>
  );
}
