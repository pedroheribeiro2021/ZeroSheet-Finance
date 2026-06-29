-- Item C do loop semanal: leituras parciais da fatura (acompanhamento semanal).
-- Cada linha representa o valor acumulado da fatura num determinado momento.
-- NÃO é card_snapshots (fatura fechada do mês) — são leituras no meio do ciclo.

CREATE TABLE IF NOT EXISTS public.card_readings (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL,
  month_id    uuid        REFERENCES public.months(id)  ON DELETE CASCADE,
  card_id     uuid        REFERENCES public.cards(id)   ON DELETE CASCADE,
  amount      numeric     NOT NULL DEFAULT 0,
  read_at     timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz DEFAULT now()
);

-- RLS: dono da linha (user_id = auth.uid()) lê e escreve; ninguém mais.
ALTER TABLE public.card_readings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS card_readings_owner ON public.card_readings;
CREATE POLICY card_readings_owner ON public.card_readings
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
