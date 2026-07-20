-- "Pausar este mês": lançamento recorrente que NÃO conta neste mês, mas
-- continua na lista (pausado) e volta ativo na cópia para o mês seguinte —
-- copyRecurringTransactions não propaga a coluna, então o novo mês nasce
-- com skipped = false. Excluir o lançamento quebraria a corrente da
-- recorrência (a cópia é sempre mês a mês).

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS skipped boolean NOT NULL DEFAULT false;
