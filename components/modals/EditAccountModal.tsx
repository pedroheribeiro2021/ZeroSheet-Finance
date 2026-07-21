'use client';

import { useState } from 'react';

import { updateAccount } from '@/core/services/account.service';
import { useToast } from '@/components/ui/ToastProvider';
import Modal from '@/components/ui/Modal';
import { DBAccount } from '@/core/types/database';
import { AccountKind } from '@/core/types/finance';

type Props = {
  account: DBAccount;
  onClose: () => void;
  onUpdated?: () => void;
};

export default function EditAccountModal({ account, onClose, onUpdated }: Props) {
  const { showToast } = useToast();

  const [name, setName] = useState(account.name);
  const [kind, setKind] = useState<AccountKind>(account.kind);
  const [color, setColor] = useState(account.color ?? '#2563eb');

  const handleSave = async () => {
    try {
      await updateAccount(account.id, { name, kind, color });

      showToast('Conta atualizada com sucesso');
      onUpdated?.();
      onClose();
    } catch (err) {
      console.error(err);
      showToast('Erro ao atualizar conta', 'error');
    }
  };

  return (
    <Modal open onClose={onClose} title="Editar Conta">
      <div className="grid gap-3">
        <label className="field-label">
          Nome da conta
          <input
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

        <div className="flex gap-2 mt-2">
          <button onClick={handleSave} className="btn-success flex-1">
            Salvar
          </button>

          <button onClick={onClose} className="btn-secondary flex-1">
            Cancelar
          </button>
        </div>
      </div>
    </Modal>
  );
}
