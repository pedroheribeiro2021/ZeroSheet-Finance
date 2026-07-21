'use client';

import { useEffect, useState } from 'react';

import AccountForm from '@/components/accounts/AccountForm';
import AccountList from '@/components/accounts/AccountList';
import TransferForm from '@/components/accounts/TransferForm';
import TransferList from '@/components/accounts/TransferList';
import PageLoading from '@/components/ui/PageLoading';

import { getMonths, createMonth } from '@/core/services/month.service';
import { getTransactions } from '@/core/services/transaction.service';
import { getCards } from '@/core/services/card.service';
import { getCardSnapshots } from '@/core/services/cardSnapshot.service';
import { getAccounts, getAccountReadings } from '@/core/services/account.service';
import { getTransfers } from '@/core/services/transfer.service';

import { mapTransaction, mapAccountReading, mapTransfer } from '@/core/models/mappers';
import {
  latestReadingByAccount,
  openBillsFromTransactions,
  openInvoicesFromSnapshots,
  pendingReturns,
  projectBalance,
} from '@/core/engine/accounts';
import { DBAccount, DBAccountReading, DBTransfer } from '@/core/types/database';

export default function AccountsPage() {
  const [monthId, setMonthId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<DBAccount[]>([]);
  const [readings, setReadings] = useState<DBAccountReading[]>([]);
  const [transfers, setTransfers] = useState<DBTransfer[]>([]);
  const [projectedByAccount, setProjectedByAccount] = useState<Map<string, number>>(new Map());

  const load = async () => {
    try {
      let monthsData = await getMonths();

      if (!monthsData.length) {
        const now = new Date();
        const newMonth = await createMonth(now.getMonth() + 1, now.getFullYear());
        monthsData = [newMonth];
      }

      const latestMonth = monthsData[monthsData.length - 1];
      setMonthId(latestMonth.id);

      const [accountsData, readingsData, transfersData, cardsData, snapshotsData, transactionsData] =
        await Promise.all([
          getAccounts(),
          getAccountReadings(),
          getTransfers(),
          getCards(),
          getCardSnapshots(latestMonth.id),
          getTransactions(latestMonth.id),
        ]);

      setAccounts(accountsData);
      setReadings(readingsData);
      setTransfers(transfersData);

      const transactionsMapped = transactionsData.map(mapTransaction);
      const transfersMapped = transfersData.map(mapTransfer);
      const readingsMapped = readingsData.map(mapAccountReading);

      const latestByAccount = latestReadingByAccount(readingsMapped);
      const pending = pendingReturns(transfersMapped);
      const openBills = openBillsFromTransactions(transactionsMapped);
      const openInvoices = openInvoicesFromSnapshots(cardsData, snapshotsData);

      const nameById = new Map(accountsData.map((a) => [a.id, a.name]));

      const projected = new Map<string, number>();
      for (const account of accountsData) {
        const latest = latestByAccount.get(account.id);
        if (!latest) continue;

        const returnsForAccount = pending
          .filter((p) => p.holdingAccountId === account.id)
          .map((p) => ({
            label: `Devolver p/ ${nameById.get(p.toAccountId) ?? '?'}`,
            amount: p.amount,
          }));

        const result = projectBalance({
          reading: { label: account.name, amount: latest.amount },
          openBills: account.is_payment_default ? openBills : [],
          openInvoices: account.is_payment_default ? openInvoices : [],
          pendingReturns: returnsForAccount,
        });

        projected.set(account.id, result.projected);
      }

      setProjectedByAccount(projected);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  if (!monthId) {
    return <PageLoading />;
  }

  const transfersMapped = transfers.map(mapTransfer);
  const openComplements = pendingReturns(transfersMapped);

  return (
    <div className="grid gap-4 p-4 sm:gap-5 sm:p-6">
      <h1 className="text-xl font-bold text-white sm:text-2xl">Contas</h1>

      <AccountForm onCreated={load} />

      <AccountList
        accounts={accounts}
        readings={readings}
        projectedByAccount={projectedByAccount}
        onUpdated={load}
      />

      <TransferForm accounts={accounts} openComplements={openComplements} onCreated={load} />

      <TransferList
        transfers={transfers}
        accounts={accounts}
        openComplements={openComplements}
        onUpdated={load}
      />
    </div>
  );
}
