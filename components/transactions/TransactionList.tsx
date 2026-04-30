import { Transaction } from '@/core/types/finance';

export default function TransactionList({
  transactions,
}: {
  transactions: Transaction[];
}) {
  return (
    <div className="bg-zinc-900 p-4 rounded-2xl">
      <h2 className="text-white font-bold mb-2">Transações</h2>

      {transactions.map((t) => (
        <div
          key={t.id}
          className="flex justify-between text-white border-b border-zinc-800 py-2"
        >
          <span>{t.category}</span>
          <span>
            {t.type === 'income' ? '+' : '-'} R$ {t.amount}
          </span>
        </div>
      ))}
    </div>
  );
}
