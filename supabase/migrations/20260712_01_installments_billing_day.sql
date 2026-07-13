-- Dia do mês em que a parcela é lançada na fatura do cartão (1-31).
-- Usado para excluir o valor da parcela do "gasto da semana" no
-- acompanhamento semanal (delta de card_readings) quando ela cai dentro do
-- ciclo vigente — evita contar como gasto livre algo que já é compromisso
-- fixo (mesmo raciocínio do due_day em transactions). NULL = sem data
-- definida (a parcela continua entrando no delta bruto até ser preenchida).

ALTER TABLE public.installments
  ADD COLUMN IF NOT EXISTS billing_day integer NULL;

-- Seguro aplicar múltiplas vezes: só cria a constraint se ainda não existir.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'installments_billing_day_range'
  ) THEN
    ALTER TABLE public.installments
      ADD CONSTRAINT installments_billing_day_range
      CHECK (billing_day IS NULL OR (billing_day BETWEEN 1 AND 31));
  END IF;
END $$;
