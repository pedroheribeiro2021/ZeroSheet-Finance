-- Índice único parcial (month_id, category) WHERE is_recurring impedia
-- múltiplas assinaturas recorrentes da mesma categoria no mesmo mês
-- (ex.: Claude e TotalPass, ambas 'Assinaturas'). A distinção agora é
-- feita pela coluna description.
-- APLICADA EM PRODUÇÃO em 2026-07-03 (via MCP).
DROP INDEX IF EXISTS public.unique_recurring_transaction;
