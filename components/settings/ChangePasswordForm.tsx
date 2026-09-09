'use client';

import { useState } from 'react';

import { useToast } from '@/components/ui/ToastProvider';
import { supabase } from '@/lib/supabase';

const MIN_LENGTH = 6;

export default function ChangePasswordForm() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const handleSave = async () => {
    if (newPassword.length < MIN_LENGTH) {
      showToast(`A senha precisa ter pelo menos ${MIN_LENGTH} caracteres`, 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast('As senhas não coincidem', 'error');
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setNewPassword('');
      setConfirmPassword('');
      showToast('Senha alterada com sucesso');
    } catch (err) {
      console.error(err);
      showToast(
        err instanceof Error ? err.message : 'Erro ao alterar senha',
        'error',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="surface grid gap-4 p-4 sm:p-5">
      <div>
        <h2 className="font-bold text-white">Alterar senha</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Você precisa estar logado para trocar a senha aqui. Esqueceu a senha
          atual? Saia e use &quot;Esqueci minha senha&quot; na tela de login.
        </p>
      </div>

      <label className="field-label">
        Nova senha
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="field"
        />
      </label>

      <label className="field-label">
        Confirmar nova senha
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          className="field"
        />
      </label>

      <button onClick={handleSave} disabled={saving} className="btn-primary">
        {saving ? 'Salvando…' : 'Salvar nova senha'}
      </button>
    </div>
  );
}
