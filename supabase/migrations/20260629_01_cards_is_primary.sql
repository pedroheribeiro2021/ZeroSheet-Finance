-- Item A do loop semanal: cartão principal por usuário.
-- Garante no máximo um principal por usuário via índice único parcial.
-- Seguro aplicar múltiplas vezes (IF NOT EXISTS em tudo).

ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false;

-- Índice único parcial: só indexa linhas WHERE is_primary, portanto
-- só pode existir um registro is_primary = true por user_id.
CREATE UNIQUE INDEX IF NOT EXISTS cards_one_primary_per_user
  ON public.cards (user_id)
  WHERE is_primary;
