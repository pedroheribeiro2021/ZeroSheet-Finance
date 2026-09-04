'use client';

import { useEffect, useState } from 'react';

import PaydayForm from '@/components/settings/PaydayForm';
import PageLoading from '@/components/ui/PageLoading';
import { PaydaySettings } from '@/core/engine/payday';
import {
  getUserSettings,
  toPaydaySettings,
} from '@/core/services/settings.service';

export default function SettingsView() {
  const [loading, setLoading] = useState(true);
  const [payday, setPayday] = useState<PaydaySettings | null>(null);
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const row = await getUserSettings();
        const settings = toPaydaySettings(row);

        setPayday(settings);
        setConfigured(!!settings);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <PageLoading />;

  return (
    <div className="grid gap-4 p-4 sm:gap-5 sm:p-6">
      <h1 className="text-xl font-bold text-white sm:text-2xl">Configurações</h1>

      <PaydayForm
        initial={payday}
        configured={configured}
        onSaved={(settings) => {
          setPayday(settings);
          setConfigured(true);
        }}
      />
    </div>
  );
}
