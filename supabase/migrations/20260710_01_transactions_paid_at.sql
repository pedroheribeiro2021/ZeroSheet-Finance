-- Controle de vencimento das despesas fixas: marca se/quando o vencimento
-- do mês foi pago. NULL = não pago. Coluna nova (não reaproveita nenhuma
-- flag existente — is_fixed/is_provision/is_recurring têm semântica própria).
-- NÃO APLICADA EM PRODUÇÃO — aguardando confirmação.

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS paid_at timestamptz NULL;
