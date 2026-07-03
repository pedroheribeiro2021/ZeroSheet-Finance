-- Nome/descrição do lançamento, separado da categoria.
-- Ex.: description='Claude', category='Assinaturas'.
-- APLICADA EM PRODUÇÃO em 2026-07-03 (via MCP).
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS description text NULL;
