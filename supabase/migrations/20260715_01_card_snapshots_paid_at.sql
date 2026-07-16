-- Controle de vencimento da fatura do cartão: marca se/quando a fatura do
-- mês foi paga. NULL = não paga. Mesma semântica de transactions.paid_at
-- (20260710_01), aplicada ao snapshot da fatura em vez de uma transação.
-- APLICADA EM PRODUÇÃO em 2026-07-15 (via MCP).

ALTER TABLE public.card_snapshots
  ADD COLUMN IF NOT EXISTS paid_at timestamptz NULL;
