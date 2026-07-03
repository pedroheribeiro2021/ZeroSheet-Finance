-- Duração da recorrência: NULL = repete indefinidamente.
-- Preenchido = última competência (primeiro dia do mês) em que a transação
-- ainda deve ser copiada ao criar um novo mês.
-- APLICADA EM PRODUÇÃO em 2026-07-03 (via MCP).
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS recurring_until date NULL;
