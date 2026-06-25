-- Remove CHECK legado que restringia transactions.card aos slugs hardcoded ('nubank', 'c6').
-- A tabela `cards` agora é dinâmica por usuário; o campo card em transactions
-- não é preenchido pela UI atual mas precisa estar livre para receber card_id (uuid) no futuro.
ALTER TABLE public.transactions DROP CONSTRAINT transactions_card_check;

-- Limpa os registros legados que tinham slugs do sistema antigo.
UPDATE public.transactions SET card = NULL WHERE card IN ('nubank', 'c6');
