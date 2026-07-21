-- Transferências entre contas próprias. NÃO é receita nem despesa — não
-- entra em calculateSummary, só afeta a visão de Contas.
--
-- kind:
--   complemento  = empréstimo entre contas próprias (gera pendência de devolução)
--   devolucao    = quita (total ou parcialmente) um complemento, via linked_transfer_id
--   movimentacao = transferência comum, sem pendência

CREATE TABLE public.transfers (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_account_id     uuid        NOT NULL REFERENCES public.accounts(id),
  to_account_id       uuid        NOT NULL REFERENCES public.accounts(id),
  amount              numeric     NOT NULL CHECK (amount > 0),
  kind                text        NOT NULL CHECK (kind IN ('complemento', 'devolucao', 'movimentacao')),
  linked_transfer_id  uuid        NULL REFERENCES public.transfers(id),
  note                text        NULL,
  transferred_at      date        NOT NULL DEFAULT current_date,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- RLS: dono da linha (user_id = auth.uid()) lê e escreve; ninguém mais.
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS transfers_owner ON public.transfers;
CREATE POLICY transfers_owner ON public.transfers
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
