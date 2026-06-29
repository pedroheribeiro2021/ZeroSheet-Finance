-- Flags de paridade com a planilha (Items 2 e 3 do PARIDADE-PLANILHA).
-- is_reimbursement: receita que não soma no total (ex.: reembolso de despesa).
-- is_reserve: reserva/poupança — abate o total mas separada de custos fixos.

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS is_reimbursement boolean DEFAULT false;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS is_reserve boolean DEFAULT false;

-- Após aplicar, marcar dados históricos já importados (junho/2026):
--
--   UPDATE public.transactions
--     SET is_reimbursement = true
--     WHERE category = 'Extras/Reembolsos' AND type = 'income';
--
--   UPDATE public.transactions
--     SET is_reserve = true
--     WHERE category = 'Reserva' AND type = 'expense';
--
-- Esses UPDATEs fecham junho em −39,17 e separam a Reserva de julho.
-- Rodar só UMA VEZ depois da migration, manualmente no Supabase SQL Editor.
