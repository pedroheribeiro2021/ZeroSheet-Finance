-- Contas bancárias com saldo informado manualmente (como já se faz com a
-- leitura de fatura) e o histórico de leituras de saldo por conta.
-- Finalidade: projetar o saldo livre no dashboard sem precisar abrir o app
-- do banco.

CREATE TABLE public.accounts (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                 text        NOT NULL,
  kind                 text        NOT NULL CHECK (kind IN ('corrente', 'guardado')),
  color                text        NULL,
  -- conta de onde saem os pagamentos por padrão (projeção do dashboard)
  is_payment_default   boolean     NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.account_readings (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id  uuid        NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  amount      numeric     NOT NULL,
  read_at     timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- RLS: dono da linha (user_id = auth.uid()) lê e escreve; ninguém mais.
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS accounts_owner ON public.accounts;
CREATE POLICY accounts_owner ON public.accounts
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.account_readings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_readings_owner ON public.account_readings;
CREATE POLICY account_readings_owner ON public.account_readings
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
